import { WebSocket } from 'ws';
import { Player, RoomSettings, LobbyState, SyncedGameState, PlayerTeam, PlayerRole } from '../src/types/multiplayer';
import { Card, Team, GamePhase, WinReason, GameLogEntry, Clue } from '../src/types/game';

export interface ConnectedClient {
  socket: WebSocket;
  playerId: string;
  roomCode: string;
  sessionToken: string;
  isAlive: boolean;
}

export interface InternalGameState {
  cards: Card[]; // Full authoritative card list with real roles
  startingTeam: Team;
  currentTeam: Team;
  phase: GamePhase;
  currentClue: Clue | null;
  guessesRemaining: number;
  remainingRed: number;
  remainingBlue: number;
  winner: Team | null;
  winReason: WinReason | null;
  turnTimerEnd?: number; // Timestamp when turn timer expires
  timerIntervalId?: NodeJS.Timeout;
  logs: GameLogEntry[];
  clueHistory: Clue[];
}

export interface Room {
  roomCode: string;
  hostId: string;
  players: Map<string, Player>; // playerId -> Player
  sessions: Map<string, string>; // sessionToken -> playerId
  redLocked: boolean;
  blueLocked: boolean;
  settings: RoomSettings;
  isGameStarted: boolean;
  isGamePaused: boolean;
  pauseReason?: string;
  gameState: InternalGameState | null;
  createdAt: number;
  disconnectCleanups: Map<string, NodeJS.Timeout>; // playerId -> cleanup timeout
}
