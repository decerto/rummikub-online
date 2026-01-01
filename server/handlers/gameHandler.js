// Game event handlers
import * as gameStore from '../stores/gameStore.js';
import * as lobbyStore from '../stores/lobbyStore.js';
import * as userStore from '../stores/userStore.js';
import * as chatStore from '../stores/chatStore.js';
import { validateTableState, validateInitialMeld, hasPlayerWon, calculateInitialMeldPoints } from '../../common/rules.js';
import { RECONNECT_GRACE_PERIOD, GAME_STATE } from '../../common/constants.js';
import { executeBotTurn } from '../bot/BotManager.js';

const disconnectTimers = new Map();

export function registerGameHandlers(io, socket) {
  // Start game from lobby
  socket.on('start-game', (callback) => {
    const user = userStore.getUser(socket.id);
    if (!user) {
      return callback({ success: false, error: 'Not authenticated' });
    }

    const lobby = lobbyStore.getLobby(user.lobbyId);
    if (!lobby) {
      return callback({ success: false, error: 'Not in a lobby' });
    }

    if (lobby.hostSocketId !== socket.id) {
      return callback({ success: false, error: 'Only host can start the game' });
    }

    if (lobby.players.length < lobby.rules.minPlayers) {
      return callback({ success: false, error: `Need at least ${lobby.rules.minPlayers} players` });
    }

    // Create the game
    const game = gameStore.createGame(lobby);
    lobbyStore.setLobbyGameInProgress(lobby.id, game.id);

    // Move all players to game room
    for (const player of lobby.players) {
      if (!player.isBot) {
        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          playerSocket.join(`game:${game.id}`);
          userStore.updateUser(player.socketId, { gameId: game.id });
        }
      }
    }

    // Move spectators to game room
    for (const spectator of lobby.spectators) {
      const spectatorSocket = io.sockets.sockets.get(spectator.socketId);
      if (spectatorSocket) {
        spectatorSocket.join(`game:${game.id}`);
      }
    }

    // Initialize turn
    game.turnStartState = gameStore.saveTurnStartState(game);
    game.turnStartTime = Date.now();

    console.log(`Game started: ${game.id} from lobby ${lobby.id}`);

    // Notify all players
    for (const player of game.players) {
      if (!player.isBot) {
        io.to(player.socketId).emit('game-started', {
          gameId: game.id,
          players: game.players.map(p => ({
            username: p.username,
            socketId: p.socketId,
            isBot: p.isBot,
            tileCount: p.tiles.length
          })),
          yourTiles: player.tiles,
          currentPlayerIndex: game.currentPlayerIndex,
          rules: game.rules,
          tableSets: game.tableSets,
          poolCount: game.tilePool.length
        });
      }
    }

    // Notify spectators
    for (const spectator of game.spectators) {
      io.to(spectator.socketId).emit('game-started', {
        gameId: game.id,
        players: game.players.map(p => ({
          username: p.username,
          socketId: p.socketId,
          isBot: p.isBot,
          tileCount: p.tiles.length
        })),
        yourTiles: [], // Spectators don't see tiles
        currentPlayerIndex: game.currentPlayerIndex,
        rules: game.rules,
        tableSets: game.tableSets,
        poolCount: game.tilePool.length,
        isSpectator: true
      });
    }

    callback({ success: true, gameId: game.id });

    // Start first turn (check if bot or human)
    const firstPlayer = gameStore.getCurrentPlayer(game);
    if (firstPlayer.isBot) {
      executeBotTurnWithDelay(io, game);
    } else {
      startTurnTimer(io, game);
    }

    // Broadcast lobby update
    io.emit('public-lobbies-updated', lobbyStore.getPublicLobbies().map(l => ({
      id: l.id,
      hostUsername: l.hostUsername,
      playerCount: l.players.length,
      maxPlayers: l.rules.maxPlayers,
      gameInProgress: l.gameInProgress
    })));
  });

  // End turn
  socket.on('end-turn', (data, callback) => {
    const user = userStore.getUser(socket.id);
    if (!user?.gameId) {
      return callback({ success: false, error: 'Not in a game' });
    }

    const game = gameStore.getGame(user.gameId);
    if (!game) {
      return callback({ success: false, error: 'Game not found' });
    }

    const currentPlayer = gameStore.getCurrentPlayer(game);
    if (currentPlayer.socketId !== socket.id) {
      return callback({ success: false, error: 'Not your turn' });
    }

    const result = processEndTurn(io, game, data.tableSets, data.playerTiles);
    callback(result);
  });

  // Draw tile
  socket.on('draw-tile', (callback) => {
    const user = userStore.getUser(socket.id);
    if (!user?.gameId) {
      return callback({ success: false, error: 'Not in a game' });
    }

    const game = gameStore.getGame(user.gameId);
    if (!game) {
      return callback({ success: false, error: 'Game not found' });
    }

    const currentPlayer = gameStore.getCurrentPlayer(game);
    if (currentPlayer.socketId !== socket.id) {
      return callback({ success: false, error: 'Not your turn' });
    }

    if (game.tilePool.length === 0) {
      // No tiles left - just pass the turn
      callback({ success: true, passed: true });
      advanceToNextTurn(io, game);
      return;
    }

    // Check if player has made any changes (placed tiles on table)
    // If they have, they cannot draw - they must either complete their play or revert
    const turnStartState = game.turnStartState;
    const currentPlayerTiles = currentPlayer.tiles;
    
    // Check if player tile count differs from start (means they placed tiles)
    if (turnStartState && currentPlayerTiles.length < turnStartState.playerTiles.length) {
      return callback({ 
        success: false, 
        error: 'Cannot draw after placing tiles. Complete your play or revert changes.' 
      });
    }
    
    const result = gameStore.drawTile(game.id, socket.id);
    if (!result) {
      return callback({ success: false, error: 'Could not draw tile' });
    }

    // Log the draw action
    const actionMsg = chatStore.addActionMessage(`game:${game.id}`, currentPlayer.username, 'drew');
    console.log('[Game] Broadcasting draw action to room:', `game:${game.id}`, actionMsg);
    io.to(`game:${game.id}`).emit('chat-broadcast', actionMsg);

    callback({ success: true, tile: result.tile });

    // End turn after drawing
    advanceToNextTurn(io, game);
  });

  // Leave game (after game ends)
  socket.on('leave-game', (callback) => {
    const user = userStore.getUser(socket.id);
    if (!user?.gameId) {
      return callback?.({ success: true }); // Already not in a game
    }

    const game = gameStore.getGame(user.gameId);
    if (game) {
      socket.leave(`game:${game.id}`);
    }

    // Also leave the lobby if user is in one
    if (user.lobbyId) {
      const lobby = lobbyStore.getLobby(user.lobbyId);
      if (lobby) {
        socket.leave(`lobby:${lobby.id}`);
        lobbyStore.removePlayerFromLobby(lobby.id, socket.id);
      }
    }

    userStore.updateUser(socket.id, { gameId: null, lobbyId: null, isSpectator: false });
    callback?.({ success: true });
  });

  // Join as spectator
  socket.on('join-spectator', (gameId, callback) => {
    const user = userStore.getUser(socket.id);
    if (!user) {
      return callback({ success: false, error: 'Not authenticated' });
    }

    const game = gameStore.getGame(gameId);
    if (!game) {
      return callback({ success: false, error: 'Game not found' });
    }

    gameStore.addSpectatorToGame(gameId, socket.id, user.username);
    socket.join(`game:${gameId}`);
    userStore.updateUser(socket.id, { gameId, isSpectator: true });

    chatStore.addSystemMessage(`game:${gameId}`, `${user.username} is now spectating`);

    callback({
      success: true,
      game: {
        gameId: game.id,
        players: game.players.map(p => ({
          username: p.username,
          isBot: p.isBot,
          tileCount: p.tiles.length
        })),
        currentPlayerIndex: game.currentPlayerIndex,
        tableSets: game.tableSets,
        poolCount: game.tilePool.length,
        isSpectator: true
      }
    });

    io.to(`game:${gameId}`).emit('spectator-joined', { username: user.username });
  });

  // Leave spectator
  socket.on('leave-spectator', (callback) => {
    const user = userStore.getUser(socket.id);
    if (!user?.gameId) {
      return callback?.({ success: false, error: 'Not spectating a game' });
    }

    const game = gameStore.getGame(user.gameId);
    if (game) {
      gameStore.removeSpectatorFromGame(game.id, socket.id);
      socket.leave(`game:${game.id}`);
      
      chatStore.addSystemMessage(`game:${game.id}`, `${user.username} stopped spectating`);
      io.to(`game:${game.id}`).emit('spectator-left', { username: user.username });
    }

    userStore.updateUser(socket.id, { gameId: null, isSpectator: false });
    callback?.({ success: true });
  });

  // Host decision on disconnected player
  socket.on('handle-disconnected-player', (data, callback) => {
    const { gameId, playerSocketId, action, botDifficulty } = data;

    const game = gameStore.getGame(gameId);
    if (!game) {
      return callback({ success: false, error: 'Game not found' });
    }

    // Verify sender is host (first connected player typically)
    const lobby = lobbyStore.getLobby(game.lobbyId);
    if (!lobby || lobby.hostSocketId !== socket.id) {
      return callback({ success: false, error: 'Only host can make this decision' });
    }

    if (action === 'kick') {
      // Remove player from game
      const playerIndex = game.players.findIndex(p => p.socketId === playerSocketId);
      if (playerIndex !== -1) {
        game.players.splice(playerIndex, 1);
        
        // Check if game should end
        if (game.players.length < 2) {
          endGame(io, game, game.players[0]?.socketId);
        } else {
          // Adjust current player index if needed
          if (game.currentPlayerIndex >= playerIndex) {
            game.currentPlayerIndex = game.currentPlayerIndex % game.players.length;
          }
          broadcastGameState(io, game);
        }
      }
      callback({ success: true });
    } else if (action === 'replace-with-bot') {
      gameStore.replacePlayerWithBot(gameId, playerSocketId, botDifficulty || 'medium');
      
      io.to(`game:${gameId}`).emit('bot-takeover', {
        playerSocketId,
        botDifficulty: botDifficulty || 'medium'
      });

      // Resume game if it was paused
      if (game.state === GAME_STATE.PAUSED) {
        gameStore.resumeGame(gameId);
        
        // If it's the bot's turn, execute it
        const currentPlayer = gameStore.getCurrentPlayer(game);
        if (currentPlayer.isBot) {
          executeBotTurnWithDelay(io, game);
        } else {
          startTurnTimer(io, game);
        }
      }

      callback({ success: true });
    }
  });

  // Rematch request
  socket.on('rematch', (callback) => {
    const user = userStore.getUser(socket.id);
    if (!user?.gameId) {
      return callback({ success: false, error: 'Not in a game' });
    }

    const game = gameStore.getGame(user.gameId);
    if (!game || game.state !== GAME_STATE.FINISHED) {
      return callback({ success: false, error: 'Game not finished' });
    }

    const lobby = lobbyStore.getLobby(game.lobbyId);
    if (!lobby) {
      return callback({ success: false, error: 'Lobby not found' });
    }

    if (lobby.hostSocketId !== socket.id) {
      return callback({ success: false, error: 'Only host can start rematch' });
    }

    // Delete old game
    gameStore.deleteGame(game.id);
    lobby.gameInProgress = false;
    lobby.gameId = null;

    // Update all players
    for (const player of game.players) {
      if (!player.isBot) {
        userStore.updateUser(player.socketId, { gameId: null });
        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          playerSocket.leave(`game:${game.id}`);
        }
      }
    }

    // Notify all to return to lobby
    io.to(`lobby:${lobby.id}`).emit('rematch-started', { lobbyId: lobby.id });
    
    callback({ success: true, lobbyId: lobby.id });
  });
}

