import { useState, useEffect, useCallback } from 'react';
import { GameState } from './types/game';
import { Player, LobbyState, SyncedGameState, ReadinessCheck, RoomSettings, PlayerTeam, PlayerRole } from './types/multiplayer';
import { createNewGame, restartCurrentGame, submitClue as localSubmitClue, selectCard as localSelectCard, passTurn as localPassTurn } from './game/gameEngine';
import { sounds } from './game/soundEffects';
import { multiplayerClient } from './services/multiplayerClient';
import { LandingPage } from './components/multiplayer/LandingPage';
import { MultiplayerLobby } from './components/multiplayer/MultiplayerLobby';
import { InGamePlayerList } from './components/multiplayer/InGamePlayerList';
import { PlayerAdminModal } from './components/multiplayer/PlayerAdminModal';
import { DisconnectionBanner } from './components/multiplayer/DisconnectionBanner';
import { Header } from './components/Header';
import { GameBoard } from './components/GameBoard';
import { CluePanel } from './components/CluePanel';
import { SpymasterKeyMini } from './components/SpymasterKeyMini';
import { GameLog } from './components/GameLog';
import { VictoryModal } from './components/VictoryModal';
import { RulesModal } from './components/RulesModal';

type AppViewMode = 'LANDING' | 'MULTIPLAYER_LOBBY' | 'MULTIPLAYER_GAME' | 'LOCAL_GAME';

