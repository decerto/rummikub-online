// Hard Bot Strategy - Expert level with aggressive joker usage
// Uses jokers proactively for initial melds, completing sets, and table manipulation
import { isValidSet, validateTableState, calculateInitialMeldPoints } from '../../../common/rules.js';
import { TILE_COLORS } from '../../../common/constants.js';
import { MediumStrategy } from './MediumStrategy.js';

export class HardStrategy {
  constructor() {
    this.mediumStrategy = new MediumStrategy();
  }

  play(state) {
    const { playerTiles, tableSets, hasPlayedInitialMeld, rules } = state;

    // Count jokers in hand
    const jokers = playerTiles.filter(t => t.isJoker);
    const nonJokers = playerTiles.filter(t => !t.isJoker);

    // If no initial meld yet, try aggressive joker strategy for initial meld
    if (!hasPlayedInitialMeld) {
      const initialMeldResult = this.tryJokerInitialMeld(playerTiles, rules);
      if (initialMeldResult) {
        return initialMeldResult;
      }
      // Fall back to medium strategy for initial meld
      return this.mediumStrategy.play(state);
    }

    // 1. First try to reclaim jokers from the table
    const reclaimResult = this.tryReclaimJokers(playerTiles, tableSets);
    if (reclaimResult && reclaimResult.jokersReclaimed > 0) {
      // Continue playing with reclaimed jokers
      const continueResult = this.continueWithJokers(
        reclaimResult.remainingTiles,
        reclaimResult.tableSets
      );
      if (continueResult.tilesPlayed > 0) {
        return {
          action: 'play',
          tableSets: continueResult.tableSets,
          playerTiles: continueResult.remainingTiles,
          tilesPlayed: continueResult.tilesPlayed,
          playedInitialMeld: false
        };
      }
    }

    // 2. Try using jokers aggressively to complete sets
    if (jokers.length > 0) {
      const jokerPlayResult = this.tryJokerCompletions(playerTiles, tableSets);
      if (jokerPlayResult && jokerPlayResult.tilesPlayed > 0) {
        // After joker play, try additional plays
        const continueResult = this.continueWithJokers(
          jokerPlayResult.remainingTiles,
          jokerPlayResult.tableSets
        );
        return {
          action: 'play',
          tableSets: continueResult.tableSets,
          playerTiles: continueResult.remainingTiles,
          tilesPlayed: jokerPlayResult.tilesPlayed + continueResult.tilesPlayed,
          playedInitialMeld: false
        };
      }
    }

    // 3. Try extending sets with jokers
    const extendWithJokerResult = this.tryExtendWithJokers(playerTiles, tableSets);
    if (extendWithJokerResult && extendWithJokerResult.tilesPlayed > 0) {
      return {
        action: 'play',
        tableSets: extendWithJokerResult.tableSets,
        playerTiles: extendWithJokerResult.remainingTiles,
        tilesPlayed: extendWithJokerResult.tilesPlayed,
        playedInitialMeld: false
      };
    }

    // 4. Try medium strategy (table manipulation)
    const mediumResult = this.mediumStrategy.play(state);
    if (mediumResult.action === 'play' && mediumResult.tilesPlayed > 0) {
      return mediumResult;
    }

    // 5. Last resort: use joker to complete almost-complete sets
    if (jokers.length > 0) {
      const desperateJokerResult = this.tryDesperateJokerPlay(playerTiles, tableSets);
      if (desperateJokerResult && desperateJokerResult.tilesPlayed > 0) {
        return {
          action: 'play',
          tableSets: desperateJokerResult.tableSets,
          playerTiles: desperateJokerResult.remainingTiles,
          tilesPlayed: desperateJokerResult.tilesPlayed,
          playedInitialMeld: false
        };
      }
    }

    // No play found, draw
    return { action: 'draw' };
  }

