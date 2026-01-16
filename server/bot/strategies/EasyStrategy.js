// Easy Bot Strategy - Plans multi-tile plays with basic strategy
// (Formerly Medium strategy)
import { isValidSet, calculateInitialMeldPoints } from '../../../common/rules.js';
import { TILE_COLORS } from '../../../common/constants.js';

export class EasyStrategy {
  play(state) {
    const { playerTiles, tableSets, hasPlayedInitialMeld, rules } = state;
    
    let remainingTiles = [...playerTiles];
    let newTableSets = tableSets.map(set => [...set]);
    let tilesPlayed = 0;
    let playedInitialMeld = false;

    // If initial meld already played, first try to extend existing sets
    if (hasPlayedInitialMeld) {
      const extendResult = this.tryExtendSets(remainingTiles, newTableSets);
      if (extendResult.tilesPlayed > 0) {
        remainingTiles = extendResult.remainingTiles;
        newTableSets = extendResult.tableSets;
        tilesPlayed += extendResult.tilesPlayed;
      }
    }

    // Try to find optimal combination of sets from hand
    const allPossibleSets = this.findAllPossibleSets(remainingTiles);
    
    // Sort by total tiles used (prefer playing more tiles)
    allPossibleSets.sort((a, b) => {
      const aTiles = a.reduce((sum, set) => sum + set.length, 0);
      const bTiles = b.reduce((sum, set) => sum + set.length, 0);
      return bTiles - aTiles;
    });

    for (const setCombo of allPossibleSets) {
      const tempRemaining = [...playerTiles];
      const tempTableSets = [...newTableSets];
      let valid = true;
      let tempTilesPlayed = 0;

      // Check if we can play this combination
      for (const set of setCombo) {
        if (!isValidSet(set).valid) {
          valid = false;
          break;
        }

        // Remove tiles from hand
        for (const tile of set) {
          const idx = tempRemaining.findIndex(t => t.id === tile.id);
          if (idx === -1) {
            valid = false;
            break;
          }
          tempRemaining.splice(idx, 1);
          tempTilesPlayed++;
        }

        if (!valid) break;
        tempTableSets.push(set);
      }

      if (!valid) continue;

      // Check initial meld requirement
      if (!hasPlayedInitialMeld) {
        const meldPoints = calculateInitialMeldPoints(setCombo);
        if (meldPoints >= rules.initialMeldPoints) {
          remainingTiles = tempRemaining;
          newTableSets = tempTableSets;
          tilesPlayed = tempTilesPlayed;
          playedInitialMeld = true;
          break;
        }
      } else {
        remainingTiles = tempRemaining;
        newTableSets = tempTableSets;
        tilesPlayed = tempTilesPlayed;
        break;
      }
    }

    // After playing new sets, try to extend again with remaining tiles
    if (hasPlayedInitialMeld && tilesPlayed > 0) {
      const extendResult = this.tryExtendSets(remainingTiles, newTableSets);
      if (extendResult.tilesPlayed > 0) {
        remainingTiles = extendResult.remainingTiles;
        newTableSets = extendResult.tableSets;
        tilesPlayed += extendResult.tilesPlayed;
      }
    }

    if (tilesPlayed > 0) {
      return {
        action: 'play',
        tableSets: newTableSets,
        playerTiles: remainingTiles,
        tilesPlayed,
        playedInitialMeld
      };
    }

    return { action: 'draw' };
  }

  findAllPossibleSets(tiles) {
    const combinations = [];
    
    // Find all individual valid sets
    const groups = this.findAllGroups(tiles);
    const runs = this.findAllRuns(tiles);
    
    const allSets = [...groups, ...runs];

    // Generate non-overlapping combinations
    this.generateCombinations(allSets, [], combinations);

    return combinations;
  }

