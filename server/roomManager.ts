import { Room, InternalGameState } from './types';
import { Player, RoomSettings, LobbyState, ReadinessCheck, PlayerTeam, PlayerRole } from '../src/types/multiplayer';
import { generateBoard } from '../src/game/boardGenerator';
import { Team, CardRole, GameLogEntry, Card } from '../src/types/game';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  /**
   * Generates a 6-character uppercase alphanumeric room code
   */
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded 0, O, 1, I for readability
    let code = '';
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);
    return code;
  }

  public getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase().trim());
  }

  public createRoom(hostName: string, sessionToken: string): { room: Room; player: Player } {
    const cleanName = hostName.trim();
    if (!cleanName) throw new Error('Player name cannot be empty');

    const roomCode = this.generateRoomCode();
    const hostId = `player-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const hostPlayer: Player = {
      id: hostId,
      name: cleanName,
      team: null,
      role: null,
      isHost: true,
      isConnected: true,
      joinedAt: Date.now(),
    };

    const playersMap = new Map<string, Player>();
    playersMap.set(hostId, hostPlayer);

    const sessionsMap = new Map<string, string>();
    sessionsMap.set(sessionToken, hostId);

    const defaultSettings: RoomSettings = {
      turnTimerSeconds: 0,
      unlimitedClues: true,
      allowSpectators: true,
    };

    const room: Room = {
      roomCode,
      hostId,
      players: playersMap,
      sessions: sessionsMap,
      redLocked: false,
      blueLocked: false,
      settings: defaultSettings,
      isGameStarted: false,
      isGamePaused: false,
      gameState: null,
      createdAt: Date.now(),
      disconnectCleanups: new Map(),
    };

    this.rooms.set(roomCode, room);
    return { room, player: hostPlayer };
  }

  public joinRoom(roomCode: string, playerName: string, sessionToken: string): { room: Room; player: Player; isReconnection: boolean } {
    const code = roomCode.toUpperCase().trim();
    const room = this.rooms.get(code);
    if (!room) {
      throw new Error('Room not found.');
    }

    // Check if player is reconnecting with an existing sessionToken in this room
    const existingPlayerId = room.sessions.get(sessionToken);
    if (existingPlayerId && room.players.has(existingPlayerId)) {
      const existingPlayer = room.players.get(existingPlayerId)!;
      existingPlayer.isConnected = true;

      // Cancel cleanup timeout if active
      const timeout = room.disconnectCleanups.get(existingPlayerId);
      if (timeout) {
        clearTimeout(timeout);
        room.disconnectCleanups.delete(existingPlayerId);
      }

      // If game was paused because of this player, resume if no other spymasters are missing
      if (room.isGamePaused && room.pauseReason?.includes(existingPlayer.name)) {
        room.isGamePaused = false;
        room.pauseReason = undefined;
      }

      return { room, player: existingPlayer, isReconnection: true };
    }

    const cleanName = playerName.trim();
    if (!cleanName) throw new Error('Player name cannot be empty');

    // Prevent duplicate player names inside the same room (case-insensitive)
    const duplicate = Array.from(room.players.values()).some(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase() && p.isConnected
    );
    if (duplicate) {
      throw new Error(`A player named "${cleanName}" is already in this room. Please pick a different name.`);
    }

    const newPlayerId = `player-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newPlayer: Player = {
      id: newPlayerId,
      name: cleanName,
      team: null,
      role: null,
      isHost: false,
      isConnected: true,
      joinedAt: Date.now(),
    };

    room.players.set(newPlayerId, newPlayer);
    room.sessions.set(sessionToken, newPlayerId);

    return { room, player: newPlayer, isReconnection: false };
  }

  public selectTeamRole(roomCode: string, playerId: string, team: PlayerTeam, role: PlayerRole): Room {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('Room not found');

    const player = room.players.get(playerId);
    if (!player) throw new Error('Player not found');

    if (room.isGameStarted) {
      throw new Error('Game is already in progress. Roles cannot be changed.');
    }

    // Check team locks
    if (team === 'RED' && room.redLocked) {
      throw new Error('Red team is locked by the host.');
    }
    if (team === 'BLUE' && room.blueLocked) {
      throw new Error('Blue team is locked by the host.');
    }

    // Check Spymaster exclusivity (Only 1 Spymaster per team)
    if (role === 'SPYMASTER' && (team === 'RED' || team === 'BLUE')) {
      const existingSpymaster = Array.from(room.players.values()).find(
        (p) => p.id !== playerId && p.team === team && p.role === 'SPYMASTER' && p.isConnected
      );
      if (existingSpymaster) {
        throw new Error(`${team} Team already has a Spymaster (${existingSpymaster.name}).`);
      }
    }

    player.team = team;
    player.role = role;
    return room;
  }

  public toggleTeamLock(roomCode: string, requesterId: string, target: 'RED' | 'BLUE' | 'ALL'): Room {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== requesterId) throw new Error('Only the host can lock/unlock teams.');

    if (target === 'RED') {
      room.redLocked = !room.redLocked;
    } else if (target === 'BLUE') {
      room.blueLocked = !room.blueLocked;
    } else if (target === 'ALL') {
      const lockAll = !(room.redLocked && room.blueLocked);
      room.redLocked = lockAll;
      room.blueLocked = lockAll;
    }

    return room;
  }

  public updateSettings(roomCode: string, requesterId: string, newSettings: Partial<RoomSettings>): Room {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== requesterId) throw new Error('Only the host can modify room settings.');

    room.settings = {
      ...room.settings,
      ...newSettings,
    };

    return room;
  }

  public movePlayer(
    roomCode: string,
    requesterId: string,
    targetPlayerId: string,
    team: PlayerTeam,
    role: PlayerRole
  ): Room {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== requesterId) throw new Error('Only the host can move players.');

    const targetPlayer = room.players.get(targetPlayerId);
    if (!targetPlayer) throw new Error('Target player not found');

    if (role === 'SPYMASTER' && (team === 'RED' || team === 'BLUE')) {
      const existingSpymaster = Array.from(room.players.values()).find(
        (p) => p.id !== targetPlayerId && p.team === team && p.role === 'SPYMASTER' && p.isConnected
      );
      if (existingSpymaster) {
        // Demote existing spymaster to operative
        existingSpymaster.role = 'OPERATIVE';
      }
    }

    targetPlayer.team = team;
    targetPlayer.role = role;
    return room;
  }

  public kickPlayer(roomCode: string, requesterId: string, targetPlayerId: string): Room {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== requesterId) throw new Error('Only the host can remove players.');
    if (requesterId === targetPlayerId) throw new Error('Host cannot kick themselves.');

    room.players.delete(targetPlayerId);

    // Also remove session mapping
    for (const [token, pid] of room.sessions.entries()) {
      if (pid === targetPlayerId) {
        room.sessions.delete(token);
      }
    }

    return room;
  }

  public transferHost(roomCode: string, requesterId: string, newHostId: string): Room {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== requesterId) throw new Error('Only the host can transfer host privileges.');

    const newHost = room.players.get(newHostId);
    if (!newHost) throw new Error('Target player not found.');

    const oldHost = room.players.get(requesterId);
    if (oldHost) oldHost.isHost = false;

    newHost.isHost = true;
    room.hostId = newHostId;

    return room;
  }

  public checkReadiness(room: Room): ReadinessCheck {
    const players = Array.from(room.players.values()).filter((p) => p.isConnected);

    const redSpymaster = players.find((p) => p.team === 'RED' && p.role === 'SPYMASTER');
    const redOperatives = players.filter((p) => p.team === 'RED' && p.role === 'OPERATIVE');

    const blueSpymaster = players.find((p) => p.team === 'BLUE' && p.role === 'SPYMASTER');
    const blueOperatives = players.filter((p) => p.team === 'BLUE' && p.role === 'OPERATIVE');

    const missingRequirements: string[] = [];

    if (!redSpymaster) {
      missingRequirements.push('Red Team needs a Spymaster.');
    }
    if (redOperatives.length === 0) {
      missingRequirements.push('Red Team needs at least 1 Operative.');
    }
    if (!blueSpymaster) {
      missingRequirements.push('Blue Team needs a Spymaster.');
    }
    if (blueOperatives.length === 0) {
      missingRequirements.push('Blue Team needs at least 1 Operative.');
    }

    return {
      isReady: missingRequirements.length === 0,
      redSpymasterReady: !!redSpymaster,
      redOperativesCount: redOperatives.length,
      blueSpymasterReady: !!blueSpymaster,
      blueOperativesCount: blueOperatives.length,
      missingRequirements,
    };
  }

  public startGame(roomCode: string, requesterId: string): Room {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== requesterId) throw new Error('Only the host can start the game.');

    const readiness = this.checkReadiness(room);
    if (!readiness.isReady) {
      throw new Error(`Cannot start game: ${readiness.missingRequirements.join(' ')}`);
    }

    // Lock entire lobby & teams
    room.isGameStarted = true;
    room.redLocked = true;
    room.blueLocked = true;

    // Generate random 25-card board & secret key
    const board = generateBoard();

    const initialLog: GameLogEntry = {
      id: `log-${Date.now()}-multi-init`,
      text: `Game started! ${board.startingTeam} team starts first with ${board.startingTeam === 'RED' ? board.redCount : board.blueCount} cards.`,
      type: 'SYSTEM',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    room.gameState = {
      cards: board.cards,
      startingTeam: board.startingTeam,
      currentTeam: board.startingTeam,
      phase: 'CLUE_GIVING',
      currentClue: null,
      guessesRemaining: 0,
      remainingRed: board.redCount,
      remainingBlue: board.blueCount,
      winner: null,
      winReason: null,
      logs: [initialLog],
      clueHistory: [],
    };

    return room;
  }

  public handleDisconnect(roomCode: string, playerId: string): { room?: Room; transferredHost?: Player } {
    const room = this.getRoom(roomCode);
    if (!room) return {};

    const player = room.players.get(playerId);
    if (!player) return { room };

    player.isConnected = false;
    let transferredHost: Player | undefined;

    // Auto-transfer host if host disconnected
    if (player.isHost) {
      const nextHost = Array.from(room.players.values()).find((p) => p.id !== playerId && p.isConnected);
      if (nextHost) {
        player.isHost = false;
        nextHost.isHost = true;
        room.hostId = nextHost.id;
        transferredHost = nextHost;
      }
    }

    // If Spymaster disconnected during an active game, pause the game
    if (room.isGameStarted && player.role === 'SPYMASTER') {
      room.isGamePaused = true;
      room.pauseReason = `Spymaster (${player.name}) has disconnected. Waiting for reconnection...`;
    }

    // Schedule 5-minute cleanup
    const cleanupTimeout = setTimeout(() => {
      room.players.delete(playerId);
      for (const [tok, pid] of room.sessions.entries()) {
        if (pid === playerId) room.sessions.delete(tok);
      }
      // If room is empty, remove room completely
      if (Array.from(room.players.values()).every((p) => !p.isConnected)) {
        this.rooms.delete(roomCode);
      }
    }, 5 * 60 * 1000);

    room.disconnectCleanups.set(playerId, cleanupTimeout);

    return { room, transferredHost };
  }

  public getLobbyState(room: Room): LobbyState {
    const hostPlayer = room.players.get(room.hostId);
    return {
      roomCode: room.roomCode,
      hostId: room.hostId,
      hostName: hostPlayer ? hostPlayer.name : 'Host',
      players: Array.from(room.players.values()),
      redLocked: room.redLocked,
      blueLocked: room.blueLocked,
      settings: room.settings,
      isGameStarted: room.isGameStarted,
      isGamePaused: room.isGamePaused,
      pauseReason: room.pauseReason,
      createdAt: room.createdAt,
    };
  }
}

export const roomManager = new RoomManager();