  // Try to use jokers to achieve initial meld
  tryJokerInitialMeld(playerTiles, rules) {
    const minPoints = rules?.initialMeldPoints || 30;
    const jokers = playerTiles.filter(t => t.isJoker);
    const nonJokers = playerTiles.filter(t => !t.isJoker);

    if (jokers.length === 0) return null;

    // Find all potential sets that could be completed with jokers
    const potentialSets = this.findPotentialSetsWithJokers(playerTiles);
    
    // Try combinations to reach minimum points
    const validCombinations = this.findInitialMeldCombinations(potentialSets, minPoints, playerTiles);
    
    if (validCombinations.length > 0) {
      // Pick the combination that uses the most tiles (empties hand fastest)
      const bestCombo = validCombinations.reduce((best, curr) => {
        const bestTileCount = best.reduce((sum, set) => sum + set.length, 0);
        const currTileCount = curr.reduce((sum, set) => sum + set.length, 0);
        return currTileCount > bestTileCount ? curr : best;
      });

      const usedTileIds = new Set();
      for (const set of bestCombo) {
        for (const tile of set) {
          usedTileIds.add(tile.id);
        }
      }

      return {
        action: 'play',
        tableSets: bestCombo,
        playerTiles: playerTiles.filter(t => !usedTileIds.has(t.id)),
        tilesPlayed: usedTileIds.size,
        playedInitialMeld: true
      };
    }

    return null;
  }

  // Find sets that can be formed using jokers
  findPotentialSetsWithJokers(tiles) {
    const sets = [];
    const jokers = tiles.filter(t => t.isJoker);
    const nonJokers = tiles.filter(t => !t.isJoker);

    if (jokers.length === 0) {
      return this.findCompleteSets(nonJokers);
    }

    // Find groups (same number, different colors)
    const byNumber = {};
    for (const tile of nonJokers) {
      if (!byNumber[tile.number]) byNumber[tile.number] = [];
      byNumber[tile.number].push(tile);
    }

    for (const number in byNumber) {
      const tilesOfNumber = byNumber[number];
      const uniqueByColor = {};
      for (const t of tilesOfNumber) {
        if (!uniqueByColor[t.color]) uniqueByColor[t.color] = t;
      }
      const uniqueTiles = Object.values(uniqueByColor);

      // Complete groups: 3 or 4 tiles of same number
      if (uniqueTiles.length >= 3) {
        sets.push([...uniqueTiles.slice(0, Math.min(4, uniqueTiles.length))]);
      }

      // Incomplete groups that can be completed with joker
      if (uniqueTiles.length === 2 && jokers.length >= 1) {
        sets.push([...uniqueTiles, jokers[0]]);
      }

      // Two tiles + two jokers for a group of 4
      if (uniqueTiles.length === 2 && jokers.length >= 2) {
        sets.push([...uniqueTiles, jokers[0], jokers[1]]);
      }
    }

    // Find runs (same color, consecutive numbers)
    const colors = Object.values(TILE_COLORS);
    for (const color of colors) {
      const colorTiles = nonJokers
        .filter(t => t.color === color)
        .sort((a, b) => a.number - b.number);

      const uniqueByNumber = {};
      for (const t of colorTiles) {
        if (!uniqueByNumber[t.number]) uniqueByNumber[t.number] = t;
      }
      const unique = Object.values(uniqueByNumber).sort((a, b) => a.number - b.number);

      // Complete runs
      for (let i = 0; i < unique.length - 2; i++) {
        let run = [unique[i]];
        for (let j = i + 1; j < unique.length; j++) {
          if (unique[j].number === run[run.length - 1].number + 1) {
            run.push(unique[j]);
          } else break;
        }
        if (run.length >= 3) {
          sets.push([...run]);
        }
      }

      // Runs with gaps that jokers can fill
      for (let i = 0; i < unique.length - 1; i++) {
        const gap = unique[i + 1].number - unique[i].number;
        if (gap === 2 && jokers.length >= 1) {
          // One gap, can bridge with joker
          const missingNum = unique[i].number + 1;
          // Check if we have another tile to extend
          if (i + 2 < unique.length && unique[i + 2].number === unique[i + 1].number + 1) {
            sets.push([unique[i], jokers[0], unique[i + 1], unique[i + 2]]);
          } else {
            sets.push([unique[i], jokers[0], unique[i + 1]]);
          }
        }
        
        // Two consecutive with joker at end
        if (gap === 1 && jokers.length >= 1) {
          const startNum = unique[i].number;
          const endNum = unique[i + 1].number;
          
          // Joker at start
          if (startNum > 1) {
            sets.push([jokers[0], unique[i], unique[i + 1]]);
          }
          // Joker at end
          if (endNum < 13) {
            sets.push([unique[i], unique[i + 1], jokers[0]]);
          }
        }
      }

      // Single tile + two jokers
      if (unique.length >= 1 && jokers.length >= 2) {
        for (const tile of unique) {
          if (tile.number >= 2 && tile.number <= 12) {
            // Jokers on both sides
            sets.push([jokers[0], tile, jokers[1]]);
          } else if (tile.number === 1) {
            sets.push([tile, jokers[0], jokers[1]]);
          } else if (tile.number === 13) {
            sets.push([jokers[0], jokers[1], tile]);
          }
        }
      }
    }

    return sets;
  }