function processEndTurn(io, game, newTableSets, newPlayerTiles) {
  const currentPlayer = gameStore.getCurrentPlayer(game);
  
  console.log('[Game] Processing end turn for', currentPlayer.username);
  console.log('[Game] Table sets received:', JSON.stringify(newTableSets?.map(s => s?.length)));
  console.log('[Game] Player tiles remaining:', newPlayerTiles?.length);
  
  // Check if player made any changes
  const turnStartState = game.turnStartState;
  const startTileCount = turnStartState?.playerTiles?.length || 0;
  const endTileCount = newPlayerTiles?.length || 0;
  const hasPlacedTiles = endTileCount < startTileCount;
  
  // Check if table was modified (for joker swaps where tile count stays same)
  const startTableTileIds = new Set(
    (turnStartState?.tableSets || []).flat().map(t => t.id)
  );
  const endTableTileIds = new Set(
    (newTableSets || []).flat().map(t => t.id)
  );
  const tableWasModified = 
    startTableTileIds.size !== endTableTileIds.size ||
    [...startTableTileIds].some(id => !endTableTileIds.has(id)) ||
    [...endTableTileIds].some(id => !startTableTileIds.has(id));
  
  const hasMadeChanges = hasPlacedTiles || tableWasModified;
  
  // Prevent jokers from being taken from table to hand
  // Jokers on the table must stay on the table (can only be rearranged between sets)
  const startTableJokers = (turnStartState?.tableSets || []).flat().filter(t => t.isJoker);
  const endPlayerJokers = (newPlayerTiles || []).filter(t => t.isJoker);
  const startPlayerJokerIds = new Set((turnStartState?.playerTiles || []).filter(t => t.isJoker).map(t => t.id));
  
  for (const joker of endPlayerJokers) {
    // Check if this joker was on the table at turn start (not in player's hand)
    if (!startPlayerJokerIds.has(joker.id)) {
      const wasOnTable = startTableJokers.some(t => t.id === joker.id);
      if (wasOnTable) {
        console.log('[Game] Invalid: Player tried to take joker from table to hand');
        gameStore.revertToTurnStart(game.id);
        return {
          success: false,
          error: 'Jokers on the table cannot be taken back to your hand. You can only move them between sets on the table.',
          reverted: true
        };
      }
    }
  }
  
  // Prevent skipping turn when pool has tiles (must either play or draw)
  if (!hasMadeChanges && game.tilePool.length > 0) {
    return {
      success: false,
      error: 'You must play tiles or draw from the pool',
      reverted: false
    };
  }
  
  // Validate inputs
  if (!Array.isArray(newTableSets)) {
    console.log('[Game] Invalid: tableSets is not an array');
    return {
      success: false,
      error: 'Invalid table state: expected array of sets',
      reverted: true
    };
  }
  
  // Ensure each set is actually an array
  for (let i = 0; i < newTableSets.length; i++) {
    if (!Array.isArray(newTableSets[i])) {
      console.log('[Game] Invalid: set', i, 'is not an array, got:', typeof newTableSets[i]);
      gameStore.revertToTurnStart(game.id);
      return {
        success: false,
        error: 'Invalid table state: each set must be an array',
        reverted: true
      };
    }
  }
  
  // Validate no duplicate tile IDs exist (prevents cheating/bugs)
  const allTileIds = new Set();
  const duplicateIds = [];
  
  // Check player tiles
  for (const tile of newPlayerTiles) {
    if (allTileIds.has(tile.id)) {
      duplicateIds.push(tile.id);
    }
    allTileIds.add(tile.id);
  }
  
  // Check table tiles
  for (const set of newTableSets) {
    for (const tile of set) {
      if (allTileIds.has(tile.id)) {
        duplicateIds.push(tile.id);
      }
      allTileIds.add(tile.id);
    }
  }
  
  if (duplicateIds.length > 0) {
    console.log('[Game] Duplicate tile IDs detected:', duplicateIds);
    gameStore.revertToTurnStart(game.id);
    return {
      success: false,
      error: 'Invalid state: duplicate tiles detected',
      reverted: true
    };
  }
  
  // Validate table state
  const tableValidation = validateTableState(newTableSets);
  console.log('[Game] Table validation result:', tableValidation);
  if (!tableValidation.valid) {
    // Log details of invalid sets for debugging
    for (const invalidSet of tableValidation.invalidSets) {
      console.log(`[Game] Invalid set at index ${invalidSet.index}:`, 
        invalidSet.tiles.map(t => t.isJoker ? 'JOKER' : `${t.color}${t.number}`).join(', '));
    }
    // Revert to turn start
    gameStore.revertToTurnStart(game.id);
    return { 
      success: false, 
      error: 'Invalid table state: ' + (tableValidation.invalidSets.length > 0 
        ? `${tableValidation.invalidSets.length} invalid sets (need 3+ tiles in valid runs or groups)`
        : 'unknown error'), 
      invalidSets: tableValidation.invalidSets,
      reverted: true
    };
  }

  // Check initial meld requirement
  if (!currentPlayer.hasPlayedInitialMeld) {
    // Find new sets added by this player
    const originalTableTileIds = new Set(
      game.turnStartState.tableSets.flat().map(t => t.id)
    );
    
    const newSets = newTableSets.filter(set => 
      set.some(tile => !originalTableTileIds.has(tile.id))
    );

    if (newSets.length > 0) {
      const meldValidation = validateInitialMeld(newSets, game.rules);
      if (!meldValidation.valid) {
        gameStore.revertToTurnStart(game.id);
        return {
          success: false,
          error: `Initial meld must be at least ${game.rules.initialMeldPoints} points (you have ${meldValidation.points}). Draw a tile to continue.`,
          reverted: true
        };
      }
      gameStore.setPlayerInitialMeld(game.id, currentPlayer.socketId);
    }
  }

  // Update game state
  gameStore.updateTableSets(game.id, newTableSets);
  gameStore.updatePlayerTiles(game.id, currentPlayer.socketId, newPlayerTiles);

  // Log the action to game chat
  const tilesPlayed = startTileCount - endTileCount;
  const originalSetCount = turnStartState?.tableSets?.length || 0;
  const newSetCount = newTableSets.length;
  const setsCreated = Math.max(0, newSetCount - originalSetCount);
  
  // Find which tiles were played (tiles that were in hand but now on table)
  const startPlayerTileIds = new Set((turnStartState?.playerTiles || []).map(t => t.id));
  const endPlayerTileIds = new Set((newPlayerTiles || []).map(t => t.id));
  const playedTileIds = [...startPlayerTileIds].filter(id => !endPlayerTileIds.has(id));
  
  // Get details of played tiles from the new table sets
  const playedTiles = [];
  for (const set of newTableSets) {
    for (const tile of set) {
      if (playedTileIds.includes(tile.id)) {
        playedTiles.push({
          color: tile.color,
          number: tile.number,
          isJoker: tile.isJoker
        });
      }
    }
  }
  
  // Check if this was initial meld
  const wasInitialMeld = !currentPlayer.hasPlayedInitialMeld && tilesPlayed > 0;
  let meldPoints = 0;
  if (wasInitialMeld) {
    const originalTableTileIds = new Set(
      turnStartState.tableSets.flat().map(t => t.id)
    );
    const newSets = newTableSets.filter(set => 
      set.some(tile => !originalTableTileIds.has(tile.id))
    );
    meldPoints = calculateInitialMeldPoints(newSets);
  }
  
  // Check if tiles were moved but not from hand (table rearrangement)
  const tableModified = hasMadeChanges && tilesPlayed === 0;
  
  if (tilesPlayed > 0 || tableModified) {
    const actionMsg = chatStore.addActionMessage(`game:${game.id}`, currentPlayer.username, 'played', {
      tilesPlayed,
      setsCreated,
      isInitialMeld: wasInitialMeld,
      points: meldPoints,
      tiles: playedTiles
    });
    io.to(`game:${game.id}`).emit('chat-broadcast', actionMsg);
  }

  // Check for win
  if (hasPlayerWon(newPlayerTiles)) {
    endGame(io, game, currentPlayer.socketId);
    return { success: true, gameEnded: true };
  }

  // Advance to next turn
  advanceToNextTurn(io, game);
  
  return { success: true };
}

