import React from 'react';
import { Player } from '../../types/multiplayer';
import { Shield, UserMinus, Crown, X } from 'lucide-react';
import { sounds } from '../../game/soundEffects';

interface PlayerAdminModalProps {
  isOpen: boolean;
  targetPlayer: Player | null;
  onClose: () => void;
  onMovePlayer: (targetId: string, team: 'RED' | 'BLUE' | 'SPECTATOR' | null, role: 'SPYMASTER' | 'OPERATIVE' | 'SPECTATOR' | null) => void;
  onKickPlayer: (targetId: string) => void;
  onTransferHost: (targetId: string) => void;
}

export const PlayerAdminModal: React.FC<PlayerAdminModalProps> = ({
  isOpen,
  targetPlayer,
  onClose,
  onMovePlayer,
  onKickPlayer,
  onTransferHost,
}) => {
  if (!isOpen || !targetPlayer) return null;

  const isTargetHost = targetPlayer.isHost;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="player-admin-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div className="modal-title-group">
            <Shield size={20} className="text-amber-400" />
            <h2>Manage: {targetPlayer.name}</h2>
          </div>
          <button onClick={onClose} className="close-modal-btn">
            <X size={20} />
          </button>
        </div>

        <div className="player-admin-body">
          <div className="player-current-status">
            <span>Team: <strong>{targetPlayer.team || 'Unassigned'}</strong></span>
            <span>Role: <strong>{targetPlayer.role || 'None'}</strong></span>
          </div>

          <div className="admin-actions-section">
            <h3>Assign Role</h3>
            <div className="role-assign-grid">
              <button
                onClick={() => {
                  sounds.playClick();
                  onMovePlayer(targetPlayer.id, 'RED', 'SPYMASTER');
                  onClose();
                }}
                className="btn-assign btn-assign-red-spy"
              >
                🔴 Red Spymaster
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  onMovePlayer(targetPlayer.id, 'RED', 'OPERATIVE');
                  onClose();
                }}
                className="btn-assign btn-assign-red-op"
              >
                👥 Red Operative
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  onMovePlayer(targetPlayer.id, 'BLUE', 'SPYMASTER');
                  onClose();
                }}
                className="btn-assign btn-assign-blue-spy"
              >
                🔵 Blue Spymaster
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  onMovePlayer(targetPlayer.id, 'BLUE', 'OPERATIVE');
                  onClose();
                }}
                className="btn-assign btn-assign-blue-op"
              >
                👥 Blue Operative
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  onMovePlayer(targetPlayer.id, 'SPECTATOR', 'SPECTATOR');
                  onClose();
                }}
                className="btn-assign btn-assign-spectator"
              >
                👁️ Spectator
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  onMovePlayer(targetPlayer.id, null, null);
                  onClose();
                }}
                className="btn-assign btn-assign-unassign"
              >
                Unassign
              </button>
            </div>
          </div>

          {!isTargetHost && (
            <div className="admin-danger-section">
              <button
                onClick={() => {
                  sounds.playClick();
                  if (confirm(`Transfer HOST privileges to ${targetPlayer.name}?`)) {
                    onTransferHost(targetPlayer.id);
                    onClose();
                  }
                }}
                className="btn-admin-action btn-transfer-host"
              >
                <Crown size={16} />
                <span>Make Room Host</span>
              </button>

              <button
                onClick={() => {
                  sounds.playClick();
                  if (confirm(`Remove ${targetPlayer.name} from the room?`)) {
                    onKickPlayer(targetPlayer.id);
                    onClose();
                  }
                }}
                className="btn-admin-action btn-kick"
              >
                <UserMinus size={16} />
                <span>Kick / Remove Player</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
