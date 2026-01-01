// Lobby event handlers
import * as lobbyStore from '../stores/lobbyStore.js';
import * as userStore from '../stores/userStore.js';
import * as chatStore from '../stores/chatStore.js';
import { validateCustomRules } from '../../common/rulePresets.js';

export function registerLobbyHandlers(io, socket) {
  // Create a new lobby
  socket.on('create-lobby', (options, callback) => {
    const user = userStore.getUser(socket.id);
    if (!user) {
      return callback({ success: false, error: 'Not authenticated' });
    }

    // Check if already in a lobby
    const existingLobby = lobbyStore.getLobbyByPlayer(socket.id);
    if (existingLobby) {
      return callback({ success: false, error: 'Already in a lobby' });
    }

    const isPublic = options?.isPublic !== false;
    const lobby = lobbyStore.createLobby(socket.id, user.username, isPublic);
    
    // Update user's lobby reference
    userStore.updateUser(socket.id, { lobbyId: lobby.id });
    
    // Join the socket room
    socket.join(`lobby:${lobby.id}`);
    
    // Add join message to chat
    chatStore.addJoinMessage(`lobby:${lobby.id}`, user.username);
    
    console.log(`Lobby created: ${lobby.id} by ${user.username}`);
    
    callback({ success: true, lobby: sanitizeLobby(lobby) });
    
    // Broadcast updated public lobbies
    io.emit('public-lobbies-updated', getPublicLobbiesData());
  });

  // Get public lobbies
  socket.on('get-public-lobbies', (callback) => {
    callback(getPublicLobbiesData());
  });

  // Join a lobby
  socket.on('join-lobby', (lobbyId, callback) => {
    const user = userStore.getUser(socket.id);
    if (!user) {
      return callback({ success: false, error: 'Not authenticated' });
    }

    const lobby = lobbyStore.getLobby(lobbyId);
    if (!lobby) {
      return callback({ success: false, error: 'Lobby not found' });
    }

    if (lobby.gameInProgress) {
      return callback({ success: false, error: 'Game already in progress' });
    }

    if (lobby.players.length >= lobby.rules.maxPlayers) {
      return callback({ success: false, error: 'Lobby is full' });
    }

    // Leave current lobby if in one
    const currentLobby = lobbyStore.getLobbyByPlayer(socket.id);
    if (currentLobby) {
      leaveLobby(io, socket, currentLobby.id);
    }

    const result = lobbyStore.addPlayerToLobby(lobbyId, socket.id, user.username);
    if (!result) {
      return callback({ success: false, error: 'Could not join lobby' });
    }

    userStore.updateUser(socket.id, { lobbyId: lobby.id });
    socket.join(`lobby:${lobbyId}`);
    
    chatStore.addJoinMessage(`lobby:${lobbyId}`, user.username);
    
    console.log(`${user.username} joined lobby ${lobbyId}`);
    
    callback({ success: true, lobby: sanitizeLobby(result) });
    
    // Notify lobby members
    socket.to(`lobby:${lobbyId}`).emit('lobby-updated', sanitizeLobby(result));
    io.emit('public-lobbies-updated', getPublicLobbiesData());
  });

  // Leave lobby
  socket.on('leave-lobby', (callback) => {
    const lobby = lobbyStore.getLobbyByPlayer(socket.id);
    if (!lobby) {
      return callback({ success: false, error: 'Not in a lobby' });
    }

    const result = leaveLobby(io, socket, lobby.id);
    callback({ success: true, deleted: result?.deleted });
  });

  // Invite a user to lobby
  socket.on('invite-user', (username, callback) => {
    const user = userStore.getUser(socket.id);
    if (!user) {
      return callback({ success: false, error: 'Not authenticated' });
    }

    const lobby = lobbyStore.getLobby(user.lobbyId);
    if (!lobby) {
      return callback({ success: false, error: 'Not in a lobby' });
    }

    if (lobby.hostSocketId !== socket.id) {
      return callback({ success: false, error: 'Only host can invite' });
    }

    const targetUser = userStore.getUserByUsername(username);
    if (!targetUser) {
      return callback({ success: false, error: 'User not found' });
    }

    if (targetUser.lobbyId) {
      return callback({ success: false, error: 'User is already in a lobby' });
    }

    // Send invite to target user
    io.to(targetUser.socketId).emit('invite-received', {
      lobbyId: lobby.id,
      hostUsername: user.username,
      playerCount: lobby.players.length,
      maxPlayers: lobby.rules.maxPlayers
    });

    callback({ success: true });
  });

  // Add bot to lobby
  socket.on('add-bot', (difficulty, callback) => {
    const user = userStore.getUser(socket.id);
    if (!user) {
      return callback({ success: false, error: 'Not authenticated' });
    }

    const lobby = lobbyStore.getLobby(user.lobbyId);
    if (!lobby) {
      return callback({ success: false, error: 'Not in a lobby' });
    }

    if (lobby.hostSocketId !== socket.id) {
      return callback({ success: false, error: 'Only host can add bots' });
    }

    const validDifficulties = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(difficulty)) {
      return callback({ success: false, error: 'Invalid difficulty' });
    }

    const result = lobbyStore.addBotToLobby(lobby.id, difficulty);
    if (!result) {
      return callback({ success: false, error: 'Could not add bot (lobby may be full)' });
    }

    callback({ success: true, lobby: sanitizeLobby(result) });
    
    io.to(`lobby:${lobby.id}`).emit('lobby-updated', sanitizeLobby(result));
    io.emit('public-lobbies-updated', getPublicLobbiesData());
  });

  // Remove player/bot from lobby
  socket.on('remove-player', (targetSocketId, callback) => {
    const user = userStore.getUser(socket.id);
    if (!user) {
      return callback({ success: false, error: 'Not authenticated' });
    }

    const lobby = lobbyStore.getLobby(user.lobbyId);
    if (!lobby) {
      return callback({ success: false, error: 'Not in a lobby' });
    }

    if (lobby.hostSocketId !== socket.id) {
      return callback({ success: false, error: 'Only host can remove players' });
    }

    const targetPlayer = lobby.players.find(p => p.socketId === targetSocketId);
    if (!targetPlayer) {
      return callback({ success: false, error: 'Player not found' });
    }

    if (targetPlayer.isBot) {
      const result = lobbyStore.removeBotFromLobby(lobby.id, targetSocketId);
      if (result) {
        callback({ success: true, lobby: sanitizeLobby(result) });
        io.to(`lobby:${lobby.id}`).emit('lobby-updated', sanitizeLobby(result));
        io.emit('public-lobbies-updated', getPublicLobbiesData());
      }
    } else {
      // Kick human player
      io.to(targetSocketId).emit('kicked-from-lobby');
      
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(`lobby:${lobby.id}`);
      }
      
      const result = lobbyStore.removePlayerFromLobby(lobby.id, targetSocketId);
      userStore.updateUser(targetSocketId, { lobbyId: null });
      
      if (result) {
        callback({ success: true, lobby: sanitizeLobby(result) });
        io.to(`lobby:${lobby.id}`).emit('lobby-updated', sanitizeLobby(result));
        io.emit('public-lobbies-updated', getPublicLobbiesData());
      }
    }
  });

  // Update lobby rules
  socket.on('update-rules', (rules, callback) => {
    const user = userStore.getUser(socket.id);
    if (!user) {
      return callback({ success: false, error: 'Not authenticated' });
    }

    const lobby = lobbyStore.getLobby(user.lobbyId);
    if (!lobby) {
      return callback({ success: false, error: 'Not in a lobby' });
    }

    if (lobby.hostSocketId !== socket.id) {
      return callback({ success: false, error: 'Only host can update rules' });
    }

    // Validate custom rules
    const validation = validateCustomRules({ ...lobby.rules, ...rules });
    if (!validation.valid) {
      return callback({ success: false, error: validation.errors.join(', ') });
    }

    const result = lobbyStore.updateLobbyRules(lobby.id, rules);
    
    callback({ success: true, lobby: sanitizeLobby(result) });
    io.to(`lobby:${lobby.id}`).emit('lobby-updated', sanitizeLobby(result));
    io.emit('public-lobbies-updated', getPublicLobbiesData());
  });

  // Toggle lobby visibility
  socket.on('toggle-public', (isPublic, callback) => {
    const user = userStore.getUser(socket.id);
    if (!user) {
      return callback({ success: false, error: 'Not authenticated' });
    }

    const lobby = lobbyStore.getLobby(user.lobbyId);
    if (!lobby) {
      return callback({ success: false, error: 'Not in a lobby' });
    }

    if (lobby.hostSocketId !== socket.id) {
      return callback({ success: false, error: 'Only host can change visibility' });
    }

    const result = lobbyStore.setLobbyVisibility(lobby.id, isPublic);
    
    callback({ success: true, lobby: sanitizeLobby(result) });
    io.to(`lobby:${lobby.id}`).emit('lobby-updated', sanitizeLobby(result));
    io.emit('public-lobbies-updated', getPublicLobbiesData());
  });

  // Get lobby by ID
  socket.on('get-lobby', (lobbyId, callback) => {
    const lobby = lobbyStore.getLobby(lobbyId);
    if (!lobby) {
      return callback({ success: false, error: 'Lobby not found' });
    }
    callback({ success: true, lobby: sanitizeLobby(lobby) });
  });
}

