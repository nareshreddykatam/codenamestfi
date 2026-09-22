import {
  RoomSettings,
  PlayerTeam,
  PlayerRole,
} from '../types/multiplayer';

export type MultiplayerEventCallback = (data: any) => void;

/**
 * Resolve the WebSocket server URL.
 *
 * Development:
 *   ws://localhost:3001
 *
 * Production:
 *   VITE_WS_URL must be configured, for example:
 *   wss://codenames-tfi-server.onrender.com
 */
function getWebSocketUrl(): string {
  const configuredUrl = import.meta.env.VITE_WS_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (import.meta.env.DEV) {
    return 'ws://localhost:3001';
  }

  throw new Error(
    'VITE_WS_URL is not configured for production.'
  );
}

class MultiplayerClient {
  private ws: WebSocket | null = null;

  private readonly url: string;

  private listeners: Map<
    string,
    Set<MultiplayerEventCallback>
  > = new Map();

  private reconnectTimer: ReturnType<typeof setTimeout> | null =
    null;

  private reconnectAttempts = 0;

  private manuallyDisconnected = false;

  /**
   * Prevents multiple simultaneous connection attempts.
   */
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    this.url = getWebSocketUrl();
  }

  /**
   * Connect to the multiplayer server.
   */
  public connect(): Promise<void> {
    this.manuallyDisconnected = false;

    /*
     * Already connected.
     */
    if (
      this.ws &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      return Promise.resolve();
    }

    /*
     * Connection already in progress.
     * Reuse the same Promise instead of opening
     * multiple WebSocket connections.
     */
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise<void>(
      (resolve, reject) => {
        let settled = false;

        try {
          this.ws = new WebSocket(this.url);

          this.ws.onopen = () => {
            settled = true;

            this.reconnectAttempts = 0;

            if (this.reconnectTimer) {
              clearTimeout(this.reconnectTimer);
              this.reconnectTimer = null;
            }

            this.emit('CONNECTED', {});

            resolve();
          };

          this.ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);

              const {
                type,
                ...payload
              } = data;

              if (!type) {
                console.warn(
                  'Received WebSocket message without a type:',
                  data
                );
                return;
              }

              this.emit(type, payload);
            } catch (error) {
              console.error(
                'Failed to parse WebSocket message:',
                error
              );
            }
          };

          this.ws.onerror = (error) => {
            this.emit('ERROR', {
              message: 'WebSocket connection error.',
            });

            /*
             * onclose normally follows onerror.
             * Reject the current connection attempt here
             * so callers waiting on connect() don't hang.
             */
            if (!settled) {
              settled = true;
              reject(error);
            }
          };

          this.ws.onclose = () => {
            this.emit('DISCONNECTED', {});

            this.ws = null;

            if (!settled) {
              settled = true;

              reject(
                new Error(
                  'WebSocket connection closed before connecting.'
                )
              );
            }

            this.connectionPromise = null;

            if (!this.manuallyDisconnected) {
              this.scheduleReconnect();
            }
          };
        } catch (error) {
          settled = true;
          this.connectionPromise = null;

          reject(error);
        }
      }
    );

    /*
     * Make sure the promise reference is cleared after
     * a successful connection too.
     */
    this.connectionPromise.finally(() => {
      if (
        this.connectionPromise &&
        this.ws?.readyState === WebSocket.OPEN
      ) {
        this.connectionPromise = null;
      }
    });

    return this.connectionPromise;
  }

  /**
   * Schedule automatic reconnect using exponential backoff.
   *
   * 1s → 2s → 4s → 8s → 10s max
   */
  private scheduleReconnect() {
    if (this.manuallyDisconnected) {
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      10000
    );

    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;

      if (this.manuallyDisconnected) {
        return;
      }

      this.connect().catch(() => {
        /*
         * The WebSocket close/error handlers will schedule
         * the next reconnect attempt.
         */
      });
    }, delay);
  }

  /**
   * Subscribe to a multiplayer event.
   */
  public on(
    event: string,
    callback: MultiplayerEventCallback
  ) {
    if (!this.listeners.has(event)) {
      this.listeners.set(
        event,
        new Set()
      );
    }

    this.listeners
      .get(event)!
      .add(callback);

    /*
     * Return an unsubscribe function.
     */
    return () => {
      const callbacks =
        this.listeners.get(event);

      callbacks?.delete(callback);

      if (
        callbacks &&
        callbacks.size === 0
      ) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Emit an event to all registered listeners.
   */
  public emit(
    event: string,
    data: unknown
  ) {
    const callbacks =
      this.listeners.get(event);

    if (!callbacks) {
      return;
    }

    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(
          `Error in listener for ${event}:`,
          error
        );
      }
    });
  }

  /**
   * Send a message to the multiplayer server.
   */
  public send(
    type: string,
    payload: Record<string, unknown> = {}
  ) {
    const message = JSON.stringify({
      type,
      payload,
    });

    /*
     * Already connected.
     */
    if (
      this.ws &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      this.ws.send(message);
      return;
    }

    /*
     * Connect first, then send.
     */
    this.connect()
      .then(() => {
        if (
          this.ws &&
          this.ws.readyState === WebSocket.OPEN
        ) {
          this.ws.send(message);
        }
      })
      .catch((error) => {
        console.error(
          'Failed to send WebSocket message:',
          error
        );
      });
  }

  /**
   * Create a new multiplayer room.
   */
  public createRoom(
    name: string,
    sessionToken?: string
  ) {
    this.send('CREATE_ROOM', {
      name,
      sessionToken,
    });
  }

  /**
   * Join an existing multiplayer room.
   */
  public joinRoom(
    roomCode: string,
    name: string,
    sessionToken?: string
  ) {
    this.send('JOIN_ROOM', {
      roomCode,
      name,
      sessionToken,
    });
  }

  /**
   * Select team and role.
   */
  public selectTeamRole(
    team: PlayerTeam,
    role: PlayerRole
  ) {
    this.send('SELECT_TEAM_ROLE', {
      team,
      role,
    });
  }

  /**
   * Toggle team lock.
   */
  public toggleTeamLock(
    target: 'RED' | 'BLUE' | 'ALL'
  ) {
    this.send('TOGGLE_TEAM_LOCK', {
      target,
    });
  }

  /**
   * Update lobby settings.
   */
  public updateSettings(
    settings: Partial<RoomSettings>
  ) {
    this.send('UPDATE_SETTINGS', {
      settings,
    });
  }

  /**
   * Host moves a player to another team/role.
   */
  public movePlayer(
    targetPlayerId: string,
    team: PlayerTeam,
    role: PlayerRole
  ) {
    this.send('MOVE_PLAYER', {
      targetPlayerId,
      team,
      role,
    });
  }

  /**
   * Host kicks a player.
   */
  public kickPlayer(
    targetPlayerId: string
  ) {
    this.send('KICK_PLAYER', {
      targetPlayerId,
    });
  }

  /**
   * Transfer room ownership.
   */
  public transferHost(
    targetPlayerId: string
  ) {
    this.send('TRANSFER_HOST', {
      targetPlayerId,
    });
  }

  /**
   * Start the game.
   */
  public startGame() {
    this.send('START_GAME');
  }

  /**
   * Submit a Spymaster clue.
   */
  public submitClue(
    word: string,
    count: number
  ) {
    this.send('SUBMIT_CLUE', {
      word,
      count,
    });
  }

  /**
   * Select a movie card.
   */
  public selectCard(
    cardId: string
  ) {
    this.send('SELECT_CARD', {
      cardId,
    });
  }

  /**
   * End the current team's turn.
   */
  public passTurn() {
    this.send('PASS_TURN');
  }

  /**
   * Restart the current game.
   */
  public restartGame() {
    this.send('RESTART_GAME');
  }

  /**
   * Start a completely new game.
   */
  public newGame() {
    this.send('NEW_GAME');
  }

  /**
   * Manually disconnect.
   *
   * Automatic reconnect is disabled until connect()
   * is called again.
   */
  public disconnect() {
    this.manuallyDisconnected = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.connectionPromise = null;

    if (this.ws) {
      const socket = this.ws;

      this.ws = null;

      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    }
  }
}

export const multiplayerClient =
  new MultiplayerClient();