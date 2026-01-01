# Rummikub Online - Copilot Instructions

## Project Overview
An online multiplayer Rummikub game with real-time gameplay using WebSockets.

## Tech Stack
- **Frontend**: Vue 3 + Vuetify 3 + Vue Router + Pinia + VueDraggable
- **Backend**: Node.js + Express + Socket.io
- **Shared**: Common validation logic in `/common/`
- **Build**: Backend serves built frontend from `/client/dist`

## Architecture

### Directory Structure
```
/
├── .github/copilot-instructions.md
├── package.json (root - orchestration scripts)
├── /common/ (shared code)
│   ├── constants.js (tile definitions, colors)
│   ├── rules.js (validation logic)
│   └── rulePresets.js (official + custom configs)
├── /server/
│   ├── index.js (Express + Socket.io entry)
│   ├── /stores/ (in-memory data stores)
│   ├── /handlers/ (Socket.io event handlers)
│   └── /bot/ (bot AI system)
│       ├── BotManager.js
│       └── /strategies/
│           ├── EasyStrategy.js
│           ├── MediumStrategy.js
│           └── HardStrategy.js
└── /client/
    ├── /src/
    │   ├── /views/ (page components)
    │   ├── /components/ (reusable UI)
    │   ├── /stores/ (Pinia stores)
    │   ├── /plugins/ (Vuetify, Socket.io)
    │   └── /router/ (Vue Router config)
    └── /dist/ (built output, served by backend)
```

## Game Features

### User Flow
1. **Username Selection**: Unique username validation via Socket.io (no database)
2. **Lobby Browser**: View public lobbies, join, or create new lobby
3. **Lobby**: Configure game, invite players, add bots, start game
4. **Game**: Play Rummikub with drag-and-drop tiles
5. **Results**: View scores, rematch option

### Lobby System
- **Public lobbies**: Visible in lobby browser, anyone can join
- **Private lobbies**: Invite-only via username
- **Spectator mode**: Watch ongoing games (read-only board, shared chat)
- **Bot players**: Add AI players with difficulty levels (Easy/Medium/Hard)

### Rule Configuration
- **Official preset**: 30-point initial meld, 60s turn timer, 2 jokers
- **Custom rules**: Configurable initial meld points, timer duration, joker count

### Game Mechanics
- **Turn timer**: 1 minute (configurable) with free tile movement during turn
- **Drag-and-drop**: Move tiles freely on board during your turn
- **Validation**: "End Turn" validates all sets; invalid state reverts board
- **Official Rummikub rules**:
  - Initial meld must be 30+ points from player's own tiles
  - Valid sets: runs (same color, consecutive numbers) or groups (same number, different colors)
  - Jokers can substitute any tile
  - Can manipulate existing table sets after initial meld

### Bot AI Levels
- **Easy**: Plays obvious/simple valid sets
- **Medium**: Plans multi-tile plays, basic strategy
- **Hard**: Table manipulation, optimal placement strategy

### Notifications
- **Popup invites**: Modal with accept/decline for lobby invitations
- **Notification panel**: Drawer with notification history
- **Events**: Invites, disconnects, reconnects, bot takeovers, spectator joins

### Chat System
- **Lobby chat**: Available in lobby view
- **Game chat**: Shared between players and spectators
- **History**: Recent messages stored for late joiners
- **Moderation**: Message length limits

### Disconnect Handling
- **Grace period**: 30 seconds to reconnect
- **Notification**: All players/spectators notified of disconnect
- **On timeout**: Host prompted with "Kick player" or "Replace with bot"
- **Bot takeover**: Seamless continuation with AI controlling player's tiles

### End Game
- **Winner announcement**: Highlighted with animation
- **Scoring**: Remaining tiles count as penalty points
- **Stats**: Turns played, time elapsed
- **Rematch**: Restart with same players and rules
- **Return to lobby**: Go back to lobby to reconfigure

## Socket.io Events

### Authentication
- `register-username`: Client requests username
- `username-registered`: Server confirms username
- `username-taken`: Server rejects duplicate username

### Lobby
- `create-lobby`: Create new lobby with settings
- `join-lobby`: Join existing lobby
- `leave-lobby`: Leave current lobby
- `invite-user`: Send invite to another user
- `invite-received`: Notification of incoming invite
- `accept-invite`: Accept lobby invitation
- `decline-invite`: Decline lobby invitation
- `add-bot`: Add bot player to lobby
- `remove-player`: Host removes player/bot
- `update-rules`: Host changes rule configuration
- `toggle-public`: Toggle lobby visibility
- `start-game`: Host starts the game
- `lobby-updated`: Broadcast lobby state changes

### Game
- `game-started`: Game begins, initial state sent
- `turn-start`: Player's turn begins
- `turn-end`: Player ends turn (with board state)
- `turn-timeout`: Turn timer expired
- `draw-tile`: Player draws from pool
- `game-state-update`: Broadcast current game state
- `invalid-move`: Move validation failed
- `player-won`: Game ended, winner announced
- `game-ended`: Final scores and stats

### Spectator
- `join-spectator`: Join game as spectator
- `leave-spectator`: Leave spectator mode
- `spectator-joined`: Notification of new spectator
- `spectator-left`: Notification of spectator leaving

### Chat
- `chat-message`: Send chat message
- `chat-history`: Receive recent chat history
- `chat-broadcast`: Broadcast message to room

### Connection
- `player-disconnected`: Player lost connection
- `player-reconnected`: Player returned
- `bot-takeover`: Bot replaced disconnected player
- `kick-player`: Host kicks player after timeout

## Conventions

### Code Style
- Use ES modules (`import`/`export`)
- Async/await for asynchronous operations
- Descriptive variable and function names
- Vue 3 Composition API with `<script setup>`

### Naming
- Components: PascalCase (e.g., `GameBoard.vue`)
- Files: camelCase for JS, PascalCase for Vue components
- Socket events: kebab-case (e.g., `game-started`)
- CSS classes: kebab-case with component prefix

### State Management
- Server is authoritative for game state
- Client uses Pinia for local UI state
- Socket.io for real-time synchronization

## Colors (Rummikub Theme)
- **Tiles**: Black, Red, Blue, Orange (classic colors)
- **Background**: Dark wood texture feel
- **Accent**: Gold/amber for highlights
- **UI**: Vuetify Material Design with custom theme
