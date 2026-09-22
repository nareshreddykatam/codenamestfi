import React, { useState } from 'react';
import { RoomSettings } from '../../types/multiplayer';
import { Settings, X, Timer, Infinity, Eye, Check } from 'lucide-react';
import { sounds } from '../../game/soundEffects';

interface LobbySettingsModalProps {
  isOpen: boolean;
  settings: RoomSettings;
  isHost: boolean;
  onClose: () => void;
  onSaveSettings: (newSettings: Partial<RoomSettings>) => void;
}

export const LobbySettingsModal: React.FC<LobbySettingsModalProps> = ({
  isOpen,
  settings,
  isHost,
  onClose,
  onSaveSettings,
}) => {
  const [turnTimer, setTurnTimer] = useState<0 | 30 | 60 | 90 | 120>(settings.turnTimerSeconds);
  const [unlimitedClues, setUnlimitedClues] = useState<boolean>(settings.unlimitedClues);
  const [allowSpectators, setAllowSpectators] = useState<boolean>(settings.allowSpectators);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    onSaveSettings({
      turnTimerSeconds: turnTimer,
      unlimitedClues,
      allowSpectators,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div className="modal-title-group">
            <Settings size={22} className="text-amber-400" />
            <h2>Lobby Match Settings</h2>
          </div>
          <button onClick={onClose} className="close-modal-btn">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="settings-form">
          {/* Turn Timer */}
          <div className="setting-item-row">
            <div className="setting-info">
              <div className="setting-label">
                <Timer size={18} className="text-amber-400" />
                <span>Turn Timer</span>
              </div>
              <p className="setting-desc">Sets maximum guessing time per turn before automatically passing.</p>
            </div>
            <select
              value={turnTimer}
              disabled={!isHost}
              onChange={(e) => setTurnTimer(Number(e.target.value) as 0 | 30 | 60 | 90 | 120)}
              className="setting-select"
            >
              <option value={0}>OFF (No Timer)</option>
              <option value={30}>30 Seconds</option>
              <option value={60}>60 Seconds</option>
              <option value={90}>90 Seconds</option>
              <option value={120}>120 Seconds</option>
            </select>
          </div>

          {/* Unlimited Clues */}
          <div className="setting-item-row">
            <div className="setting-info">
              <div className="setting-label">
                <Infinity size={18} className="text-amber-400" />
                <span>Unlimited Clues</span>
              </div>
              <p className="setting-desc">Allows Spymaster to submit unlimited (∞) or 0 clues.</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={unlimitedClues}
                disabled={!isHost}
                onChange={(e) => setUnlimitedClues(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Spectators */}
          <div className="setting-item-row">
            <div className="setting-info">
              <div className="setting-label">
                <Eye size={18} className="text-amber-400" />
                <span>Allow Spectators</span>
              </div>
              <p className="setting-desc">Allows unassigned players to watch the game without voting.</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={allowSpectators}
                disabled={!isHost}
                onChange={(e) => setAllowSpectators(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {!isHost && (
            <div className="host-only-note">
              🔒 Only the host can adjust match settings.
            </div>
          )}

          <div className="settings-actions">
            {isHost ? (
              <button type="submit" className="btn-primary-gold">
                <Check size={18} />
                <span>Apply & Save Settings</span>
              </button>
            ) : (
              <button type="button" onClick={onClose} className="btn-secondary">
                Close
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
