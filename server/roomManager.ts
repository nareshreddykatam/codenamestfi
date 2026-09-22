import { Room } from './types';
import { Player, RoomSettings, LobbyState, ReadinessCheck, PlayerTeam, PlayerRole } from '../src/types/multiplayer';
import { generateBoard } from '../src/game/boardGenerator';
import { GameLogEntry } from '../src/types/game';
import { RoomPersistence } from './persistence';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  private persistence =
    new RoomPersistence();

  /**
   * Restore persisted rooms when the server starts.
   */
  public async initialize(): Promise<void> {
    const restoredRooms =
      await this.persistence.initialize();

    for (const room of restoredRooms) {
      /*
       * Every socket was destroyed when the old
       * server process stopped, so every restored
       * player starts disconnected.
       */
      for (const player of
        room.players.values()) {
        player.isConnected = false;

        this.scheduleDisconnectCleanup(
          room,
          player.id
        );
      }

      /*
       * If a game was active when the server
       * restarted, pause it until both Spymasters
       * reconnect.
       */
      if (room.isGameStarted) {
        room.isGamePaused = true;

        room.pauseReason =
          'Server restarted. Waiting for players to reconnect...';

        /*
         * A running timer cannot survive a server
         * restart.
         */
        if (room.gameState) {
          room.gameState.turnTimerEnd =
            undefined;
        }
      }

      this.rooms.set(
        room.roomCode,
        room
      );

      this.persistRoom(room);
    }

    console.log(
      `[RoomManager] Restored ${restoredRooms.length} room(s).`
    );
  }

  /**
   * Returns whether Supabase persistence
   * is currently enabled.
   */
  public isPersistenceEnabled(): boolean {
    return this.persistence.isEnabled();
  }

  /**
   * Persist a room without blocking the
   * WebSocket request.
   */
  public persistRoom(room: Room): void {
    void this.persistence
      .saveRoom(room)
      .catch((error) => {
        console.error(
          `[RoomManager] Failed to persist room ${room.roomCode}:`,
          error
        );
      });
  }

  /**
   * Generates a 6-character uppercase
   * alphanumeric room code.
   */
  public generateRoomCode(): string {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    let code = '';
    let attempts = 0;

    do {
      code = '';

      for (let i = 0; i < 6; i++) {
        code += chars.charAt(
          Math.floor(
            Math.random() *
              chars.length
          )
        );
      }

      attempts++;
    } while (
      this.rooms.has(code) &&
      attempts < 100
    );

    return code;
  }

  public getRoom(
    roomCode: string
  ): Room | undefined {
    return this.rooms.get(
      roomCode
        .toUpperCase()
        .trim()
    );
  }

  public createRoom(
    hostName: string,
    sessionToken: string
  ): {
    room: Room;
    player: Player;
  } {
    const cleanName =
      hostName.trim();

    if (!cleanName) {
      throw new Error(
        'Player name cannot be empty'
      );
    }

    const roomCode =
      this.generateRoomCode();

    const hostId =
      `player-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 7)}`;

    const hostPlayer: Player = {
      id: hostId,
      name: cleanName,
      team: null,
      role: null,
      isHost: true,
      isConnected: true,
      joinedAt: Date.now(),
    };

    const playersMap =
      new Map<string, Player>();

    playersMap.set(
      hostId,
      hostPlayer
    );

    const sessionsMap =
      new Map<string, string>();

    sessionsMap.set(
      sessionToken,
      hostId
    );

    const defaultSettings:
      RoomSettings = {
        turnTimerSeconds: 0,
        unlimitedClues: true,
        allowSpectators: true,
      };

    const room: Room = {
      roomCode,
      hostId,

      players:
        playersMap,

      sessions:
        sessionsMap,

      redLocked: false,
      blueLocked: false,

      settings:
        defaultSettings,

      isGameStarted:
        false,

      isGamePaused:
        false,

      gameState:
        null,

      createdAt:
        Date.now(),

      disconnectCleanups:
        new Map(),
    };

    this.rooms.set(
      roomCode,
      room
    );

    this.persistRoom(room);

    return {
      room,
      player: hostPlayer,
    };
  }

  public joinRoom(
    roomCode: string,
    playerName: string,
    sessionToken: string
  ): {
    room: Room;
    player: Player;
    isReconnection: boolean;
  } {
    const code =
      roomCode
        .toUpperCase()
        .trim();

    const room =
      this.rooms.get(code);

    if (!room) {
      throw new Error(
        'Room not found.'
      );
    }

    /*
     * Existing session = reconnection.
     */
    const existingPlayerId =
      room.sessions.get(
        sessionToken
      );

    if (
      existingPlayerId &&
      room.players.has(
        existingPlayerId
      )
    ) {
      const existingPlayer =
        room.players.get(
          existingPlayerId
        )!;

      existingPlayer.isConnected =
        true;

      const timeout =
        room.disconnectCleanups.get(
          existingPlayerId
        );

      if (timeout) {
        clearTimeout(timeout);

        room.disconnectCleanups.delete(
          existingPlayerId
        );
      }

      /*
       * Resume only when BOTH team Spymasters
       * are connected.
       */
      if (
        room.isGamePaused &&
        room.isGameStarted
      ) {
        const redSpymasterConnected =
          Array.from(
            room.players.values()
          ).some(
            (player) =>
              player.team === 'RED' &&
              player.role === 'SPYMASTER' &&
              player.isConnected
          );

        const blueSpymasterConnected =
          Array.from(
            room.players.values()
          ).some(
            (player) =>
              player.team === 'BLUE' &&
              player.role === 'SPYMASTER' &&
              player.isConnected
          );

        if (
          redSpymasterConnected &&
          blueSpymasterConnected
        ) {
          room.isGamePaused =
            false;

          room.pauseReason =
            undefined;
        }
      }

      this.persistRoom(room);

      return {
        room,
        player:
          existingPlayer,
        isReconnection:
          true,
      };
    }

    const cleanName =
      playerName.trim();

    if (!cleanName) {
      throw new Error(
        'Player name cannot be empty'
      );
    }

    /*
     * Prevent duplicate connected
     * player names.
     */
    const duplicate =
      Array.from(
        room.players.values()
      ).some(
        (player) =>
          player.name.toLowerCase() ===
            cleanName.toLowerCase() &&
          player.isConnected
      );

    if (duplicate) {
      throw new Error(
        `A player named "${cleanName}" is already in this room. Please pick a different name.`
      );
    }

    const newPlayerId =
      `player-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 7)}`;

    const newPlayer: Player = {
      id: newPlayerId,
      name: cleanName,
      team: null,
      role: null,
      isHost: false,
      isConnected: true,
      joinedAt: Date.now(),
    };

    room.players.set(
      newPlayerId,
      newPlayer
    );

    room.sessions.set(
      sessionToken,
      newPlayerId
    );

    this.persistRoom(room);

    return {
      room,
      player: newPlayer,
      isReconnection:
        false,
    };
  }

  public selectTeamRole(
    roomCode: string,
    playerId: string,
    team: PlayerTeam,
    role: PlayerRole
  ): Room {
    const room =
      this.getRoom(roomCode);

    if (!room) {
      throw new Error(
        'Room not found'
      );
    }

    const player =
      room.players.get(
        playerId
      );

    if (!player) {
      throw new Error(
        'Player not found'
      );
    }

    if (room.isGameStarted) {
      throw new Error(
        'Game is already in progress. Roles cannot be changed.'
      );
    }

    if (
      team === 'RED' &&
      room.redLocked
    ) {
      throw new Error(
        'Red team is locked by the host.'
      );
    }

    if (
      team === 'BLUE' &&
      room.blueLocked
    ) {
      throw new Error(
        'Blue team is locked by the host.'
      );
    }

    /*
     * Exactly one Spymaster per team.
     */
    if (
      role === 'SPYMASTER' &&
      (team === 'RED' ||
        team === 'BLUE')
    ) {
      const existingSpymaster =
        Array.from(
          room.players.values()
        ).find(
          (p) =>
            p.id !== playerId &&
            p.team === team &&
            p.role ===
              'SPYMASTER' &&
            p.isConnected
        );

      if (existingSpymaster) {
        throw new Error(
          `${team} Team already has a Spymaster (${existingSpymaster.name}).`
        );
      }
    }

    player.team = team;
    player.role = role;

    this.persistRoom(room);

    return room;
  }

  public toggleTeamLock(
    roomCode: string,
    requesterId: string,
    target:
      | 'RED'
      | 'BLUE'
      | 'ALL'
  ): Room {
    const room =
      this.getRoom(roomCode);

    if (!room) {
      throw new Error(
        'Room not found'
      );
    }

    if (
      room.hostId !==
      requesterId
    ) {
      throw new Error(
        'Only the host can lock/unlock teams.'
      );
    }

    if (target === 'RED') {
      room.redLocked =
        !room.redLocked;
    } else if (
      target === 'BLUE'
    ) {
      room.blueLocked =
        !room.blueLocked;
    } else {
      const lockAll =
        !(
          room.redLocked &&
          room.blueLocked
        );

      room.redLocked =
        lockAll;

      room.blueLocked =
        lockAll;
    }

    this.persistRoom(room);

    return room;
  }

  public updateSettings(
    roomCode: string,
    requesterId: string,
    newSettings:
      Partial<RoomSettings>
  ): Room {
    const room =
      this.getRoom(roomCode);

    if (!room) {
      throw new Error(
        'Room not found'
      );
    }

    if (
      room.hostId !==
      requesterId
    ) {
      throw new Error(
        'Only the host can modify room settings.'
      );
    }

    room.settings = {
      ...room.settings,
      ...newSettings,
    };

    this.persistRoom(room);

    return room;
  }

  public movePlayer(
    roomCode: string,
    requesterId: string,
    targetPlayerId: string,
    team: PlayerTeam,
    role: PlayerRole
  ): Room {
    const room =
      this.getRoom(roomCode);

    if (!room) {
      throw new Error(
        'Room not found'
      );
    }

    if (
      room.hostId !==
      requesterId
    ) {
      throw new Error(
        'Only the host can move players.'
      );
    }

    const targetPlayer =
      room.players.get(
        targetPlayerId
      );

    if (!targetPlayer) {
      throw new Error(
        'Target player not found'
      );
    }

    if (
      role === 'SPYMASTER' &&
      (team === 'RED' ||
        team === 'BLUE')
    ) {
      const existingSpymaster =
        Array.from(
          room.players.values()
        ).find(
          (player) =>
            player.id !==
              targetPlayerId &&
            player.team === team &&
            player.role ===
              'SPYMASTER' &&
            player.isConnected
        );

      if (existingSpymaster) {
        existingSpymaster.role =
          'OPERATIVE';
      }
    }

    targetPlayer.team =
      team;

    targetPlayer.role =
      role;

    this.persistRoom(room);

    return room;
  }

  public kickPlayer(
    roomCode: string,
    requesterId: string,
    targetPlayerId: string
  ): Room {
    const room =
      this.getRoom(roomCode);

    if (!room) {
      throw new Error(
        'Room not found'
      );
    }

    if (
      room.hostId !==
      requesterId
    ) {
      throw new Error(
        'Only the host can remove players.'
      );
    }

    if (
      requesterId ===
      targetPlayerId
    ) {
      throw new Error(
        'Host cannot kick themselves.'
      );
    }

    const timeout =
      room.disconnectCleanups.get(
        targetPlayerId
      );

    if (timeout) {
      clearTimeout(timeout);

      room.disconnectCleanups.delete(
        targetPlayerId
      );
    }

    room.players.delete(
      targetPlayerId
    );

    for (const [
      token,
      playerId,
    ] of room.sessions.entries()) {
      if (
        playerId ===
        targetPlayerId
      ) {
        room.sessions.delete(
          token
        );
      }
    }

    this.persistRoom(room);

    return room;
  }

  public transferHost(
    roomCode: string,
    requesterId: string,
    newHostId: string
  ): Room {
    const room =
      this.getRoom(roomCode);

    if (!room) {
      throw new Error(
        'Room not found'
      );
    }

    if (
      room.hostId !==
      requesterId
    ) {
      throw new Error(
        'Only the host can transfer host privileges.'
      );
    }

    const newHost =
      room.players.get(
        newHostId
      );

    if (!newHost) {
      throw new Error(
        'Target player not found.'
      );
    }

    const oldHost =
      room.players.get(
        requesterId
      );

    if (oldHost) {
      oldHost.isHost =
        false;
    }

    newHost.isHost =
      true;

    room.hostId =
      newHostId;

    this.persistRoom(room);

    return room;
  }

  public checkReadiness(
    room: Room
  ): ReadinessCheck {
    const players =
      Array.from(
        room.players.values()
      ).filter(
        (player) =>
          player.isConnected
      );

    const redSpymaster =
      players.find(
        (player) =>
          player.team === 'RED' &&
          player.role ===
            'SPYMASTER'
      );

    const redOperatives =
      players.filter(
        (player) =>
          player.team === 'RED' &&
          player.role ===
            'OPERATIVE'
      );

    const blueSpymaster =
      players.find(
        (player) =>
          player.team === 'BLUE' &&
          player.role ===
            'SPYMASTER'
      );

    const blueOperatives =
      players.filter(
        (player) =>
          player.team === 'BLUE' &&
          player.role ===
            'OPERATIVE'
      );

    const missingRequirements:
      string[] = [];

    if (!redSpymaster) {
      missingRequirements.push(
        'Red Team needs a Spymaster.'
      );
    }

    if (
      redOperatives.length ===
      0
    ) {
      missingRequirements.push(
        'Red Team needs at least 1 Operative.'
      );
    }

    if (!blueSpymaster) {
      missingRequirements.push(
        'Blue Team needs a Spymaster.'
      );
    }

    if (
      blueOperatives.length ===
      0
    ) {
      missingRequirements.push(
        'Blue Team needs at least 1 Operative.'
      );
    }

    return {
      isReady:
        missingRequirements.length ===
        0,

      redSpymasterReady:
        !!redSpymaster,

      redOperativesCount:
        redOperatives.length,

      blueSpymasterReady:
        !!blueSpymaster,

      blueOperativesCount:
        blueOperatives.length,

      missingRequirements,
    };
  }

  public startGame(
    roomCode: string,
    requesterId: string
  ): Room {
    const room =
      this.getRoom(roomCode);

    if (!room) {
      throw new Error(
        'Room not found'
      );
    }

    if (
      room.hostId !==
      requesterId
    ) {
      throw new Error(
        'Only the host can start the game.'
      );
    }

    const readiness =
      this.checkReadiness(
        room
      );

    if (!readiness.isReady) {
      throw new Error(
        `Cannot start game: ${readiness.missingRequirements.join(
          ' '
        )}`
      );
    }

    room.isGameStarted =
      true;

    room.redLocked =
      true;

    room.blueLocked =
      true;

    const board =
      generateBoard();

    const initialLog:
      GameLogEntry = {
      id:
        `log-${Date.now()}-multi-init`,

      text:
        `Game started! ${board.startingTeam} team starts first with ${
          board.startingTeam ===
          'RED'
            ? board.redCount
            : board.blueCount
        } cards.`,

      type:
        'SYSTEM',

      timestamp:
        new Date().toLocaleTimeString(
          [],
          {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }
        ),
    };

    room.gameState = {
      cards:
        board.cards,

      startingTeam:
        board.startingTeam,

      currentTeam:
        board.startingTeam,

      phase:
        'CLUE_GIVING',

      currentClue:
        null,

      guessesRemaining:
        0,

      remainingRed:
        board.redCount,

      remainingBlue:
        board.blueCount,

      winner:
        null,

      winReason:
        null,

      logs:
        [initialLog],

      clueHistory:
        [],
    };

    this.persistRoom(room);

    return room;
  }

  public handleDisconnect(
    roomCode: string,
    playerId: string
  ): {
    room?: Room;
    transferredHost?: Player;
  } {
    const room =
      this.getRoom(roomCode);

    if (!room) {
      return {};
    }

    const player =
      room.players.get(
        playerId
      );

    if (!player) {
      return { room };
    }

    player.isConnected =
      false;

    let transferredHost:
      | Player
      | undefined;

    /*
     * Auto-transfer host.
     */
    if (player.isHost) {
      const nextHost =
        Array.from(
          room.players.values()
        ).find(
          (candidate) =>
            candidate.id !==
              playerId &&
            candidate.isConnected
        );

      if (nextHost) {
        player.isHost =
          false;

        nextHost.isHost =
          true;

        room.hostId =
          nextHost.id;

        transferredHost =
          nextHost;
      }
    }

    /*
     * Pause active games when a Spymaster
     * disconnects.
     */
    if (
      room.isGameStarted &&
      player.role ===
        'SPYMASTER'
    ) {
      room.isGamePaused =
        true;

      room.pauseReason =
        `Spymaster (${player.name}) has disconnected. Waiting for reconnection...`;
    }

    this.scheduleDisconnectCleanup(
      room,
      playerId
    );

    this.persistRoom(room);

    return {
      room,
      transferredHost,
    };
  }

  private scheduleDisconnectCleanup(
    room: Room,
    playerId: string
  ): void {
    const existingTimeout =
      room.disconnectCleanups.get(
        playerId
      );

    if (existingTimeout) {
      clearTimeout(
        existingTimeout
      );
    }

    const cleanupTimeout =
      setTimeout(
        () => {
          const player =
            room.players.get(
              playerId
            );

          /*
           * Player reconnected.
           */
          if (
            player?.isConnected
          ) {
            return;
          }

          room.players.delete(
            playerId
          );

          for (const [
            token,
            mappedPlayerId,
          ] of room.sessions.entries()) {
            if (
              mappedPlayerId ===
              playerId
            ) {
              room.sessions.delete(
                token
              );
            }
          }

          room.disconnectCleanups.delete(
            playerId
          );

          /*
           * If everybody is disconnected,
           * remove the room entirely.
           */
          const everyoneDisconnected =
            Array.from(
              room.players.values()
            ).every(
              (candidate) =>
                !candidate.isConnected
            );

          if (
            room.players.size ===
              0 ||
            everyoneDisconnected
          ) {
            this.rooms.delete(
              room.roomCode
            );

            void this.persistence
              .deleteRoom(
                room.roomCode
              )
              .catch(
                (error) => {
                  console.error(
                    `[RoomManager] Failed to delete persisted room ${room.roomCode}:`,
                    error
                  );
                }
              );

            return;
          }

          this.persistRoom(
            room
          );
        },
        5 * 60 * 1000
      );

    room.disconnectCleanups.set(
      playerId,
      cleanupTimeout
    );
  }

  public getLobbyState(
    room: Room
  ): LobbyState {
    const hostPlayer =
      room.players.get(
        room.hostId
      );

    return {
      roomCode:
        room.roomCode,

      hostId:
        room.hostId,

      hostName:
        hostPlayer
          ? hostPlayer.name
          : 'Host',

      players:
        Array.from(
          room.players.values()
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

      createdAt:
        room.createdAt,
    };
  }
}

export const roomManager =
  new RoomManager();