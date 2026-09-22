import { Card, CardRole, Team } from '../types/game';
import { getRandomTeluguMovieEntries } from '../data/movies';

export interface BoardGenerationResult {
  cards: Card[];
  startingTeam: Team;
  redCount: number;
  blueCount: number;
}

/**
 * Standard Codenames Board Generator:
 * - 25 cards in a 5x5 grid
 * - Random starting team (RED or BLUE)
 * - 9 cards for starting team
 * - 8 cards for opposing team
 * - 7 neutral cards
 * - 1 assassin card
 * - 25 unique Telugu movie entries with optional poster images
 */
export function generateBoard(): BoardGenerationResult {
  const startingTeam: Team = Math.random() < 0.5 ? 'RED' : 'BLUE';
  const opposingTeam: Team = startingTeam === 'RED' ? 'BLUE' : 'RED';

  // Role distribution array
  const roles: CardRole[] = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(opposingTeam),
    ...Array(7).fill('NEUTRAL' as CardRole),
    'ASSASSIN' as CardRole,
  ];

  // Fisher-Yates shuffle on roles
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  // 25 unique Telugu movie entries
  const movieEntries = getRandomTeluguMovieEntries(25);

  const cards: Card[] = movieEntries.map((entry, index) => ({
    id: `card-${index + 1}-${entry.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    movie: entry.title,
    image: entry.image,
    role: roles[index],
    isRevealed: false,
  }));

  return {
    cards,
    startingTeam,
    redCount: startingTeam === 'RED' ? 9 : 8,
    blueCount: startingTeam === 'BLUE' ? 9 : 8,
  };
}
