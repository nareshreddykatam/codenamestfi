import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Room, InternalGameState } from './types';
import { Player } from '../src/types/multiplayer';

type PersistedGameState = Omit<
  InternalGameState,
  'timerIntervalId'
>;

interface PersistedRoomState {
  roomCode: string;
  hostId: string;
  players: Player[];
  sessions: Array<[string, string]>;
  redLocked: boolean;
  blueLocked: boolean;
  settings: Room['settings'];
  isGameStarted: boolean;
  isGamePaused: boolean;
  pauseReason?: string;
  gameState: PersistedGameState | null;
  createdAt: number;
}

interface RoomRow {
  room_code: string;
  host_player_id: string;
  status: string;
  settings: Room['settings'];
  state: PersistedRoomState;
  created_at: string;
  updated_at: string;
}

export class RoomPersistence {
  private client: SupabaseClient | null = null;
  private enabled = false;
  private required = false;

  /*
   * Keeps database writes ordered per room.
   *
   * Without this, two quick game actions could result
   * in an older snapshot reaching Supabase after a newer
   * snapshot.
   */
  private saveQueues = new Map<
    string,
    Promise<void>
  >();

  constructor() {
    this.required =
      process.env.REQUIRE_SUPABASE === 'true';

    const supabaseUrl =
      process.env.SUPABASE_URL?.trim();

    const secretKey =
      process.env.SUPABASE_SECRET_KEY?.trim();

    if (!supabaseUrl || !secretKey) {
      return;
    }

    this.client = createClient(
      supabaseUrl,
      secretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    this.enabled = true;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async initialize(): Promise<Room[]> {
    if (!this.enabled || !this.client) {
      if (this.required) {
        throw new Error(
          'Supabase persistence is required, but SUPABASE_URL or SUPABASE_SECRET_KEY is missing.'
        );
      }

      console.warn(
        '[Persistence] Supabase is not configured. Running in memory-only mode.'
      );

      return [];
    }

    const ttlMinutes = Number(
      process.env.ROOM_PERSISTENCE_TTL_MINUTES || '1440'
    );

    const safeTtlMinutes =
      Number.isFinite(ttlMinutes) &&
      ttlMinutes > 0
        ? ttlMinutes
        : 1440;

    const cutoff = new Date(
      Date.now() -
        safeTtlMinutes * 60 * 1000
    ).toISOString();

    const {
      data,
      error,
    } = await this.client
      .from('rooms')
      .select(
        'room_code,host_player_id,status,settings,state,created_at,updated_at'
      )
      .gte('updated_at', cutoff)
      .order('updated_at', {
        ascending: false,
      });

    if (error) {
      if (this.required) {
        throw new Error(
          `Supabase room restore failed: ${error.message}`
        );
      }

      console.error(
        '[Persistence] Failed to restore rooms:',
        error.message
      );

      return [];
    }

    const rooms: Room[] = [];

    for (const row of (data || []) as RoomRow[]) {
      try {
        rooms.push(
          this.deserializeRoom(row.state)
        );
      } catch (error) {
        console.error(
          `[Persistence] Failed to restore room ${row.room_code}:`,
          error
        );
      }
    }

    return rooms;
  }

  public saveRoom(room: Room): Promise<void> {
    if (!this.enabled || !this.client) {
      return Promise.resolve();
    }

    const snapshot =
      this.serializeRoom(room);

    const previous =
      this.saveQueues.get(
        room.roomCode
      ) || Promise.resolve();

    const next = previous
      .catch(() => undefined)
      .then(() =>
        this.writeRoom(snapshot)
      );

    this.saveQueues.set(
      room.roomCode,
      next
    );

    next.then(
      () => {
        if (
          this.saveQueues.get(
            room.roomCode
          ) === next
        ) {
          this.saveQueues.delete(
            room.roomCode
          );
        }
      },
      () => {
        if (
          this.saveQueues.get(
            room.roomCode
          ) === next
        ) {
          this.saveQueues.delete(
            room.roomCode
          );
        }
      }
    );

    return next;
  }

  public deleteRoom(
    roomCode: string
  ): Promise<void> {
    if (!this.enabled || !this.client) {
      return Promise.resolve();
    }

    const previous =
      this.saveQueues.get(
        roomCode
      ) || Promise.resolve();

    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const {
          error,
        } = await this.client!
          .from('rooms')
          .delete()
          .eq(
            'room_code',
            roomCode
          );

        if (error) {
          throw new Error(
            `Failed to delete room ${roomCode}: ${error.message}`
          );
        }
      });

    this.saveQueues.set(
      roomCode,
      next
    );

    next.then(
      () => {
        if (
          this.saveQueues.get(
            roomCode
          ) === next
        ) {
          this.saveQueues.delete(
            roomCode
          );
        }
      },
      () => {
        if (
          this.saveQueues.get(
            roomCode
          ) === next
        ) {
          this.saveQueues.delete(
            roomCode
          );
        }
      }
    );

    return next;
  }

