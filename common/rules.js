// Rummikub game rules and validation logic
import { TILE_COLORS } from './constants.js';

/**
 * Check if a set of tiles forms a valid group (same number, different colors)
 * @param {Array} tiles - Array of tile objects
 * @returns {boolean}
 */
export function isValidGroup(tiles) {
  if (!tiles || tiles.length < 3 || tiles.length > 4) {
    return false;
  }

  // Separate jokers from regular tiles
  const regularTiles = tiles.filter(t => !t.isJoker);
  const jokerCount = tiles.filter(t => t.isJoker).length;

  if (regularTiles.length === 0) {
    // All jokers - technically valid but unusual
    return tiles.length >= 3;
  }

  // All regular tiles must have the same number
  const number = regularTiles[0].number;
  if (!regularTiles.every(t => t.number === number)) {
    return false;
  }

  // All colors must be different
  const colors = regularTiles.map(t => t.color);
  const uniqueColors = new Set(colors);
  if (uniqueColors.size !== colors.length) {
    return false;
  }

  // Check that we don't exceed 4 tiles (one per color max)
  const totalColors = uniqueColors.size + jokerCount;
  if (totalColors > 4) {
    return false;
  }

  return true;
}

/**
 * Check if a set of tiles forms a valid run (same color, consecutive numbers)
 * @param {Array} tiles - Array of tile objects
 * @returns {boolean}
 */
export function isValidRun(tiles) {
  if (!tiles || tiles.length < 3 || tiles.length > 13) {
    return false;
  }

  // Separate jokers from regular tiles
  const regularTiles = tiles.filter(t => !t.isJoker);
  const jokerCount = tiles.filter(t => t.isJoker).length;

  if (regularTiles.length === 0) {
    // All jokers - valid if at least 3
    return tiles.length >= 3;
  }

  // All regular tiles must have the same color
  const color = regularTiles[0].color;
  if (!regularTiles.every(t => t.color === color)) {
    return false;
  }

  // Sort by number
  const sortedTiles = [...regularTiles].sort((a, b) => a.number - b.number);

  // Check for consecutive numbers with jokers filling gaps
  let jokersUsed = 0;
  for (let i = 1; i < sortedTiles.length; i++) {
    const gap = sortedTiles[i].number - sortedTiles[i - 1].number - 1;
    if (gap < 0) {
      // Duplicate numbers
      return false;
    }
    jokersUsed += gap;
  }

  // Check if we have enough jokers to fill gaps
  if (jokersUsed > jokerCount) {
    return false;
  }

  // Verify the run doesn't exceed valid number range (1-13)
  const minNumber = sortedTiles[0].number;
  const maxNumber = sortedTiles[sortedTiles.length - 1].number;
  const runLength = maxNumber - minNumber + 1 + (jokerCount - jokersUsed);

  // Extra jokers can extend the run
  const extraJokers = jokerCount - jokersUsed;
  const canExtendLeft = minNumber - 1;
  const canExtendRight = 13 - maxNumber;
  const maxExtension = Math.min(extraJokers, canExtendLeft + canExtendRight);

  return runLength <= 13;
}

/**
 * Check if a set of tiles is valid (either a group or a run)
 * @param {Array} tiles - Array of tile objects
 * @returns {{valid: boolean, type: string|null}}
 */
export function isValidSet(tiles) {
  if (isValidGroup(tiles)) {
    return { valid: true, type: 'group' };
  }
  if (isValidRun(tiles)) {
    return { valid: true, type: 'run' };
  }
  return { valid: false, type: null };
}

/**
 * Calculate the point value of a set of tiles
 * @param {Array} tiles - Array of tile objects
 * @returns {number}
 */
export function calculateSetPoints(tiles) {
  return tiles.reduce((sum, tile) => {
    if (tile.isJoker) {
      // Joker takes the value of the tile it represents
      // For simplicity, we'll calculate based on position in the set
      return sum; // Joker value calculated contextually
    }
    return sum + tile.number;
  }, 0);
}

/**
 * Calculate points for initial meld validation
 * Jokers in initial meld count as the value they represent
 * @param {Array} sets - Array of sets (each set is an array of tiles)
 * @returns {number}
 */
export function calculateInitialMeldPoints(sets) {
  let totalPoints = 0;

  for (const set of sets) {
    const result = isValidSet(set);
    if (!result.valid) {
      return 0; // Invalid set means 0 points
    }

    if (result.type === 'group') {
      // All tiles have the same number
      const number = set.find(t => !t.isJoker)?.number || 0;
      totalPoints += number * set.length;
    } else if (result.type === 'run') {
      // Calculate run points including joker positions
      const regularTiles = set.filter(t => !t.isJoker).sort((a, b) => a.number - b.number);
      if (regularTiles.length === 0) continue;

      const minNum = regularTiles[0].number;
      const maxNum = regularTiles[regularTiles.length - 1].number;
      
      // Sum all numbers in the run
      for (let n = minNum; n <= maxNum; n++) {
        totalPoints += n;
      }
      
      // Add joker values for extended positions
      const jokerCount = set.filter(t => t.isJoker).length;
      const gapJokers = maxNum - minNum + 1 - regularTiles.length;
      const extraJokers = jokerCount - gapJokers;
      
      // Extra jokers extend the run
      for (let i = 0; i < extraJokers; i++) {
        if (minNum - i - 1 >= 1) {
          totalPoints += minNum - i - 1;
        } else if (maxNum + i + 1 <= 13) {
          totalPoints += maxNum + i + 1;
        }
      }
    }
  }

  return totalPoints;
}

/**
 * Validate the initial meld meets the minimum point requirement
 * @param {Array} sets - Array of sets played
 * @param {Object} rules - Game rules configuration
 * @returns {{valid: boolean, points: number, required: number}}
 */
export function validateInitialMeld(sets, rules) {
  const points = calculateInitialMeldPoints(sets);
  return {
    valid: points >= rules.initialMeldPoints,
    points,
    required: rules.initialMeldPoints
  };
}

/**
 * Validate the entire table state (all sets must be valid)
 * @param {Array} tableSets - Array of all sets on the table
 * @returns {{valid: boolean, invalidSets: Array}}
 */
export function validateTableState(tableSets) {
  const invalidSets = [];

  for (let i = 0; i < tableSets.length; i++) {
    const result = isValidSet(tableSets[i]);
    if (!result.valid) {
      invalidSets.push({
        index: i,
        tiles: tableSets[i]
      });
    }
  }

  return {
    valid: invalidSets.length === 0,
    invalidSets
  };
}

/**
 * Calculate penalty points for remaining tiles (end game scoring)
 * @param {Array} tiles - Player's remaining tiles
 * @returns {number}
 */
export function calculatePenaltyPoints(tiles) {
  return tiles.reduce((sum, tile) => {
    if (tile.isJoker) {
      return sum + 30; // Jokers count as 30 penalty points
    }
    return sum + tile.number;
  }, 0);
}

/**
 * Check if a player has won (no tiles remaining)
 * @param {Array} playerTiles - Player's remaining tiles
 * @returns {boolean}
 */
export function hasPlayerWon(playerTiles) {
  return playerTiles.length === 0;
}