  findCompleteSets(tiles) {
    const sets = [];
    
    // Groups
    const byNumber = {};
    for (const tile of tiles) {
      if (!byNumber[tile.number]) byNumber[tile.number] = [];
      byNumber[tile.number].push(tile);
    }

    for (const number in byNumber) {
      const tilesOfNumber = byNumber[number];
      const byColor = {};
      for (const t of tilesOfNumber) {
        if (!byColor[t.color]) byColor[t.color] = t;
      }
      const uniqueTiles = Object.values(byColor);
      if (uniqueTiles.length >= 3) {
        sets.push(uniqueTiles.slice(0, Math.min(4, uniqueTiles.length)));
      }
    }

    // Runs
    const colors = Object.values(TILE_COLORS);
    for (const color of colors) {
      const colorTiles = tiles
        .filter(t => t.color === color)
        .sort((a, b) => a.number - b.number);
      
      const unique = [];
      const seen = new Set();
      for (const t of colorTiles) {
        if (!seen.has(t.number)) {
          seen.add(t.number);
          unique.push(t);
        }
      }

      for (let i = 0; i < unique.length - 2; i++) {
        let run = [unique[i]];
        for (let j = i + 1; j < unique.length; j++) {
          if (unique[j].number === run[run.length - 1].number + 1) {
            run.push(unique[j]);
          } else break;
        }
        if (run.length >= 3) {
          sets.push([...run]);
        }
      }
    }

    return sets;
  }

  findInitialMeldCombinations(potentialSets, minPoints, allTiles) {
    const validCombinations = [];
    
    // Filter to only valid sets
    const validSets = potentialSets.filter(set => isValidSet(set).valid);

    // Try single sets first
    for (const set of validSets) {
      const points = this.calculateSetPoints(set);
      if (points >= minPoints) {
        validCombinations.push([set]);
      }
    }

    // Try pairs of sets
    for (let i = 0; i < validSets.length; i++) {
      for (let j = i + 1; j < validSets.length; j++) {
        if (!this.setsShareTiles(validSets[i], validSets[j])) {
          const totalPoints = this.calculateSetPoints(validSets[i]) + this.calculateSetPoints(validSets[j]);
          if (totalPoints >= minPoints) {
            validCombinations.push([validSets[i], validSets[j]]);
          }
        }
      }
    }

    // Try triples of sets
    for (let i = 0; i < validSets.length; i++) {
      for (let j = i + 1; j < validSets.length; j++) {
        for (let k = j + 1; k < validSets.length; k++) {
          if (!this.setsShareTiles(validSets[i], validSets[j]) &&
              !this.setsShareTiles(validSets[i], validSets[k]) &&
              !this.setsShareTiles(validSets[j], validSets[k])) {
            const totalPoints = this.calculateSetPoints(validSets[i]) + 
                               this.calculateSetPoints(validSets[j]) + 
                               this.calculateSetPoints(validSets[k]);
            if (totalPoints >= minPoints) {
              validCombinations.push([validSets[i], validSets[j], validSets[k]]);
            }
          }
        }
      }
    }

    return validCombinations;
  }

