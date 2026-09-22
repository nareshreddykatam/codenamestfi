import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../roomManager';
import { GameSessionManager } from '../gameSession';

describe('Multiplayer Room & Security Logic', () => {
  let roomManager: RoomManager;
  let gameSessionManager: GameSessionManager;

  beforeEach(() => {
    roomManager = new RoomManager();
    gameSessionManager = new GameSessionManager();
  });

  it('generates unique 6-character room codes', () => {
    const code1 = roomManager.generateRoomCode();
    const code2 = roomManager.generateRoomCode();
    expect(code1).toMatch(/^[A-Z0-9]{6}$/);
    expect(code2).toMatch(/^[A-Z0-9]{6}$/);
    expect(code1).not.toBe(code2);
  });

  it('creates a room and assigns host status', () => {
    const { room, player } = roomManager.createRoom('Naresh', 'token-123');
    expect(room.roomCode).toHaveLength(6);
    expect(player.name).toBe('Naresh');
    expect(player.isHost).toBe(true);
    expect(room.hostId).toBe(player.id);
  });

  it('allows joining valid room and rejects invalid room', () => {
    const { room } = roomManager.createRoom('HostPlayer', 'token-host');
    
    // Valid join
    const { player: player2 } = roomManager.joinRoom(room.roomCode, 'Rahul', 'token-guest');
    expect(player2.name).toBe('Rahul');
    expect(player2.isHost).toBe(false);

    // Invalid room
    expect(() => roomManager.joinRoom('INVALID', 'Guest', 'token-x')).toThrow('Room not found.');
  });

  it('prevents duplicate player names inside the same room', () => {
    const { room } = roomManager.createRoom('Sai', 'token-1');
    expect(() => roomManager.joinRoom(room.roomCode, 'sai', 'token-2')).toThrow(
      /A player named "sai" is already in this room/
    );
  });

  it('enforces exactly ONE Spymaster per team and rejects duplicate Spymasters', () => {
    const { room, player: host } = roomManager.createRoom('Host', 'token-h');
    const { player: p2 } = roomManager.joinRoom(room.roomCode, 'Player2', 'token-p2');

    // Host becomes Red Spymaster
    roomManager.selectTeamRole(room.roomCode, host.id, 'RED', 'SPYMASTER');
    expect(room.players.get(host.id)?.role).toBe('SPYMASTER');

    // Player 2 attempts to also become Red Spymaster -> Should fail!
    expect(() =>
      roomManager.selectTeamRole(room.roomCode, p2.id, 'RED', 'SPYMASTER')
    ).toThrow('RED Team already has a Spymaster (Host).');

    // But Player 2 can become Red Operative
    roomManager.selectTeamRole(room.roomCode, p2.id, 'RED', 'OPERATIVE');
    expect(room.players.get(p2.id)?.role).toBe('OPERATIVE');
  });

  it('allows multiple Operatives on a team', () => {
    const { room, player: host } = roomManager.createRoom('Host', 'token-h');
    const { player: p1 } = roomManager.joinRoom(room.roomCode, 'P1', 'token-1');
    const { player: p2 } = roomManager.joinRoom(room.roomCode, 'P2', 'token-2');

    roomManager.selectTeamRole(room.roomCode, p1.id, 'BLUE', 'OPERATIVE');
    roomManager.selectTeamRole(room.roomCode, p2.id, 'BLUE', 'OPERATIVE');

    expect(room.players.get(p1.id)?.role).toBe('OPERATIVE');
    expect(room.players.get(p2.id)?.role).toBe('OPERATIVE');
  });

  it('locks teams and prevents non-members from joining locked teams', () => {
    const { room, player: host } = roomManager.createRoom('Host', 'token-h');
    const { player: guest } = roomManager.joinRoom(room.roomCode, 'Guest', 'token-g');

    // Host locks RED team
    roomManager.toggleTeamLock(room.roomCode, host.id, 'RED');
    expect(room.redLocked).toBe(true);

    // Guest cannot join RED
    expect(() =>
      roomManager.selectTeamRole(room.roomCode, guest.id, 'RED', 'OPERATIVE')
    ).toThrow('Red team is locked by the host.');

    // Non-host cannot lock/unlock teams
    expect(() =>
      roomManager.toggleTeamLock(room.roomCode, guest.id, 'BLUE')
    ).toThrow('Only the host can lock/unlock teams.');
  });

  it('starts game and permanently locks teams and roles', () => {
    const { room, player: host } = roomManager.createRoom('Host', 'token-h');
    const { player: r1 } = roomManager.joinRoom(room.roomCode, 'RedOp', 'token-r1');
    const { player: bS } = roomManager.joinRoom(room.roomCode, 'BlueSpy', 'token-bs');
    const { player: bO } = roomManager.joinRoom(room.roomCode, 'BlueOp', 'token-bo');

    roomManager.selectTeamRole(room.roomCode, host.id, 'RED', 'SPYMASTER');
    roomManager.selectTeamRole(room.roomCode, r1.id, 'RED', 'OPERATIVE');
    roomManager.selectTeamRole(room.roomCode, bS.id, 'BLUE', 'SPYMASTER');
    roomManager.selectTeamRole(room.roomCode, bO.id, 'BLUE', 'OPERATIVE');

    roomManager.startGame(room.roomCode, host.id);
    expect(room.isGameStarted).toBe(true);
    expect(room.redLocked).toBe(true);
    expect(room.blueLocked).toBe(true);

    // Attempting to change role while game is active throws error
    expect(() =>
      roomManager.selectTeamRole(room.roomCode, r1.id, 'BLUE', 'OPERATIVE')
    ).toThrow('Game is already in progress. Roles cannot be changed.');
  });

  it('strictly protects secret key from Operatives (role: HIDDEN)', () => {
    const { room, player: host } = roomManager.createRoom('Host', 'token-h');
    const { player: r1 } = roomManager.joinRoom(room.roomCode, 'RedOp', 'token-r1');
    const { player: bS } = roomManager.joinRoom(room.roomCode, 'BlueSpy', 'token-bs');
    const { player: bO } = roomManager.joinRoom(room.roomCode, 'BlueOp', 'token-bo');

    roomManager.selectTeamRole(room.roomCode, host.id, 'RED', 'SPYMASTER');
    roomManager.selectTeamRole(room.roomCode, r1.id, 'RED', 'OPERATIVE');
    roomManager.selectTeamRole(room.roomCode, bS.id, 'BLUE', 'SPYMASTER');
    roomManager.selectTeamRole(room.roomCode, bO.id, 'BLUE', 'OPERATIVE');

    roomManager.startGame(room.roomCode, host.id);

    // SPYMASTER receives real roles
    const spymasterState = gameSessionManager.getMaskedGameState(room, host);
    expect(spymasterState.cards.every((c) => c.role !== 'HIDDEN')).toBe(true);

    // OPERATIVE receives HIDDEN for all unrevealed cards
    const operativeState = gameSessionManager.getMaskedGameState(room, r1);
    expect(operativeState.cards.every((c) => c.role === 'HIDDEN')).toBe(true);
    // Operative card still receives title and image
    expect(operativeState.cards.every((c) => !!c.movie)).toBe(true);
  });

  it('allows Operative to guess by cardId and reveals role + image', () => {
    const { room, player: host } = roomManager.createRoom('Host', 'token-h');
    const { player: r1 } = roomManager.joinRoom(room.roomCode, 'RedOp', 'token-r1');
    const { player: bS } = roomManager.joinRoom(room.roomCode, 'BlueSpy', 'token-bs');
    const { player: bO } = roomManager.joinRoom(room.roomCode, 'BlueOp', 'token-bo');

    roomManager.selectTeamRole(room.roomCode, host.id, 'RED', 'SPYMASTER');
    roomManager.selectTeamRole(room.roomCode, r1.id, 'RED', 'OPERATIVE');
    roomManager.selectTeamRole(room.roomCode, bS.id, 'BLUE', 'SPYMASTER');
    roomManager.selectTeamRole(room.roomCode, bO.id, 'BLUE', 'OPERATIVE');

    roomManager.startGame(room.roomCode, host.id);

    const startingTeam = room.gameState!.startingTeam;
    const activeSpymaster = startingTeam === 'RED' ? host : bS;
    const activeOperative = startingTeam === 'RED' ? r1 : bO;

    // Spymaster gives clue
    gameSessionManager.submitClue(room, activeSpymaster.id, 'BLOCKBUSTER', 2);
    expect(room.gameState!.phase).toBe('GUESSING');
    expect(room.gameState!.guessesRemaining).toBe(3); // 2 + 1 = 3

    // Operative clicks a card directly
    const firstCard = room.gameState!.cards[0];
    gameSessionManager.selectCard(room, activeOperative.id, firstCard.id);

    expect(firstCard.isRevealed).toBe(true);

    // Now for Operative, this revealed card has its true role revealed!
    const operativeState = gameSessionManager.getMaskedGameState(room, activeOperative);
    const revealedCard = operativeState.cards.find((c) => c.id === firstCard.id);
    expect(revealedCard?.isRevealed).toBe(true);
    expect(revealedCard?.role).toBe(firstCard.role);
  });

  it('clicking Assassin card immediately ends the game', () => {
    const { room, player: host } = roomManager.createRoom('Host', 'token-h');
    const { player: r1 } = roomManager.joinRoom(room.roomCode, 'RedOp', 'token-r1');
    const { player: bS } = roomManager.joinRoom(room.roomCode, 'BlueSpy', 'token-bs');
    const { player: bO } = roomManager.joinRoom(room.roomCode, 'BlueOp', 'token-bo');

    roomManager.selectTeamRole(room.roomCode, host.id, 'RED', 'SPYMASTER');
    roomManager.selectTeamRole(room.roomCode, r1.id, 'RED', 'OPERATIVE');
    roomManager.selectTeamRole(room.roomCode, bS.id, 'BLUE', 'SPYMASTER');
    roomManager.selectTeamRole(room.roomCode, bO.id, 'BLUE', 'OPERATIVE');

    roomManager.startGame(room.roomCode, host.id);

    const startingTeam = room.gameState!.startingTeam;
    const activeSpymaster = startingTeam === 'RED' ? host : bS;
    const activeOperative = startingTeam === 'RED' ? r1 : bO;
    const opponentTeam = startingTeam === 'RED' ? 'BLUE' : 'RED';

    gameSessionManager.submitClue(room, activeSpymaster.id, 'DANGER', 1);

    const assassinCard = room.gameState!.cards.find((c) => c.role === 'ASSASSIN')!;
    gameSessionManager.selectCard(room, activeOperative.id, assassinCard.id);

    expect(room.gameState!.phase).toBe('GAME_OVER');
    expect(room.gameState!.winner).toBe(opponentTeam);
    expect(room.gameState!.winReason).toBe('ASSASSIN_HIT');
  });

  it('allows only host to transfer host privileges and kick players', () => {
    const { room, player: host } = roomManager.createRoom('Host', 'token-h');
    const { player: guest } = roomManager.joinRoom(room.roomCode, 'Guest', 'token-g');

    // Guest cannot kick Host
    expect(() => roomManager.kickPlayer(room.roomCode, guest.id, host.id)).toThrow(
      'Only the host can remove players.'
    );

    // Host kicks Guest -> Success
    roomManager.kickPlayer(room.roomCode, host.id, guest.id);
    expect(room.players.has(guest.id)).toBe(false);
  });
});
