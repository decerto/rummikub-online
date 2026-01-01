// Medium Bot Strategy - Plans multi-tile plays with basic strategy
import { isValidSet, calculateInitialMeldPoints } from '../../../common/rules.js';
import { TILE_COLORS } from '../../../common/constants.js';

export class MediumStrategy {
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
      if (colors.length >= 3) {
        // Generate all combinations of 3 or 4 colors
        this.generateGroupCombinations(byColor, colors, 3, [], groups);
        if (colors.length >= 4) {
          this.generateGroupCombinations(byColor, colors, 4, [], groups);
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
    const colors = Object.values(TILE_COLORS);

    for (const color of colors) {
      const colorTiles = tiles
        .filter(t => !t.isJoker && t.color === color)
        .sort((a, b) => a.number - b.number);

      // Remove duplicates (keep first of each number)
      const uniqueTiles = [];
      const seenNumbers = new Set();
      for (const tile of colorTiles) {
        if (!seenNumbers.has(tile.number)) {
          seenNumbers.add(tile.number);
          uniqueTiles.push(tile);
        }
      }

      // Find all valid runs of length 3+
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