  private async writeRoom(
    snapshot: PersistedRoomState
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    const status =
      snapshot.isGameStarted
        ? snapshot.isGamePaused
          ? 'PAUSED'
          : snapshot.gameState?.phase ===
            'GAME_OVER'
          ? 'GAME_OVER'
          : 'IN_PROGRESS'
        : 'LOBBY';

    const {
      error,
    } = await this.client
      .from('rooms')
      .upsert(
        {
          room_code:
            snapshot.roomCode,

          host_player_id:
            snapshot.hostId,

          status,

          settings:
            snapshot.settings,

          state:
            snapshot,

          created_at:
            new Date(
              snapshot.createdAt
            ).toISOString(),

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            'room_code',
        }
      );

    if (error) {
      throw new Error(
        `Failed to persist room ${snapshot.roomCode}: ${error.message}`
      );
    }
  }

  private serializeRoom(
    room: Room
  ): PersistedRoomState {
    let gameState:
      | PersistedGameState
      | null = null;

    if (room.gameState) {
      gameState = {
        cards: room.gameState.cards,
        startingTeam:
          room.gameState.startingTeam,
        currentTeam:
          room.gameState.currentTeam,
        phase:
          room.gameState.phase,
        currentClue:
          room.gameState.currentClue,
        guessesRemaining:
          room.gameState.guessesRemaining,
        remainingRed:
          room.gameState.remainingRed,
        remainingBlue:
          room.gameState.remainingBlue,
        winner:
          room.gameState.winner,
        winReason:
          room.gameState.winReason,
        turnTimerEnd:
          room.gameState.turnTimerEnd,
        logs:
          room.gameState.logs,
        clueHistory:
          room.gameState.clueHistory,
      };
    }

    return {
      roomCode:
        room.roomCode,

      hostId:
        room.hostId,

      players:
        Array.from(
          room.players.values()
        ),

      sessions:
        Array.from(
          room.sessions.entries()
        ),

      redLocked:
        room.redLocked,

      blueLocked:
        room.blueLocked,

      settings:
        room.settings,

      isGameStarted:
        room.isGameStarted,

      isGamePaused:
        room.isGamePaused,

      pauseReason:
        room.pauseReason,

      gameState,

      createdAt:
        room.createdAt,
    };
  }

  private deserializeRoom(
    state: PersistedRoomState
  ): Room {
    const players =
      new Map<string, Player>();

    for (const player of
      state.players || []) {
      players.set(
        player.id,
        player
      );
    }

    const sessions =
      new Map<string, string>(
        state.sessions || []
      );

    const gameState =
      state.gameState
        ? {
            ...state.gameState,
            timerIntervalId:
              undefined,
          }
        : null;

    return {
      roomCode:
        state.roomCode,

      hostId:
        state.hostId,

      players,

      sessions,

      redLocked:
        state.redLocked,

      blueLocked:
        state.blueLocked,

      settings:
        state.settings,

      isGameStarted:
        state.isGameStarted,

      isGamePaused:
        state.isGamePaused,

      pauseReason:
        state.pauseReason,

      gameState,

      createdAt:
        state.createdAt,

      disconnectCleanups:
        new Map(),
    };
  }
}