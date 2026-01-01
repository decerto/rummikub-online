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

export function isUsernameTaken(username) {
  return usernameToSocketId.has(username.toLowerCase());
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
