import React, { useState } from 'react';
import { Player, LobbyState } from '../../types/multiplayer';
import { Users, Crown, ChevronRight, ChevronLeft, Shield, WifiOff } from 'lucide-react';
import { sounds } from '../../game/soundEffects';

interface InGamePlayerListProps {
  lobby: LobbyState;
  currentPlayer: Player;
  onSelectAdminPlayer: (player: Player) => void;
}

export const InGamePlayerList: React.FC<InGamePlayerListProps> = ({
  lobby,
  currentPlayer,
  onSelectAdminPlayer,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const isHost = currentPlayer.isHost;

  const redSpymaster = lobby.players.find((p) => p.team === 'RED' && p.role === 'SPYMASTER');
  const redOperatives = lobby.players.filter((p) => p.team === 'RED' && p.role === 'OPERATIVE');

  const blueSpymaster = lobby.players.find((p) => p.team === 'BLUE' && p.role === 'SPYMASTER');
  const blueOperatives = lobby.players.filter((p) => p.team === 'BLUE' && p.role === 'OPERATIVE');

  const spectators = lobby.players.filter((p) => p.team === 'SPECTATOR' || p.role === 'SPECTATOR' || (!p.team && p.isConnected));

  const handlePlayerClick = (player: Player) => {
    if (isHost) {
      sounds.playClick();
      onSelectAdminPlayer(player);
    }
  };

  return (
    <aside className={`in-game-player-list-root ${isOpen ? 'is-open' : 'is-collapsed'}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="in-game-player-toggle-btn"
        title={isOpen ? 'Collapse Players Panel' : 'Expand Players Panel'}
        aria-label={isOpen ? 'Collapse Players Panel' : 'Expand Players Panel'}
      >
        <Users size={16} />
        <span className="toggle-btn-text">PLAYERS ({lobby.players.length})</span>
        {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {isOpen && (
        <div className="in-game-player-panel-content">
          <div className="player-panel-header">
            <div className="header-title-group">
              <Users size={16} className="text-amber-400" />
              <h3>Match Roster</h3>
            </div>
            {isHost && (
              <span className="host-admin-hint">
                <Shield size={12} /> Host Mode Active
              </span>
            )}
          </div>

          <div className="roster-teams-wrapper">
            {/* RED TEAM ROSTER */}
            <div className="roster-team-group red-roster">
              <div className="roster-team-header">
                <span className="team-dot red" />
                <span className="team-title-text">RED TEAM</span>
              </div>

              <div className="roster-role-group">
                <span className="role-subhead">Spymaster</span>
                {redSpymaster ? (
                  <div
                    className={`roster-player-item ${redSpymaster.id === currentPlayer.id ? 'is-you' : ''} ${!redSpymaster.isConnected ? 'is-disconnected' : ''}`}
                    onClick={() => handlePlayerClick(redSpymaster)}
                    role={isHost ? 'button' : undefined}
                  >
                    <span className="player-icon">🕵️</span>
                    <span className="player-name-text">{redSpymaster.name}</span>
                    {redSpymaster.isHost && <Crown size={12} className="host-crown-icon" />}
                    {redSpymaster.id === currentPlayer.id && <span className="you-tag">YOU</span>}
                    {!redSpymaster.isConnected && (
                      <span className="disconnected-tag" title="Disconnected">
                        <WifiOff size={10} />
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="roster-empty-slot">Vacant</span>
                )}
              </div>

              <div className="roster-role-group">
                <span className="role-subhead">Operatives ({redOperatives.length})</span>
                {redOperatives.length === 0 ? (
                  <span className="roster-empty-slot">No operatives</span>
                ) : (
                  redOperatives.map((op) => (
                    <div
                      key={op.id}
                      className={`roster-player-item ${op.id === currentPlayer.id ? 'is-you' : ''} ${!op.isConnected ? 'is-disconnected' : ''}`}
                      onClick={() => handlePlayerClick(op)}
                      role={isHost ? 'button' : undefined}
                    >
                      <span className="player-icon">👤</span>
                      <span className="player-name-text">{op.name}</span>
                      {op.isHost && <Crown size={12} className="host-crown-icon" />}
                      {op.id === currentPlayer.id && <span className="you-tag">YOU</span>}
                      {!op.isConnected && (
                        <span className="disconnected-tag" title="Disconnected">
                          <WifiOff size={10} />
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* BLUE TEAM ROSTER */}
            <div className="roster-team-group blue-roster">
              <div className="roster-team-header">
                <span className="team-dot blue" />
                <span className="team-title-text">BLUE TEAM</span>
              </div>

              <div className="roster-role-group">
                <span className="role-subhead">Spymaster</span>
                {blueSpymaster ? (
                  <div
                    className={`roster-player-item ${blueSpymaster.id === currentPlayer.id ? 'is-you' : ''} ${!blueSpymaster.isConnected ? 'is-disconnected' : ''}`}
                    onClick={() => handlePlayerClick(blueSpymaster)}
                    role={isHost ? 'button' : undefined}
                  >
                    <span className="player-icon">🕵️</span>
                    <span className="player-name-text">{blueSpymaster.name}</span>
                    {blueSpymaster.isHost && <Crown size={12} className="host-crown-icon" />}
                    {blueSpymaster.id === currentPlayer.id && <span className="you-tag">YOU</span>}
                    {!blueSpymaster.isConnected && (
                      <span className="disconnected-tag" title="Disconnected">
                        <WifiOff size={10} />
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="roster-empty-slot">Vacant</span>
                )}
              </div>

              <div className="roster-role-group">
                <span className="role-subhead">Operatives ({blueOperatives.length})</span>
                {blueOperatives.length === 0 ? (
                  <span className="roster-empty-slot">No operatives</span>
                ) : (
                  blueOperatives.map((op) => (
                    <div
                      key={op.id}
                      className={`roster-player-item ${op.id === currentPlayer.id ? 'is-you' : ''} ${!op.isConnected ? 'is-disconnected' : ''}`}
                      onClick={() => handlePlayerClick(op)}
                      role={isHost ? 'button' : undefined}
                    >
                      <span className="player-icon">👤</span>
                      <span className="player-name-text">{op.name}</span>
                      {op.isHost && <Crown size={12} className="host-crown-icon" />}
                      {op.id === currentPlayer.id && <span className="you-tag">YOU</span>}
                      {!op.isConnected && (
                        <span className="disconnected-tag" title="Disconnected">
                          <WifiOff size={10} />
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SPECTATORS */}
            {spectators.length > 0 && (
              <div className="roster-team-group spec-roster">
                <div className="roster-team-header">
                  <span className="team-title-text">SPECTATORS ({spectators.length})</span>
                </div>
                <div className="roster-role-group">
                  {spectators.map((spec) => (
                    <div
                      key={spec.id}
                      className={`roster-player-item ${spec.id === currentPlayer.id ? 'is-you' : ''}`}
                      onClick={() => handlePlayerClick(spec)}
                      role={isHost ? 'button' : undefined}
                    >
                      <span className="player-icon">👁️</span>
                      <span className="player-name-text">{spec.name}</span>
                      {spec.isHost && <Crown size={12} className="host-crown-icon" />}
                      {spec.id === currentPlayer.id && <span className="you-tag">YOU</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