  calculateSetPoints(set) {
    const result = isValidSet(set);
    if (!result.valid) return 0;

    if (result.type === 'run') {
      // For runs, jokers take the value of their position
      let total = 0;
      const nonJokers = set.filter(t => !t.isJoker);
      if (nonJokers.length === 0) return 0;

      // Find anchor
      let anchorIdx = set.findIndex(t => !t.isJoker);
      let anchorNum = set[anchorIdx].number;
      let startNum = anchorNum - anchorIdx;

      for (let i = 0; i < set.length; i++) {
        total += startNum + i;
      }
      return total;
    } else {
      // For groups, all tiles have the same number value
      const nonJokers = set.filter(t => !t.isJoker);
      if (nonJokers.length === 0) return 0;
      return nonJokers[0].number * set.length;
    }
  }

  setsShareTiles(set1, set2) {
    const ids1 = new Set(set1.map(t => t.id));
    return set2.some(t => ids1.has(t.id));
  }

  // Try to reclaim jokers from the table by replacing them with matching tiles from hand
  tryReclaimJokers(playerTiles, tableSets) {
    let remainingTiles = [...playerTiles];
    let newTableSets = tableSets.map(s => [...s]);
    let jokersReclaimed = 0;

    for (let setIdx = 0; setIdx < newTableSets.length; setIdx++) {
      const set = newTableSets[setIdx];
      const jokerIndices = set.map((t, i) => t.isJoker ? i : -1).filter(i => i >= 0);

      for (const jokerIdx of jokerIndices) {
        const result = isValidSet(set);
        if (!result.valid) continue;

        // Determine what tile the joker represents
        let replacementTile = null;

        if (result.type === 'run') {
          const nonJokers = set.filter(t => !t.isJoker);
          if (nonJokers.length === 0) continue;

          const color = nonJokers[0].color;
          let anchorPos = set.findIndex(t => !t.isJoker);
          let anchorNum = set[anchorPos].number;
          let jokerNum = anchorNum + (jokerIdx - anchorPos);

          // Find matching tile in hand
          replacementTile = remainingTiles.find(t => 
            !t.isJoker && t.color === color && t.number === jokerNum
          );
        } else if (result.type === 'group') {
          const nonJokers = set.filter(t => !t.isJoker);
          if (nonJokers.length === 0) continue;

          const number = nonJokers[0].number;
          const usedColors = new Set(nonJokers.map(t => t.color));

          // Find a tile with same number and unused color
          replacementTile = remainingTiles.find(t => 
            !t.isJoker && t.number === number && !usedColors.has(t.color)
          );
        }

        if (replacementTile) {
          // Swap the joker out
          const joker = set[jokerIdx];
          newTableSets[setIdx][jokerIdx] = replacementTile;
          
          // Add joker to hand, remove replacement tile
          remainingTiles = remainingTiles.filter(t => t.id !== replacementTile.id);
          remainingTiles.push(joker);
          jokersReclaimed++;
        }
      }
    }

    if (jokersReclaimed > 0 && validateTableState(newTableSets).valid) {
      return { tableSets: newTableSets, remainingTiles, jokersReclaimed };
    }

    return null;
  }

