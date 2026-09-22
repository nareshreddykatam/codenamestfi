import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { roomManager } from './roomManager';
import { gameSessionManager } from './gameSession';
import { ConnectedClient } from './types';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.get('/api/room/:code', (req, res) => {
  const code = req.params.code?.toUpperCase().trim();
  const room = roomManager.getRoom(code);
  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }
  res.json({
    roomCode: room.roomCode,
    isGameStarted: room.isGameStarted,
    playerCount: room.players.size,
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map<WebSocket, ConnectedClient>();

/**
 * Send JSON message to a specific socket
 */
function send(ws: WebSocket, type: string, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

/**
 * Broadcast lobby state to all players in a room
 */
function broadcastLobbyState(roomCode: string) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const lobby = roomManager.getLobbyState(room);
  const readiness = roomManager.checkReadiness(room);

  for (const [ws, client] of clients.entries()) {
    if (client.roomCode === roomCode && ws.readyState === WebSocket.OPEN) {
      send(ws, 'LOBBY_UPDATE', { lobby, readiness });
    }
  }
}

/**
 * Broadcast role-appropriate game state to each individual player in the room
 */
function broadcastGameState(roomCode: string) {
  const room = roomManager.getRoom(roomCode);
  if (!room || !room.gameState) return;

  for (const [ws, client] of clients.entries()) {
    if (client.roomCode === roomCode && ws.readyState === WebSocket.OPEN) {
      const player = room.players.get(client.playerId);
      const isSpymaster = player?.role === 'SPYMASTER';
      const maskedState = gameSessionManager.getMaskedGameState(room, player);

      send(ws, 'GAME_STATE_UPDATE', {
        gameState: maskedState,
        isSpymaster,
        player,
        isPaused: room.isGamePaused,
        pauseReason: room.pauseReason,
      });
    }
  }
}

wss.on('connection', (ws: WebSocket) => {
  const client: ConnectedClient = {
    socket: ws,
    playerId: '',
    roomCode: '',
    sessionToken: '',
    isAlive: true,
  };
  clients.set(ws, client);

  ws.on('pong', () => {
    client.isAlive = true;
  });

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());
      const { type, payload = {} } = msg;

      switch (type) {
        case 'CREATE_ROOM': {
          const { name, sessionToken } = payload;
          const token = sessionToken || `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const { room, player } = roomManager.createRoom(name, token);

          client.playerId = player.id;
          client.roomCode = room.roomCode;
          client.sessionToken = token;

          send(ws, 'ROOM_JOINED', {
            player,
            lobby: roomManager.getLobbyState(room),
            readiness: roomManager.checkReadiness(room),
            sessionToken: token,
          });
          break;
        }

        case 'JOIN_ROOM': {
          const { roomCode, name, sessionToken } = payload;
          const token = sessionToken || `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const { room, player } = roomManager.joinRoom(roomCode, name, token);

          client.playerId = player.id;
          client.roomCode = room.roomCode;
          client.sessionToken = token;

          send(ws, 'ROOM_JOINED', {
            player,
            lobby: roomManager.getLobbyState(room),
            readiness: roomManager.checkReadiness(room),
            sessionToken: token,
          });

          broadcastLobbyState(room.roomCode);

          if (room.isGameStarted) {
            broadcastGameState(room.roomCode);
          }
          break;
        }

        case 'SELECT_TEAM_ROLE': {
          const { team, role } = payload;
          if (!client.roomCode || !client.playerId) return;

          roomManager.selectTeamRole(client.roomCode, client.playerId, team, role);
          broadcastLobbyState(client.roomCode);
          break;
        }

        case 'TOGGLE_TEAM_LOCK': {
          const { target } = payload;
          if (!client.roomCode || !client.playerId) return;

          roomManager.toggleTeamLock(client.roomCode, client.playerId, target);
          broadcastLobbyState(client.roomCode);
          break;
        }

        case 'UPDATE_SETTINGS': {
          const { settings } = payload;
          if (!client.roomCode || !client.playerId) return;

          roomManager.updateSettings(client.roomCode, client.playerId, settings);
          broadcastLobbyState(client.roomCode);
          break;
        }

        case 'MOVE_PLAYER': {
          const { targetPlayerId, team, role } = payload;
          if (!client.roomCode || !client.playerId) return;

          roomManager.movePlayer(client.roomCode, client.playerId, targetPlayerId, team, role);
          broadcastLobbyState(client.roomCode);
          break;
        }

        case 'KICK_PLAYER': {
          const { targetPlayerId } = payload;
          if (!client.roomCode || !client.playerId) return;

          const room = roomManager.kickPlayer(client.roomCode, client.playerId, targetPlayerId);

          // Notify kicked client
          for (const [socket, cl] of clients.entries()) {
            if (cl.playerId === targetPlayerId && cl.roomCode === room.roomCode) {
              send(socket, 'KICKED', { message: 'You have been removed from the room by the host.' });
            }
          }

          broadcastLobbyState(room.roomCode);
          break;
        }

        case 'TRANSFER_HOST': {
          const { targetPlayerId } = payload;
          if (!client.roomCode || !client.playerId) return;

          const room = roomManager.transferHost(client.roomCode, client.playerId, targetPlayerId);
          const newHost = room.players.get(targetPlayerId);

          for (const [socket, cl] of clients.entries()) {
            if (cl.roomCode === room.roomCode && socket.readyState === WebSocket.OPEN) {
              send(socket, 'HOST_TRANSFERRED', {
                newHostId: targetPlayerId,
                newHostName: newHost ? newHost.name : 'Host',
              });
            }
          }

          broadcastLobbyState(room.roomCode);
          break;
        }

        case 'START_GAME': {
          if (!client.roomCode || !client.playerId) return;

          const room = roomManager.startGame(client.roomCode, client.playerId);
          broadcastLobbyState(room.roomCode);
          broadcastGameState(room.roomCode);
          break;
        }

        case 'SUBMIT_CLUE': {
          const { word, count } = payload;
          if (!client.roomCode || !client.playerId) return;

          const room = roomManager.getRoom(client.roomCode);
          if (!room) return;

          gameSessionManager.submitClue(room, client.playerId, word, count);
          broadcastGameState(room.roomCode);
          break;
        }

        case 'SELECT_CARD': {
          const { cardId } = payload;
          if (!client.roomCode || !client.playerId) return;

          const room = roomManager.getRoom(client.roomCode);
          if (!room) return;

          gameSessionManager.selectCard(room, client.playerId, cardId);
          broadcastGameState(room.roomCode);
          break;
        }

        case 'PASS_TURN': {
          if (!client.roomCode || !client.playerId) return;

          const room = roomManager.getRoom(client.roomCode);
          if (!room) return;

          gameSessionManager.passTurn(room, client.playerId);
          broadcastGameState(room.roomCode);
          break;
        }

        case 'RESTART_GAME': {
          if (!client.roomCode || !client.playerId) return;

          const room = roomManager.getRoom(client.roomCode);
          if (!room) return;

          gameSessionManager.restartGame(room, client.playerId);
          broadcastGameState(room.roomCode);
          break;
        }

        case 'NEW_GAME': {
          if (!client.roomCode || !client.playerId) return;

          const room = roomManager.getRoom(client.roomCode);
          if (!room) return;

          gameSessionManager.newGame(room, client.playerId);
          broadcastGameState(room.roomCode);
          break;
        }

        default:
          break;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'An error occurred';
      send(ws, 'ERROR', { message: errMsg });
    }
  });

  ws.on('close', () => {
    if (client.roomCode && client.playerId) {
      const { room, transferredHost } = roomManager.handleDisconnect(client.roomCode, client.playerId);
      if (room) {
        if (transferredHost) {
          for (const [socket, cl] of clients.entries()) {
            if (cl.roomCode === room.roomCode && socket.readyState === WebSocket.OPEN) {
              send(socket, 'HOST_TRANSFERRED', {
                newHostId: transferredHost.id,
                newHostName: transferredHost.name,
              });
            }
          }
        }
        broadcastLobbyState(room.roomCode);
        if (room.isGameStarted) {
          broadcastGameState(room.roomCode);
        }
      }
    }
    clients.delete(ws);
  });
});

// Periodic heartbeat to clean dead connections
const heartbeatInterval = setInterval(() => {
  for (const [ws, client] of clients.entries()) {
    if (!client.isAlive) {
      ws.terminate();
      clients.delete(ws);
      continue;
    }
    client.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

server.listen(PORT, () => {
  console.log(`[Codenames TFI Server] Running on http://localhost:${PORT}`);
});

export { app, server, roomManager, gameSessionManager };
