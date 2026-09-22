import React, { useState } from 'react';
import { GamePhase, Team, Clue } from '../types/game';
import { Send, SkipForward, HelpCircle, Film, Sparkles } from 'lucide-react';

interface CluePanelProps {
  currentTeam: Team;
  phase: GamePhase;
  currentClue: Clue | null;
  guessesRemaining: number;
  isSpymasterView: boolean;
  canGiveClue?: boolean; // In multiplayer, only active team Spymaster can submit
  canPassTurn?: boolean; // In multiplayer, only active team Operatives/Host can pass
  onSubmitClue: (word: string, count: number) => void;
  onPassTurn: () => void;
}

export const CluePanel: React.FC<CluePanelProps> = ({
  currentTeam,
  phase,
  currentClue,
  guessesRemaining,
  isSpymasterView,
  canGiveClue = true,
  canPassTurn = true,
  onSubmitClue,
  onPassTurn,
}) => {
  const [clueWord, setClueWord] = useState('');
  const [clueCount, setClueCount] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState('');

  const handleGiveClue = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = clueWord.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a clue word.');
      return;
    }

    if (trimmed.includes(' ')) {
      setErrorMessage('Clues must strictly be a single word!');
      return;
    }

    setErrorMessage('');
    onSubmitClue(trimmed, clueCount);
    setClueWord('');
  };

  const teamClass = currentTeam.toLowerCase();

  return (
    <div className={`clue-panel-container ${teamClass}-theme`}>
      {/* PHASE 1: SPYMASTER GIVES CLUE */}
      {phase === 'CLUE_GIVING' && (
        <div className="clue-giving-section">
          {canGiveClue && isSpymasterView ? (
            <>
              <div className="clue-panel-header">
                <div className="team-turn-indicator">
                  <span className={`team-dot ${teamClass}`} />
                  <span className="team-name">{currentTeam} SPYMASTER</span>
                  <span className="prompt-text">— YOUR TURN: Give your operatives a one-word clue:</span>
                </div>
              </div>

              <form onSubmit={handleGiveClue} className="clue-input-form">
                <div className="input-group clue-word-group">
                  <label htmlFor="clue-word-input">Clue Word</label>
                  <input
                    id="clue-word-input"
                    type="text"
                    placeholder="e.g. HERO, POLICE, RAJAMOULI, VILLAGE..."
                    value={clueWord}
                    onChange={(e) => {
                      setClueWord(e.target.value.toUpperCase());
                      if (errorMessage) setErrorMessage('');
                    }}
                    maxLength={30}
                    className="clue-word-input"
                    autoComplete="off"
                  />
                </div>

                <div className="input-group clue-number-group">
                  <label htmlFor="clue-number-select">Movie Count</label>
                  <select
                    id="clue-number-select"
                    value={clueCount}
                    onChange={(e) => setClueCount(Number(e.target.value))}
                    className="clue-number-select"
                  >
                    <option value={1}>1 Movie</option>
                    <option value={2}>2 Movies</option>
                    <option value={3}>3 Movies</option>
                    <option value={4}>4 Movies</option>
                    <option value={5}>5 Movies</option>
                    <option value={6}>6 Movies</option>
                    <option value={7}>7 Movies</option>
                    <option value={8}>8 Movies</option>
                    <option value={9}>9 Movies</option>
                    <option value={0}>0 (Zero / Opposite clue)</option>
                    <option value={99}>∞ (Unlimited)</option>
                  </select>
                </div>

                <button type="submit" className={`submit-clue-btn btn-${teamClass}`}>
                  <Send size={18} />
                  <span>Give Clue</span>
                </button>
              </form>

              {errorMessage && <div className="clue-error-msg">{errorMessage}</div>}
            </>
          ) : (
            <div className="waiting-spymaster-banner">
              <Film size={20} className="animate-spin-slow" />
              <div className="waiting-text-group">
                <span className="waiting-title">{currentTeam} TEAM TURN</span>
                <span className="waiting-subtitle">
                  Waiting for {currentTeam} Spymaster to study the secret key and submit a clue...
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PHASE 2: OPERATIVES ARE GUESSING */}
      {phase === 'GUESSING' && currentClue && (
        <div className="clue-guessing-section">
          <div className="active-clue-display">
            <div className="clue-banner-left">
              <span className="clue-label">CLUE:</span>
              <span className="clue-word-highlight">"{currentClue.word}"</span>
              <span className="clue-count-badge">
                {currentClue.count === 99 ? '∞' : currentClue.count}
              </span>
            </div>

            <div className="clue-banner-middle">
              <div className="guesses-counter">
                <span className="guesses-num">{guessesRemaining >= 90 ? '∞' : guessesRemaining}</span>
                <span className="guesses-label">Guesses Left</span>
              </div>
              <div className="operative-instruction-hint">
                <Sparkles size={14} className="text-amber-400" />
                <span>Operatives — click a movie card on the board to guess</span>
              </div>
            </div>

            <div className="clue-banner-right">
              {canPassTurn && (
                <button
                  type="button"
                  onClick={onPassTurn}
                  className="pass-turn-btn"
                  title="End your team's turn and pass to opponent"
                >
                  <SkipForward size={17} />
                  <span>End / Pass Turn</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PHASE 3: GAME OVER */}
      {phase === 'GAME_OVER' && (
        <div className="game-over-banner">
          <HelpCircle size={20} />
          <span>Match concluded. Check the victory report or start a new match!</span>
        </div>
      )}
    </div>
  );
};
