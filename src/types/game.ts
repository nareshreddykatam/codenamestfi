export type CardRole = 'RED' | 'BLUE' | 'NEUTRAL' | 'ASSASSIN';

export type Team = 'RED' | 'BLUE';

export interface Card {
  id: string;
  movie: string;
  image?: string;
  role: CardRole;
  isRevealed: boolean;
  revealedBy?: Team;
}

export interface Clue {
  word: string;
  count: number; // 0 for zero, 1-9, or -1 / 99 for unlimited
  team: Team;
  timestamp: number;
}

export type GamePhase = 'CLUE_GIVING' | 'GUESSING' | 'GAME_OVER';

export type WinReason = 'ALL_CARDS_FOUND' | 'ASSASSIN_HIT';

export interface GameLogEntry {
  id: string;
  text: string;
  type: 'CLUE' | 'GUESS' | 'PASS' | 'GAME_OVER' | 'SYSTEM';
  team?: Team;
  timestamp: string;
}

export interface GameState {
  cards: Card[];
  startingTeam: Team;
  currentTeam: Team;
  phase: GamePhase;
  currentClue: Clue | null;
  guessesRemaining: number;
  remainingRed: number;
  remainingBlue: number;
  winner: Team | null;
  winReason: WinReason | null;
  isSpymasterView: boolean;
  logs: GameLogEntry[];
  clueHistory: Clue[];
}
