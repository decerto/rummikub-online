// Chat history store
import { CHAT_HISTORY_LENGTH, MAX_MESSAGE_LENGTH } from '../../common/constants.js';

// Map of roomId -> array of messages
const chatHistory = new Map();

export function addMessage(roomId, username, message, type = 'chat') {
  if (!chatHistory.has(roomId)) {
    chatHistory.set(roomId, []);
  }

  const history = chatHistory.get(roomId);
  
  // Truncate message if too long
  const truncatedMessage = message.substring(0, MAX_MESSAGE_LENGTH);

  const chatMessage = {
    id: Date.now().toString(),
    username,
    message: truncatedMessage,
    type, // 'chat', 'system', 'join', 'leave'
    timestamp: Date.now()
  };

  history.push(chatMessage);

  // Keep only recent messages
  if (history.length > CHAT_HISTORY_LENGTH) {
    history.shift();
  }

  return chatMessage;
}

export function getHistory(roomId) {
  return chatHistory.get(roomId) || [];
}

export function clearHistory(roomId) {
  chatHistory.delete(roomId);
}

export function addSystemMessage(roomId, message) {
  return addMessage(roomId, 'System', message, 'system');
}

export function addJoinMessage(roomId, username) {
  return addMessage(roomId, username, `${username} joined`, 'join');
}

export function addLeaveMessage(roomId, username) {
  return addMessage(roomId, username, `${username} left`, 'leave');
}

// Format tile for display with color emoji
function formatTile(tile) {
  if (tile.isJoker) return '🃏';
  const colorEmoji = {
    black: '⬛',
    red: '🟥',
    blue: '🟦',
    orange: '🟧'
  };
  return `${colorEmoji[tile.color] || '⬜'}${tile.number}`;
}

// Format list of tiles for display
function formatTileList(tiles) {
  if (!tiles || tiles.length === 0) return '';
  if (tiles.length <= 4) {
    return tiles.map(formatTile).join(' ');
  }
  // Group tiles by color for larger plays
  const byColor = {};
  tiles.forEach(t => {
    const key = t.isJoker ? 'joker' : t.color;
    if (!byColor[key]) byColor[key] = [];
    byColor[key].push(t);
  });
  
  const parts = [];
  for (const [color, colorTiles] of Object.entries(byColor)) {
    if (color === 'joker') {
      parts.push(`${colorTiles.length}x🃏`);
    } else {
      const colorEmoji = { black: '⬛', red: '🟥', blue: '🟦', orange: '🟧' }[color] || '⬜';
      const numbers = colorTiles.map(t => t.number).sort((a, b) => a - b).join(',');
      parts.push(`${colorEmoji}${numbers}`);
    }
  }
  return parts.join(' ');
}

export function addActionMessage(roomId, username, action, details = {}) {
  let message = '';
  
  switch (action) {
    case 'played':
      const tilesPlayed = details.tilesPlayed || 0;
      const setsCreated = details.setsCreated || 0;
      const tilesAdded = tilesPlayed - (details.tilesInNewSets || 0);
      const tileDesc = details.tiles ? formatTileList(details.tiles) : '';
      
      if (details.isInitialMeld) {
        message = `${username} played initial meld (${details.points}pts): ${tileDesc}`;
      } else if (setsCreated > 0 && tilesAdded > 0) {
        // Both new sets and additions to existing sets
        message = `${username} played ${tilesPlayed} tile${tilesPlayed !== 1 ? 's' : ''}: ${tileDesc} (${setsCreated} new set${setsCreated !== 1 ? 's' : ''}, added to existing)`;
      } else if (setsCreated > 0) {
        message = `${username} played ${tilesPlayed} tile${tilesPlayed !== 1 ? 's' : ''}: ${tileDesc} (${setsCreated} new set${setsCreated !== 1 ? 's' : ''})`;
      } else if (tileDesc) {
        message = `${username} played: ${tileDesc} (added to existing set${tilesPlayed !== 1 ? 's' : ''})`;
      } else {
        message = `${username} played ${tilesPlayed} tile${tilesPlayed !== 1 ? 's' : ''}`;
      }
      break;
    case 'drew':
      message = `${username} drew a tile`;
      break;
    case 'timeout':
      message = `${username} timed out, drew a tile`;
      break;
    case 'passed':
      message = `${username} passed (pool empty)`;
      break;
    case 'turn':
      message = `▶️ ${username}'s turn`;
      break;
    case 'won':
      message = `🎉 ${username} won the game!`;
      break;
    default:
      message = `${username} ${action}`;
  }
  
  return addMessage(roomId, username, message, 'action');
}

// Add action message with tile info (for personalized draw messages)
export function addActionMessageWithTile(roomId, username, action, tile) {
  let message = '';
  const tileStr = formatTile(tile);
  
  switch (action) {
    case 'drew':
      message = `You drew ${tileStr}`;
      break;
    case 'timeout':
      message = `You timed out, drew ${tileStr}`;
      break;
    default:
      message = `${username} ${action}`;
  }
  
  // Note: We don't add to history since the generic message is already added
  // This is just for the player's personal view
  return {
    id: Date.now().toString() + '-personal',
    username,
    message,
    type: 'action',
    timestamp: Date.now(),
    tile // Include tile data for potential visual rendering
  };
}
