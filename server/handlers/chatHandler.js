// Chat event handlers
import * as chatStore from '../stores/chatStore.js';
import * as userStore from '../stores/userStore.js';
import * as lobbyStore from '../stores/lobbyStore.js';
import * as gameStore from '../stores/gameStore.js';
import { MAX_MESSAGE_LENGTH } from '../../common/constants.js';

export function registerChatHandlers(io, socket) {
  // Send a chat message
  socket.on('chat-message', (data, callback) => {
    const user = userStore.getUser(socket.id);
    if (!user) {
      return callback?.({ success: false, error: 'Not authenticated' });
    }

    const { roomId, message } = data;
    
    if (!message || typeof message !== 'string') {
      return callback?.({ success: false, error: 'Invalid message' });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return callback?.({ success: false, error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` });
    }

    // Validate room access
    if (roomId.startsWith('lobby:')) {
      const lobbyId = roomId.replace('lobby:', '');
      const lobby = lobbyStore.getLobby(lobbyId);
      if (!lobby) {
        return callback?.({ success: false, error: 'Lobby not found' });
      }
      
      const isInLobby = lobby.players.some(p => p.socketId === socket.id) ||
                        lobby.spectators.some(s => s.socketId === socket.id);
      if (!isInLobby) {
        return callback?.({ success: false, error: 'Not in this lobby' });
      }
    } else if (roomId.startsWith('game:')) {
      const gameId = roomId.replace('game:', '');
      const game = gameStore.getGame(gameId);
      if (!game) {
        return callback?.({ success: false, error: 'Game not found' });
      }
      
      const isInGame = game.players.some(p => p.socketId === socket.id) ||
                       game.spectators.some(s => s.socketId === socket.id);
      if (!isInGame) {
        return callback?.({ success: false, error: 'Not in this game' });
      }
    } else {
      return callback?.({ success: false, error: 'Invalid room' });
    }

    const chatMessage = chatStore.addMessage(roomId, user.username, message.trim());
    
    // Broadcast to room
    io.to(roomId).emit('chat-broadcast', chatMessage);
    
    callback?.({ success: true, message: chatMessage });
  });

  // Get chat history for a room
  socket.on('get-chat-history', (roomId, callback) => {
    const history = chatStore.getHistory(roomId);
    callback(history);
  });
}
