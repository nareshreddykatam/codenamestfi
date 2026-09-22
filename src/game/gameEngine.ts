import { GameState, Team, Clue, CardRole, GameLogEntry, Card } from '../types/game';
import { generateBoard } from './boardGenerator';

function formatTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function createNewGame(): GameState {
  const { cards, startingTeam, redCount, blueCount } = generateBoard();

  const initialLog: GameLogEntry = {
    id: `log-${Date.now()}-init`,
    text: `Game initialized! ${startingTeam} team starts with ${startingTeam === 'RED' ? redCount : blueCount} cards.`,
    type: 'SYSTEM',
    timestamp: formatTimestamp(),
  };

  return {
    cards,
    startingTeam,
    currentTeam: startingTeam,
    phase: 'CLUE_GIVING',
    currentClue: null,
    guessesRemaining: 0,
    remainingRed: redCount,
    remainingBlue: blueCount,
    winner: null,
    winReason: null,
    isSpymasterView: false,
    logs: [initialLog],
    clueHistory: [],
  };
}

export function restartCurrentGame(prevState: GameState): GameState {
  const startingTeam = prevState.startingTeam;
  const redCount = startingTeam === 'RED' ? 9 : 8;
  const blueCount = startingTeam === 'BLUE' ? 9 : 8;

  // Reset all existing cards to unrevealed
  const resetCards: Card[] = prevState.cards.map(card => ({
    ...card,
    isRevealed: false,
    revealedBy: undefined,
  }));

  const log: GameLogEntry = {
    id: `log-${Date.now()}-restart`,
    text: `Game restarted with the same secret board key. ${startingTeam} team to give clue.`,
    type: 'SYSTEM',
    timestamp: formatTimestamp(),
  };

  return {
    ...prevState,
    cards: resetCards,
    currentTeam: startingTeam,
    phase: 'CLUE_GIVING',
    currentClue: null,
    guessesRemaining: 0,
    remainingRed: redCount,
    remainingBlue: blueCount,
    winner: null,
    winReason: null,
    logs: [log, ...prevState.logs],
  };
}

export function submitClue(prevState: GameState, word: string, count: number): GameState {
  if (prevState.phase === 'GAME_OVER') return prevState;

  const cleanWord = word.trim().toUpperCase();
  if (!cleanWord) return prevState;

  const currentTeam = prevState.currentTeam;
  const newClue: Clue = {
    word: cleanWord,
    count,
    team: currentTeam,
    timestamp: Date.now(),
  };

  // In Codenames, if number is N (e.g. 2), operatives get N + 1 guesses (e.g. 3).
  // If count is 0 or unlimited (99), allowed guesses is unlimited (99).
  const allowedGuesses = count === 0 || count >= 99 ? 99 : count + 1;

  const clueLog: GameLogEntry = {
    id: `log-${Date.now()}-clue`,
    text: `${currentTeam} Spymaster gave clue: "${cleanWord}" for ${count === 99 ? '∞ (Unlimited)' : count} cards.`,
    type: 'CLUE',
    team: currentTeam,
    timestamp: formatTimestamp(),
  };

  return {
    ...prevState,
    phase: 'GUESSING',
    currentClue: newClue,
    guessesRemaining: allowedGuesses,
    clueHistory: [newClue, ...prevState.clueHistory],
    logs: [clueLog, ...prevState.logs],
  };
}