function advanceToNextTurn(io, game) {
  // Clear existing timer
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }

  // Check for stalemate (pool empty and full round with no plays)
  if (game.tilePool.length === 0) {
    const playerTileSum = game.players.reduce((sum, p) => sum + p.tiles.length, 0);
    
    if (!game.lastRoundTileSum) {
      game.lastRoundTileSum = playerTileSum;
      game.stalemateTurnCount = 0;
    } else if (playerTileSum === game.lastRoundTileSum) {
      game.stalemateTurnCount++;
      // If a full round passed with no plays (4 players = 4 turns)
      if (game.stalemateTurnCount >= game.players.length) {
        console.log('[Game] Stalemate detected - ending game');
        // End game with lowest tile count as winner
        const winner = game.players.reduce((min, p) => 
          p.tiles.length < min.tiles.length ? p : min
        );
        endGame(io, game, winner.socketId);
        return;
      }
    } else {
      // Someone played, reset stalemate counter
      game.lastRoundTileSum = playerTileSum;
      game.stalemateTurnCount = 0;
    }
  }

  gameStore.advanceTurn(game.id);
  broadcastGameState(io, game);

  const currentPlayer = gameStore.getCurrentPlayer(game);
  console.log(`[Turn] Advanced to ${currentPlayer.username}, isBot: ${currentPlayer.isBot}`);
  
  if (currentPlayer.isBot) {
    executeBotTurnWithDelay(io, game);
  } else {
    startTurnTimer(io, game);
  }
}

