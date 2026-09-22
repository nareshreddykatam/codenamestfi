import React, { useState } from 'react';
import { CardRole, Team } from '../types/game';
import { MaskedCard } from '../types/multiplayer';
import { Film } from 'lucide-react';

interface MovieCardProps {
  card: MaskedCard | {
    id: string;
    movie: string;
    image?: string;
    role: CardRole;
    isRevealed: boolean;
    revealedBy?: Team;
  };
  isSpymasterView: boolean;
  canGuess: boolean;
  currentTeam: Team;
  onSelect: (cardId: string) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  card,
  isSpymasterView,
  canGuess,
  onSelect,
}) => {
  const [imgError, setImgError] = useState(false);

  const handleClick = () => {
    if (card.isRevealed || !canGuess) return;
    onSelect(card.id);
  };

  const getRoleColorClass = (role: CardRole | 'HIDDEN') => {
    switch (role) {
      case 'RED':
        return 'role-red';
      case 'BLUE':
        return 'role-blue';
      case 'NEUTRAL':
        return 'role-neutral';
      case 'ASSASSIN':
        return 'role-assassin';
      default:
        return '';
    }
  };

  const getSpymasterHintBadge = (role: CardRole | 'HIDDEN') => {
    switch (role) {
      case 'RED':
        return { label: 'RED', icon: '🔴', color: 'text-red-400' };
      case 'BLUE':
        return { label: 'BLUE', icon: '🔵', color: 'text-blue-400' };
      case 'NEUTRAL':
        return { label: 'NEUTRAL', icon: '⚪', color: 'text-amber-200/70' };
      case 'ASSASSIN':
        return { label: 'ASSASSIN', icon: '💀', color: 'text-purple-300' };
      default:
        return null;
    }
  };

  const isClickable = !card.isRevealed && canGuess;
  const isKnownRole = card.role !== 'HIDDEN';
  const showSpymasterHint = isSpymasterView && isKnownRole;
  const spymasterBadge = showSpymasterHint ? getSpymasterHintBadge(card.role) : null;
  const hasValidImage = card.image && !imgError;

  return (
    <div
      onClick={handleClick}
      className={`movie-card-container ${isClickable ? 'is-clickable' : ''} ${card.isRevealed ? 'is-revealed' : ''}`}
      role="button"
      tabIndex={isClickable ? 0 : -1}
      aria-label={`Movie card: ${card.movie}, ${card.isRevealed ? `Revealed ${card.role}` : isSpymasterView && isKnownRole ? `Hidden ${card.role}` : 'Unrevealed'}`}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className={`movie-card-inner ${card.isRevealed ? 'is-flipped' : ''}`}>
        {/* CARD FRONT (Unrevealed State) */}
        <div
          className={`movie-card-front ${
            showSpymasterHint ? `spymaster-mode ${getRoleColorClass(card.role)}-hint` : 'operative-mode'
          }`}
        >
          {/* Film reel perforations top */}
          <div className="card-perforations top" aria-hidden="true">
            <span /><span /><span /><span />
          </div>

          {/* Spymaster Role Pill (Visible only in Spymaster View) */}
          {showSpymasterHint && spymasterBadge && (
            <div className={`spymaster-role-pill ${card.role.toLowerCase()}`}>
              <span className="role-icon">{spymasterBadge.icon}</span>
              <span className="role-text">{spymasterBadge.label}</span>
            </div>
          )}

          {/* Movie Title (Clean typography without TFI label) */}
          <div className="movie-title-wrapper">
            <span className="movie-title">{card.movie}</span>
          </div>

          {/* Film reel perforations bottom */}
          <div className="card-perforations bottom" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
        </div>

        {/* CARD BACK (Revealed State: Movie Poster + Role Overlay) */}
        <div className={`movie-card-back ${getRoleColorClass(card.role)}`}>
          {hasValidImage ? (
            <div className="card-poster-wrapper">
              <img
                src={card.image}
                alt={card.movie}
                className="card-poster-img"
                onError={() => setImgError(true)}
                loading="lazy"
              />
              <div className="card-poster-overlay" />
            </div>
          ) : (
            <div className="card-poster-fallback">
              <Film size={28} className="fallback-film-icon" />
            </div>
          )}

          <div className="revealed-header-bar">
            {card.role === 'RED' && <span className="revealed-role-tag red">🔴 RED</span>}
            {card.role === 'BLUE' && <span className="revealed-role-tag blue">🔵 BLUE</span>}
            {card.role === 'NEUTRAL' && <span className="revealed-role-tag neutral">⚪ NEUTRAL</span>}
            {card.role === 'ASSASSIN' && <span className="revealed-role-tag assassin">💀 ASSASSIN</span>}
          </div>

          <div className="revealed-title-container">
            <span className="movie-title-revealed">{card.movie}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
