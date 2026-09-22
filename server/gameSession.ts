import { Room } from './types';
import { Player, SyncedGameState, MaskedCard } from '../src/types/multiplayer';
import { generateBoard } from '../src/game/boardGenerator';
import { CardRole, Team, GameLogEntry, Card } from '../src/types/game';

function formatTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export class GameSessionManager {
  /**
   * Returns a role-appropriate masked game state.
   * Spymasters receive all secret card roles.
   * Operatives and spectators receive 'HIDDEN' for unrevealed cards.
   */
  public getMaskedGameState(room: Room, player: Player | undefined): SyncedGameState {
    if (!room.gameState) {
      throw new Error('Game has not been started yet.');
    }

    const state = room.gameState;
    const isSpymaster = player?.role === 'SPYMASTER';

    const maskedCards: MaskedCard[] = state.cards.map((card) => {
      if (card.isRevealed || isSpymaster) {
        return {
          id: card.id,
          movie: card.movie,
          image: card.image,
          role: card.role,
          isRevealed: card.isRevealed,
          revealedBy: card.revealedBy,
        };
      }

      // STRICT SECURITY: Conceal secret role from operative/spectator clients!
      return {
        id: card.id,
        movie: card.movie,
        image: card.image,
        role: 'HIDDEN',
        isRevealed: false,
      };
    });

    let timeLeft: number | undefined;
    if (state.turnTimerEnd) {
      timeLeft = Math.max(0, Math.ceil((state.turnTimerEnd - Date.now()) / 1000));
    }

    return {
      roomCode: room.roomCode,
      cards: maskedCards,
      startingTeam: state.startingTeam,
      currentTeam: state.currentTeam,
      phase: state.phase,
      currentClue: state.currentClue,
      guessesRemaining: state.guessesRemaining,
      remainingRed: state.remainingRed,
      remainingBlue: state.remainingBlue,
      winner: state.winner,
      winReason: state.winReason,
      turnTimeLeft: timeLeft,
      logs: state.logs,
      clueHistory: state.clueHistory,
    };
  }

  public submitClue(room: Room, playerId: string, word: string, count: number): void {
    const player = room.players.get(playerId);
    if (!player) throw new Error('Player not found.');
    if (!room.gameState) throw new Error('Game not started.');

    const state = room.gameState;
    if (state.phase !== 'CLUE_GIVING') {
      throw new Error('Not currently in the Clue Giving phase.');
    }

    // Only active team Spymaster can submit clue
    if (player.team !== state.currentTeam || player.role !== 'SPYMASTER') {
      throw new Error(`Only the ${state.currentTeam} Spymaster can give a clue right now.`);
    }

    const cleanWord = word.trim().toUpperCase();
    if (!cleanWord || cleanWord.includes(' ')) {
      throw new Error('Clues must be a single word.');
    }

    if (!room.settings.unlimitedClues && (count === 99 || count === 0)) {
      throw new Error('Unlimited or Zero clues are disabled in this room settings.');
    }

    state.currentClue = {
      word: cleanWord,
      count,
      team: state.currentTeam,
      timestamp: Date.now(),
    };

    // Standard Codenames rule: N cards gives up to N + 1 allowed guesses
    state.guessesRemaining = count === 0 || count >= 99 ? 99 : count + 1;
    state.phase = 'GUESSING';
    state.clueHistory = [state.currentClue, ...state.clueHistory];

    const log: GameLogEntry = {
      id: `log-${Date.now()}-multi-clue`,
      text: `${state.currentTeam} Spymaster (${player.name}) gave clue: "${cleanWord}" for ${count === 99 ? '∞ (Unlimited)' : count} cards.`,
      type: 'CLUE',
      team: state.currentTeam,
      timestamp: formatTimestamp(),
    };
    state.logs = [log, ...state.logs];

    // Set turn timer if enabled
    this.startTurnTimer(room);
  }

  public selectCard(room: Room, playerId: string, cardId: string): void {
    const player = room.players.get(playerId);
    if (!player) throw new Error('Player not found.');
    if (!room.gameState) throw new Error('Game not started.');

    const state = room.gameState;
    if (state.phase !== 'GUESSING') {
      throw new Error('Cards can only be selected during the Guessing phase.');
    }

    // Operatives of the current team can select cards
    if (player.team !== state.currentTeam || player.role !== 'OPERATIVE') {
      throw new Error(`Only ${state.currentTeam} Team Operatives can make guesses.`);
    }

    const cardIndex = state.cards.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) throw new Error('Card not found.');

    const targetCard = state.cards[cardIndex];
    if (targetCard.isRevealed) throw new Error('Card has already been revealed.');

    targetCard.isRevealed = true;
    targetCard.revealedBy = state.currentTeam;

    const currentTeam = state.currentTeam;
    const opponentTeam: Team = currentTeam === 'RED' ? 'BLUE' : 'RED';
    const role = targetCard.role;

    if (role === 'RED') state.remainingRed = Math.max(0, state.remainingRed - 1);
    if (role === 'BLUE') state.remainingBlue = Math.max(0, state.remainingBlue - 1);

    const guessLog: GameLogEntry = {
      id: `log-${Date.now()}-multi-guess`,
      text: `${currentTeam} Operative (${player.name}) selected "${targetCard.movie}" → [${role}]`,
      type: 'GUESS',
      team: currentTeam,
      timestamp: formatTimestamp(),
    };

    // Case 1: Assassin
    if (role === 'ASSASSIN') {
      this.clearTurnTimer(room);
      state.phase = 'GAME_OVER';
      state.winner = opponentTeam;
      state.winReason = 'ASSASSIN_HIT';
      const endLog: GameLogEntry = {
        id: `log-${Date.now()}-multi-assassin`,
        text: `💀 ASSASSIN HIT! ${currentTeam} clicked the Assassin. ${opponentTeam} TEAM WINS!`,
        type: 'GAME_OVER',
        team: opponentTeam,
        timestamp: formatTimestamp(),
      };
      state.logs = [endLog, guessLog, ...state.logs];
      return;
    }

    // Case 2: Win conditions
    if (state.remainingRed === 0) {
      this.clearTurnTimer(room);
      state.phase = 'GAME_OVER';
      state.winner = 'RED';
      state.winReason = 'ALL_CARDS_FOUND';
      const winLog: GameLogEntry = {
        id: `log-${Date.now()}-multi-win-red`,
        text: `🎉 RED TEAM has found all their movie cards and WINS THE GAME!`,
        type: 'GAME_OVER',
        team: 'RED',
        timestamp: formatTimestamp(),
      };
      state.logs = [winLog, guessLog, ...state.logs];
      return;
    }

    if (state.remainingBlue === 0) {
      this.clearTurnTimer(room);
      state.phase = 'GAME_OVER';
      state.winner = 'BLUE';
      state.winReason = 'ALL_CARDS_FOUND';
      const winLog: GameLogEntry = {
        id: `log-${Date.now()}-multi-win-blue`,
        text: `🎉 BLUE TEAM has found all their movie cards and WINS THE GAME!`,
        type: 'GAME_OVER',
        team: 'BLUE',
        timestamp: formatTimestamp(),
      };
      state.logs = [winLog, guessLog, ...state.logs];
      return;
    }

    // Case 3: Correct card
    if (role === (currentTeam as CardRole)) {
      state.guessesRemaining -= 1;
      if (state.guessesRemaining <= 0) {
        // Guesses exhausted -> Pass turn
        this.clearTurnTimer(room);
        state.currentTeam = opponentTeam;
        state.phase = 'CLUE_GIVING';
        state.currentClue = null;
        state.guessesRemaining = 0;
        const passLog: GameLogEntry = {
          id: `log-${Date.now()}-multi-exhaust`,
          text: `${currentTeam} used all allotted guesses. Turn passes to ${opponentTeam} Spymaster.`,
          type: 'SYSTEM',
          timestamp: formatTimestamp(),
        };
        state.logs = [passLog, guessLog, ...state.logs];
      } else {
        state.logs = [guessLog, ...state.logs];
      }
      return;
    }

    // Case 4: Neutral or Opponent card chosen -> End turn immediately
    this.clearTurnTimer(room);
    state.currentTeam = opponentTeam;
    state.phase = 'CLUE_GIVING';
    state.currentClue = null;
    state.guessesRemaining = 0;
    const changeLog: GameLogEntry = {
      id: `log-${Date.now()}-multi-pass-wrong`,
      text: `${currentTeam} selected a ${role} card. Turn passes to ${opponentTeam} Spymaster.`,
      type: 'PASS',
      timestamp: formatTimestamp(),
    };
    state.logs = [changeLog, guessLog, ...state.logs];
  }

  public passTurn(room: Room, playerId: string): void {
    const player = room.players.get(playerId);
    if (!player) throw new Error('Player not found.');
    if (!room.gameState) throw new Error('Game not started.');

    const state = room.gameState;
    if (state.phase === 'GAME_OVER') return;

    if (player.team !== state.currentTeam && !player.isHost) {
      throw new Error(`Only ${state.currentTeam} team members or the Host can end the turn.`);
    }

    const currentTeam = state.currentTeam;
    const opponentTeam: Team = currentTeam === 'RED' ? 'BLUE' : 'RED';

    this.clearTurnTimer(room);
    state.currentTeam = opponentTeam;
    state.phase = 'CLUE_GIVING';
    state.currentClue = null;
    state.guessesRemaining = 0;

    const passLog: GameLogEntry = {
      id: `log-${Date.now()}-multi-manual-pass`,
      text: `${currentTeam} Team ended their turn. ${opponentTeam} Spymaster's turn.`,
      type: 'PASS',
      team: currentTeam,
      timestamp: formatTimestamp(),
    };
    state.logs = [passLog, ...state.logs];
  }

  public restartGame(room: Room, requesterId: string): void {
    if (room.hostId !== requesterId) throw new Error('Only the host can restart the game.');
    if (!room.gameState) throw new Error('Game not started.');

    const startingTeam = room.gameState.startingTeam;
    const redCount = startingTeam === 'RED' ? 9 : 8;
    const blueCount = startingTeam === 'BLUE' ? 9 : 8;

    this.clearTurnTimer(room);

    // Reset all cards
    room.gameState.cards.forEach((c) => {
      c.isRevealed = false;
      c.revealedBy = undefined;
    });

    room.gameState.currentTeam = startingTeam;
    room.gameState.phase = 'CLUE_GIVING';
    room.gameState.currentClue = null;
    room.gameState.guessesRemaining = 0;
    room.gameState.remainingRed = redCount;
    room.gameState.remainingBlue = blueCount;
    room.gameState.winner = null;
    room.gameState.winReason = null;

    const log: GameLogEntry = {
      id: `log-${Date.now()}-multi-restart`,
      text: `Host restarted the game with the same secret board key.`,
      type: 'SYSTEM',
      timestamp: formatTimestamp(),
    };
    room.gameState.logs = [log, ...room.gameState.logs];
  }

  public newGame(room: Room, requesterId: string): void {
    if (room.hostId !== requesterId) throw new Error('Only the host can create a new board.');

    this.clearTurnTimer(room);

    const board = generateBoard();
    const log: GameLogEntry = {
      id: `log-${Date.now()}-multi-new`,
      text: `Host started a new match with 25 fresh Telugu movies! ${board.startingTeam} team starts.`,
      type: 'SYSTEM',
      timestamp: formatTimestamp(),
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
      logs: [log],
      clueHistory: [],
    };
  }

  private startTurnTimer(room: Room): void {
    this.clearTurnTimer(room);
    if (!room.gameState || room.settings.turnTimerSeconds <= 0) return;

    room.gameState.turnTimerEnd = Date.now() + room.settings.turnTimerSeconds * 1000;
  }

  private clearTurnTimer(room: Room): void {
    if (room.gameState?.timerIntervalId) {
      clearInterval(room.gameState.timerIntervalId);
      room.gameState.timerIntervalId = undefined;
    }
    if (room.gameState) {
      room.gameState.turnTimerEnd = undefined;
    }
  }
}

export const gameSessionManager = new GameSessionManager();