export function App() {
  const [viewMode, setViewMode] = useState<AppViewMode>('LANDING');
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Multiplayer State
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [readiness, setReadiness] = useState<ReadinessCheck | null>(null);
  const [syncedGame, setSyncedGame] = useState<SyncedGameState | null>(null);
  const [isServerSpymaster, setIsServerSpymaster] = useState(false);
  const [isGamePaused, setIsGamePaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | undefined>();
  const [hostTransferNotice, setHostTransferNotice] = useState<string | undefined>();
  const [adminSelectedPlayer, setAdminSelectedPlayer] = useState<Player | null>(null);

  // Local Game State (Pass and play fallback)
  const [localGame, setLocalGame] = useState<GameState>(() => createNewGame());
  const [isLocalSpymasterView, setIsLocalSpymasterView] = useState(false);

  // Auto-reconnect check from sessionStorage on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem('tfi_codenames_token');
    const savedRoom = sessionStorage.getItem('tfi_codenames_room');
    const savedName = sessionStorage.getItem('tfi_codenames_name');

    if (savedToken && savedRoom && savedName) {
      setIsLoading(true);
      multiplayerClient.connect().then(() => {
        multiplayerClient.joinRoom(savedRoom, savedName, savedToken);
      }).catch(() => {
        setIsLoading(false);
      });
    }
  }, []);

  // WebSocket Event Subscriptions
  useEffect(() => {
    const unsubJoined = multiplayerClient.on('ROOM_JOINED', (data: any) => {
      setIsLoading(false);
      setErrorMessage('');
      setCurrentPlayer(data.player);
      setLobbyState(data.lobby);
      setReadiness(data.readiness);

      // Persist session
      if (data.sessionToken && data.lobby?.roomCode && data.player?.name) {
        sessionStorage.setItem('tfi_codenames_token', data.sessionToken);
        sessionStorage.setItem('tfi_codenames_room', data.lobby.roomCode);
        sessionStorage.setItem('tfi_codenames_name', data.player.name);
      }

      if (data.lobby?.isGameStarted) {
        setViewMode('MULTIPLAYER_GAME');
      } else {
        setViewMode('MULTIPLAYER_LOBBY');
      }
    });

    const unsubLobbyUpdate = multiplayerClient.on('LOBBY_UPDATE', (data: any) => {
      setLobbyState(data.lobby);
      setReadiness(data.readiness);

      if (currentPlayer) {
        const me = data.lobby?.players?.find((p: Player) => p.id === currentPlayer.id);
        if (me) setCurrentPlayer(me);
      }

      if (data.lobby?.isGameStarted) {
        setViewMode('MULTIPLAYER_GAME');
      } else {
        setViewMode('MULTIPLAYER_LOBBY');
      }
    });

    const unsubGameState = multiplayerClient.on('GAME_STATE_UPDATE', (data: any) => {
      setSyncedGame(data.gameState);
      setIsServerSpymaster(!!data.isSpymaster);
      setIsGamePaused(!!data.isPaused);
      setPauseReason(data.pauseReason);
      setViewMode('MULTIPLAYER_GAME');

      if (data.player) setCurrentPlayer(data.player);
    });

    const unsubHostTransferred = multiplayerClient.on('HOST_TRANSFERRED', (data: any) => {
      setHostTransferNotice(`👑 Room host has been transferred to ${data.newHostName}.`);
      sounds.playTurnChange();
    });

    const unsubKicked = multiplayerClient.on('KICKED', (data: any) => {
      alert(data.message || 'You have been removed from the room.');
      sessionStorage.clear();
      setViewMode('LANDING');
      setCurrentPlayer(null);
      setLobbyState(null);
    });

    const unsubError = multiplayerClient.on('ERROR', (data: any) => {
      setIsLoading(false);
      setErrorMessage(data.message || 'An error occurred.');
    });

    return () => {
      unsubJoined();
      unsubLobbyUpdate();
      unsubGameState();
      unsubHostTransferred();
      unsubKicked();
      unsubError();
    };
  }, [currentPlayer]);

  // Handle Mute
  const handleToggleMute = useCallback(() => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  }, []);

  // Create Multiplayer Room
  const handleCreateRoom = useCallback((playerName: string) => {
    setIsLoading(true);
    setErrorMessage('');
    multiplayerClient.connect().then(() => {
      multiplayerClient.createRoom(playerName);
    }).catch(() => {
      setIsLoading(false);
      setErrorMessage('Could not connect to multiplayer server.');
    });
  }, []);

  // Join Multiplayer Room
  const handleJoinRoom = useCallback((roomCode: string, playerName: string) => {
    setIsLoading(true);
    setErrorMessage('');
    multiplayerClient.connect().then(() => {
      multiplayerClient.joinRoom(roomCode, playerName);
    }).catch(() => {
      setIsLoading(false);
      setErrorMessage('Could not connect to multiplayer server.');
    });
  }, []);

  // Leave Room
  const handleLeaveRoom = useCallback(() => {
    sessionStorage.clear();
    multiplayerClient.disconnect();
    setCurrentPlayer(null);
    setLobbyState(null);
    setSyncedGame(null);
    setViewMode('LANDING');
  }, []);

  // Multiplayer Actions
  const handleSelectTeamRole = useCallback((team: PlayerTeam, role: PlayerRole) => {
    multiplayerClient.selectTeamRole(team, role);
  }, []);

  const handleToggleTeamLock = useCallback((target: 'RED' | 'BLUE' | 'ALL') => {
    multiplayerClient.toggleTeamLock(target);
  }, []);

  const handleUpdateSettings = useCallback((settings: Partial<RoomSettings>) => {
    multiplayerClient.updateSettings(settings);
  }, []);

  const handleMovePlayer = useCallback((targetId: string, team: PlayerTeam, role: PlayerRole) => {
    multiplayerClient.movePlayer(targetId, team, role);
  }, []);

  const handleKickPlayer = useCallback((targetId: string) => {
    multiplayerClient.kickPlayer(targetId);
  }, []);

  const handleTransferHost = useCallback((targetId: string) => {
    multiplayerClient.transferHost(targetId);
  }, []);

  const handleStartGame = useCallback(() => {
    multiplayerClient.startGame();
  }, []);

  // Game Play Actions (Multiplayer vs Local)
  const handleSubmitClue = useCallback((word: string, count: number) => {
    sounds.playClueGiven();
    if (viewMode === 'MULTIPLAYER_GAME') {
      multiplayerClient.submitClue(word, count);
    } else {
      setLocalGame((prev) => localSubmitClue(prev, word, count));
    }
  }, [viewMode]);

  const handleSelectCard = useCallback((cardId: string) => {
    if (viewMode === 'MULTIPLAYER_GAME') {
      multiplayerClient.selectCard(cardId);
    } else {
      setLocalGame((prev) => {
        const { newState, revealedRole, isCorrect } = localSelectCard(prev, cardId);
        sounds.playCardFlip(revealedRole, isCorrect);
        return newState;
      });
    }
  }, [viewMode]);

  const handlePassTurn = useCallback(() => {
    sounds.playTurnChange();
    if (viewMode === 'MULTIPLAYER_GAME') {
      multiplayerClient.passTurn();
    } else {
      setLocalGame((prev) => localPassTurn(prev));
    }
  }, [viewMode]);

  const handleRestartGame = useCallback(() => {
    sounds.playClick();
    if (viewMode === 'MULTIPLAYER_GAME') {
      multiplayerClient.restartGame();
    } else {
      setLocalGame((prev) => restartCurrentGame(prev));
    }
  }, [viewMode]);

  const handleNewGame = useCallback(() => {
    sounds.playClick();
    if (viewMode === 'MULTIPLAYER_GAME') {
      multiplayerClient.newGame();
    } else {
      setLocalGame(createNewGame());
    }
  }, [viewMode]);

  // ================= RENDER MODES =================

  // 1. LANDING PAGE
  if (viewMode === 'LANDING') {
    return (
      <LandingPage
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onPlayLocal={() => setViewMode('LOCAL_GAME')}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onClearError={() => setErrorMessage('')}
      />
    );
  }

  // 2. MULTIPLAYER LOBBY
  if (viewMode === 'MULTIPLAYER_LOBBY' && lobbyState && currentPlayer && readiness) {
    return (
      <MultiplayerLobby
        lobby={lobbyState}
        currentPlayer={currentPlayer}
        readiness={readiness}
        onSelectTeamRole={handleSelectTeamRole}
        onToggleTeamLock={handleToggleTeamLock}
        onUpdateSettings={handleUpdateSettings}
        onMovePlayer={handleMovePlayer}
        onKickPlayer={handleKickPlayer}
        onTransferHost={handleTransferHost}
        onStartGame={handleStartGame}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  // 3. MULTIPLAYER GAME VIEW
  if (viewMode === 'MULTIPLAYER_GAME' && syncedGame && currentPlayer && lobbyState) {
    const isOperative = currentPlayer.role === 'OPERATIVE';
    const isSpymaster = currentPlayer.role === 'SPYMASTER';
    const isMyTeamTurn = currentPlayer.team === syncedGame.currentTeam;

    // Operatives can only guess when it's their team's turn and phase is GUESSING
    const canGuess = isOperative && isMyTeamTurn && syncedGame.phase === 'GUESSING' && !syncedGame.winner && !isGamePaused;
    // Only the active team Spymaster can submit clues
    const canGiveClue = isSpymaster && isMyTeamTurn && syncedGame.phase === 'CLUE_GIVING' && !isGamePaused;
    // Active team operatives or Host can pass turn
    const canPassTurn = isMyTeamTurn && !syncedGame.winner && !isGamePaused;

    return (
      <div className="codenames-app-root in-multiplayer-game">
        <div className="ambient-glow glow-red" />
        <div className="ambient-glow glow-blue" />
        <div className="ambient-glow glow-gold" />

        <DisconnectionBanner
          isPaused={isGamePaused}
          pauseReason={pauseReason}
          hostTransferNotice={hostTransferNotice}
          onDismissNotice={() => setHostTransferNotice(undefined)}
        />

        <Header
          remainingRed={syncedGame.remainingRed}
          remainingBlue={syncedGame.remainingBlue}
          currentTeam={syncedGame.currentTeam}
          phase={syncedGame.phase}
          startingTeam={syncedGame.startingTeam}
          isSpymasterView={isServerSpymaster}
          isMuted={isMuted}
          isMultiplayer={true}
          currentPlayer={currentPlayer}
          onToggleSpymasterView={() => {}}
          onToggleMute={handleToggleMute}
          onNewGame={handleNewGame}
          onRestartGame={handleRestartGame}
          onOpenRules={() => {
            sounds.playClick();
            setIsRulesOpen(true);
          }}
        />

        <div className="game-stage-layout">
          {/* PERMANENT IN-GAME MULTIPLAYER PLAYER LIST SIDEBAR */}
          <InGamePlayerList
            lobby={lobbyState}
            currentPlayer={currentPlayer}
            onSelectAdminPlayer={(p) => setAdminSelectedPlayer(p)}
          />

          <main className="game-main-content">
            <CluePanel
              currentTeam={syncedGame.currentTeam}
              phase={syncedGame.phase}
              currentClue={syncedGame.currentClue}
              guessesRemaining={syncedGame.guessesRemaining}
              isSpymasterView={isServerSpymaster}
              canGiveClue={canGiveClue}
              canPassTurn={canPassTurn}
              onSubmitClue={handleSubmitClue}
              onPassTurn={handlePassTurn}
            />

            <div className="board-stage-area">
              <GameBoard
                cards={syncedGame.cards}
                isSpymasterView={isServerSpymaster}
                canGuess={canGuess}
                currentTeam={syncedGame.currentTeam}
                onSelectCard={handleSelectCard}
              />

              {isServerSpymaster && (
                <SpymasterKeyMini
                  cards={syncedGame.cards}
                  isSpymasterView={isServerSpymaster}
                />
              )}
            </div>
          </main>
        </div>

        <GameLog logs={syncedGame.logs} />

        {syncedGame.winner && syncedGame.winReason && (
          <VictoryModal
            winner={syncedGame.winner}
            winReason={syncedGame.winReason}
            onNewGame={handleNewGame}
            onRestartGame={handleRestartGame}
          />
        )}

        <RulesModal
          isOpen={isRulesOpen}
          onClose={() => setIsRulesOpen(false)}
        />

        {/* PLAYER ADMIN MODAL (Host Only) */}
        {currentPlayer.isHost && (
          <PlayerAdminModal
            isOpen={!!adminSelectedPlayer}
            targetPlayer={adminSelectedPlayer}
            onClose={() => setAdminSelectedPlayer(null)}
            onMovePlayer={handleMovePlayer}
            onKickPlayer={handleKickPlayer}
            onTransferHost={handleTransferHost}
          />
        )}
      </div>
    );
  }

  // 4. LOCAL PASS & PLAY GAME VIEW
  const canLocalGuess = localGame.phase === 'GUESSING' && !localGame.winner;

  return (
    <div className="codenames-app-root">
      <div className="ambient-glow glow-red" />
      <div className="ambient-glow glow-blue" />
      <div className="ambient-glow glow-gold" />

      <Header
        remainingRed={localGame.remainingRed}
        remainingBlue={localGame.remainingBlue}
        currentTeam={localGame.currentTeam}
        phase={localGame.phase}
        startingTeam={localGame.startingTeam}
        isSpymasterView={isLocalSpymasterView}
        isMuted={isMuted}
        isMultiplayer={false}
        onToggleSpymasterView={() => {
          sounds.playClick();
          setIsLocalSpymasterView(!isLocalSpymasterView);
        }}
        onToggleMute={handleToggleMute}
        onNewGame={handleNewGame}
        onRestartGame={handleRestartGame}
        onOpenRules={() => {
          sounds.playClick();
          setIsRulesOpen(true);
        }}
      />

      <main className="game-main-content">
        <CluePanel
          currentTeam={localGame.currentTeam}
          phase={localGame.phase}
          currentClue={localGame.currentClue}
          guessesRemaining={localGame.guessesRemaining}
          isSpymasterView={isLocalSpymasterView}
          canGiveClue={true}
          canPassTurn={true}
          onSubmitClue={handleSubmitClue}
          onPassTurn={handlePassTurn}
        />

        <div className="board-stage-area">
          <GameBoard
            cards={localGame.cards}
            isSpymasterView={isLocalSpymasterView}
            canGuess={canLocalGuess}
            currentTeam={localGame.currentTeam}
            onSelectCard={handleSelectCard}
          />

          <SpymasterKeyMini
            cards={localGame.cards}
            isSpymasterView={isLocalSpymasterView}
          />
        </div>
      </main>

      <GameLog logs={localGame.logs} />

      {localGame.winner && localGame.winReason && (
        <VictoryModal
          winner={localGame.winner}
          winReason={localGame.winReason}
          onNewGame={handleNewGame}
          onRestartGame={handleRestartGame}
        />
      )}

      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </div>
  );
}

export default App;
