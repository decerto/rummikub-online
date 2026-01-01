// Bot Manager - Orchestrates bot turns
import { EasyStrategy } from './strategies/EasyStrategy.js';
import { MediumStrategy } from './strategies/MediumStrategy.js';
import { HardStrategy } from './strategies/HardStrategy.js';
import * as gameStore from '../stores/gameStore.js';
import * as chatStore from '../stores/chatStore.js';
import { hasPlayerWon, calculateInitialMeldPoints } from '../../common/rules.js';

const strategies = {
  easy: new EasyStrategy(),
  medium: new MediumStrategy(),
  hard: new HardStrategy()
};

export function executeBotTurn(io, game, callback) {
  const currentPlayer = gameStore.getCurrentPlayer(game);
  
  if (!currentPlayer.isBot) {
    return callback({ success: false, error: 'Not a bot turn' });
  }

  const strategy = strategies[currentPlayer.botDifficulty] || strategies.medium;
  
  // Store original state to find what tiles were played
  const originalTableTileIds = new Set(game.tableSets.flat().map(t => t.id));
  const originalPlayerTileIds = new Set(currentPlayer.tiles.map(t => t.id));
  const originalSetCount = game.tableSets.length;
  
  // Execute bot strategy
  const result = strategy.play({
    playerTiles: [...currentPlayer.tiles],
    tableSets: game.tableSets.map(set => [...set]),
    tilePool: game.tilePool,
    hasPlayedInitialMeld: currentPlayer.hasPlayedInitialMeld,
    rules: game.rules
  });

  if (result.action === 'play') {
    // Bot made valid plays
    gameStore.updateTableSets(game.id, result.tableSets);
    gameStore.updatePlayerTiles(game.id, currentPlayer.socketId, result.playerTiles);
    
    const wasInitialMeld = !currentPlayer.hasPlayedInitialMeld && result.playedInitialMeld;
    
    if (!currentPlayer.hasPlayedInitialMeld && result.playedInitialMeld) {
      gameStore.setPlayerInitialMeld(game.id, currentPlayer.socketId);
    }

    // Find the tiles that were played from hand to table
    const playedTiles = [];
    for (const set of result.tableSets) {
      for (const tile of set) {
        if (originalPlayerTileIds.has(tile.id) && !originalTableTileIds.has(tile.id)) {
          playedTiles.push({
            color: tile.color,
            number: tile.number,
            isJoker: tile.isJoker
          });
        }
      }
    }

    // Calculate tiles played and log action
    const tilesPlayed = playedTiles.length;
    const newSetCount = result.tableSets.length;
    const setsCreated = Math.max(0, newSetCount - originalSetCount);
    
    // For initial meld, find only the new sets the bot created (not the whole table)
    let meldPoints = 0;
    if (wasInitialMeld) {
      const newSets = result.tableSets.filter(set => 
        set.some(tile => originalPlayerTileIds.has(tile.id))
      );
      meldPoints = calculateInitialMeldPoints(newSets);
    }
    
    const actionMsg = chatStore.addActionMessage(`game:${game.id}`, currentPlayer.username, 'played', {
      tilesPlayed,
      setsCreated,
      isInitialMeld: wasInitialMeld,
      points: meldPoints,
      tiles: playedTiles
    });
    io.to(`game:${game.id}`).emit('chat-broadcast', actionMsg);

    // Broadcast bot's move
    io.to(`game:${game.id}`).emit('bot-played', {
      botName: currentPlayer.username,
      tilesPlayed: result.tilesPlayed || 0
    });

    // Check for win
    if (hasPlayerWon(result.playerTiles)) {
      callback({ gameEnded: true, winnerSocketId: currentPlayer.socketId });
      return;
    }
  } else {
    // Bot draws a tile
    if (game.tilePool.length > 0) {
      gameStore.drawTile(game.id, currentPlayer.socketId);
      
      // Log the draw action
      const actionMsg = chatStore.addActionMessage(`game:${game.id}`, currentPlayer.username, 'drew');
      io.to(`game:${game.id}`).emit('chat-broadcast', actionMsg);
      
      io.to(`game:${game.id}`).emit('bot-drew', {
        botName: currentPlayer.username
      });
    } else {
      // Log that bot passed due to empty pool
      const actionMsg = chatStore.addActionMessage(`game:${game.id}`, currentPlayer.username, 'passed');
      io.to(`game:${game.id}`).emit('chat-broadcast', actionMsg);
    }
  }

  callback({ success: true });
}
