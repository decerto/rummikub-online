// Authentication event handlers
import * as userStore from '../stores/userStore.js';
import { handlePlayerReconnect } from './gameHandler.js';

export function registerAuthHandlers(io, socket) {
  // Register a username
  socket.on('register-username', (username, callback) => {
    // Validate username
    if (!username || typeof username !== 'string') {
      return callback({ success: false, error: 'Invalid username' });
    }

    const trimmedUsername = username.trim();
    
    if (trimmedUsername.length < 2 || trimmedUsername.length > 20) {
      return callback({ success: false, error: 'Username must be 2-20 characters' });
    }

    // Check if this username belongs to a disconnected user (for reconnection)
    const disconnectedUser = userStore.getDisconnectedUser(trimmedUsername);
    if (disconnectedUser) {
      const oldSocketId = disconnectedUser.socketId;
      
      // Auto-reconnect: transfer the old user data to the new socket
      const user = userStore.transferUser(oldSocketId, socket.id);
      if (user) {
        console.log(`User auto-reconnected: ${trimmedUsername} (${socket.id})`);
        
        // Handle game reconnection if user was in a game
        if (user.gameId) {
          handlePlayerReconnect(io, socket, oldSocketId);
        }
        
        // Rejoin lobby room if user was in a lobby
        if (user.lobbyId) {
          socket.join(`lobby:${user.lobbyId}`);
        }
        
        callback({ 
          success: true, 
          user: { 
            username: user.username,
            lobbyId: user.lobbyId,
            gameId: user.gameId
          },
          reconnected: true
        });
        
        // Broadcast updated online users list
        io.emit('users-updated', userStore.getOnlineUsers().map(u => ({
          username: u.username,
          lobbyId: u.lobbyId
        })));
        return;
      }
    }

    // Check if username is taken by a connected user
    if (userStore.isUsernameTaken(trimmedUsername)) {
      return callback({ success: false, error: 'Username is already taken' });
    }

    // Register the user
    const user = userStore.addUser(socket.id, trimmedUsername);
    
    console.log(`User registered: ${trimmedUsername} (${socket.id})`);
    
    callback({ success: true, user: { username: user.username } });
    
    // Broadcast updated online users list
    io.emit('users-updated', userStore.getOnlineUsers().map(u => ({
      username: u.username,
      lobbyId: u.lobbyId
    })));
  });

  // Get online users
  socket.on('get-online-users', (callback) => {
    const users = userStore.getOnlineUsers().map(u => ({
      username: u.username,
      lobbyId: u.lobbyId
    }));
    callback(users);
  });

  // Reconnection attempt
  socket.on('reconnect-user', (username, callback) => {
    const existingUser = userStore.getUserByUsername(username);
    
    if (existingUser && existingUser.disconnectedAt) {
      // User was disconnected, allow reconnection
      const user = userStore.transferUser(existingUser.socketId, socket.id);
      if (user) {
        console.log(`User reconnected: ${username} (${socket.id})`);
        callback({ 
          success: true, 
          user: { 
            username: user.username,
            lobbyId: user.lobbyId,
            gameId: user.gameId
          } 
        });
        return;
      }
    }
    
    callback({ success: false, error: 'Could not reconnect' });
  });
}