function startTurnTimer(io, game) {
  const timerMs = game.rules.turnTimerSeconds * 1000;
  
  game.turnTimer = setTimeout(() => {
    handleTurnTimeout(io, game);
  }, timerMs);

  // Notify current player
  const currentPlayer = gameStore.getCurrentPlayer(game);
  if (!currentPlayer.isBot) {
    io.to(currentPlayer.socketId).emit('turn-start', {
      timeLimit: game.rules.turnTimerSeconds
    });
  }
}

function handleTurnTimeout(io, game) {
  // Revert any changes and draw a tile
  gameStore.revertToTurnStart(game.id);
  
  const currentPlayer = gameStore.getCurrentPlayer(game);
  console.log(`[Timeout] ${currentPlayer.username} timed out`);
  
  if (game.tilePool.length > 0) {
    gameStore.drawTile(game.id, currentPlayer.socketId);
    
    // Log the timeout action
    const actionMsg = chatStore.addActionMessage(`game:${game.id}`, currentPlayer.username, 'timeout');
    io.to(`game:${game.id}`).emit('chat-broadcast', actionMsg);
  } else {
    // Log that they passed due to empty pool
    const actionMsg = chatStore.addActionMessage(`game:${game.id}`, currentPlayer.username, 'passed');
    io.to(`game:${game.id}`).emit('chat-broadcast', actionMsg);
  }

  io.to(`game:${game.id}`).emit('turn-timeout', {
    player: currentPlayer.username
  });

  advanceToNextTurn(io, game);
}

