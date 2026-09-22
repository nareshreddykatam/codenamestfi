import React, { useEffect } from 'react';
import { Team, WinReason } from '../types/game';
import confetti from 'canvas-confetti';
import { Trophy, Skull, PlusCircle, RotateCcw } from 'lucide-react';

interface VictoryModalProps {
  winner: Team;
  winReason: WinReason;
  onNewGame: () => void;
  onRestartGame: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  winner,
  winReason,
  onNewGame,
  onRestartGame,
}) => {
  useEffect(() => {
    if (winReason === 'ALL_CARDS_FOUND') {
      const duration = 3.5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const interval: number = window.setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: Math.random() * 0.4 + 0.1, y: Math.random() - 0.2 },
          colors: winner === 'RED' ? ['#ef4444', '#f87171', '#f59e0b', '#ffffff'] : ['#3b82f6', '#60a5fa', '#f59e0b', '#ffffff'],
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: Math.random() * 0.4 + 0.5, y: Math.random() - 0.2 },
          colors: winner === 'RED' ? ['#ef4444', '#f87171', '#f59e0b', '#ffffff'] : ['#3b82f6', '#60a5fa', '#f59e0b', '#ffffff'],
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [winner, winReason]);

  const isRed = winner === 'RED';
  const isAssassin = winReason === 'ASSASSIN_HIT';
  const loserTeam = isRed ? 'BLUE' : 'RED';

  return (
    <div className="modal-backdrop">
      <div className={`victory-modal-card ${isRed ? 'winner-red' : 'winner-blue'} ${isAssassin ? 'assassin-defeat' : ''}`}>
        <div className="victory-icon-wrapper">
          {isAssassin ? (
            <div className="assassin-skull-pulse">
              <Skull size={64} className="skull-icon" />
            </div>
          ) : (
            <div className="trophy-bounce">
              <Trophy size={64} className="trophy-icon" />
            </div>
          )}
        </div>

        <div className="victory-header">
          <span className="victory-subtitle">
            {isAssassin ? 'FATAL ASSASSIN HIT!' : 'BOX OFFICE BLOCKBUSTER!'}
          </span>
          <h2 className="victory-title">
            <span className={isRed ? 'text-red-team' : 'text-blue-team'}>{winner} TEAM</span> WINS!
          </h2>
        </div>

        <div className="victory-explanation">
          {isAssassin ? (
            <p>
              The <strong>{loserTeam} Team</strong> inadvertently selected the secret <strong className="text-purple-400">ASSASSIN</strong> card.
              <br />
              <strong>{winner} Team</strong> claims an immediate victory!
            </p>
          ) : (
            <p>
              <strong>{winner} Team</strong> successfully decoded all of their Telugu movie cards first!
            </p>
          )}
        </div>

        <div className="victory-actions">
          <button onClick={onNewGame} className="btn-victory-primary">
            <PlusCircle size={18} />
            <span>Play New Board (25 Fresh Movies)</span>
          </button>
          <button onClick={onRestartGame} className="btn-victory-secondary">
            <RotateCcw size={18} />
            <span>Restart Current Board</span>
          </button>
        </div>
      </div>
    </div>
  );
};
