// Rummikub tile colors
export const TILE_COLORS = {
  BLACK: 'black',
  RED: 'red',
  BLUE: 'blue',
  ORANGE: 'orange'
};

// Tile color display values (for CSS)
export const TILE_COLOR_VALUES = {
  black: '#1a1a1a',
  red: '#d32f2f',
  blue: '#1976d2',
  orange: '#f57c00'
};

// Tile numbers (1-13)
export const TILE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// Number of each tile (2 sets of each color/number combo)
export const TILES_PER_SET = 2;

// Joker configuration
export const JOKER_COUNT_DEFAULT = 2;

// Game configuration
export const INITIAL_TILES_PER_PLAYER = 14;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

// Timer defaults (in seconds)
export const DEFAULT_TURN_TIMER = 60;
export const RECONNECT_GRACE_PERIOD = 30;

// Chat limits
export const MAX_MESSAGE_LENGTH = 200;
export const CHAT_HISTORY_LENGTH = 50;

// Bot difficulty levels
export const BOT_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

// Lobby visibility
export const LOBBY_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private'
};

// Game states
export const GAME_STATE = {
  WAITING: 'waiting',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  FINISHED: 'finished'
};

// Player states
export const PLAYER_STATE = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  BOT: 'bot'
};

// Generate all tiles for the game
export function generateTileset(jokerCount = JOKER_COUNT_DEFAULT) {
  const tiles = [];
  let id = 0;

  // Generate 2 sets of each color/number combination
  for (let set = 0; set < TILES_PER_SET; set++) {
    for (const color of Object.values(TILE_COLORS)) {
      for (const number of TILE_NUMBERS) {
        tiles.push({
          id: id++,
          color,
          number,
          isJoker: false
        });
      }
    }
  }

  // Add jokers
  for (let i = 0; i < jokerCount; i++) {
    tiles.push({
      id: id++,
      color: null,
      number: null,
      isJoker: true
    });
  }

  return tiles;
}

// Shuffle array (Fisher-Yates)
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
