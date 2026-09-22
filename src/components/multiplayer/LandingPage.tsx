import React, { useState, useEffect } from 'react';
import {
  Film,
  PlusCircle,
  Users,
  ArrowRight,
  Play,
  X,
  Sparkles,
} from 'lucide-react';
import { sounds } from '../../game/soundEffects';

interface LandingPageProps {
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  onPlayLocal: () => void;
  isLoading: boolean;
  errorMessage: string;
  onClearError: () => void;
  prefilledRoomCode?: string;
}

type ModalMode = 'NONE' | 'CREATE' | 'JOIN';

export const LandingPage: React.FC<LandingPageProps> = ({
  onCreateRoom,
  onJoinRoom,
  onPlayLocal,
  isLoading,
  errorMessage,
  onClearError,
  prefilledRoomCode,
}) => {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [modalMode, setModalMode] =
    useState<ModalMode>('NONE');

  /*
   * Detect room code from:
   *
   * 1. prefilledRoomCode supplied by App.tsx
   * 2. Direct invite URL:
   *
   *    /room/AB7KQ2
   *
   * This allows a player to open a shared invite
   * link and automatically see the Join Room modal.
   */
  useEffect(() => {
    let detectedRoomCode =
      prefilledRoomCode?.trim();

    if (!detectedRoomCode) {
      const pathParts =
        window.location.pathname
          .split('/')
          .filter(Boolean);

      if (
        pathParts.length >= 2 &&
        pathParts[0].toLowerCase() === 'room'
      ) {
        detectedRoomCode =
          pathParts[1];
      }
    }

    if (
      detectedRoomCode &&
      /^[A-Za-z0-9]{6}$/.test(
        detectedRoomCode
      )
    ) {
      setRoomCode(
        detectedRoomCode.toUpperCase()
      );

      setModalMode('JOIN');
    }
  }, [prefilledRoomCode]);

  const handleOpenCreate = () => {
    sounds.playClick();
    onClearError();

    setModalMode('CREATE');
  };

  const handleOpenJoin = () => {
    sounds.playClick();
    onClearError();

    setModalMode('JOIN');
  };

  const handleCloseModal = () => {
    setModalMode('NONE');
    onClearError();
  };

  const handleCreateSubmit = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const trimmedName =
      playerName.trim();

    if (!trimmedName) {
      return;
    }

    onCreateRoom(trimmedName);
  };

  const handleJoinSubmit = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const trimmedName =
      playerName.trim();

    const normalizedRoomCode =
      roomCode.trim().toUpperCase();

    if (
      !trimmedName ||
      !normalizedRoomCode
    ) {
      return;
    }

    if (
      !/^[A-Za-z0-9]{6}$/.test(
        normalizedRoomCode
      )
    ) {
      return;
    }

    onJoinRoom(
      normalizedRoomCode,
      trimmedName
    );
  };

  return (
    <div className="landing-page-root">
      {/* BACKGROUND AMBIENT GLOWS */}
      <div className="ambient-glow glow-red" />
      <div className="ambient-glow glow-blue" />
      <div className="ambient-glow glow-gold" />

      <div className="landing-container">
        {/* HERO BRANDING */}
        <div className="landing-hero-card">
          <div className="landing-badge">
            <Sparkles
              size={16}
              className="text-amber-400"
            />

            <span>
              Tollywood Cinema Multiplayer
            </span>
          </div>

          <div className="landing-brand-title-group">
            <div className="landing-film-icon-badge">
              <Film
                size={42}
                className="landing-film-icon"
              />
            </div>

            <h1 className="landing-main-title">
              TFI{' '}
              <span className="highlight-gold">
                CODENAMES
              </span>
            </h1>

            <p className="landing-subtitle">
              Telugu Cinema × Codenames
            </p>
          </div>

          <p className="landing-description">
            Connect with friends, choose your
            team and role, then battle through
            Telugu cinema.
          </p>

          {/* PRIMARY ACTION BUTTONS */}
          <div className="landing-action-buttons">
            <button
              onClick={handleOpenCreate}
              className="btn-landing-primary"
              id="btn-create-room"
            >
              <PlusCircle size={20} />

              <span>
                CREATE ROOM
              </span>
            </button>

            <button
              onClick={handleOpenJoin}
              className="btn-landing-secondary"
              id="btn-join-room"
            >
              <Users size={20} />

              <span>
                JOIN ROOM
              </span>
            </button>
          </div>

          {/* LOCAL PASS & PLAY OPTION */}
          <div className="landing-footer-option">
            <button
              onClick={() => {
                sounds.playClick();
                onPlayLocal();
              }}
              className="btn-pass-play"
            >
              <Play size={15} />

              <span>
                Or Play Local Pass & Play
                on this device
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ==========================================
          CREATE ROOM MODAL
          ========================================== */}
      {modalMode === 'CREATE' && (
        <div
          className="modal-backdrop"
          onClick={handleCloseModal}
        >
          <div
            className="landing-modal-card"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="modal-header-row">
              <div className="modal-title-group">
                <PlusCircle
                  size={22}
                  className="text-amber-400"
                />

                <h2>
                  Create Multiplayer Room
                </h2>
              </div>

              <button
                onClick={handleCloseModal}
                className="close-modal-btn"
                type="button"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              className="landing-form"
            >
              <div className="form-group">
                <label htmlFor="create-player-name">
                  Your Player Name
                </label>

                <input
                  id="create-player-name"
                  type="text"
                  placeholder="e.g. Naresh, Rahul, Sai..."
                  value={playerName}
                  onChange={(e) =>
                    setPlayerName(
                      e.target.value
                    )
                  }
                  maxLength={20}
                  required
                  autoFocus
                  autoComplete="name"
                  className="landing-input"
                />
              </div>

              {errorMessage && (
                <div className="form-error-banner">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isLoading ||
                  !playerName.trim()
                }
                className="btn-form-submit"
              >
                <span>
                  {isLoading
                    ? 'Creating Room...'
                    : 'Create & Enter Lobby'}
                </span>

                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          JOIN ROOM MODAL
          ========================================== */}
      {modalMode === 'JOIN' && (
        <div
          className="modal-backdrop"
          onClick={handleCloseModal}
        >
          <div
            className="landing-modal-card"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="modal-header-row">
              <div className="modal-title-group">
                <Users
                  size={22}
                  className="text-blue-400"
                />

                <h2>
                  Join Multiplayer Room
                </h2>
              </div>

              <button
                onClick={handleCloseModal}
                className="close-modal-btn"
                type="button"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleJoinSubmit}
              className="landing-form"
            >
              <div className="form-group">
                <label htmlFor="join-room-code">
                  6-Character Room Code
                </label>

                <input
                  id="join-room-code"
                  type="text"
                  placeholder="e.g. AB7KQ2"
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(
                      e.target.value
                        .toUpperCase()
                        .replace(
                          /[^A-Z0-9]/g,
                          ''
                        )
                        .slice(0, 6)
                    )
                  }
                  maxLength={6}
                  required
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  className="landing-input room-code-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="join-player-name">
                  Your Player Name
                </label>

                <input
                  id="join-player-name"
                  type="text"
                  placeholder="e.g. Arjun, Vamsi, Kiran..."
                  value={playerName}
                  onChange={(e) =>
                    setPlayerName(
                      e.target.value
                    )
                  }
                  maxLength={20}
                  required
                  autoComplete="name"
                  className="landing-input"
                />
              </div>

              {errorMessage && (
                <div className="form-error-banner">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isLoading ||
                  !playerName.trim() ||
                  roomCode.trim().length !== 6
                }
                className="btn-form-submit btn-submit-blue"
              >
                <span>
                  {isLoading
                    ? 'Joining Room...'
                    : 'Join Lobby'}
                </span>

                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};