function leaveLobby(io, socket, lobbyId) {
  const user = userStore.getUser(socket.id);
  const result = lobbyStore.removePlayerFromLobby(lobbyId, socket.id);
  
  if (result) {
    socket.leave(`lobby:${lobbyId}`);
    userStore.updateUser(socket.id, { lobbyId: null });
    
    if (user) {
      chatStore.addLeaveMessage(`lobby:${lobbyId}`, user.username);
    }
    
    if (!result.deleted) {
      io.to(`lobby:${lobbyId}`).emit('lobby-updated', sanitizeLobby(result));
    }
    
    io.emit('public-lobbies-updated', getPublicLobbiesData());
  }
  
  return result;
}

function sanitizeLobby(lobby) {
  return {
    id: lobby.id,
    hostUsername: lobby.hostUsername,
    isPublic: lobby.isPublic,
    players: lobby.players.map(p => ({
      username: p.username,
      socketId: p.socketId,
      isBot: p.isBot,
      botDifficulty: p.botDifficulty,
      isReady: p.isReady
    })),
    spectators: lobby.spectators,
    rules: lobby.rules,
    gameInProgress: lobby.gameInProgress,
    createdAt: lobby.createdAt
  };
}

function getPublicLobbiesData() {
  return lobbyStore.getPublicLobbies().map(lobby => ({
    id: lobby.id,
    hostUsername: lobby.hostUsername,
    playerCount: lobby.players.length,
    maxPlayers: lobby.rules.maxPlayers,
    rules: lobby.rules,
    createdAt: lobby.createdAt
  }));
}

export { leaveLobby };