  // Continue playing after reclaiming jokers
  continueWithJokers(playerTiles, tableSets) {
    let remainingTiles = [...playerTiles];
    let newTableSets = tableSets.map(s => [...s]);
    let tilesPlayed = 0;

    // Try to play sets with jokers
    const jokerPlayResult = this.tryJokerCompletions(remainingTiles, newTableSets);
    if (jokerPlayResult && jokerPlayResult.tilesPlayed > 0) {
      remainingTiles = jokerPlayResult.remainingTiles;
      newTableSets = jokerPlayResult.tableSets;
      tilesPlayed += jokerPlayResult.tilesPlayed;
    }

    // Also try simple plays
    const simpleResult = this.mediumStrategy.trySimplePlays(remainingTiles, newTableSets);
    if (simpleResult.tilesPlayed > 0) {
      remainingTiles = simpleResult.remainingTiles;
      newTableSets = simpleResult.tableSets;
      tilesPlayed += simpleResult.tilesPlayed;
    }

    return { tableSets: newTableSets, remainingTiles, tilesPlayed };
  }

  // Try to complete sets by using jokers from hand
  tryJokerCompletions(playerTiles, tableSets) {
    const jokers = playerTiles.filter(t => t.isJoker);
    const nonJokers = playerTiles.filter(t => !t.isJoker);

    if (jokers.length === 0) return null;

    let bestResult = null;
    let bestTilesPlayed = 0;

    // Try each potential set with joker completion
    const potentialSets = this.findPotentialSetsWithJokers(playerTiles);
    
    for (const set of potentialSets) {
      if (!isValidSet(set).valid) continue;

      // Verify all tiles are available
      const usedIds = new Set();
      let allAvailable = true;
      for (const tile of set) {
        if (usedIds.has(tile.id)) {
          allAvailable = false;
          break;
        }
        if (!playerTiles.some(t => t.id === tile.id)) {
          allAvailable = false;
          break;
        }
        usedIds.add(tile.id);
      }

      if (!allAvailable) continue;

      // This set can be played
      const tilesPlayed = set.length;
      if (tilesPlayed > bestTilesPlayed) {
        const newTableSets = [...tableSets.map(s => [...s]), set];
        const remainingTiles = playerTiles.filter(t => !usedIds.has(t.id));
        
        if (validateTableState(newTableSets).valid) {
          bestResult = { tableSets: newTableSets, remainingTiles, tilesPlayed };
          bestTilesPlayed = tilesPlayed;
        }
      }
    }

    return bestResult;
  }

  // Try extending existing table sets with jokers
  tryExtendWithJokers(playerTiles, tableSets) {
    const jokers = playerTiles.filter(t => t.isJoker);
    if (jokers.length === 0) return null;

    let remainingTiles = [...playerTiles];
    let newTableSets = tableSets.map(s => [...s]);
    let tilesPlayed = 0;

    for (let setIdx = 0; setIdx < newTableSets.length; setIdx++) {
      const set = newTableSets[setIdx];
      const result = isValidSet(set);
      if (!result.valid) continue;

      if (result.type === 'run') {
        // Try adding joker at end or start
        const nonJokers = set.filter(t => !t.isJoker);
        if (nonJokers.length === 0) continue;

        const color = nonJokers[0].color;
        let anchorPos = set.findIndex(t => !t.isJoker);
        let anchorNum = set[anchorPos].number;
        let startNum = anchorNum - anchorPos;
        let endNum = startNum + set.length - 1;

        const jokerInHand = remainingTiles.find(t => t.isJoker);
        if (!jokerInHand) continue;

        // Can we add joker at end?
        if (endNum < 13) {
          // Check if there's also a regular tile we can add after joker
          const afterJokerNum = endNum + 2;
          const afterJokerTile = remainingTiles.find(t => 
            !t.isJoker && t.color === color && t.number === afterJokerNum
          );

          if (afterJokerTile) {
            const newSet = [...set, jokerInHand, afterJokerTile];
            if (isValidSet(newSet).valid) {
              newTableSets[setIdx] = newSet;
              remainingTiles = remainingTiles.filter(t => 
                t.id !== jokerInHand.id && t.id !== afterJokerTile.id
              );
              tilesPlayed += 2;
            }
          } else {
            // Just add joker at end
            const newSet = [...set, jokerInHand];
            if (isValidSet(newSet).valid) {
              newTableSets[setIdx] = newSet;
              remainingTiles = remainingTiles.filter(t => t.id !== jokerInHand.id);
              tilesPlayed += 1;
            }
          }
        }
      } else if (result.type === 'group' && set.length < 4) {
        // Add joker to group
        const jokerInHand = remainingTiles.find(t => t.isJoker);
        if (!jokerInHand) continue;

        const newSet = [...set, jokerInHand];
        if (isValidSet(newSet).valid) {
          newTableSets[setIdx] = newSet;
          remainingTiles = remainingTiles.filter(t => t.id !== jokerInHand.id);
          tilesPlayed += 1;
        }
      }
    }

    if (tilesPlayed > 0 && validateTableState(newTableSets).valid) {
      return { tableSets: newTableSets, remainingTiles, tilesPlayed };
    }

    return null;
  }

