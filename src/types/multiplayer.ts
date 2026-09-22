import { Team, CardRole, GamePhase, WinReason, GameLogEntry, Clue } from './game';

export type PlayerTeam = Team | 'SPECTATOR' | null;
export type PlayerRole = 'SPYMASTER' | 'OPERATIVE' | 'SPECTATOR' | null;

export interface Player {
  id: string;
  name: string;
  team: PlayerTeam;
  role: PlayerRole;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;
}

export interface RoomSettings {
  turnTimerSeconds: 0 | 30 | 60 | 90 | 120; // 0 = OFF
  unlimitedClues: boolean; // default: true
  allowSpectators: boolean; // default: true
}

export interface LobbyState {
  roomCode: string;
  hostId: string;
  hostName: string;
  players: Player[];
  redLocked: boolean;
  blueLocked: boolean;
  settings: RoomSettings;
  isGameStarted: boolean;
  isGamePaused: boolean;
  pauseReason?: string;
  createdAt: number;
}

export interface MaskedCard {
  id: string;
  movie: string;
  image?: string;
  role: CardRole | 'HIDDEN'; // 'HIDDEN' for unrevealed cards on operative view
  isRevealed: boolean;
  revealedBy?: Team;
}

export interface SyncedGameState {
  roomCode: string;
  cards: MaskedCard[];
  startingTeam: Team;
  currentTeam: Team;
  phase: GamePhase;
  currentClue: Clue | null;
  guessesRemaining: number;
  remainingRed: number;
  remainingBlue: number;
  winner: Team | null;
  winReason: WinReason | null;
  turnTimeLeft?: number;
  logs: GameLogEntry[];
  clueHistory: Clue[];
}

export interface ReadinessCheck {
  isReady: boolean;
  redSpymasterReady: boolean;
  redOperativesCount: number;
  blueSpymasterReady: boolean;
  blueOperativesCount: number;
  missingRequirements: string[];
}
