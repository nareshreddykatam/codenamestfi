import { RoomSettings, PlayerTeam, PlayerRole } from '../types/multiplayer';

export type MultiplayerEventCallback = (data: any) => void;

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Map<string, Set<MultiplayerEventCallback>> = new Map();

  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port === '5173' ? '3001' : window.location.port || '3001';
    this.url = `${protocol}//${host}:${port}`;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.emit('CONNECTED', {});
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const { type, ...payload } = data;
            this.emit(type, payload);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        this.ws.onerror = (err) => {
          this.emit('ERROR', { message: 'WebSocket connection error' });
          reject(err);
        };

        this.ws.onclose = () => {
          this.emit('DISCONNECTED', {});
          this.ws = null;
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public on(event: string, callback: MultiplayerEventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  public emit(event: string, data: unknown) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in listener for ${event}:`, e);
        }
      });
    }
  }

  public send(type: string, payload: Record<string, unknown> = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      this.connect().then(() => {
        this.ws?.send(JSON.stringify({ type, payload }));
      }).catch((e) => console.error('Failed to send message:', e));
    }
  }

  public createRoom(name: string, sessionToken?: string) {
    this.send('CREATE_ROOM', { name, sessionToken });
  }

  public joinRoom(roomCode: string, name: string, sessionToken?: string) {
    this.send('JOIN_ROOM', { roomCode, name, sessionToken });
  }

  public selectTeamRole(team: PlayerTeam, role: PlayerRole) {
    this.send('SELECT_TEAM_ROLE', { team, role });
  }

  public toggleTeamLock(target: 'RED' | 'BLUE' | 'ALL') {
    this.send('TOGGLE_TEAM_LOCK', { target });
  }

  public updateSettings(settings: Partial<RoomSettings>) {
    this.send('UPDATE_SETTINGS', { settings });
  }

  public movePlayer(targetPlayerId: string, team: PlayerTeam, role: PlayerRole) {
    this.send('MOVE_PLAYER', { targetPlayerId, team, role });
  }

  public kickPlayer(targetPlayerId: string) {
    this.send('KICK_PLAYER', { targetPlayerId });
  }

  public transferHost(targetPlayerId: string) {
    this.send('TRANSFER_HOST', { targetPlayerId });
  }

  public startGame() {
    this.send('START_GAME');
  }

  public submitClue(word: string, count: number) {
    this.send('SUBMIT_CLUE', { word, count });
  }

  public selectCard(cardId: string) {
    this.send('SELECT_CARD', { cardId });
  }

  public passTurn() {
    this.send('PASS_TURN');
  }

  public restartGame() {
    this.send('RESTART_GAME');
  }

  public newGame() {
    this.send('NEW_GAME');
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const multiplayerClient = new MultiplayerClient();
