// In-memory game store
import { v4 as uuidv4 } from 'uuid';
import { generateTileset, shuffleArray, GAME_STATE } from '../../common/constants.js';

const games = new Map();

export function createGame(lobby) {
  const gameId = uuidv4().substring(0, 8);
  
  // Generate and shuffle tiles
  const allTiles = shuffleArray(generateTileset(lobby.rules.jokerCount));
  
  // Deal tiles to players
  const players = lobby.players.map((player, index) => {
    const startIdx = index * lobby.rules.tilesPerPlayer;
    const playerTiles = allTiles.slice(startIdx, startIdx + lobby.rules.tilesPerPlayer);
    
    return {
      socketId: player.socketId,
      username: player.username,
      isBot: player.isBot,
      botDifficulty: player.botDifficulty,
      tiles: playerTiles,
      hasPlayedInitialMeld: false,
      isDisconnected: false,
      disconnectedAt: null,
      penaltyPoints: 0
    };
  });

  // Remaining tiles form the pool
  const poolStartIdx = lobby.players.length * lobby.rules.tilesPerPlayer;
  const tilePool = allTiles.slice(poolStartIdx);

  const game = {
    id: gameId,
    lobbyId: lobby.id,
    players,
    spectators: [...lobby.spectators],
    tilePool,
    tableSets: [], // Array of arrays (each inner array is a set on the table)
    currentPlayerIndex: 0,
    turnStartTime: null,
    turnTimer: null,
    rules: { ...lobby.rules },
    state: GAME_STATE.IN_PROGRESS,
    winner: null,
    startedAt: Date.now(),
    endedAt: null,
    turnHistory: [],
    // Store the state at the start of each turn for reverting invalid moves
    turnStartState: null
  };

  games.set(gameId, game);
  return game;
}

export function getGame(gameId) {
  return games.get(gameId);
}

export function deleteGame(gameId) {
  const game = games.get(gameId);
  if (game && game.turnTimer) {
    clearTimeout(game.turnTimer);
  }
  return games.delete(gameId);
}

export function getAllGames() {
  return Array.from(games.values());
}

export function getGameByPlayer(socketId) {
  for (const game of games.values()) {
    if (game.players.some(p => p.socketId === socketId)) {
      return game;
    }
  }
  return null;
}

export function getGameByLobby(lobbyId) {
  for (const game of games.values()) {
    if (game.lobbyId === lobbyId) {
      return game;
    }
  }
  return null;
}

export function getCurrentPlayer(game) {
  return game.players[game.currentPlayerIndex];
}

export function advanceTurn(gameId) {
  const game = games.get(gameId);
  if (!game) return null;

  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  game.turnStartTime = Date.now();
  game.turnStartState = saveTurnStartState(game);
  
  return game;
}

export function saveTurnStartState(game) {
  const currentPlayer = getCurrentPlayer(game);
  return {
    playerTiles: [...currentPlayer.tiles],
    tableSets: game.tableSets.map(set => [...set]),
    tilePool: [...game.tilePool]
  };
}

export function revertToTurnStart(gameId) {
  const game = games.get(gameId);
  if (!game || !game.turnStartState) return null;

  const currentPlayer = getCurrentPlayer(game);
  currentPlayer.tiles = [...game.turnStartState.playerTiles];
  game.tableSets = game.turnStartState.tableSets.map(set => [...set]);
  game.tilePool = [...game.turnStartState.tilePool];

  return game;
}

export function drawTile(gameId, playerSocketId) {
  const game = games.get(gameId);
  if (!game) return null;

  const player = game.players.find(p => p.socketId === playerSocketId);
  if (!player) return null;

  if (game.tilePool.length === 0) return null;

  const tile = game.tilePool.pop();
  player.tiles.push(tile);

  return { game, tile };
}

export function updatePlayerTiles(gameId, playerSocketId, tiles) {
  const game = games.get(gameId);
  if (!game) return null;

  const player = game.players.find(p => p.socketId === playerSocketId);
  if (!player) return null;

  player.tiles = tiles;
  return game;
}

export function updateTableSets(gameId, tableSets) {
  const game = games.get(gameId);
  if (!game) return null;

  game.tableSets = tableSets;
  return game;
}

export function setPlayerInitialMeld(gameId, playerSocketId) {
  const game = games.get(gameId);
  if (!game) return null;

  const player = game.players.find(p => p.socketId === playerSocketId);
  if (player) {
    player.hasPlayedInitialMeld = true;
  }
  return game;
}

export function setGameWinner(gameId, winnerSocketId) {
  const game = games.get(gameId);
  if (!game) return null;

  const winner = game.players.find(p => p.socketId === winnerSocketId);
  if (winner) {
    game.winner = {
      socketId: winner.socketId,
      username: winner.username
    };
    game.state = GAME_STATE.FINISHED;
    game.endedAt = Date.now();
  }
  return game;
}

export function setPlayerDisconnected(gameId, playerSocketId) {
  const game = games.get(gameId);
  if (!game) return null;

  const player = game.players.find(p => p.socketId === playerSocketId);
  if (player) {
    player.isDisconnected = true;
    player.disconnectedAt = Date.now();
  }
  return game;
}

export function setPlayerReconnected(gameId, playerSocketId) {
  const game = games.get(gameId);
  if (!game) return null;

  const player = game.players.find(p => p.socketId === playerSocketId);
  if (player) {
    player.isDisconnected = false;
    player.disconnectedAt = null;
  }
  return game;
}

export function replacePlayerWithBot(gameId, playerSocketId, botDifficulty) {
  const game = games.get(gameId);
  if (!game) return null;

  const player = game.players.find(p => p.socketId === playerSocketId);
  if (player) {
    player.isBot = true;
    player.botDifficulty = botDifficulty;
    player.isDisconnected = false;
    player.disconnectedAt = null;
    player.username = `${player.username} (Bot)`;
  }
  return game;
}

export function pauseGame(gameId) {
  const game = games.get(gameId);
  if (!game) return null;

  game.state = GAME_STATE.PAUSED;
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
  return game;
}

export function resumeGame(gameId) {
  const game = games.get(gameId);
  if (!game) return null;

  game.state = GAME_STATE.IN_PROGRESS;
  return game;
}

export function addSpectatorToGame(gameId, socketId, username) {
  const game = games.get(gameId);
  if (!game) return null;

  if (!game.spectators.some(s => s.socketId === socketId)) {
    game.spectators.push({ socketId, username });
  }
  return game;
}

export function removeSpectatorFromGame(gameId, socketId) {
  const game = games.get(gameId);
  if (!game) return null;

  const index = game.spectators.findIndex(s => s.socketId === socketId);
  if (index !== -1) {
    game.spectators.splice(index, 1);
  }
  return game;
}

export function calculateFinalScores(gameId) {
  const game = games.get(gameId);
  if (!game) return null;

  const scores = game.players.map(player => {
    const penaltyPoints = player.tiles.reduce((sum, tile) => {
      if (tile.isJoker) return sum + 30;
      return sum + tile.number;
    }, 0);

    return {
      socketId: player.socketId,
      username: player.username,
      tilesRemaining: player.tiles.length,
      penaltyPoints,
      isWinner: game.winner?.socketId === player.socketId
    };
  });

  // Sort by penalty points (winner first with 0)
  scores.sort((a, b) => a.penaltyPoints - b.penaltyPoints);

  return scores;
}
