# Codenames TFI (Telugu Cinema Edition) 🎬

A modern, cinematic real-time multiplayer web implementation of the classic **Codenames** board game, themed entirely around the **Telugu Film Industry (Tollywood / TFI)**.

![Codenames TFI](https://img.shields.io/badge/Codenames-Telugu%20Cinema-f59e0b?style=for-the-badge)
![Realtime Multiplayer](https://img.shields.io/badge/Multiplayer-WebSockets-10b981?style=for-the-badge)
![React](https://img.shields.io/badge/React-18.3-61dafb?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-6.1-646cff?style=for-the-badge)

---

## 🌟 Game Highlights

### 1. Multiplayer Room & Pre-Game Lobby
- **Landing Page**: Cinematic hero page with "CREATE ROOM" and "JOIN ROOM" actions.
- **Unique 6-Character Room Codes**: e.g., `AB7KQ2` with 1-click clipboard copy.
- **Dual Team Panels**:
  - **RED TEAM**: 🔴 Red Spymaster (1 role slot, locked when occupied) + 👥 Red Operatives (Multiple players).
  - **BLUE TEAM**: 🔵 Blue Spymaster (1 role slot, locked when occupied) + 👥 Blue Operatives (Multiple players).
  - **Spectators & Unassigned Pool**: Dedicated observation section.
- **Host Controls & Permissions**:
  - Lock/Unlock Red Team, Blue Team, or All Teams.
  - Move players between teams & roles.
  - Transfer host privileges to any connected player.
  - Kick/remove players.
  - Match settings: Turn Timer (OFF, 30s, 60s, 90s, 120s), Unlimited Clues (ON/OFF), Allow Spectators (ON/OFF).
- **Readiness Checks & Gate**:
  - Both teams must have 1 Spymaster and at least 1 Operative before the game can start.
  - Live missing requirements indicator.

### 2. Server-Authoritative Security & Sync
- **Strict Role-Based Card Masking**: Operatives and spectators only receive movie titles with `role: 'HIDDEN'` for unrevealed cards (impossible to inspect hidden roles via browser DevTools). Spymasters receive the secret role key.
- **Real-time WebSockets**: Instant synchronization for room states, clues, card reveals, team turns, and victory states.
- **Reconnection & Disconnection Handling**: Automatic host transfer if host leaves; game auto-pauses with notice if an active Spymaster disconnects.

### 3. Pure Telugu Movie Database
- 500+ curated Telugu films across all eras (Mayabazar, Khaidi, Pokiri, Magadheera, Baahubali, Rangasthalam, RRR, Pushpa 2, Kalki 2898 AD, Devara, etc.).

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Multiplayer Backend Server
```bash
npm run server
```
Runs on `http://localhost:3001`.

### 3. Start the Frontend Dev Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Run Automated Tests
```bash
npm test
```

### 5. Build for Production
```bash
npm run build
```

---

## 🗂️ Project Structure

```text
server/
├── index.ts                # Express + WebSocket real-time server
├── roomManager.ts          # Room creation, player sessions, team locks, host transfer
├── gameSession.ts          # Server-authoritative card masking & turn execution
├── types.ts                # Server protocol types
└── __tests__/
    └── multiplayer.test.ts # Vitest suite for multiplayer room & security

src/
├── data/
│   └── movies.ts           # Curated 500+ Telugu movie database
├── types/
│   ├── game.ts             # Core game types
│   └── multiplayer.ts      # Client multiplayer types
├── services/
│   └── multiplayerClient.ts # WebSocket client service
├── components/
│   ├── multiplayer/
│   │   ├── LandingPage.tsx        # Cinematic landing page
│   │   ├── MultiplayerLobby.tsx   # Dual Red/Blue team panels & host controls
│   │   ├── LobbySettingsModal.tsx # Turn timer & clue settings
│   │   ├── PlayerAdminModal.tsx   # Host player management
│   │   └── DisconnectionBanner.tsx # Reconnect & pause banner
│   ├── Header.tsx          # Score bar, turn indicator, mute, controls
│   ├── GameBoard.tsx       # 5x5 responsive grid
│   ├── MovieCard.tsx       # 3D flippable movie ticket card
│   ├── CluePanel.tsx       # Spymaster clue input & Operative banner
│   ├── SpymasterKeyMini.tsx# 5x5 mini secret key
│   ├── GameLog.tsx         # Live activity log
│   ├── VictoryModal.tsx    # Confetti victory modal
│   └── RulesModal.tsx      # In-game rules guide
├── index.css               # Cinematic dark styling & responsive grid layout
├── App.tsx                 # Main application router
└── main.tsx                # Entry point
```
