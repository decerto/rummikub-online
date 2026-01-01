import { io } from 'socket.io-client';
import { useUserStore } from '@/stores/userStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useGameStore } from '@/stores/gameStore';

let socket = null;

export function getSocket() {
  return socket;
}

export function initSocket() {
  const serverUrl = import.meta.env.PROD 
    ? window.location.origin 
    : 'http://localhost:3000';
  
  socket = io(serverUrl, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
    
    // Try to reconnect with existing username if we have one
    const userStore = useUserStore();
    const gameStore = useGameStore();
    
    if (userStore.username) {
      console.log('Attempting auto-reconnect for user:', userStore.username);
      
      // Always try to re-register/reconnect when socket reconnects
      socket.emit('register-username', userStore.username, (response) => {
        if (response.success) {
          console.log('Auto-reconnected:', response);
          userStore.setUser(response.user);
          
          // If we were in a game, the server will send game-state-update
          if (response.reconnected && response.user.gameId) {
            console.log('Reconnected to game:', response.user.gameId);
            gameStore.setGameId(response.user.gameId);
          } else if (response.reconnected && response.user.lobbyId) {
            const lobbyStore = useLobbyStore();
            lobbyStore.rejoinLobby(response.user.lobbyId);
          }
        } else {
          console.log('Auto-reconnect failed:', response.error);
          // Username might be taken by someone else now, clear our state
          userStore.clearUser();
        }
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });

  // Global event listeners
  socket.on('users-updated', (users) => {
    const userStore = useUserStore();
    userStore.setOnlineUsers(users);
  });

  socket.on('public-lobbies-updated', (lobbies) => {
    const lobbyStore = useLobbyStore();
    lobbyStore.setPublicLobbies(lobbies);
  });

  socket.on('invite-received', (invite) => {
    const notificationStore = useNotificationStore();
    notificationStore.addInvite(invite);
  });

  socket.on('lobby-updated', (lobby) => {
    const lobbyStore = useLobbyStore();
    lobbyStore.setCurrentLobby(lobby);
  });

  socket.on('kicked-from-lobby', () => {
    const lobbyStore = useLobbyStore();
    const notificationStore = useNotificationStore();
    lobbyStore.clearCurrentLobby();
    notificationStore.addNotification({
      type: 'warning',
      title: 'Kicked from Lobby',
      message: 'You have been removed from the lobby'
    });
  });

  socket.on('game-started', (gameData) => {
    const gameStore = useGameStore();
    gameStore.initGame(gameData);
  });

  socket.on('game-state-update', (state) => {
    const gameStore = useGameStore();
    gameStore.updateGameState(state);
  });

  socket.on('turn-start', (data) => {
    const gameStore = useGameStore();
    gameStore.startTurn(data.timeLimit);
  });

  socket.on('turn-timeout', (data) => {
    const gameStore = useGameStore();
    const notificationStore = useNotificationStore();
    gameStore.handleTurnTimeout();
    notificationStore.addNotification({
      type: 'info',
      title: 'Turn Timeout',
      message: `${data.player}'s turn timed out`
    });
  });

  socket.on('game-ended', (data) => {
    const gameStore = useGameStore();
    gameStore.endGame(data);
  });

  socket.on('player-disconnected', (data) => {
    const notificationStore = useNotificationStore();
    notificationStore.addNotification({
      type: 'warning',
      title: 'Player Disconnected',
      message: `${data.username} disconnected. Waiting ${data.gracePeriod}s for reconnection...`
    });
  });

  socket.on('player-reconnected', (data) => {
    const notificationStore = useNotificationStore();
    notificationStore.addNotification({
      type: 'success',
      title: 'Player Reconnected',
      message: `${data.username} has reconnected`
    });
  });

  socket.on('disconnect-timeout', (data) => {
    const gameStore = useGameStore();
    gameStore.setDisconnectTimeout(data);
  });

  socket.on('bot-takeover', (data) => {
    const notificationStore = useNotificationStore();
    notificationStore.addNotification({
      type: 'info',
      title: 'Bot Takeover',
      message: `A bot is now playing for the disconnected player`
    });
  });

  socket.on('bot-played', (data) => {
    const notificationStore = useNotificationStore();
    notificationStore.addNotification({
      type: 'info',
      title: 'Bot Move',
      message: `${data.botName} played ${data.tilesPlayed} tile(s)`
    });
  });

  socket.on('bot-drew', (data) => {
    const notificationStore = useNotificationStore();
    notificationStore.addNotification({
      type: 'info',
      title: 'Bot Draw',
      message: `${data.botName} drew a tile`
    });
  });

  socket.on('spectator-joined', (data) => {
    const notificationStore = useNotificationStore();
    notificationStore.addNotification({
      type: 'info',
      title: 'Spectator Joined',
      message: `${data.username} is now watching`
    });
  });

  socket.on('rematch-started', (data) => {
    const lobbyStore = useLobbyStore();
    const gameStore = useGameStore();
    gameStore.clearGame();
    lobbyStore.rejoinLobby(data.lobbyId);
  });

  socket.on('chat-broadcast', (message) => {
    console.log('[Socket] Received chat-broadcast:', message);
    const lobbyStore = useLobbyStore();
    const gameStore = useGameStore();
    
    if (gameStore.isInGame) {
      console.log('[Socket] Adding to game chat');
      gameStore.addChatMessage(message);
    } else if (lobbyStore.currentLobby) {
      console.log('[Socket] Adding to lobby chat');
      lobbyStore.addChatMessage(message);
    } else {
      console.log('[Socket] No game or lobby to add message to');
    }
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
  }
}
