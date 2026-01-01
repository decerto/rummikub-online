import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getSocket } from '@/plugins/socket';

export const useGameStore = defineStore('game', () => {
  const gameId = ref(null);
  const players = ref([]);
  const myTiles = ref([]);
  const tableSets = ref([]);
  const currentPlayerIndex = ref(0);
  const poolCount = ref(0);
  const rules = ref(null);
  const isSpectator = ref(false);
  const chatMessages = ref([]);
  
  // Turn state
  const turnTimeLimit = ref(120);
  const turnTimeRemaining = ref(120);
  const turnTimer = ref(null);
  const isMyTurn = ref(false);
  
  // Game state
  const gameEnded = ref(false);
  const winner = ref(null);
  const scores = ref([]);
  const stats = ref(null);
  
  // Disconnect handling
  const disconnectTimeout = ref(null);
  
  // Drag state for local manipulation
  const localTableSets = ref([]);
  const localMyTiles = ref([]);
  const hasChanges = ref(false);
  const currentSortOrder = ref(null); // 'color', 'number', or null
  const highlightedTileIds = ref(new Set()); // Track newly placed tiles for highlighting

  const isInGame = computed(() => !!gameId.value && !gameEnded.value);
  
  const currentPlayer = computed(() => 
    players.value[currentPlayerIndex.value]
  );
  
  const myPlayer = computed(() => {
    const socket = getSocket();
    return players.value.find(p => p.socketId === socket?.id);
  });

  function initGame(data) {
    gameId.value = data.gameId;
    players.value = data.players;
    myTiles.value = data.yourTiles || [];
    localMyTiles.value = [...myTiles.value];
    tableSets.value = data.tableSets || [];
    localTableSets.value = tableSets.value.map(s => [...s]);
    currentPlayerIndex.value = data.currentPlayerIndex;
    poolCount.value = data.poolCount;
    rules.value = data.rules;
    isSpectator.value = data.isSpectator || false;
    gameEnded.value = false;
    winner.value = null;
    scores.value = [];
    hasChanges.value = false;
    
    checkIfMyTurn();
  }

  function updateGameState(state) {
    // Track new tiles added to table for highlighting
    const previousTableTileIds = new Set(tableSets.value.flat().map(t => t.id));
    const newTableTileIds = new Set(state.tableSets.flat().map(t => t.id));
    const newlyPlacedIds = [...newTableTileIds].filter(id => !previousTableTileIds.has(id));
    
    if (newlyPlacedIds.length > 0) {
      // Highlight new tiles for 3 seconds
      newlyPlacedIds.forEach(id => highlightedTileIds.value.add(id));
      setTimeout(() => {
        newlyPlacedIds.forEach(id => highlightedTileIds.value.delete(id));
      }, 3000);
    }
    
    players.value = state.players;
    
    if (!isSpectator.value) {
      myTiles.value = state.yourTiles;
      // Only reset local tiles if not during our turn or no changes
      if (!isMyTurn.value || !hasChanges.value) {
        localMyTiles.value = [...state.yourTiles];
        // Re-apply sort if a sort order was set
        if (currentSortOrder.value === 'color') {
          applySortByColor();
        } else if (currentSortOrder.value === 'number') {
          applySortByNumber();
        }
      }
    }
    
    tableSets.value = state.tableSets;
    if (!isMyTurn.value || !hasChanges.value) {
      localTableSets.value = state.tableSets.map(s => [...s]);
    }
    
    currentPlayerIndex.value = state.currentPlayerIndex;
    poolCount.value = state.poolCount;
    
    checkIfMyTurn();
    
    if (state.reconnected) {
      // Force reset local state on reconnection
      localMyTiles.value = [...myTiles.value];
      localTableSets.value = tableSets.value.map(s => [...s]);
      hasChanges.value = false;
    }
  }

  function checkIfMyTurn() {
    const socket = getSocket();
    const current = players.value[currentPlayerIndex.value];
    isMyTurn.value = current?.socketId === socket?.id;
  }

  function startTurn(timeLimit) {
    turnTimeLimit.value = timeLimit;
    turnTimeRemaining.value = timeLimit;
    isMyTurn.value = true;
    hasChanges.value = false;
    
    // Reset local state to match server state at turn start
    localMyTiles.value = [...myTiles.value];
    localTableSets.value = tableSets.value.map(s => [...s]);
    
    // Start countdown
    if (turnTimer.value) {
      clearInterval(turnTimer.value);
    }
    
    turnTimer.value = setInterval(() => {
      turnTimeRemaining.value--;
      if (turnTimeRemaining.value <= 0) {
        clearInterval(turnTimer.value);
      }
    }, 1000);
  }

  function handleTurnTimeout() {
    if (turnTimer.value) {
      clearInterval(turnTimer.value);
    }
    isMyTurn.value = false;
    hasChanges.value = false;
    
    // Revert local state
    localMyTiles.value = [...myTiles.value];
    localTableSets.value = tableSets.value.map(s => [...s]);
  }

  function endGame(data) {
    gameEnded.value = true;
    winner.value = data.winner;
    scores.value = data.scores;
    stats.value = data.stats;
    
    if (turnTimer.value) {
      clearInterval(turnTimer.value);
    }
  }

  function clearGame() {
    gameId.value = null;
    players.value = [];
    myTiles.value = [];
    localMyTiles.value = [];
    tableSets.value = [];
    localTableSets.value = [];
    currentPlayerIndex.value = 0;
    poolCount.value = 0;
    rules.value = null;
    isSpectator.value = false;
    gameEnded.value = false;
    winner.value = null;
    scores.value = [];
    stats.value = null;
    chatMessages.value = [];
    hasChanges.value = false;
    isMyTurn.value = false;
    currentSortOrder.value = null;
    highlightedTileIds.value = new Set();
    
    if (turnTimer.value) {
      clearInterval(turnTimer.value);
      turnTimer.value = null;
    }
  }

  function setDisconnectTimeout(data) {
    disconnectTimeout.value = data;
  }

  function clearDisconnectTimeout() {
    disconnectTimeout.value = null;
  }

  function addChatMessage(message) {
    chatMessages.value.push(message);
    if (chatMessages.value.length > 100) {
      chatMessages.value = chatMessages.value.slice(-100);
    }
  }

  // Local tile manipulation
  function moveTileToTable(tile, setIndex = -1) {
    // Remove from local tiles
    const tileIdx = localMyTiles.value.findIndex(t => t.id === tile.id);
    if (tileIdx !== -1) {
      localMyTiles.value.splice(tileIdx, 1);
    }
    
    // Add to table
    if (setIndex >= 0 && setIndex < localTableSets.value.length) {
      localTableSets.value[setIndex].push(tile);
    } else {
      // Create new set
      localTableSets.value.push([tile]);
    }
    
    hasChanges.value = true;
  }

  function moveTileToRack(tile, setIndex) {
    // Remove from table set
    if (setIndex >= 0 && setIndex < localTableSets.value.length) {
      const set = localTableSets.value[setIndex];
      const tileIdx = set.findIndex(t => t.id === tile.id);
      if (tileIdx !== -1) {
        set.splice(tileIdx, 1);
        // Remove empty sets
        if (set.length === 0) {
          localTableSets.value.splice(setIndex, 1);
        }
      }
    }
    
    // Add to rack
    localMyTiles.value.push(tile);
    hasChanges.value = true;
  }

  function updateLocalTableSets(sets) {
    localTableSets.value = sets;
    hasChanges.value = true;
  }

  function updateLocalMyTiles(tiles) {
    localMyTiles.value = tiles;
    hasChanges.value = true;
  }

  function revertChanges() {
    localMyTiles.value = [...myTiles.value];
    localTableSets.value = tableSets.value.map(s => [...s]);
    hasChanges.value = false;
    // Re-apply sort if needed
    if (currentSortOrder.value === 'color') {
      applySortByColor();
    } else if (currentSortOrder.value === 'number') {
      applySortByNumber();
    }
  }

  // Internal sort function (doesn't set order)
  function applySortByColor() {
    const colorOrder = { black: 0, red: 1, blue: 2, orange: 3 };
    localMyTiles.value = [...localMyTiles.value].sort((a, b) => {
      if (a.isJoker && !b.isJoker) return 1;
      if (!a.isJoker && b.isJoker) return -1;
      if (a.isJoker && b.isJoker) return 0;
      const colorDiff = (colorOrder[a.color] || 0) - (colorOrder[b.color] || 0);
      if (colorDiff !== 0) return colorDiff;
      return a.number - b.number;
    });
  }

  // Internal sort function (doesn't set order)
  function applySortByNumber() {
    const colorOrder = { black: 0, red: 1, blue: 2, orange: 3 };
    localMyTiles.value = [...localMyTiles.value].sort((a, b) => {
      if (a.isJoker && !b.isJoker) return 1;
      if (!a.isJoker && b.isJoker) return -1;
      if (a.isJoker && b.isJoker) return 0;
      const numDiff = a.number - b.number;
      if (numDiff !== 0) return numDiff;
      return (colorOrder[a.color] || 0) - (colorOrder[b.color] || 0);
    });
  }

  // Sort tiles - by color first, then by number within each color
  function sortTilesByColor() {
    currentSortOrder.value = 'color';
    applySortByColor();
  }

  // Sort tiles - by number first, then by color within each number
  function sortTilesByNumber() {
    currentSortOrder.value = 'number';
    applySortByNumber();
  }

  // Remove duplicate tiles - keeps track of seen IDs and removes duplicates
  function deduplicateTiles() {
    const seenIds = new Set();
    
    // First, dedupe player tiles
    const dedupedPlayerTiles = [];
    for (const tile of localMyTiles.value) {
      if (!seenIds.has(tile.id)) {
        seenIds.add(tile.id);
        dedupedPlayerTiles.push(tile);
      }
    }
    localMyTiles.value = dedupedPlayerTiles;
    
    // Then, dedupe table sets
    const dedupedTableSets = [];
    for (const set of localTableSets.value) {
      const dedupedSet = [];
      for (const tile of set) {
        if (!seenIds.has(tile.id)) {
          seenIds.add(tile.id);
          dedupedSet.push(tile);
        }
      }
      if (dedupedSet.length > 0) {
        dedupedTableSets.push(dedupedSet);
      }
    }
    localTableSets.value = dedupedTableSets;
  }

  // Socket actions
  function endTurn() {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      
      // Deduplicate tiles before sending to prevent duplicate ID errors
      deduplicateTiles();
      
      socket.emit('end-turn', {
        tableSets: localTableSets.value,
        playerTiles: localMyTiles.value
      }, (response) => {
        if (response.success) {
          hasChanges.value = false;
          if (turnTimer.value) {
            clearInterval(turnTimer.value);
          }
          resolve(response);
        } else {
          if (response.reverted) {
            revertChanges();
          }
          reject(new Error(response.error));
        }
      });
    });
  }

  function drawTile() {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      
      socket.emit('draw-tile', (response) => {
        if (response.success) {
          hasChanges.value = false;
          if (turnTimer.value) {
            clearInterval(turnTimer.value);
          }
          resolve(response.tile);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function handleDisconnectedPlayer(action, botDifficulty = 'medium') {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      
      socket.emit('handle-disconnected-player', {
        gameId: gameId.value,
        playerSocketId: disconnectTimeout.value?.playerSocketId,
        action,
        botDifficulty
      }, (response) => {
        if (response.success) {
          clearDisconnectTimeout();
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function requestRematch() {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      
      socket.emit('rematch', (response) => {
        if (response.success) {
          resolve(response.lobbyId);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  function sendMessage(message) {
    const socket = getSocket();
    if (!gameId.value) return;
    
    socket.emit('chat-message', {
      roomId: `game:${gameId.value}`,
      message
    });
  }

  return {
    gameId,
    players,
    myTiles,
    tableSets,
    currentPlayerIndex,
    poolCount,
    rules,
    isSpectator,
    chatMessages,
    turnTimeLimit,
    turnTimeRemaining,
    isMyTurn,
    gameEnded,
    winner,
    scores,
    stats,
    disconnectTimeout,
    localTableSets,
    localMyTiles,
    hasChanges,
    highlightedTileIds,
    isInGame,
    currentPlayer,
    myPlayer,
    initGame,
    updateGameState,
    startTurn,
    handleTurnTimeout,
    endGame,
    clearGame,
    setDisconnectTimeout,
    clearDisconnectTimeout,
    addChatMessage,
    moveTileToTable,
    moveTileToRack,
    updateLocalTableSets,
    updateLocalMyTiles,
    revertChanges,
    sortTilesByColor,
    sortTilesByNumber,
    endTurn,
    drawTile,
    handleDisconnectedPlayer,
    requestRematch,
    sendMessage
  };
});