  findAllGroups(tiles) {
    const groups = [];
    const jokers = tiles.filter(t => t.isJoker);
    const byNumber = {};

    for (const tile of tiles) {
      if (tile.isJoker) continue;
      if (!byNumber[tile.number]) {
        byNumber[tile.number] = [];
      }
      byNumber[tile.number].push(tile);
    }

    for (const number in byNumber) {
      const tilesOfNumber = byNumber[number];
      const byColor = {};
      
      for (const tile of tilesOfNumber) {
        if (!byColor[tile.color]) {
          byColor[tile.color] = [];
        }
        byColor[tile.color].push(tile);
      }

      const colors = Object.keys(byColor);
      
      // Full groups (3 or 4 colors, no joker needed)
      if (colors.length >= 3) {
        // Generate all combinations of 3 or 4 colors
        this.generateGroupCombinations(byColor, colors, 3, [], groups);
        if (colors.length >= 4) {
          this.generateGroupCombinations(byColor, colors, 4, [], groups);
        }
      }
      
      // Groups with jokers
      if (jokers.length >= 1 && colors.length >= 2) {
        // 2 tiles + 1 joker = valid group of 3
        const uniqueTiles = colors.map(c => byColor[c][0]);
        for (let i = 0; i < uniqueTiles.length; i++) {
          for (let j = i + 1; j < uniqueTiles.length; j++) {
            const group = [uniqueTiles[i], uniqueTiles[j], jokers[0]];
            if (isValidSet(group).valid) {
              groups.push(group);
            }
            // Also try with 2 jokers for a group of 4
            if (jokers.length >= 2) {
              const group4 = [uniqueTiles[i], uniqueTiles[j], jokers[0], jokers[1]];
              if (isValidSet(group4).valid) {
                groups.push(group4);
              }
            }
          }
        }
      }
      
      // 1 tile + 2 jokers = valid group of 3
      if (jokers.length >= 2 && colors.length >= 1) {
        const tile = byColor[colors[0]][0];
        const group = [tile, jokers[0], jokers[1]];
        if (isValidSet(group).valid) {
          groups.push(group);
        }
      }
    }

    return groups;
  }

  generateGroupCombinations(byColor, colors, size, current, results) {
    if (current.length === size) {
      const group = current.map(color => byColor[color][0]);
      if (isValidSet(group).valid) {
        results.push(group);
      }
      return;
    }

    const start = current.length === 0 ? 0 : colors.indexOf(current[current.length - 1]) + 1;
    for (let i = start; i < colors.length; i++) {
      this.generateGroupCombinations(byColor, colors, size, [...current, colors[i]], results);
    }
  }

  findAllRuns(tiles) {
    const runs = [];
    const jokers = tiles.filter(t => t.isJoker);
    const colors = Object.values(TILE_COLORS);

    for (const color of colors) {
      const colorTiles = tiles
        .filter(t => !t.isJoker && t.color === color)
        .sort((a, b) => a.number - b.number);

      // Remove duplicates (keep first of each number)
      const uniqueTiles = [];
      const seenNumbers = new Set();
      const byNum = {};
      for (const tile of colorTiles) {
        if (!seenNumbers.has(tile.number)) {
          seenNumbers.add(tile.number);
          uniqueTiles.push(tile);
          byNum[tile.number] = tile;
        }
      }

      // Find all valid runs of length 3+ (no jokers)
      for (let start = 0; start < uniqueTiles.length - 2; start++) {
        for (let end = start + 2; end < uniqueTiles.length; end++) {
          const potentialRun = uniqueTiles.slice(start, end + 1);
          
          // Check if consecutive
          let isConsecutive = true;
          for (let i = 1; i < potentialRun.length; i++) {
            if (potentialRun[i].number !== potentialRun[i-1].number + 1) {
              isConsecutive = false;
              break;
            }
          }

          if (isConsecutive && isValidSet(potentialRun).valid) {
            runs.push(potentialRun);
          }
        }
      }
      
      // Runs with jokers filling gaps
      if (jokers.length >= 1 && uniqueTiles.length >= 2) {
        for (let i = 0; i < uniqueTiles.length - 1; i++) {
          const gap = uniqueTiles[i + 1].number - uniqueTiles[i].number;
          
          // Gap of 2 - joker fills the middle
          if (gap === 2) {
            const run = [uniqueTiles[i], jokers[0], uniqueTiles[i + 1]];
            if (isValidSet(run).valid) {
              runs.push(run);
            }
          }
          
          // Consecutive pair - joker extends at either end
          if (gap === 1) {
            if (uniqueTiles[i].number > 1) {
              const run = [jokers[0], uniqueTiles[i], uniqueTiles[i + 1]];
              if (isValidSet(run).valid) {
                runs.push(run);
              }
            }
            if (uniqueTiles[i + 1].number < 13) {
              const run = [uniqueTiles[i], uniqueTiles[i + 1], jokers[0]];
              if (isValidSet(run).valid) {
                runs.push(run);
              }
            }
          }
        }
      }
      
      // Single tile + 2 jokers
      if (jokers.length >= 2) {
        for (const tile of uniqueTiles) {
          let run;
          if (tile.number === 1) {
            run = [tile, jokers[0], jokers[1]]; // 1, J, J = 1,2,3
          } else if (tile.number === 13) {
            run = [jokers[0], jokers[1], tile]; // J, J, 13 = 11,12,13
          } else {
            run = [jokers[0], tile, jokers[1]]; // J, X, J = X-1, X, X+1
          }
          if (isValidSet(run).valid) {
            runs.push(run);
          }
        }
      }
    }

    return runs;
  }