function executeBotTurnWithDelay(io, game) {
  const currentPlayer = gameStore.getCurrentPlayer(game);
  console.log(`[Bot] Executing bot turn for ${currentPlayer.username} in 1.5-3s`);
  
  // Add realistic delay for bot
  setTimeout(() => {
    console.log(`[Bot] Now playing: ${currentPlayer.username}`);
    executeBotTurn(io, game, (result) => {
      console.log(`[Bot] ${currentPlayer.username} finished:`, result);
      if (result.gameEnded) {
        endGame(io, game, result.winnerSocketId);
      } else {
        advanceToNextTurn(io, game);
      }
    });
  }, 1500 + Math.random() * 1500); // 1.5-3s delay
}

function endGame(io, game, winnerSocketId) {
  gameStore.setGameWinner(game.id, winnerSocketId);
  
  const scores = gameStore.calculateFinalScores(game.id);
  
  // Log the winner
  const actionMsg = chatStore.addActionMessage(`game:${game.id}`, game.winner.username, 'won');
  io.to(`game:${game.id}`).emit('chat-broadcast', actionMsg);
  
  io.to(`game:${game.id}`).emit('game-ended', {
    winner: game.winner,
    scores,
    stats: {
      duration: game.endedAt - game.startedAt,
      turnsPlayed: game.turnHistory?.length || 0
    }
  });

  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
  }
}

