import { describe, it, expect } from 'vitest';
import { TELUGU_MOVIES, getRandomTeluguMovies } from '../../data/movies';
import { generateBoard } from '../boardGenerator';
import {
  createNewGame,
  restartCurrentGame,
  submitClue,
  selectCard,
  passTurn,
} from '../gameEngine';

describe('Telugu Movie Dataset & Random Selection', () => {
  it('contains over 100 Telugu movies with strictly unique names', () => {
    expect(TELUGU_MOVIES.length).toBeGreaterThanOrEqual(100);

    const titleSet = new Set(TELUGU_MOVIES.map((m) => m.trim().toLowerCase()));
    // Check uniqueness
    expect(titleSet.size).toBe(new Set(TELUGU_MOVIES).size);
  });

  it('selects exactly 25 unique Telugu movies', () => {
    const selected = getRandomTeluguMovies(25);
    expect(selected).toHaveLength(25);
    const set = new Set(selected);
    expect(set.size).toBe(25);
  });
});

describe('Codenames Board Generator', () => {
  it('generates 25 cards with authentic role distribution (9 starting, 8 opposing, 7 neutral, 1 assassin)', () => {
    const board = generateBoard();
    expect(board.cards).toHaveLength(25);
    expect(['RED', 'BLUE']).toContain(board.startingTeam);

    const opposingTeam = board.startingTeam === 'RED' ? 'BLUE' : 'RED';
    const startingCards = board.cards.filter((c) => c.role === board.startingTeam);
    const opposingCards = board.cards.filter((c) => c.role === opposingTeam);
    const neutralCards = board.cards.filter((c) => c.role === 'NEUTRAL');
    const assassinCards = board.cards.filter((c) => c.role === 'ASSASSIN');

    expect(startingCards).toHaveLength(9);
    expect(opposingCards).toHaveLength(8);
    expect(neutralCards).toHaveLength(7);
    expect(assassinCards).toHaveLength(1);

    // Initial counts
    expect(board.redCount).toBe(board.startingTeam === 'RED' ? 9 : 8);
    expect(board.blueCount).toBe(board.startingTeam === 'BLUE' ? 9 : 8);
  });
});