  generateCombinations(sets, current, results, usedTileIds = new Set()) {
    if (current.length > 0) {
      results.push([...current]);
    }

    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      
      // Check if any tile in this set is already used
      const hasOverlap = set.some(tile => usedTileIds.has(tile.id));
      if (hasOverlap) continue;

      // Add this set and recurse
      const newUsedIds = new Set(usedTileIds);
      for (const tile of set) {
        newUsedIds.add(tile.id);
      }

      this.generateCombinations(
        sets.slice(i + 1),
        [...current, set],
        results,
        newUsedIds
      );
    }
  }

  tryExtendSets(tiles, tableSets) {
    let remainingTiles = [...tiles];
    let tilesPlayed = 0;
    const newTableSets = tableSets.map(set => [...set]);

    for (let i = 0; i < newTableSets.length; i++) {
      const set = newTableSets[i];
      const result = isValidSet(set);
      
      if (result.type === 'run') {
        // For runs, we need to understand the POSITION-based numbers
        // Find an anchor tile to determine the sequence
        const regularTiles = set.filter(t => !t.isJoker);
        if (regularTiles.length === 0) continue;
        
        const color = regularTiles[0].color;
        
        // Find first anchor to determine start number
        let anchorPos = -1;
        let anchorNum = 0;
        for (let j = 0; j < set.length; j++) {
          if (!set[j].isJoker) {
            anchorPos = j;
            anchorNum = set[j].number;
            break;
          }
        }
        
        const startNum = anchorNum - anchorPos;
        const endNum = startNum + set.length - 1;
        
        // Collect all numbers currently in the run (including joker positions)
        const numbersInRun = new Set();
        for (let j = 0; j < set.length; j++) {
          numbersInRun.add(startNum + j);
        }
        
        // Try adding to start
        const numToAddStart = startNum - 1;
        if (numToAddStart >= 1 && !numbersInRun.has(numToAddStart)) {
          const tileToAddStart = remainingTiles.find(t => 
            !t.isJoker && t.color === color && t.number === numToAddStart
          );
          
          if (tileToAddStart) {
            set.unshift(tileToAddStart);
            const idx = remainingTiles.findIndex(t => t.id === tileToAddStart.id);
            remainingTiles.splice(idx, 1);
            tilesPlayed++;
          }
        }

        // Try adding to end
        const numToAddEnd = endNum + 1;
        if (numToAddEnd <= 13 && !numbersInRun.has(numToAddEnd)) {
          const tileToAddEnd = remainingTiles.find(t => 
            !t.isJoker && t.color === color && t.number === numToAddEnd
          );
          
          if (tileToAddEnd) {
            set.push(tileToAddEnd);
            const idx = remainingTiles.findIndex(t => t.id === tileToAddEnd.id);
            remainingTiles.splice(idx, 1);
            tilesPlayed++;
          }
        }
      } else if (result.type === 'group' && set.length < 4) {
        // Try to extend groups
        const number = set.find(t => !t.isJoker)?.number;
        const usedColors = new Set(set.filter(t => !t.isJoker).map(t => t.color));
        
        const tileToAdd = remainingTiles.find(t => 
          !t.isJoker && t.number === number && !usedColors.has(t.color)
        );
        
        if (tileToAdd) {
          set.push(tileToAdd);
          const idx = remainingTiles.findIndex(t => t.id === tileToAdd.id);
          remainingTiles.splice(idx, 1);
          tilesPlayed++;
        }
      }
    }

    return {
      tableSets: newTableSets,
      remainingTiles,
      tilesPlayed
    };
  }
}
