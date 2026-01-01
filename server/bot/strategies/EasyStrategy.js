// Easy Bot Strategy - Plays obvious, simple valid sets
import { isValidSet, calculateInitialMeldPoints } from '../../../common/rules.js';
import { TILE_COLORS } from '../../../common/constants.js';

export class EasyStrategy {
  play(state) {
    const { playerTiles, tableSets, hasPlayedInitialMeld, rules } = state;
    
    let remainingTiles = [...playerTiles];
    let newTableSets = tableSets.map(set => [...set]);
    let tilesPlayed = 0;
    let playedInitialMeld = false;

    // If already played initial meld, try extending existing sets first
    if (hasPlayedInitialMeld) {
      const extendResult = this.tryExtendSets(remainingTiles, newTableSets);
      if (extendResult.tilesPlayed > 0) {
        remainingTiles = extendResult.remainingTiles;
        newTableSets = extendResult.tableSets;
        tilesPlayed += extendResult.tilesPlayed;
      }
    }

    // Try to find simple sets from hand
    const setsToPlay = this.findSimpleSets(remainingTiles);

    if (setsToPlay.length > 0) {
      // Check initial meld requirement
      if (!hasPlayedInitialMeld) {
        const meldPoints = calculateInitialMeldPoints(setsToPlay);
        if (meldPoints >= rules.initialMeldPoints) {
          // Can play initial meld
          for (const set of setsToPlay) {
            newTableSets.push(set);
            for (const tile of set) {
              const idx = remainingTiles.findIndex(t => t.id === tile.id);
              if (idx !== -1) {
                remainingTiles.splice(idx, 1);
                tilesPlayed++;
              }
            }
          }
          playedInitialMeld = true;
        } else if (tilesPlayed === 0) {
          // Not enough points for initial meld and no extensions, draw instead
          return { action: 'draw' };
        }
      } else {
        // Already played initial meld, can play any valid sets
        for (const set of setsToPlay) {
          newTableSets.push(set);
          for (const tile of set) {
            const idx = remainingTiles.findIndex(t => t.id === tile.id);
            if (idx !== -1) {
              remainingTiles.splice(idx, 1);
              tilesPlayed++;
            }
          }
        }
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

    // No valid plays found, draw a tile
    return { action: 'draw' };
  }

  // Try to extend existing sets on the table
  tryExtendSets(tiles, tableSets) {
    let remainingTiles = [...tiles];
    let tilesPlayed = 0;
    const newTableSets = tableSets.map(set => [...set]);
    let changed = true;

    while (changed) {
      changed = false;

      for (let i = 0; i < newTableSets.length; i++) {
        const set = newTableSets[i];
        const result = isValidSet(set);
        
        if (result.type === 'run') {
          // Try to extend runs
          const regularTiles = set.filter(t => !t.isJoker);
          if (regularTiles.length === 0) continue;
          
          const color = regularTiles[0].color;
          const numbers = regularTiles.map(t => t.number).sort((a, b) => a - b);
          const minNum = Math.min(...numbers);
          const maxNum = Math.max(...numbers);
          
          // Try adding to start
          if (minNum > 1) {
            const tileToAddStart = remainingTiles.find(t => 
              !t.isJoker && t.color === color && t.number === minNum - 1
            );
            
            if (tileToAddStart) {
              newTableSets[i] = [tileToAddStart, ...set];
              remainingTiles = remainingTiles.filter(t => t.id !== tileToAddStart.id);
              tilesPlayed++;
              changed = true;
            }
          }

          // Try adding to end
          if (maxNum < 13) {
            const tileToAddEnd = remainingTiles.find(t => 
              !t.isJoker && t.color === color && t.number === maxNum + 1
            );
            
            if (tileToAddEnd) {
              newTableSets[i] = [...newTableSets[i], tileToAddEnd];
              remainingTiles = remainingTiles.filter(t => t.id !== tileToAddEnd.id);
              tilesPlayed++;
              changed = true;
            }
          }
        } else if (result.type === 'group' && set.length < 4) {
          // Try to extend groups
          const regularTiles = set.filter(t => !t.isJoker);
          if (regularTiles.length === 0) continue;
          
          const number = regularTiles[0].number;
          const usedColors = new Set(regularTiles.map(t => t.color));
          
          const tileToAdd = remainingTiles.find(t => 
            !t.isJoker && t.number === number && !usedColors.has(t.color)
          );
          
          if (tileToAdd) {
            newTableSets[i] = [...set, tileToAdd];
            remainingTiles = remainingTiles.filter(t => t.id !== tileToAdd.id);
            tilesPlayed++;
            changed = true;
          }
        }
      }
    }

    return {
      tableSets: newTableSets,
      remainingTiles,
      tilesPlayed
    };
  }

  findSimpleSets(tiles) {
    const sets = [];
    const usedIds = new Set();

    // Find groups (same number, different colors)
    const groups = this.findGroups(tiles, usedIds);
    sets.push(...groups);

    // Find runs (same color, consecutive numbers)
    const runs = this.findRuns(tiles, usedIds);
    sets.push(...runs);

    return sets;
  }

  findGroups(tiles, usedIds) {
    const groups = [];
    const byNumber = {};

    // Group tiles by number
    for (const tile of tiles) {
      if (tile.isJoker || usedIds.has(tile.id)) continue;
      if (!byNumber[tile.number]) {
        byNumber[tile.number] = [];
      }
      byNumber[tile.number].push(tile);
    }

    // Find valid groups (3-4 tiles of same number, different colors)
    for (const number in byNumber) {
      const tilesOfNumber = byNumber[number];
      const colorSet = new Set();
      const validTiles = [];

      for (const tile of tilesOfNumber) {
        if (!colorSet.has(tile.color)) {
          colorSet.add(tile.color);
          validTiles.push(tile);
        }
      }

      if (validTiles.length >= 3) {
        const group = validTiles.slice(0, Math.min(4, validTiles.length));
        if (isValidSet(group).valid) {
          groups.push(group);
          for (const t of group) {
            usedIds.add(t.id);
          }
        }
      }
    }

    return groups;
  }

  findRuns(tiles, usedIds) {
    const runs = [];
    const colors = Object.values(TILE_COLORS);

    for (const color of colors) {
      const colorTiles = tiles
        .filter(t => !t.isJoker && !usedIds.has(t.id) && t.color === color)
        .sort((a, b) => a.number - b.number);

      // Find consecutive sequences
      let currentRun = [];
      
      for (const tile of colorTiles) {
        if (currentRun.length === 0) {
          currentRun.push(tile);
        } else {
          const lastTile = currentRun[currentRun.length - 1];
          if (tile.number === lastTile.number + 1) {
            currentRun.push(tile);
          } else if (tile.number !== lastTile.number) {
            // End of sequence, check if valid
            if (currentRun.length >= 3 && isValidSet(currentRun).valid) {
              runs.push([...currentRun]);
              for (const t of currentRun) {
                usedIds.add(t.id);
              }
            }
            currentRun = [tile];
          }
        }
      }

      // Check final run
      if (currentRun.length >= 3 && isValidSet(currentRun).valid) {
        runs.push(currentRun);
        for (const t of currentRun) {
          usedIds.add(t.id);
        }
      }
    }

    return runs;
  }
}
