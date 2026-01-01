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
 * This validates based on tile ORDER in the array, not just the numbers present.
 * @param {Array} tiles - Array of tile objects in order
 * @returns {boolean}
 */
export function isValidRun(tiles) {
  if (!tiles || tiles.length < 3 || tiles.length > 13) {
    return false;
  }

  // Count jokers
  const jokerCount = tiles.filter(t => t.isJoker).length;
  const regularTiles = tiles.filter(t => !t.isJoker);

  if (regularTiles.length === 0) {
    // All jokers - valid if at least 3
    return tiles.length >= 3;
  }

  // All regular tiles must have the same color
  const color = regularTiles[0].color;
  if (!regularTiles.every(t => t.color === color)) {
    return false;
  }

  // Determine the run's number sequence based on tile positions
  // First, find anchor points (regular tiles with their positions)
  const anchors = [];
  for (let i = 0; i < tiles.length; i++) {
    if (!tiles[i].isJoker) {
      anchors.push({ position: i, number: tiles[i].number });
    }
  }

  // Check that anchors are in ascending order
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i].number <= anchors[i-1].number) {
      return false; // Numbers not in ascending order
    }
  }

  // Calculate what number each position represents
  // Use first anchor as reference
  const firstAnchor = anchors[0];
  const startNumber = firstAnchor.number - firstAnchor.position;
  const endNumber = startNumber + tiles.length - 1;

  // Check bounds (1-13)
  if (startNumber < 1 || endNumber > 13) {
    return false;
  }

  // Verify all anchors match their expected position
  for (const anchor of anchors) {
    const expectedNumber = startNumber + anchor.position;
    if (anchor.number !== expectedNumber) {
      return false; // Anchor doesn't match expected position
    }
  }

  return true;
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
      // Calculate run points based on position
      // Find an anchor tile to determine the start number
      const regularTiles = set.filter(t => !t.isJoker);
      if (regularTiles.length === 0) continue;
      
      // Find first anchor
      let anchorPos = -1;
      let anchorNum = 0;
      for (let i = 0; i < set.length; i++) {
        if (!set[i].isJoker) {
          anchorPos = i;
          anchorNum = set[i].number;
          break;
        }
      }
      
      const startNum = anchorNum - anchorPos;
      
      // Sum all numbers in the run based on position
      for (let i = 0; i < set.length; i++) {
        totalPoints += startNum + i;
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
