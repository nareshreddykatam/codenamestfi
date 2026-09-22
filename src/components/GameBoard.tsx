import React from 'react';
import { CardRole, Team } from '../types/game';
import { MaskedCard } from '../types/multiplayer';
import { MovieCard } from './MovieCard';

interface GameBoardProps {
  cards: (MaskedCard | {
    id: string;
    movie: string;
    role: CardRole;
    isRevealed: boolean;
    revealedBy?: Team;
  })[];
  isSpymasterView: boolean;
  canGuess: boolean;
  currentTeam: Team;
  onSelectCard: (cardId: string) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  cards,
  isSpymasterView,
  canGuess,
  currentTeam,
  onSelectCard,
}) => {
  return (
    <div className="game-board-wrapper">
      <div className="game-board-grid">
        {cards.map((card) => (
          <MovieCard
            key={card.id}
            card={card}
            isSpymasterView={isSpymasterView}
            canGuess={canGuess}
            currentTeam={currentTeam}
            onSelect={onSelectCard}
          />
        ))}
      </div>
    </div>
  );
};
