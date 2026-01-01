import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getSocket } from '@/plugins/socket';

export const useLobbyStore = defineStore('lobby', () => {
  const currentLobby = ref(null);
  const publicLobbies = ref([]);
  const chatMessages = ref([]);
  const isLoading = ref(false);

  const isInLobby = computed(() => !!currentLobby.value);
  const isHost = computed(() => {
    if (!currentLobby.value) return false;
    const socket = getSocket();
    return currentLobby.value.players.some(p => 
      p.socketId === socket?.id && p.username === currentLobby.value.hostUsername
    );
  });

  function setCurrentLobby(lobby) {
    currentLobby.value = lobby;
  }

  function clearCurrentLobby() {
    currentLobby.value = null;
    chatMessages.value = [];
  }

  function setPublicLobbies(lobbies) {
    publicLobbies.value = lobbies;
  }

  function addChatMessage(message) {
    chatMessages.value.push(message);
    // Keep last 100 messages
    if (chatMessages.value.length > 100) {
      chatMessages.value = chatMessages.value.slice(-100);
    }
  }

  function setChatHistory(history) {
    chatMessages.value = history;
  }

  // Socket actions
  function createLobby(isPublic = true) {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      isLoading.value = true;
      
      socket.emit('create-lobby', { isPublic }, (response) => {
        isLoading.value = false;
        if (response.success) {
          setCurrentLobby(response.lobby);
          resolve(response.lobby);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function joinLobby(lobbyId) {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      isLoading.value = true;
      
      socket.emit('join-lobby', lobbyId, (response) => {
        isLoading.value = false;
        if (response.success) {
          setCurrentLobby(response.lobby);
          // Get chat history
          socket.emit('get-chat-history', `lobby:${lobbyId}`, (history) => {
            setChatHistory(history);
          });
          resolve(response.lobby);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function rejoinLobby(lobbyId) {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      
      socket.emit('get-lobby', lobbyId, (response) => {
        if (response.success) {
          setCurrentLobby(response.lobby);
          resolve(response.lobby);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function leaveLobby() {
    return new Promise((resolve) => {
      const socket = getSocket();
      
      socket.emit('leave-lobby', (response) => {
        clearCurrentLobby();
        resolve(response);
      });
    });
  }

  function inviteUser(username) {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      
      socket.emit('invite-user', username, (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function addBot(difficulty) {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      
      socket.emit('add-bot', difficulty, (response) => {
        if (response.success) {
          setCurrentLobby(response.lobby);
          resolve(response.lobby);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function removePlayer(socketId) {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      
      socket.emit('remove-player', socketId, (response) => {
        if (response.success) {
          resolve(response.lobby);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function updateRules(rules) {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      
      socket.emit('update-rules', rules, (response) => {
        if (response.success) {
          setCurrentLobby(response.lobby);
          resolve(response.lobby);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function togglePublic(isPublic) {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      
      socket.emit('toggle-public', isPublic, (response) => {
        if (response.success) {
          setCurrentLobby(response.lobby);
          resolve(response.lobby);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function startGame() {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      isLoading.value = true;
      
      socket.emit('start-game', (response) => {
        isLoading.value = false;
        if (response.success) {
          resolve(response.gameId);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function fetchPublicLobbies() {
    const socket = getSocket();
    socket.emit('get-public-lobbies', (lobbies) => {
      setPublicLobbies(lobbies);
    });
  }

  function sendMessage(message) {
    const socket = getSocket();
    if (!currentLobby.value) return;
    
    socket.emit('chat-message', {
      roomId: `lobby:${currentLobby.value.id}`,
      message
    });
  }

  return {
    currentLobby,
    publicLobbies,
    chatMessages,
    isLoading,
    isInLobby,
    isHost,
    setCurrentLobby,
    clearCurrentLobby,
    setPublicLobbies,
    addChatMessage,
    setChatHistory,
    createLobby,
    joinLobby,
    rejoinLobby,
    leaveLobby,
    inviteUser,
    addBot,
    removePlayer,
    updateRules,
    togglePublic,
    startGame,
    fetchPublicLobbies,
    sendMessage
  };
});
