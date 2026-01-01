# Rummikub Online 🎮

An online multiplayer Rummikub game with real-time gameplay using WebSockets.

![Rummikub](https://img.shields.io/badge/Rummikub-Online-FFB300?style=for-the-badge)
![Vue](https://img.shields.io/badge/Vue-3-4FC08D?style=for-the-badge&logo=vue.js)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?style=for-the-badge&logo=socket.io)

## Features

### 🎯 Core Gameplay
- **Official Rummikub Rules** - Initial meld requirement, valid sets (runs & groups), joker manipulation
- **Drag-and-Drop Interface** - Intuitive tile movement with VueDraggable
- **1-Minute Turn Timer** - Configurable timer with free tile movement during your turn
- **Real-time Validation** - Invalid moves are automatically reverted

### 👥 Multiplayer
- **Public & Private Lobbies** - Create public games or invite-only sessions
- **Username System** - Unique usernames via Socket.io (no database needed)
- **Spectator Mode** - Watch ongoing games with shared chat
- **Player Invitations** - Popup invites with accept/decline

### 🤖 AI Bots
- **Easy** - Plays obvious, simple valid sets
- **Medium** - Plans multi-tile plays with basic strategy
- **Hard** - Table manipulation and optimal placement

### ⚙️ Customization
- **Rule Presets** - Official or Custom rule configurations
- **Configurable Settings** - Initial meld points, timer duration, joker count
- **Disconnect Handling** - 30s grace period with bot takeover option

### 💬 Communication
- **In-game Chat** - Shared between players and spectators
- **Notification System** - Popup invites + notification panel
- **Game Events** - Disconnects, reconnects, bot takeovers

## Tech Stack

- **Frontend**: Vue 3 + Vuetify 3 + Vue Router + Pinia + VueDraggable
- **Backend**: Node.js + Express + Socket.io
- **Shared**: Common validation logic in `/common/`

## Project Structure

```
├── package.json          # Root - orchestration scripts
├── /common/              # Shared code (rules, constants)
│   ├── constants.js      # Tile definitions, colors
│   ├── rules.js          # Validation logic
│   └── rulePresets.js    # Official + custom configs
├── /server/              # Node.js backend
│   ├── index.js          # Express + Socket.io entry
│   ├── /stores/          # In-memory data stores
│   ├── /handlers/        # Socket.io event handlers
│   └── /bot/             # Bot AI system
└── /client/              # Vue 3 frontend
    ├── /src/
    │   ├── /views/       # Page components
    │   ├── /components/  # Reusable UI
    │   ├── /stores/      # Pinia stores
    │   └── /plugins/     # Vuetify, Socket.io
    └── /dist/            # Built output
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/rummikub-online.git
cd rummikub-online
```

2. Install all dependencies:
```bash
npm run install:all
```

### Development

Run both frontend and backend in development mode:
```bash
npm run dev
```

Or run them separately:
```bash
# Terminal 1 - Backend (http://localhost:3000)
npm run dev:server

# Terminal 2 - Frontend (http://localhost:5173)
npm run dev:client
```

### Production Build

1. Build the frontend:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

The server will serve the built frontend at `http://localhost:3000`.

## Game Rules

### Official Rummikub Rules
- **Initial Meld**: First play must total 30+ points from your own tiles
- **Valid Sets**:
  - **Runs**: 3+ tiles of the same color in consecutive numbers
  - **Groups**: 3-4 tiles of the same number in different colors
- **Jokers**: Wild tiles that can substitute any tile (2 per game)
- **Turn**: Move tiles freely, then validate with "End Turn"
- **Drawing**: If you can't play, draw a tile and end your turn

### Custom Rules
- Adjust initial meld requirement (0-100 points)
- Configure turn timer (15-300 seconds)
- Set number of jokers (0-4)

## Socket.io Events

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for complete event documentation.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Made with ❤️ and Vue.js
