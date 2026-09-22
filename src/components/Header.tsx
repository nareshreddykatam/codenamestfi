import React from 'react';
import { GamePhase, Team } from '../types/game';
import { Player } from '../types/multiplayer';
import { Eye, EyeOff, RotateCcw, PlusCircle, Volume2, VolumeX, BookOpen, Film, Crown } from 'lucide-react';

interface HeaderProps {
  remainingRed: number;
  remainingBlue: number;
  currentTeam: Team;
  phase: GamePhase;
  startingTeam: Team;
  isSpymasterView: boolean;
  isMuted: boolean;
  isMultiplayer?: boolean;
  currentPlayer?: Player | null;
  onToggleSpymasterView: () => void;
  onToggleMute: () => void;
  onNewGame: () => void;
  onRestartGame: () => void;
  onOpenRules: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  remainingRed,
  remainingBlue,
  currentTeam,
  phase,
  isSpymasterView,
  isMuted,
  isMultiplayer = false,
  currentPlayer,
  onToggleSpymasterView,
  onToggleMute,
  onNewGame,
  onRestartGame,
  onOpenRules,
}) => {
  const isHost = currentPlayer?.isHost ?? true;

  const getPlayerRoleBadge = () => {
    if (!currentPlayer) return null;
    const team = currentPlayer.team;
    const role = currentPlayer.role;

    if (role === 'SPECTATOR' || team === 'SPECTATOR') {
      return <span className="user-role-badge spectator">👁️ SPECTATOR</span>;
    }

    if (team === 'RED') {
      return (
        <span className="user-role-badge red">
          🔴 {role === 'SPYMASTER' ? 'RED SPYMASTER' : 'RED OPERATIVE'}
        </span>
      );
    }

    if (team === 'BLUE') {
      return (
        <span className="user-role-badge blue">
          🔵 {role === 'SPYMASTER' ? 'BLUE SPYMASTER' : 'BLUE OPERATIVE'}
        </span>
      );
    }

    return null;
  };

  return (
    <header className="game-header">
      {/* TOP BRANDING BAR */}
      <div className="header-brand-row">
        <div className="brand-title-group">
          <div className="brand-icon-wrapper">
            <Film className="brand-film-icon" size={26} />
          </div>
          <div>
            <h1 className="brand-title">
              CODENAMES <span className="highlight-gold">TFI</span>
            </h1>
            <p className="brand-tagline">Telugu Cinema Word & Spy Mystery</p>
          </div>
        </div>

        {/* CONTROLS & PLAYER STATUS */}
        <div className="header-action-controls">
          {/* In Multiplayer: Show permanent player role identity */}
          {isMultiplayer && currentPlayer && (
            <div className="player-identity-pill">
              <span className="player-name-label">{currentPlayer.name}</span>
              {currentPlayer.isHost && <Crown size={14} className="host-crown-icon" />}
              {getPlayerRoleBadge()}
            </div>
          )}

          {/* In Local Mode ONLY: Allow manual Spymaster toggle */}
          {!isMultiplayer && (
            <button
              onClick={onToggleSpymasterView}
              className={`spymaster-toggle-btn ${isSpymasterView ? 'active-spymaster' : 'operative-view'}`}
              title="Toggle between Spymaster view and Operative view"
            >
              {isSpymasterView ? <EyeOff size={18} /> : <Eye size={18} />}
              <span className="toggle-label">
                {isSpymasterView ? 'SPYMASTER VIEW' : 'OPERATIVE VIEW'}
              </span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={onToggleMute}
            className="icon-control-btn"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Rules Modal Trigger */}
          <button
            onClick={onOpenRules}
            className="icon-control-btn"
            title="How to Play / Rules"
            aria-label="Rules"
          >
            <BookOpen size={18} />
          </button>

          {/* Host Game Controls (Restart & New Game) */}
          {isHost && (
            <>
              <button
                onClick={onRestartGame}
                className="btn-secondary"
                title="Reset current game board with the same 25 movies"
              >
                <RotateCcw size={16} />
                <span className="btn-text">Restart</span>
              </button>

              <button
                onClick={onNewGame}
                className="btn-primary-gold"
                title="Generate a brand new game with 25 fresh Telugu movies"
              >
                <PlusCircle size={16} />
                <span className="btn-text">New Game</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* SCORE & TURN STATUS BAR */}
      <div className="status-scoreboard-bar">
        {/* RED TEAM SCORE */}
        <div className={`team-score-card red-team ${currentTeam === 'RED' && phase !== 'GAME_OVER' ? 'active-turn' : ''}`}>
          <div className="score-header">
            <span className="team-badge red">RED TEAM</span>
            {currentTeam === 'RED' && phase !== 'GAME_OVER' && (
              <span className="turn-pulse-indicator">PLAYING</span>
            )}
          </div>
          <div className="score-value-row">
            <span className="score-number">{remainingRed}</span>
            <span className="score-label">Cards Left</span>
          </div>
        </div>

        {/* CENTER MATCH STATE BADGE */}
        <div className="center-match-status">
          {phase === 'GAME_OVER' ? (
            <div className="status-phase-badge game-over">
              <span>MATCH FINISHED</span>
            </div>
          ) : (
            <div className={`status-phase-badge ${currentTeam.toLowerCase()}-turn`}>
              <span className="phase-turn-team">{currentTeam} TEAM</span>
              <span className="phase-turn-action">
                {phase === 'CLUE_GIVING' ? '• Spymaster giving clue' : '• Operatives guessing'}
              </span>
            </div>
          )}
        </div>

        {/* BLUE TEAM SCORE */}
        <div className={`team-score-card blue-team ${currentTeam === 'BLUE' && phase !== 'GAME_OVER' ? 'active-turn' : ''}`}>
          <div className="score-header">
            <span className="team-badge blue">BLUE TEAM</span>
            {currentTeam === 'BLUE' && phase !== 'GAME_OVER' && (
              <span className="turn-pulse-indicator">PLAYING</span>
            )}
          </div>
          <div className="score-value-row">
            <span className="score-number">{remainingBlue}</span>
            <span className="score-label">Cards Left</span>
          </div>
        </div>
      </div>
    </header>
  );
};
