import React, { useState } from 'react';
import { LobbyState, Player, ReadinessCheck, RoomSettings, PlayerTeam, PlayerRole } from '../../types/multiplayer';
import { Copy, Check, Lock, Unlock, Settings, Crown, Play, LogOut, ShieldAlert, Sparkles, Eye } from 'lucide-react';
import { sounds } from '../../game/soundEffects';
import { LobbySettingsModal } from './LobbySettingsModal';
import { PlayerAdminModal } from './PlayerAdminModal';

interface MultiplayerLobbyProps {
  lobby: LobbyState;
  currentPlayer: Player;
  readiness: ReadinessCheck;
  onSelectTeamRole: (team: PlayerTeam, role: PlayerRole) => void;
  onToggleTeamLock: (target: 'RED' | 'BLUE' | 'ALL') => void;
  onUpdateSettings: (settings: Partial<RoomSettings>) => void;
  onMovePlayer: (targetId: string, team: PlayerTeam, role: PlayerRole) => void;
  onKickPlayer: (targetId: string) => void;
  onTransferHost: (targetId: string) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  lobby,
  currentPlayer,
  readiness,
  onSelectTeamRole,
  onToggleTeamLock,
  onUpdateSettings,
  onMovePlayer,
  onKickPlayer,
  onTransferHost,
  onStartGame,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedAdminPlayer, setSelectedAdminPlayer] = useState<Player | null>(null);

  const isHost = currentPlayer.isHost;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(lobby.roomCode);
    sounds.playClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const redSpymaster = lobby.players.find((p) => p.team === 'RED' && p.role === 'SPYMASTER' && p.isConnected);
  const redOperatives = lobby.players.filter((p) => p.team === 'RED' && p.role === 'OPERATIVE' && p.isConnected);

  const blueSpymaster = lobby.players.find((p) => p.team === 'BLUE' && p.role === 'SPYMASTER' && p.isConnected);
  const blueOperatives = lobby.players.filter((p) => p.team === 'BLUE' && p.role === 'OPERATIVE' && p.isConnected);

  const spectators = lobby.players.filter((p) => (p.team === 'SPECTATOR' || p.role === 'SPECTATOR') && p.isConnected);
  const unassigned = lobby.players.filter((p) => !p.team && p.isConnected);

  const isRedLocked = lobby.redLocked;
  const isBlueLocked = lobby.blueLocked;

  const canJoinRed = !isRedLocked || currentPlayer.team === 'RED' || isHost;
  const canJoinBlue = !isBlueLocked || currentPlayer.team === 'BLUE' || isHost;

  const handleSelectRole = (team: PlayerTeam, role: PlayerRole) => {
    sounds.playClick();
    onSelectTeamRole(team, role);
  };

  return (
    <div className="lobby-root">
      {/* AMBIENT LIGHTS */}
      <div className="ambient-glow glow-red" />
      <div className="ambient-glow glow-blue" />
      <div className="ambient-glow glow-gold" />

      <div className="lobby-container">
        {/* TOP LOBBY HEADER BAR */}
        <header className="lobby-header-bar">
          <div className="lobby-room-badge-group">
            <span className="room-code-label">ROOM CODE</span>
            <div className="room-code-pill" onClick={handleCopyCode} title="Click to Copy Room Code">
              <span className="room-code-text">{lobby.roomCode}</span>
              <button className="copy-code-btn" aria-label="Copy Room Code">
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
            {copied && <span className="copy-feedback-text">Copied!</span>}
            {/* Invite Link Copy */}
            <div className="invite-link-pill" style={{marginTop: '8px'}} onClick={() => {
              const inviteUrl = `${window.location.origin}/room/${lobby.roomCode}`;
              navigator.clipboard.writeText(inviteUrl);
              sounds.playClick();
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }} title="Click to Copy Invite Link">
              <span className="room-code-text">Invite Link</span>
              <button className="copy-code-btn" aria-label="Copy Invite Link">
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
            {copied && <span className="copy-feedback-text">Link Copied!</span>}
          </div>

          <div className="lobby-header-actions">
            {isHost && (
              <>
                <button
                  onClick={() => {
                    sounds.playClick();
                    onToggleTeamLock('ALL');
                  }}
                  className="btn-lobby-secondary"
                  title="Toggle lock on all teams"
                >
                  {isRedLocked && isBlueLocked ? <Unlock size={16} /> : <Lock size={16} />}
                  <span>{isRedLocked && isBlueLocked ? 'Unlock All' : 'Lock All'}</span>
                </button>

                <button
                  onClick={() => {
                    sounds.playClick();
                    setIsSettingsOpen(true);
                  }}
                  className="btn-lobby-secondary"
                  title="Match Settings"
                >
                  <Settings size={16} />
                  <span>Settings</span>
                </button>
              </>
            )}

            {!isHost && (
              <button
                onClick={() => {
                  sounds.playClick();
                  setIsSettingsOpen(true);
                }}
                className="btn-lobby-secondary"
                title="View Match Settings"
              >
                <Settings size={16} />
                <span>View Settings</span>
              </button>
            )}

            <button
              onClick={() => {
                sounds.playClick();
                if (confirm('Leave this multiplayer room?')) onLeaveRoom();
              }}
              className="btn-lobby-danger"
              title="Leave Room"
            >
              <LogOut size={16} />
              <span>Leave</span>
            </button>
          </div>
        </header>

        {/* ROLE SELECTION PROMPT (If unassigned) */}
        {!currentPlayer.team && (
          <div className="unassigned-prompt-banner">
            <Sparkles size={20} className="text-amber-400" />
            <div className="prompt-text-group">
              <h3>CHOOSE YOUR SIDE</h3>
              <p>Join RED TEAM or BLUE TEAM to choose your role as Spymaster or Operative.</p>
            </div>
            <div className="quick-team-buttons">
              <button
                onClick={() => handleSelectRole('RED', 'OPERATIVE')}
                disabled={!canJoinRed}
                className="btn-quick-join btn-red"
              >
                Join Red Team
              </button>
              <button
                onClick={() => handleSelectRole('BLUE', 'OPERATIVE')}
                disabled={!canJoinBlue}
                className="btn-quick-join btn-blue"
              >
                Join Blue Team
              </button>
            </div>
          </div>
        )}

        {/* TWO LARGE TEAM PANELS */}
        <div className="lobby-teams-grid">
          {/* ================= RED TEAM PANEL ================= */}
          <div className={`team-lobby-card red-card ${isRedLocked ? 'is-locked' : ''}`}>
            <div className="team-panel-header">
              <div className="team-title-row">
                <span className="team-indicator-dot red" />
                <h2>RED TEAM</h2>
                {isRedLocked && (
                  <span className="locked-badge">
                    <Lock size={12} /> LOCKED
                  </span>
                )}
              </div>

              {isHost && (
                <button
                  onClick={() => {
                    sounds.playClick();
                    onToggleTeamLock('RED');
                  }}
                  className="btn-lock-toggle"
                  title={isRedLocked ? 'Unlock Red Team' : 'Lock Red Team'}
                >
                  {isRedLocked ? <Unlock size={14} /> : <Lock size={14} />}
                  <span>{isRedLocked ? 'Unlock Team' : 'Lock Team'}</span>
                </button>
              )}
            </div>

            {/* Red Spymaster Slot */}
            <div className="role-slot-section">
              <div className="slot-header">
                <span className="role-title">🕵️ SPYMASTER (1 Role Only)</span>
                {redSpymaster && <span className="slot-occupied-lock">🔒 OCCUPIED</span>}
              </div>

              {redSpymaster ? (
                <div
                  className={`player-item-card is-spymaster ${redSpymaster.id === currentPlayer.id ? 'is-you' : ''}`}
                  onClick={() => isHost && setSelectedAdminPlayer(redSpymaster)}
                >
                  <div className="player-info">
                    <span className="player-name">{redSpymaster.name}</span>
                    {redSpymaster.isHost && <span className="host-pill"><Crown size={12} /> HOST</span>}
                    {redSpymaster.id === currentPlayer.id && <span className="you-pill">YOU</span>}
                  </div>
                  {isHost && <span className="admin-manage-hint">Manage</span>}
                </div>
              ) : (
                <div className="vacant-slot-card">
                  <span className="vacant-text">Spymaster role vacant</span>
                  {canJoinRed && (
                    <button
                      onClick={() => handleSelectRole('RED', 'SPYMASTER')}
                      className="btn-claim-role btn-claim-red"
                    >
                      Become Red Spymaster
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Red Operatives List */}
            <div className="role-slot-section">
              <div className="slot-header">
                <span className="role-title">👥 OPERATIVES ({redOperatives.length})</span>
                {canJoinRed && (
                  <button
                    onClick={() => handleSelectRole('RED', 'OPERATIVE')}
                    className="btn-join-operatives btn-join-red-op"
                  >
                    Join as Operative
                  </button>
                )}
              </div>

              <div className="operatives-list">
                {redOperatives.length === 0 ? (
                  <div className="empty-operatives-state">No operatives yet</div>
                ) : (
                  redOperatives.map((op) => (
                    <div
                      key={op.id}
                      className={`player-item-card ${op.id === currentPlayer.id ? 'is-you' : ''}`}
                      onClick={() => isHost && setSelectedAdminPlayer(op)}
                    >
                      <div className="player-info">
                        <span className="player-name">{op.name}</span>
                        {op.isHost && <span className="host-pill"><Crown size={12} /> HOST</span>}
                        {op.id === currentPlayer.id && <span className="you-pill">YOU</span>}
                      </div>
                      {isHost && <span className="admin-manage-hint">Manage</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ================= BLUE TEAM PANEL ================= */}
          <div className={`team-lobby-card blue-card ${isBlueLocked ? 'is-locked' : ''}`}>
            <div className="team-panel-header">
              <div className="team-title-row">
                <span className="team-indicator-dot blue" />
                <h2>BLUE TEAM</h2>
                {isBlueLocked && (
                  <span className="locked-badge">
                    <Lock size={12} /> LOCKED
                  </span>
                )}
              </div>

              {isHost && (
                <button
                  onClick={() => {
                    sounds.playClick();
                    onToggleTeamLock('BLUE');
                  }}
                  className="btn-lock-toggle"
                  title={isBlueLocked ? 'Unlock Blue Team' : 'Lock Blue Team'}
                >
                  {isBlueLocked ? <Unlock size={14} /> : <Lock size={14} />}
                  <span>{isBlueLocked ? 'Unlock Team' : 'Lock Team'}</span>
                </button>
              )}
            </div>

            {/* Blue Spymaster Slot */}
            <div className="role-slot-section">
              <div className="slot-header">
                <span className="role-title">🕵️ SPYMASTER (1 Role Only)</span>
                {blueSpymaster && <span className="slot-occupied-lock">🔒 OCCUPIED</span>}
              </div>

              {blueSpymaster ? (
                <div
                  className={`player-item-card is-spymaster ${blueSpymaster.id === currentPlayer.id ? 'is-you' : ''}`}
                  onClick={() => isHost && setSelectedAdminPlayer(blueSpymaster)}
                >
                  <div className="player-info">
                    <span className="player-name">{blueSpymaster.name}</span>
                    {blueSpymaster.isHost && <span className="host-pill"><Crown size={12} /> HOST</span>}
                    {blueSpymaster.id === currentPlayer.id && <span className="you-pill">YOU</span>}
                  </div>
                  {isHost && <span className="admin-manage-hint">Manage</span>}
                </div>
              ) : (
                <div className="vacant-slot-card">
                  <span className="vacant-text">Spymaster role vacant</span>
                  {canJoinBlue && (
                    <button
                      onClick={() => handleSelectRole('BLUE', 'SPYMASTER')}
                      className="btn-claim-role btn-claim-blue"
                    >
                      Become Blue Spymaster
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Blue Operatives List */}
            <div className="role-slot-section">
              <div className="slot-header">
                <span className="role-title">👥 OPERATIVES ({blueOperatives.length})</span>
                {canJoinBlue && (
                  <button
                    onClick={() => handleSelectRole('BLUE', 'OPERATIVE')}
                    className="btn-join-operatives btn-join-blue-op"
                  >
                    Join as Operative
                  </button>
                )}
              </div>

              <div className="operatives-list">
                {blueOperatives.length === 0 ? (
                  <div className="empty-operatives-state">No operatives yet</div>
                ) : (
                  blueOperatives.map((op) => (
                    <div
                      key={op.id}
                      className={`player-item-card ${op.id === currentPlayer.id ? 'is-you' : ''}`}
                      onClick={() => isHost && setSelectedAdminPlayer(op)}
                    >
                      <div className="player-info">
                        <span className="player-name">{op.name}</span>
                        {op.isHost && <span className="host-pill"><Crown size={12} /> HOST</span>}
                        {op.id === currentPlayer.id && <span className="you-pill">YOU</span>}
                      </div>
                      {isHost && <span className="admin-manage-hint">Manage</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SPECTATORS & UNASSIGNED POOL */}
        <div className="lobby-auxiliary-panel">
          <div className="aux-column">
            <div className="aux-header">
              <Eye size={16} className="text-amber-400" />
              <span>Spectators ({spectators.length})</span>
              {lobby.settings.allowSpectators && currentPlayer.role !== 'SPECTATOR' && (
                <button
                  onClick={() => handleSelectRole('SPECTATOR', 'SPECTATOR')}
                  className="btn-aux-join"
                >
                  Watch as Spectator
                </button>
              )}
            </div>
            <div className="aux-players-list">
              {spectators.length === 0 ? (
                <span className="empty-hint">No spectators</span>
              ) : (
                spectators.map((spec) => (
                  <span key={spec.id} className="aux-player-pill">
                    {spec.name} {spec.isHost && '👑'} {spec.id === currentPlayer.id && '(YOU)'}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="aux-column">
            <div className="aux-header">
              <Eye size={16} className="text-stone-400" />
              <span>Unassigned Players ({unassigned.length})</span>
            </div>
            <div className="aux-players-list">
              {unassigned.length === 0 ? (
                <span className="empty-hint">Everyone has chosen a side!</span>
              ) : (
                unassigned.map((un) => (
                  <span key={un.id} className="aux-player-pill unassigned">
                    {un.name} {un.isHost && '👑'} {un.id === currentPlayer.id && '(YOU)'}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* READINESS & START GAME CONTROLS */}
        <div className="lobby-readiness-footer">
          <div className="readiness-summary-card">
            <div className="readiness-team-status">
              <span className="status-team-name red">RED TEAM:</span>
              <span className={readiness.redSpymasterReady ? 'status-ok' : 'status-pending'}>
                {readiness.redSpymasterReady ? '✓ Spymaster ready' : '✗ Needs Spymaster'}
              </span>
              <span className="status-bullet">•</span>
              <span className={readiness.redOperativesCount > 0 ? 'status-ok' : 'status-pending'}>
                {readiness.redOperativesCount > 0 ? `✓ ${readiness.redOperativesCount} Operative(s)` : '✗ Needs Operative'}
              </span>
            </div>

            <div className="readiness-team-status">
              <span className="status-team-name blue">BLUE TEAM:</span>
              <span className={readiness.blueSpymasterReady ? 'status-ok' : 'status-pending'}>
                {readiness.blueSpymasterReady ? '✓ Spymaster ready' : '✗ Needs Spymaster'}
              </span>
              <span className="status-bullet">•</span>
              <span className={readiness.blueOperativesCount > 0 ? 'status-ok' : 'status-pending'}>
                {readiness.blueOperativesCount > 0 ? `✓ ${readiness.blueOperativesCount} Operative(s)` : '✗ Needs Operative'}
              </span>
            </div>

            {!readiness.isReady && (
              <div className="missing-requirements-notice">
                <ShieldAlert size={16} />
                <span>{readiness.missingRequirements[0] || 'Lobby waiting for players to take required roles.'}</span>
              </div>
            )}
          </div>

          <div className="start-game-btn-wrapper">
            {isHost ? (
              <button
                onClick={() => {
                  sounds.playClick();
                  onStartGame();
                }}
                disabled={!readiness.isReady}
                className="btn-start-match"
                id="btn-start-multiplayer-game"
              >
                <Play size={20} />
                <span>START GAME</span>
              </button>
            ) : (
              <div className="non-host-waiting-badge">
                <span>Waiting for Host ({lobby.hostName}) to start the game...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LOBBY SETTINGS MODAL */}
      <LobbySettingsModal
        isOpen={isSettingsOpen}
        settings={lobby.settings}
        isHost={isHost}
        onClose={() => setIsSettingsOpen(false)}
        onSaveSettings={onUpdateSettings}
      />

      {/* PLAYER ADMIN MODAL (Host Only) */}
      <PlayerAdminModal
        isOpen={!!selectedAdminPlayer}
        targetPlayer={selectedAdminPlayer}
        onClose={() => setSelectedAdminPlayer(null)}
        onMovePlayer={onMovePlayer}
        onKickPlayer={onKickPlayer}
        onTransferHost={onTransferHost}
      />
    </div>
  );
};