describe('Game Engine State Machine', () => {
  it('initializes a fresh game in CLUE_GIVING phase with 0 revealed cards', () => {
    const state = createNewGame();
    expect(state.phase).toBe('CLUE_GIVING');
    expect(state.currentClue).toBeNull();
    expect(state.winner).toBeNull();
    expect(state.winReason).toBeNull();
    expect(state.isSpymasterView).toBe(false);
    expect(state.cards.every((c) => !c.isRevealed)).toBe(true);
  });

  it('allows Spymaster to submit a one-word clue and transitions to GUESSING phase', () => {
    const state = createNewGame();
    const withClue = submitClue(state, 'ACTION', 2);

    expect(withClue.phase).toBe('GUESSING');
    expect(withClue.currentClue).toEqual({
      word: 'ACTION',
      count: 2,
      team: state.startingTeam,
      timestamp: expect.any(Number),
    });
    // In Codenames, count 2 gives 2 + 1 = 3 allowed guesses
    expect(withClue.guessesRemaining).toBe(3);
    expect(withClue.clueHistory).toHaveLength(1);
  });

  it('correctly handles guessing own team card', () => {
    const state = createNewGame();
    const withClue = submitClue(state, 'HERO', 2);
    const initialTeam = withClue.currentTeam;
    const initialGuesses = withClue.guessesRemaining;
    const ownCard = withClue.cards.find((c) => c.role === initialTeam)!;

    const { newState, revealedRole, isCorrect } = selectCard(withClue, ownCard.id);

    expect(isCorrect).toBe(true);
    expect(revealedRole).toBe(initialTeam);
    expect(newState.cards.find((c) => c.id === ownCard.id)?.isRevealed).toBe(true);
    expect(newState.guessesRemaining).toBe(initialGuesses - 1);
    expect(newState.currentTeam).toBe(initialTeam); // Still current team's turn
  });

  it('ends turn immediately if Neutral card is guessed', () => {
    const state = createNewGame();
    const withClue = submitClue(state, 'COMEDY', 1);
    const initialTeam = withClue.currentTeam;
    const opponentTeam = initialTeam === 'RED' ? 'BLUE' : 'RED';
    const neutralCard = withClue.cards.find((c) => c.role === 'NEUTRAL')!;

    const { newState, isCorrect } = selectCard(withClue, neutralCard.id);

    expect(isCorrect).toBe(false);
    expect(newState.currentTeam).toBe(opponentTeam);
    expect(newState.phase).toBe('CLUE_GIVING');
    expect(newState.currentClue).toBeNull();
  });

  it('ends turn immediately and awards point to opponent if Opponent card is guessed', () => {
    const state = createNewGame();
    const withClue = submitClue(state, 'DRAMA', 1);
    const initialTeam = withClue.currentTeam;
    const opponentTeam = initialTeam === 'RED' ? 'BLUE' : 'RED';
    const opponentCard = withClue.cards.find((c) => c.role === opponentTeam)!;

    const initialOpponentRemaining = opponentTeam === 'RED' ? withClue.remainingRed : withClue.remainingBlue;

    const { newState, isCorrect } = selectCard(withClue, opponentCard.id);

    expect(isCorrect).toBe(false);
    expect(newState.currentTeam).toBe(opponentTeam);
    expect(newState.phase).toBe('CLUE_GIVING');

    const updatedOpponentRemaining = opponentTeam === 'RED' ? newState.remainingRed : newState.remainingBlue;
    expect(updatedOpponentRemaining).toBe(initialOpponentRemaining - 1);
  });

  it('triggers instant GAME OVER and opponent victory if ASSASSIN is selected', () => {
    const state = createNewGame();
    const withClue = submitClue(state, 'POLICE', 1);
    const guessingTeam = withClue.currentTeam;
    const opponentTeam = guessingTeam === 'RED' ? 'BLUE' : 'RED';
    const assassinCard = withClue.cards.find((c) => c.role === 'ASSASSIN')!;

    const { newState, revealedRole } = selectCard(withClue, assassinCard.id);

    expect(revealedRole).toBe('ASSASSIN');
    expect(newState.phase).toBe('GAME_OVER');
    expect(newState.winner).toBe(opponentTeam);
    expect(newState.winReason).toBe('ASSASSIN_HIT');
  });

  it('triggers victory when a team uncovers all assigned cards', () => {
    let state = createNewGame();
    const activeTeam = state.currentTeam;
    const teamCards = state.cards.filter((c) => c.role === activeTeam);

    // Reveal all cards of active team
    for (const card of teamCards) {
      state = submitClue(state, 'CLUE', 9);
      const res = selectCard(state, card.id);
      state = res.newState;
      if (state.winner) break;
    }

    expect(state.phase).toBe('GAME_OVER');
    expect(state.winner).toBe(activeTeam);
    expect(state.winReason).toBe('ALL_CARDS_FOUND');
    if (activeTeam === 'RED') {
      expect(state.remainingRed).toBe(0);
    } else {
      expect(state.remainingBlue).toBe(0);
    }
  });

  it('allows manual pass/end turn', () => {
    const state = createNewGame();
    const withClue = submitClue(state, 'THRILLER', 2);
    const initialTeam = withClue.currentTeam;
    const opponentTeam = initialTeam === 'RED' ? 'BLUE' : 'RED';

    const passedState = passTurn(withClue);
    expect(passedState.currentTeam).toBe(opponentTeam);
    expect(passedState.phase).toBe('CLUE_GIVING');
    expect(passedState.currentClue).toBeNull();
  });

  it('resets the board correctly on restartCurrentGame', () => {
    let state = createNewGame();
    state = submitClue(state, 'ROMANCE', 1);
    const firstCard = state.cards[0];
    const { newState } = selectCard(state, firstCard.id);

    expect(newState.cards.some((c) => c.isRevealed)).toBe(true);

    const restarted = restartCurrentGame(newState);
    expect(restarted.cards.every((c) => !c.isRevealed)).toBe(true);
    expect(restarted.phase).toBe('CLUE_GIVING');
    expect(restarted.currentClue).toBeNull();
    expect(restarted.winner).toBeNull();
    // Same 25 movie cards preserved
    expect(restarted.cards.map((c) => c.movie)).toEqual(newState.cards.map((c) => c.movie));
  });
});
