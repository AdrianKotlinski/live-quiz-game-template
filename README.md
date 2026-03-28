# Assignment: WebSocket Live Quiz Game

A real-time multiplayer quiz game built with WebSockets, featuring instant synchronization, live scoring, and interactive gameplay. Players can create or join quiz games, answer questions with time-based scoring, and compete for the top spot on the leaderboard.

## Project Structure

```
├── client/                   # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # WebSocket hooks
│   │   └── types/            # TypeScript types
│   └── package.json
│
├── server/                   # Backend (Node.js + ws)
│   ├── src/
│   │   ├── index.ts          # Main server, WebSocket handlers
│   │   ├── types.ts          # Types
│   │   ├── constants.ts      # Constants
│   │   └── utils/
│   │       ├── message.ts    # WebSocket messaging utilities
│   │       ├── generators.ts # Common generators
│   │       ├── validation.ts # Validation logic
│   │       ├── error.ts      # Error handling
│   │       ├── game.ts       # Game flow logic
│   │       ├── scoring.ts    # Score calculation
│   │       └── cleanup.ts    # Disconnection handling
│   ├── package.json
│   └── tsconfig.json
│
└── package.json
```

### Prerequisites

- Node.js (v24 or higher)
- npm (v10 or higher)

### Installation

```bash
git clone <repository-url>
cd live-quiz-game-template

npm install
```

### Development

```bash
npm run start:server
npm run start:client
```

This will start:
- **WebSocket Server** at `ws://localhost:3000`
- **Client App** at `http://localhost:5173`

## How to Play

### 1. Host a Game

1. Open `http://localhost:5173`
2. Register with a username and password
3. Select **"Host"** role
4. Create custom quiz questions:
   - Add question text
   - Add 4 answer options
   - Select correct answer
   - Set time limit (seconds)
5. Click **"Create Game"**
6. Share the **6-character room code** with players
7. Wait for players to join
8. Click **"Start Game"** when ready

### 2. Join a Game

1. Open `http://localhost:5173` in a new tab/browser
2. Register with a different username and password
3. Select **"Player"** role
4. Enter the room code
5. Wait in lobby for host to start
6. Answer questions as they appear
7. View results after each question
8. See final rankings at the end

### 3. Gameplay

- **Questions broadcast** - All players see the same question simultaneously
- **Answer quickly** - Faster correct answers earn more points
- **Scoring formula**: `1000 × (timeRemaining / timeLimit)`
- **Results after each question** - See who answered correctly and current scores
- **Auto-advance** - Questions advance automatically after time expires or all players answer
- **Final scoreboard** - Rankings sorted by total score with tie handling

## 📝 Environment Variables

Create `.env` file in server directory (optional):

```env
PORT=3000
```
