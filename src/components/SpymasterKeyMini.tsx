import React from 'react';
import { Key } from 'lucide-react';
import { CardRole } from '../types/game';
import { MaskedCard } from '../types/multiplayer';

interface SpymasterKeyMiniProps {
  cards: (MaskedCard | {
    id: string;
    movie: string;
    role: CardRole | 'HIDDEN';
    isRevealed: boolean;
  })[];
  isSpymasterView: boolean;
}

export const SpymasterKeyMini: React.FC<SpymasterKeyMiniProps> = ({ cards, isSpymasterView }) => {
  if (!isSpymasterView) return null;

  // If secret roles are masked (e.g. Operative), don't render key
  const hasHiddenRoles = cards.some((c) => c.role === 'HIDDEN');
  if (hasHiddenRoles) return null;

  const getRoleBg = (role: string) => {
    switch (role) {
      case 'RED':
        return '#ef4444';
      case 'BLUE':
        return '#3b82f6';
      case 'NEUTRAL':
        return '#d97706';
      case 'ASSASSIN':
        return '#09090b';
      default:
        return '#27272a';
    }
  };

  return (
    <div className="spymaster-mini-key-card">
      <div className="mini-key-header">
        <Key size={14} />
        <span>SECRET KEY MAP</span>
      </div>
      <div className="mini-key-grid">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`mini-key-cell ${card.isRevealed ? 'revealed-cell' : ''}`}
            style={{
              backgroundColor: getRoleBg(card.role),
              opacity: card.isRevealed ? 0.35 : 1,
            }}
            title={`${card.movie}: ${card.role}`}
          />
        ))}
      </div>
    </div>
  );
};
