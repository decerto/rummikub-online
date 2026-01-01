// In-memory lobby store
import { v4 as uuidv4 } from 'uuid';
import { getDefaultRules } from '../../common/rulePresets.js';

const lobbies = new Map();

export function createLobby(hostSocketId, hostUsername, isPublic = true) {
  const lobbyId = uuidv4().substring(0, 8);
  const lobby = {
    id: lobbyId,
    hostSocketId,
    hostUsername,
    isPublic,
    players: [{
      socketId: hostSocketId,
      username: hostUsername,
      isBot: false,
      botDifficulty: null,
      isReady: true
    }],
    spectators: [],
    rules: getDefaultRules(),
    gameId: null,
    createdAt: Date.now(),
    gameInProgress: false
  };
  lobbies.set(lobbyId, lobby);
  return lobby;
}

export function getLobby(lobbyId) {
  return lobbies.get(lobbyId);
}

export function deleteLobby(lobbyId) {
  return lobbies.delete(lobbyId);
}

export function getPublicLobbies() {
  return Array.from(lobbies.values()).filter(lobby => 
    lobby.isPublic && !lobby.gameInProgress
  );
}

export function getAllLobbies() {
  return Array.from(lobbies.values());
}

export function addPlayerToLobby(lobbyId, socketId, username, isBot = false, botDifficulty = null) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return null;

  // Check max players
  if (lobby.players.length >= lobby.rules.maxPlayers) {
    return null;
  }

  // Check if already in lobby
  if (lobby.players.some(p => p.socketId === socketId || p.username === username)) {
    return null;
  }

  const player = {
    socketId,
    username,
    isBot,
    botDifficulty,
    isReady: isBot // Bots are always ready
  };
  lobby.players.push(player);
  return lobby;
}

export function removePlayerFromLobby(lobbyId, socketId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return null;

  const playerIndex = lobby.players.findIndex(p => p.socketId === socketId);
  if (playerIndex === -1) return null;

  const removedPlayer = lobby.players.splice(playerIndex, 1)[0];

  // If host left, assign new host or delete lobby
  if (socketId === lobby.hostSocketId) {
    const humanPlayers = lobby.players.filter(p => !p.isBot);
    if (humanPlayers.length > 0) {
      lobby.hostSocketId = humanPlayers[0].socketId;
      lobby.hostUsername = humanPlayers[0].username;
    } else {
      // No human players left, delete lobby
      lobbies.delete(lobbyId);
      return { ...lobby, deleted: true, removedPlayer };
    }
  }

  return { ...lobby, removedPlayer };
}

export function addSpectatorToLobby(lobbyId, socketId, username) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return null;

  if (lobby.spectators.some(s => s.socketId === socketId)) {
    return null;
  }

  lobby.spectators.push({ socketId, username });
  return lobby;
}

export function removeSpectatorFromLobby(lobbyId, socketId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return null;

  const index = lobby.spectators.findIndex(s => s.socketId === socketId);
  if (index !== -1) {
    lobby.spectators.splice(index, 1);
  }
  return lobby;
}

export function updateLobbyRules(lobbyId, rules) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return null;

  lobby.rules = { ...lobby.rules, ...rules };
  return lobby;
}

export function setLobbyVisibility(lobbyId, isPublic) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return null;

  lobby.isPublic = isPublic;
  return lobby;
}

export function setLobbyGameInProgress(lobbyId, gameId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return null;

  lobby.gameInProgress = true;
  lobby.gameId = gameId;
  return lobby;
}

export function getLobbyByPlayer(socketId) {
  for (const lobby of lobbies.values()) {
    if (lobby.players.some(p => p.socketId === socketId)) {
      return lobby;
    }
    if (lobby.spectators.some(s => s.socketId === socketId)) {
      return lobby;
    }
  }
  return null;
}

export function addBotToLobby(lobbyId, botDifficulty) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return null;

  if (lobby.players.length >= lobby.rules.maxPlayers) {
    return null;
  }

  const botNumber = lobby.players.filter(p => p.isBot).length + 1;
  const botUsername = `Bot ${botNumber} (${botDifficulty})`;
  const botSocketId = `bot-${uuidv4().substring(0, 8)}`;

  const bot = {
    socketId: botSocketId,
    username: botUsername,
    isBot: true,
    botDifficulty,
    isReady: true
  };
  lobby.players.push(bot);
  return lobby;
}

export function removeBotFromLobby(lobbyId, botSocketId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return null;

  const botIndex = lobby.players.findIndex(p => p.socketId === botSocketId && p.isBot);
  if (botIndex === -1) return null;

  lobby.players.splice(botIndex, 1);
  return lobby;
}
