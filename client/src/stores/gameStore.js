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
  
  // Rematch voting
  const rematchVotes = ref({});
  const rematchVoteStats = ref({ totalPlayers: 0, yesVotes: 0, noVotes: 0, votesReceived: 0 });
  const hasVotedRematch = ref(false);
  
  // Disconnect handling
  const disconnectTimeout = ref(null);
  
  // Drag state for local manipulation
  const localTableSets = ref([]);
  const localMyTiles = ref([]);
  const hasChanges = ref(false);
  const currentSortOrder = ref(null); // 'color', 'number', or null
  const highlightedTileIds = ref(new Set()); // Track newly placed tiles for highlighting
  const highlightedHandTileIds = ref(new Set()); // Track newly drawn tiles for highlighting
  
  // Track tiles placed during current turn (only these can be taken back)
  const tilesPlacedThisTurn = ref(new Set());
  
  // Current turn timer (visible to all players)
  const currentTurnTimeRemaining = ref(0);
  const currentTurnTimerInterval = ref(null);
  
  // Total game timer
  const totalGameTime = ref(0);
  const totalGameTimerInterval = ref(null);
  const gameStartTime = ref(null);

  const isInGame = computed(() => !!gameId.value && !gameEnded.value);
  
  const currentPlayer = computed(() => 
    players.value[currentPlayerIndex.value]
  );
  
  const myPlayer = computed(() => {
    const socket = getSocket();
    return players.value.find(p => p.socketId === socket?.id);
  });

  // Check if current player has played their initial meld
  const hasPlayedInitialMeld = computed(() => {
    return myPlayer.value?.hasPlayedInitialMeld || false;
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
    
    // Clear tiles placed this turn
    tilesPlacedThisTurn.value = new Set();
    
    // Start total game timer
    gameStartTime.value = Date.now();
    totalGameTime.value = 0;
    if (totalGameTimerInterval.value) {
      clearInterval(totalGameTimerInterval.value);
    }
    totalGameTimerInterval.value = setInterval(() => {
      totalGameTime.value = Math.floor((Date.now() - gameStartTime.value) / 1000);
    }, 1000);
    gameEnded.value = false;
    winner.value = null;
    scores.value = [];
    hasChanges.value = false;
    
    // Apply default sort (by color) for new games
    currentSortOrder.value = 'color';
    applySortByColor();
    
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
      // Track new tiles added to hand for highlighting (drawn tiles)
      const previousHandTileIds = new Set(myTiles.value.map(t => t.id));
      const newHandTileIds = new Set(state.yourTiles.map(t => t.id));
      const newlyDrawnIds = [...newHandTileIds].filter(id => !previousHandTileIds.has(id));
      
      if (newlyDrawnIds.length > 0) {
        // Highlight newly drawn tiles for 3 seconds
        newlyDrawnIds.forEach(id => highlightedHandTileIds.value.add(id));
        setTimeout(() => {
          newlyDrawnIds.forEach(id => highlightedHandTileIds.value.delete(id));
        }, 3000);
      }
      
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
    
    // Clear tiles placed this turn tracking
    tilesPlacedThisTurn.value = new Set();
    
    // Reset local state to match server state at turn start
    localMyTiles.value = [...myTiles.value];
    localTableSets.value = tableSets.value.map(s => [...s]);
    
    // Re-apply sort if a sort order was set
    if (currentSortOrder.value === 'color') {
      applySortByColor();
    } else if (currentSortOrder.value === 'number') {
      applySortByNumber();
    }
    
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
    tilesPlacedThisTurn.value = new Set();
    
    // Revert local state
    localMyTiles.value = [...myTiles.value];
    localTableSets.value = tableSets.value.map(s => [...s]);
    
    // Re-apply sort if needed
    if (currentSortOrder.value === 'color') {
      applySortByColor();
    } else if (currentSortOrder.value === 'number') {
      applySortByNumber();
    }
  }

  function endGame(data) {
    gameEnded.value = true;
    winner.value = data.winner;
    scores.value = data.scores;
    stats.value = data.stats;
    
    if (turnTimer.value) {
      clearInterval(turnTimer.value);
    }
    if (currentTurnTimerInterval.value) {
      clearInterval(currentTurnTimerInterval.value);
    }
    if (totalGameTimerInterval.value) {
      clearInterval(totalGameTimerInterval.value);
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
    highlightedHandTileIds.value = new Set();
    tilesPlacedThisTurn.value = new Set();
    currentTurnTimeRemaining.value = 0;
    totalGameTime.value = 0;
    gameStartTime.value = null;
    
    if (turnTimer.value) {
      clearInterval(turnTimer.value);
      turnTimer.value = null;
    }
    if (currentTurnTimerInterval.value) {
      clearInterval(currentTurnTimerInterval.value);
      currentTurnTimerInterval.value = null;
    }
    if (totalGameTimerInterval.value) {
      clearInterval(totalGameTimerInterval.value);
      totalGameTimerInterval.value = null;
    }
  }

  // Set gameId for reconnection (before full state is received)
  function setGameId(id) {
    gameId.value = id;
    gameEnded.value = false;
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
      // Track that this tile was placed this turn
      tilesPlacedThisTurn.value.add(tile.id);
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

  // Check if a tile can be taken back from the table
  function canTakeTileBack(tile) {
    // Only tiles placed THIS TURN can be taken back
    return tilesPlacedThisTurn.value.has(tile.id);
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

  function voteRematch(vote) {
    const socket = getSocket();
    socket.emit('vote-rematch', { vote });
    hasVotedRematch.value = true;
  }

  function declineRematch() {
    const socket = getSocket();
    socket.emit('decline-rematch');
    hasVotedRematch.value = true;
  }

  function updateRematchVotes(votes, stats) {
    rematchVotes.value = votes;
    rematchVoteStats.value = stats;
  }

  function resetRematchState() {
    rematchVotes.value = {};
    rematchVoteStats.value = { totalPlayers: 0, yesVotes: 0, noVotes: 0, votesReceived: 0 };
    hasVotedRematch.value = false;
  }

  function sendMessage(message) {
    const socket = getSocket();
    if (!gameId.value) return;
    
    socket.emit('chat-message', {
      roomId: `game:${gameId.value}`,
      message
    });
  }

  // Update the current turn timer (called when receiving turn-timer-sync)
  function updateCurrentTurnTimer(timeRemaining) {
    currentTurnTimeRemaining.value = timeRemaining;
    
    // Clear existing interval
    if (currentTurnTimerInterval.value) {
      clearInterval(currentTurnTimerInterval.value);
    }
    
    // Start countdown for current turn (visible to all players)
    currentTurnTimerInterval.value = setInterval(() => {
      if (currentTurnTimeRemaining.value > 0) {
        currentTurnTimeRemaining.value--;
      } else {
        clearInterval(currentTurnTimerInterval.value);
      }
    }, 1000);
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
    currentTurnTimeRemaining,
    totalGameTime,
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
    highlightedHandTileIds,
    tilesPlacedThisTurn,
    rematchVotes,
    rematchVoteStats,
    hasVotedRematch,
    isInGame,
    currentPlayer,
    myPlayer,
    hasPlayedInitialMeld,
    initGame,
    updateGameState,
    startTurn,
    handleTurnTimeout,
    endGame,
    clearGame,
    setGameId,
    setDisconnectTimeout,
    clearDisconnectTimeout,
    addChatMessage,
    moveTileToTable,
    moveTileToRack,
    canTakeTileBack,
    updateLocalTableSets,
    updateLocalMyTiles,
    revertChanges,
    sortTilesByColor,
    sortTilesByNumber,
    updateCurrentTurnTimer,
    endTurn,
    drawTile,
    handleDisconnectedPlayer,
    voteRematch,
    declineRematch,
    updateRematchVotes,
    resetRematchState,
    sendMessage
  };
});