  // Last resort: use jokers to play any almost-complete set
  tryDesperateJokerPlay(playerTiles, tableSets) {
    const jokers = playerTiles.filter(t => t.isJoker);
    const nonJokers = playerTiles.filter(t => !t.isJoker);

    if (jokers.length === 0 || nonJokers.length < 2) return null;

    // Find pairs that could become sets with a joker
    // Groups: two tiles of same number, different colors
    const byNumber = {};
    for (const tile of nonJokers) {
      if (!byNumber[tile.number]) byNumber[tile.number] = [];
      byNumber[tile.number].push(tile);
    }

    for (const number in byNumber) {
      const tilesOfNumber = byNumber[number];
      const uniqueByColor = {};
      for (const t of tilesOfNumber) {
        if (!uniqueByColor[t.color]) uniqueByColor[t.color] = t;
      }
      const uniqueTiles = Object.values(uniqueByColor);

      if (uniqueTiles.length === 2) {
        // Can form a group of 3 with joker
        const newSet = [...uniqueTiles, jokers[0]];
        if (isValidSet(newSet).valid) {
          const newTableSets = [...tableSets.map(s => [...s]), newSet];
          const usedIds = new Set([uniqueTiles[0].id, uniqueTiles[1].id, jokers[0].id]);
          const remainingTiles = playerTiles.filter(t => !usedIds.has(t.id));

          if (validateTableState(newTableSets).valid) {
            return { tableSets: newTableSets, remainingTiles, tilesPlayed: 3 };
          }
        }
      }
    }

    // Runs: two consecutive tiles of same color
    const colors = Object.values(TILE_COLORS);
    for (const color of colors) {
      const colorTiles = nonJokers
        .filter(t => t.color === color)
        .sort((a, b) => a.number - b.number);

      for (let i = 0; i < colorTiles.length - 1; i++) {
        const t1 = colorTiles[i];
        const t2 = colorTiles[i + 1];
        const gap = t2.number - t1.number;

        if (gap === 1) {
          // Consecutive - add joker at start or end
          let newSet;
          if (t1.number > 1) {
            newSet = [jokers[0], t1, t2];
          } else if (t2.number < 13) {
            newSet = [t1, t2, jokers[0]];
          } else {
            continue;
          }

          if (isValidSet(newSet).valid) {
            const newTableSets = [...tableSets.map(s => [...s]), newSet];
            const usedIds = new Set([t1.id, t2.id, jokers[0].id]);
            const remainingTiles = playerTiles.filter(t => !usedIds.has(t.id));

            if (validateTableState(newTableSets).valid) {
              return { tableSets: newTableSets, remainingTiles, tilesPlayed: 3 };
            }
          }
        } else if (gap === 2) {
          // Gap of 1 - joker fills the gap
          const newSet = [t1, jokers[0], t2];
          if (isValidSet(newSet).valid) {
            const newTableSets = [...tableSets.map(s => [...s]), newSet];
            const usedIds = new Set([t1.id, t2.id, jokers[0].id]);
            const remainingTiles = playerTiles.filter(t => !usedIds.has(t.id));

            if (validateTableState(newTableSets).valid) {
              return { tableSets: newTableSets, remainingTiles, tilesPlayed: 3 };
            }
          }
        }
      }
    }

    return null;
  }
}
