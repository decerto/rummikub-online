// In-memory user store
// Maps socket.id -> user data

const users = new Map();
const usernameToSocketId = new Map();

export function addUser(socketId, username) {
  const user = {
    socketId,
    username,
    lobbyId: null,
    gameId: null,
    isSpectator: false,
    connectedAt: Date.now(),
    disconnectedAt: null
  };
  users.set(socketId, user);
  usernameToSocketId.set(username.toLowerCase(), socketId);
  return user;
}

export function removeUser(socketId) {
  const user = users.get(socketId);
  if (user) {
    usernameToSocketId.delete(user.username.toLowerCase());
    users.delete(socketId);
  }
  return user;
}

export function getUser(socketId) {
  return users.get(socketId);
}

export function getUserByUsername(username) {
  const socketId = usernameToSocketId.get(username.toLowerCase());
  return socketId ? users.get(socketId) : null;
}

// Grace period for reconnection (30 seconds)
const RECONNECT_GRACE_PERIOD = 30000;

export function isUsernameTaken(username) {
  const socketId = usernameToSocketId.get(username.toLowerCase());
  if (!socketId) return false;
  
  const user = users.get(socketId);
  if (!user) return false;
  
  // If user is disconnected, username is available for reconnection
  if (user.disconnectedAt) {
    return false;
  }
  
  return true;
}

export function getDisconnectedUser(username) {
  const socketId = usernameToSocketId.get(username.toLowerCase());
  if (!socketId) return null;
  
  const user = users.get(socketId);
  if (user && user.disconnectedAt) {
    return user;
  }
  return null;
}

export function updateUser(socketId, updates) {
  const user = users.get(socketId);
  if (user) {
    Object.assign(user, updates);
    return user;
  }
  return null;
}

export function getAllUsers() {
  return Array.from(users.values());
}

export function getOnlineUsers() {
  return Array.from(users.values()).filter(u => !u.disconnectedAt);
}

export function setUserDisconnected(socketId) {
  const user = users.get(socketId);
  if (user) {
    user.disconnectedAt = Date.now();
    return user;
  }
  return null;
}

export function setUserReconnected(socketId) {
  const user = users.get(socketId);
  if (user) {
    user.disconnectedAt = null;
    return user;
  }
  return null;
}

// For reconnection: transfer user data to new socket
export function transferUser(oldSocketId, newSocketId) {
  const user = users.get(oldSocketId);
  if (user) {
    users.delete(oldSocketId);
    user.socketId = newSocketId;
    user.disconnectedAt = null;
    users.set(newSocketId, user);
    usernameToSocketId.set(user.username.toLowerCase(), newSocketId);
    return user;
  }
  return null;
}

// Cleanup users who have been disconnected for more than 5 minutes
const CLEANUP_INTERVAL = 60000; // Check every minute
const MAX_DISCONNECT_TIME = 5 * 60 * 1000; // 5 minutes

export function cleanupDisconnectedUsers() {
  const now = Date.now();
  const usersToRemove = [];
  
  for (const [socketId, user] of users) {
    if (user.disconnectedAt && (now - user.disconnectedAt) > MAX_DISCONNECT_TIME) {
      // Only cleanup users not in an active game
      if (!user.gameId) {
        usersToRemove.push(socketId);
      }
    }
  }
  
  for (const socketId of usersToRemove) {
    console.log(`Cleaning up disconnected user: ${users.get(socketId)?.username}`);
    removeUser(socketId);
  }
  
  return usersToRemove.length;
}

// Start cleanup interval
setInterval(cleanupDisconnectedUsers, CLEANUP_INTERVAL);