function broadcastGameState(io, game) {
  // Send personalized state to each player
  for (const player of game.players) {
    if (!player.isBot) {
      io.to(player.socketId).emit('game-state-update', {
        players: game.players.map(p => ({
          username: p.username,
          socketId: p.socketId,
          isBot: p.isBot,
          tileCount: p.tiles.length,
          hasPlayedInitialMeld: p.hasPlayedInitialMeld,
          isDisconnected: p.isDisconnected
        })),
        yourTiles: player.tiles,
        currentPlayerIndex: game.currentPlayerIndex,
        tableSets: game.tableSets,
        poolCount: game.tilePool.length
      });
    }
  }

  // Send to spectators (without tile details)
  for (const spectator of game.spectators) {
    io.to(spectator.socketId).emit('game-state-update', {
      players: game.players.map(p => ({
        username: p.username,
        isBot: p.isBot,
        tileCount: p.tiles.length,
        hasPlayedInitialMeld: p.hasPlayedInitialMeld,
        isDisconnected: p.isDisconnected
      })),
      yourTiles: [],
      currentPlayerIndex: game.currentPlayerIndex,
      tableSets: game.tableSets,
      poolCount: game.tilePool.length,
      isSpectator: true
    });
  }
}

export function handlePlayerDisconnect(io, socket) {
  const user = userStore.getUser(socket.id);
  if (!user?.gameId) return;

  const game = gameStore.getGame(user.gameId);
  if (!game || game.state === GAME_STATE.FINISHED) return;

  gameStore.setPlayerDisconnected(game.id, socket.id);

  // Notify all players
  io.to(`game:${game.id}`).emit('player-disconnected', {
    username: user.username,
    gracePeriod: RECONNECT_GRACE_PERIOD
  });

  // Pause if it's this player's turn
  const currentPlayer = gameStore.getCurrentPlayer(game);
  if (currentPlayer.socketId === socket.id) {
    gameStore.pauseGame(game.id);
  }

  // Start grace period timer
  disconnectTimers.set(socket.id, setTimeout(() => {
    // Grace period expired
    const lobby = lobbyStore.getLobby(game.lobbyId);
    if (lobby) {
      io.to(lobby.hostSocketId).emit('disconnect-timeout', {
        playerSocketId: socket.id,
        username: user.username
      });
    }
    disconnectTimers.delete(socket.id);
  }, RECONNECT_GRACE_PERIOD * 1000));
}