export function selectCard(prevState: GameState, cardId: string): { newState: GameState; revealedRole: CardRole; isCorrect: boolean } {
  const cardIndex = prevState.cards.findIndex(c => c.id === cardId);
  if (cardIndex === -1 || prevState.phase === 'GAME_OVER') {
    return { newState: prevState, revealedRole: 'NEUTRAL', isCorrect: false };
  }

  const targetCard = prevState.cards[cardIndex];
  if (targetCard.isRevealed) {
    return { newState: prevState, revealedRole: targetCard.role, isCorrect: false };
  }

  const currentTeam = prevState.currentTeam;
  const opponentTeam: Team = currentTeam === 'RED' ? 'BLUE' : 'RED';
  const role = targetCard.role;
  const isCorrect = role === (currentTeam as CardRole);

  // Clone cards with updated revealed card
  const newCards = [...prevState.cards];
  newCards[cardIndex] = {
    ...targetCard,
    isRevealed: true,
    revealedBy: currentTeam,
  };

  let remainingRed = prevState.remainingRed;
  let remainingBlue = prevState.remainingBlue;

  if (role === 'RED') {
    remainingRed = Math.max(0, remainingRed - 1);
  } else if (role === 'BLUE') {
    remainingBlue = Math.max(0, remainingBlue - 1);
  }

  const guessLog: GameLogEntry = {
    id: `log-${Date.now()}-guess`,
    text: `${currentTeam} Team picked "${targetCard.movie}" → [${role}]`,
    type: 'GUESS',
    team: currentTeam,
    timestamp: formatTimestamp(),
  };

  // Case 1: Assassin clicked -> Instant loss for current team!
  if (role === 'ASSASSIN') {
    const endLog: GameLogEntry = {
      id: `log-${Date.now()}-over`,
      text: `💀 ASSASSIN HIT! ${currentTeam} clicked the Assassin. ${opponentTeam} TEAM WINS!`,
      type: 'GAME_OVER',
      team: opponentTeam,
      timestamp: formatTimestamp(),
    };

    return {
      newState: {
        ...prevState,
        cards: newCards,
        phase: 'GAME_OVER',
        winner: opponentTeam,
        winReason: 'ASSASSIN_HIT',
        logs: [endLog, guessLog, ...prevState.logs],
      },
      revealedRole: role,
      isCorrect: false,
    };
  }

  // Case 2: Check if Red or Blue reached 0 remaining cards
  if (remainingRed === 0) {
    const winLog: GameLogEntry = {
      id: `log-${Date.now()}-win`,
      text: `🎉 RED TEAM has found all their movie cards and WINS THE GAME!`,
      type: 'GAME_OVER',
      team: 'RED',
      timestamp: formatTimestamp(),
    };

    return {
      newState: {
        ...prevState,
        cards: newCards,
        remainingRed: 0,
        remainingBlue,
        phase: 'GAME_OVER',
        winner: 'RED',
        winReason: 'ALL_CARDS_FOUND',
        logs: [winLog, guessLog, ...prevState.logs],
      },
      revealedRole: role,
      isCorrect,
    };
  }

  if (remainingBlue === 0) {
    const winLog: GameLogEntry = {
      id: `log-${Date.now()}-win`,
      text: `🎉 BLUE TEAM has found all their movie cards and WINS THE GAME!`,
      type: 'GAME_OVER',
      team: 'BLUE',
      timestamp: formatTimestamp(),
    };

    return {
      newState: {
        ...prevState,
        cards: newCards,
        remainingRed,
        remainingBlue: 0,
        phase: 'GAME_OVER',
        winner: 'BLUE',
        winReason: 'ALL_CARDS_FOUND',
        logs: [winLog, guessLog, ...prevState.logs],
      },
      revealedRole: role,
      isCorrect,
    };
  }

  // Case 3: Correct team card chosen
  if (isCorrect) {
    const newGuessesRemaining = prevState.guessesRemaining - 1;

    // If guesses ran out, turn passes to opponent
    if (newGuessesRemaining <= 0) {
      const turnPassLog: GameLogEntry = {
        id: `log-${Date.now()}-pass`,
        text: `${currentTeam} used all allotted guesses. Turn passes to ${opponentTeam} Spymaster.`,
        type: 'SYSTEM',
        timestamp: formatTimestamp(),
      };

      return {
        newState: {
          ...prevState,
          cards: newCards,
          remainingRed,
          remainingBlue,
          currentTeam: opponentTeam,
          phase: 'CLUE_GIVING',
          currentClue: null,
          guessesRemaining: 0,
          logs: [turnPassLog, guessLog, ...prevState.logs],
        },
        revealedRole: role,
        isCorrect: true,
      };
    }

    // Still has guesses left
    return {
      newState: {
        ...prevState,
        cards: newCards,
        remainingRed,
        remainingBlue,
        guessesRemaining: newGuessesRemaining,
        logs: [guessLog, ...prevState.logs],
      },
      revealedRole: role,
      isCorrect: true,
    };
  }

  // Case 4: Neutral or Opponent card chosen -> Turn ends immediately!
  const turnChangeLog: GameLogEntry = {
    id: `log-${Date.now()}-change`,
    text: `${currentTeam} selected a ${role} card. Turn passes to ${opponentTeam} Spymaster.`,
    type: 'PASS',
    timestamp: formatTimestamp(),
  };

  return {
    newState: {
      ...prevState,
      cards: newCards,
      remainingRed,
      remainingBlue,
      currentTeam: opponentTeam,
      phase: 'CLUE_GIVING',
      currentClue: null,
      guessesRemaining: 0,
      logs: [turnChangeLog, guessLog, ...prevState.logs],
    },
    revealedRole: role,
    isCorrect: false,
  };
}

export function passTurn(prevState: GameState): GameState {
  if (prevState.phase === 'GAME_OVER') return prevState;

  const currentTeam = prevState.currentTeam;
  const opponentTeam: Team = currentTeam === 'RED' ? 'BLUE' : 'RED';

  const passLog: GameLogEntry = {
    id: `log-${Date.now()}-manual-pass`,
    text: `${currentTeam} Team ended their turn. ${opponentTeam} Spymaster's turn to give clue.`,
    type: 'PASS',
    team: currentTeam,
    timestamp: formatTimestamp(),
  };

  return {
    ...prevState,
    currentTeam: opponentTeam,
    phase: 'CLUE_GIVING',
    currentClue: null,
    guessesRemaining: 0,
    logs: [passLog, ...prevState.logs],
  };
}
