// Main server entry point
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { registerAuthHandlers } from './handlers/authHandler.js';
import { registerLobbyHandlers, leaveLobby } from './handlers/lobbyHandler.js';
import { registerGameHandlers, handlePlayerDisconnect } from './handlers/gameHandler.js';
import { registerChatHandlers } from './handlers/chatHandler.js';
import * as userStore from './stores/userStore.js';
import * as lobbyStore from './stores/lobbyStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// Serve static files from Vue build (production only)
if (!isDev) {
  app.use(express.static(join(__dirname, '../client/dist')));
}

// API health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// SPA fallback - serve index.html for all non-API routes (production only)
if (!isDev) {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../client/dist/index.html'));
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Register all event handlers
  registerAuthHandlers(io, socket);
  registerLobbyHandlers(io, socket);
  registerGameHandlers(io, socket);
  registerChatHandlers(io, socket);

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    const user = userStore.getUser(socket.id);
    if (user) {
      // Mark user as disconnected but don't remove immediately
      userStore.setUserDisconnected(socket.id);
      
      // Handle game disconnection
      handlePlayerDisconnect(io, socket);
      
      // Handle lobby disconnection
      const lobby = lobbyStore.getLobbyByPlayer(socket.id);
      if (lobby && !lobby.gameInProgress) {
        leaveLobby(io, socket, lobby.id);
      }
      
      // Notify other users
      io.emit('users-updated', userStore.getOnlineUsers().map(u => ({
        username: u.username,
        lobbyId: u.lobbyId
      })));
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🎮 Rummikub server running on http://localhost:${PORT}`);
});