export function handlePlayerReconnect(io, socket, oldSocketId) {
  // Clear disconnect timer
  if (disconnectTimers.has(oldSocketId)) {
    clearTimeout(disconnectTimers.get(oldSocketId));
    disconnectTimers.delete(oldSocketId);
  }

  const user = userStore.getUser(socket.id);
  if (!user?.gameId) return;

  const game = gameStore.getGame(user.gameId);
  if (!game) return;

  // Update player socket in game
  const player = game.players.find(p => p.socketId === oldSocketId);
  if (player) {
    player.socketId = socket.id;
    player.isDisconnected = false;
    player.disconnectedAt = null;
  }

  socket.join(`game:${game.id}`);

  // Notify reconnection
  io.to(`game:${game.id}`).emit('player-reconnected', {
    username: user.username
  });

  // Resume game if it was paused for this player
  if (game.state === GAME_STATE.PAUSED) {
    gameStore.resumeGame(game.id);
    startTurnTimer(io, game);
  }

  // Send current state to reconnected player
  io.to(socket.id).emit('game-state-update', {
    players: game.players.map(p => ({
      username: p.username,
      socketId: p.socketId,
      isBot: p.isBot,
      tileCount: p.tiles.length,
      hasPlayedInitialMeld: p.hasPlayedInitialMeld,
      isDisconnected: p.isDisconnected
    })),
    yourTiles: player.tiles,
    currentPlayerIndex: game.currentPlayerIndex,
    tableSets: game.tableSets,
    poolCount: game.tilePool.length,
    reconnected: true
  });
}
