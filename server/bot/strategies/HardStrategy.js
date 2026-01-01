// Hard Bot Strategy - Advanced table manipulation + optimal placement
import { isValidSet, validateTableState, calculateInitialMeldPoints } from '../../../common/rules.js';
import { TILE_COLORS } from '../../../common/constants.js';
import { MediumStrategy } from './MediumStrategy.js';

export class HardStrategy {
  constructor() {
    this.mediumStrategy = new MediumStrategy();
  }

  play(state) {
    const { playerTiles, tableSets, hasPlayedInitialMeld, rules } = state;

    // If no initial meld yet, delegate to medium strategy
    if (!hasPlayedInitialMeld) {
      return this.mediumStrategy.play(state);
    }

    // First try simple plays (new sets from hand + extending existing sets)
    const simpleResult = this.trySimplePlays(playerTiles, tableSets);
    if (simpleResult.tilesPlayed > 0) {
      // After simple plays, try table manipulation with remaining tiles
      const manipResult = this.tryAllManipulations(
        simpleResult.remainingTiles, 
        simpleResult.tableSets
      );
      
      if (manipResult.tilesPlayed > 0) {
        return {
          action: 'play',
          tableSets: manipResult.tableSets,
          playerTiles: manipResult.remainingTiles,
          tilesPlayed: simpleResult.tilesPlayed + manipResult.tilesPlayed,
          playedInitialMeld: false
        };
      }

      return {
        action: 'play',
        tableSets: simpleResult.tableSets,
        playerTiles: simpleResult.remainingTiles,
        tilesPlayed: simpleResult.tilesPlayed,
        playedInitialMeld: false
      };
    }

    // Try table manipulation to find a play
    const manipulationResult = this.tryAllManipulations(playerTiles, tableSets);
    
    if (manipulationResult.tilesPlayed > 0) {
      return {
        action: 'play',
        tableSets: manipulationResult.tableSets,
        playerTiles: manipulationResult.remainingTiles,
        tilesPlayed: manipulationResult.tilesPlayed,
        playedInitialMeld: false
      };
    }

    // Fall back to medium strategy
    return this.mediumStrategy.play(state);
  }

  trySimplePlays(playerTiles, tableSets) {
    let remainingTiles = [...playerTiles];
    let newTableSets = tableSets.map(s => [...s]);
    let tilesPlayed = 0;

    // Try to extend existing sets first
    const extendResult = this.extendExistingSets(remainingTiles, newTableSets);
    if (extendResult.tilesPlayed > 0) {
      remainingTiles = extendResult.remainingTiles;
      newTableSets = extendResult.tableSets;
      tilesPlayed += extendResult.tilesPlayed;
    }

    // Then try to play new sets from hand
    const newSetsResult = this.playNewSetsFromHand(remainingTiles, newTableSets);
    if (newSetsResult.tilesPlayed > 0) {
      remainingTiles = newSetsResult.remainingTiles;
      newTableSets = newSetsResult.tableSets;
      tilesPlayed += newSetsResult.tilesPlayed;
    }

    return { tableSets: newTableSets, remainingTiles, tilesPlayed };
  }

  extendExistingSets(playerTiles, tableSets) {
    let remainingTiles = [...playerTiles];
    let newTableSets = tableSets.map(s => [...s]);
    let tilesPlayed = 0;
    let changed = true;

    // Keep trying until no more extensions possible
    while (changed) {
      changed = false;

      for (let setIdx = 0; setIdx < newTableSets.length; setIdx++) {
        const set = newTableSets[setIdx];
        const result = isValidSet(set);
        if (!result.valid) continue;

        if (result.type === 'run') {
          // For runs, we need to understand the POSITION-based numbers
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

          // Try extending at start
          const numToAddStart = startNum - 1;
          if (numToAddStart >= 1) {
            const extendTile = remainingTiles.find(t => 
              !t.isJoker && t.color === color && t.number === numToAddStart
            );
            if (extendTile) {
              newTableSets[setIdx] = [extendTile, ...set];
              remainingTiles = remainingTiles.filter(t => t.id !== extendTile.id);
              tilesPlayed++;
              changed = true;
            }
          }

          // Try extending at end
          const numToAddEnd = endNum + 1;
          if (numToAddEnd <= 13) {
            const extendTile = remainingTiles.find(t => 
              !t.isJoker && t.color === color && t.number === numToAddEnd
            );
            if (extendTile) {
              newTableSets[setIdx] = [...newTableSets[setIdx], extendTile];
              remainingTiles = remainingTiles.filter(t => t.id !== extendTile.id);
              tilesPlayed++;
              changed = true;
            }
          }
        } else if (result.type === 'group' && set.length < 4) {
          // Try adding to group
          const regularTiles = set.filter(t => !t.isJoker);
          if (regularTiles.length === 0) continue;
          
          const number = regularTiles[0].number;
          const usedColors = new Set(regularTiles.map(t => t.color));

          const extendTile = remainingTiles.find(t => 
            !t.isJoker && t.number === number && !usedColors.has(t.color)
          );
          if (extendTile) {
            newTableSets[setIdx] = [...set, extendTile];
            remainingTiles = remainingTiles.filter(t => t.id !== extendTile.id);
            tilesPlayed++;
            changed = true;
          }
        }
      }
    }

    return { tableSets: newTableSets, remainingTiles, tilesPlayed };
  }

  playNewSetsFromHand(playerTiles, tableSets) {
    let remainingTiles = [...playerTiles];
    let newTableSets = [...tableSets];
    let tilesPlayed = 0;

    // Find all possible sets
    const possibleSets = this.findAllPossibleSets(remainingTiles);

    for (const set of possibleSets) {
      // Check all tiles still available
      const allAvailable = set.every(t => remainingTiles.some(rt => rt.id === t.id));
      if (!allAvailable) continue;

      if (isValidSet(set).valid) {
        newTableSets.push(set);
        for (const tile of set) {
          remainingTiles = remainingTiles.filter(t => t.id !== tile.id);
          tilesPlayed++;
        }
      }
    }

    return { tableSets: newTableSets, remainingTiles, tilesPlayed };
  }

  tryAllManipulations(playerTiles, tableSets) {
    let bestResult = {
      tableSets: tableSets.map(s => [...s]),
      remainingTiles: [...playerTiles],
      tilesPlayed: 0
    };

    // Try each player tile
    for (const tile of playerTiles) {
      // Strategy 1: Take end tile from a run to form new group
      const runEndResult = this.tryTakeRunEnd(tile, playerTiles, tableSets);
      if (runEndResult && runEndResult.tilesPlayed > bestResult.tilesPlayed) {
        bestResult = runEndResult;
      }

      // Strategy 2: Take tile from group (if group has 4) to form new set
      const groupTileResult = this.tryTakeFromGroup(tile, playerTiles, tableSets);
      if (groupTileResult && groupTileResult.tilesPlayed > bestResult.tilesPlayed) {
        bestResult = groupTileResult;
      }

      // Strategy 3: Split a long run to insert our tile
      const splitRunResult = this.trySplitRun(tile, playerTiles, tableSets);
      if (splitRunResult && splitRunResult.tilesPlayed > bestResult.tilesPlayed) {
        bestResult = splitRunResult;
      }

      // Strategy 4: Combine tiles from multiple sets with our tile
      const combineResult = this.tryCombineSets(tile, playerTiles, tableSets);
      if (combineResult && combineResult.tilesPlayed > bestResult.tilesPlayed) {
        bestResult = combineResult;
      }
    }

    return bestResult;
  }

  // Take end tile from a run to use in forming a new group with player's tile
  tryTakeRunEnd(playerTile, playerTiles, tableSets) {
    if (playerTile.isJoker) return null;

    for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
      const set = tableSets[setIdx];
      const result = isValidSet(set);
      if (result.type !== 'run' || set.length < 4) continue; // Need 4+ to take one

      const regularTiles = set.filter(t => !t.isJoker);
      if (regularTiles.length === 0) continue;

      const numbers = regularTiles.map(t => t.number).sort((a, b) => a - b);
      const minNum = Math.min(...numbers);
      const maxNum = Math.max(...numbers);

      // Try taking from start
      const startTile = set.find(t => !t.isJoker && t.number === minNum);
      if (startTile && startTile.number === playerTile.number && startTile.color !== playerTile.color) {
        // Can we form a group with these?
        const newSet = set.filter(t => t.id !== startTile.id);
        if (isValidSet(newSet).valid) {
          // Look for third tile (same number, different color)
          const thirdTile = playerTiles.find(t => 
            t.id !== playerTile.id && 
            !t.isJoker && 
            t.number === playerTile.number && 
            t.color !== playerTile.color && 
            t.color !== startTile.color
          );

          if (thirdTile) {
            const newGroup = [playerTile, startTile, thirdTile];
            if (isValidSet(newGroup).valid) {
              const newTableSets = tableSets.map((s, idx) => 
                idx === setIdx ? newSet : [...s]
              );
              newTableSets.push(newGroup);

              if (validateTableState(newTableSets).valid) {
                return {
                  tableSets: newTableSets,
                  remainingTiles: playerTiles.filter(t => 
                    t.id !== playerTile.id && t.id !== thirdTile.id
                  ),
                  tilesPlayed: 2
                };
              }
            }
          }

          // Try with just player tile + table tile (need to find more)
          const otherTableTiles = this.findMatchingTilesOnTable(
            playerTile.number, 
            [playerTile.color, startTile.color],
            tableSets,
            setIdx
          );

          if (otherTableTiles.length >= 1) {
            const newGroup = [playerTile, startTile, otherTableTiles[0].tile];
            if (isValidSet(newGroup).valid) {
              // Remove borrowed tile from its set
              const modifiedSets = this.removeFromSet(
                tableSets, 
                otherTableTiles[0].setIdx, 
                otherTableTiles[0].tile
              );
              if (modifiedSets) {
                modifiedSets[setIdx] = newSet;
                modifiedSets.push(newGroup);
                if (validateTableState(modifiedSets).valid) {
                  return {
                    tableSets: modifiedSets,
                    remainingTiles: playerTiles.filter(t => t.id !== playerTile.id),
                    tilesPlayed: 1
                  };
                }
              }
            }
          }
        }
      }

      // Try taking from end
      const endTile = set.find(t => !t.isJoker && t.number === maxNum);
      if (endTile && endTile.number === playerTile.number && endTile.color !== playerTile.color) {
        const newSet = set.filter(t => t.id !== endTile.id);
        if (isValidSet(newSet).valid) {
          const thirdTile = playerTiles.find(t => 
            t.id !== playerTile.id && 
            !t.isJoker && 
            t.number === playerTile.number && 
            t.color !== playerTile.color && 
            t.color !== endTile.color
          );

          if (thirdTile) {
            const newGroup = [playerTile, endTile, thirdTile];
            if (isValidSet(newGroup).valid) {
              const newTableSets = tableSets.map((s, idx) => 
                idx === setIdx ? newSet : [...s]
              );
              newTableSets.push(newGroup);

              if (validateTableState(newTableSets).valid) {
                return {
                  tableSets: newTableSets,
                  remainingTiles: playerTiles.filter(t => 
                    t.id !== playerTile.id && t.id !== thirdTile.id
                  ),
                  tilesPlayed: 2
                };
              }
            }
          }
        }
      }
    }

    return null;
  }

  // Take a tile from a 4-tile group
  tryTakeFromGroup(playerTile, playerTiles, tableSets) {
    if (playerTile.isJoker) return null;

    for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
      const set = tableSets[setIdx];
      const result = isValidSet(set);
      if (result.type !== 'group' || set.length < 4) continue;

      // Find a tile we can take
      for (const tableTile of set) {
        if (tableTile.isJoker) continue;

        const remainingGroup = set.filter(t => t.id !== tableTile.id);
        if (!isValidSet(remainingGroup).valid) continue;

        // Can we use this tile with our player tile?
        // Try to form a run
        if (tableTile.color === playerTile.color) {
          const diff = Math.abs(tableTile.number - playerTile.number);
          if (diff === 1 || diff === 2) {
            // Might be able to form a run
            const neededNumber = diff === 2 
              ? Math.min(tableTile.number, playerTile.number) + 1
              : (tableTile.number < playerTile.number ? tableTile.number - 1 : playerTile.number - 1);

            const thirdTile = playerTiles.find(t => 
              t.id !== playerTile.id && 
              !t.isJoker && 
              t.color === playerTile.color && 
              t.number === neededNumber
            );

            if (thirdTile) {
              const newRun = [playerTile, tableTile, thirdTile].sort((a, b) => a.number - b.number);
              if (isValidSet(newRun).valid) {
                const newTableSets = tableSets.map((s, idx) => 
                  idx === setIdx ? remainingGroup : [...s]
                );
                newTableSets.push(newRun);

                if (validateTableState(newTableSets).valid) {
                  return {
                    tableSets: newTableSets,
                    remainingTiles: playerTiles.filter(t => 
                      t.id !== playerTile.id && t.id !== thirdTile.id
                    ),
                    tilesPlayed: 2
                  };
                }
              }
            }
          }
        }

        // Try to form a group
        if (tableTile.number === playerTile.number && tableTile.color !== playerTile.color) {
          const thirdTile = playerTiles.find(t => 
            t.id !== playerTile.id && 
            !t.isJoker && 
            t.number === playerTile.number && 
            t.color !== playerTile.color && 
            t.color !== tableTile.color
          );

          if (thirdTile) {
            const newGroup = [playerTile, tableTile, thirdTile];
            if (isValidSet(newGroup).valid) {
              const newTableSets = tableSets.map((s, idx) => 
                idx === setIdx ? remainingGroup : [...s]
              );
              newTableSets.push(newGroup);

              if (validateTableState(newTableSets).valid) {
                return {
                  tableSets: newTableSets,
                  remainingTiles: playerTiles.filter(t => 
                    t.id !== playerTile.id && t.id !== thirdTile.id
                  ),
                  tilesPlayed: 2
                };
              }
            }
          }
        }
      }
    }

    return null;
  }

  // Split a run to insert our tile in the middle
  trySplitRun(playerTile, playerTiles, tableSets) {
    if (playerTile.isJoker) return null;

    for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
      const set = tableSets[setIdx];
      const result = isValidSet(set);
      if (result.type !== 'run') continue;

      const regularTiles = set.filter(t => !t.isJoker);
      if (regularTiles.length === 0) continue;
      
      const color = regularTiles[0].color;
      if (playerTile.color !== color) continue;

      const sortedSet = [...set].sort((a, b) => {
        const aNum = a.isJoker ? -1 : a.number;
        const bNum = b.isJoker ? -1 : b.number;
        return aNum - bNum;
      });

      const numbers = regularTiles.map(t => t.number).sort((a, b) => a - b);
      const minNum = Math.min(...numbers);
      const maxNum = Math.max(...numbers);

      // Check if our tile can extend either split half
      // We need set.length >= 6 to split into two valid sets of 3+
      if (set.length >= 6) {
        // Try different split points
        for (let splitAt = 3; splitAt <= set.length - 3; splitAt++) {
          const firstHalf = set.slice(0, splitAt);
          const secondHalf = set.slice(splitAt);

          if (!isValidSet(firstHalf).valid || !isValidSet(secondHalf).valid) continue;

          // Can we extend one half with our tile?
          const firstNums = firstHalf.filter(t => !t.isJoker).map(t => t.number);
          const secondNums = secondHalf.filter(t => !t.isJoker).map(t => t.number);

          if (firstNums.length > 0 && playerTile.number === Math.max(...firstNums) + 1) {
            const newFirst = [...firstHalf, playerTile];
            if (isValidSet(newFirst).valid) {
              const newTableSets = tableSets.filter((_, idx) => idx !== setIdx);
              newTableSets.push(newFirst);
              newTableSets.push(secondHalf);

              if (validateTableState(newTableSets).valid) {
                return {
                  tableSets: newTableSets,
                  remainingTiles: playerTiles.filter(t => t.id !== playerTile.id),
                  tilesPlayed: 1
                };
              }
            }
          }

          if (secondNums.length > 0 && playerTile.number === Math.min(...secondNums) - 1) {
            const newSecond = [playerTile, ...secondHalf];
            if (isValidSet(newSecond).valid) {
              const newTableSets = tableSets.filter((_, idx) => idx !== setIdx);
              newTableSets.push(firstHalf);
              newTableSets.push(newSecond);

              if (validateTableState(newTableSets).valid) {
                return {
                  tableSets: newTableSets,
                  remainingTiles: playerTiles.filter(t => t.id !== playerTile.id),
                  tilesPlayed: 1
                };
              }
            }
          }
        }
      }
    }

    return null;
  }

  // Try to combine tiles from multiple table sets with player tile
  tryCombineSets(playerTile, playerTiles, tableSets) {
    if (playerTile.isJoker) return null;

    // Look for tiles on table that match our tile's number (for groups)
    const matchingTiles = [];
    
    for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
      const set = tableSets[setIdx];
      
      for (const tile of set) {
        if (tile.isJoker) continue;
        if (tile.number === playerTile.number && tile.color !== playerTile.color) {
          // Check if we can safely remove this tile
          const remaining = set.filter(t => t.id !== tile.id);
          if (remaining.length >= 3 && isValidSet(remaining).valid) {
            matchingTiles.push({ tile, setIdx, remaining });
          } else if (remaining.length === 0) {
            // Set would be consumed entirely
            matchingTiles.push({ tile, setIdx, remaining: null });
          }
        }
      }
    }

    // Need at least 2 matching tiles to form a group with player tile
    if (matchingTiles.length >= 2) {
      const usedColors = new Set([playerTile.color]);
      const selectedTiles = [];

      for (const match of matchingTiles) {
        if (!usedColors.has(match.tile.color)) {
          usedColors.add(match.tile.color);
          selectedTiles.push(match);
          if (selectedTiles.length >= 2) break;
        }
      }

      if (selectedTiles.length >= 2) {
        const newGroup = [playerTile, ...selectedTiles.map(m => m.tile)];
        if (isValidSet(newGroup).valid) {
          // Build new table state
          const newTableSets = [];
          const removedSetIndices = new Set(selectedTiles.map(m => m.setIdx));

          for (let i = 0; i < tableSets.length; i++) {
            if (removedSetIndices.has(i)) {
              const match = selectedTiles.find(m => m.setIdx === i);
              if (match.remaining && match.remaining.length >= 3) {
                newTableSets.push(match.remaining);
              }
            } else {
              newTableSets.push([...tableSets[i]]);
            }
          }

          newTableSets.push(newGroup);

          if (validateTableState(newTableSets).valid) {
            return {
              tableSets: newTableSets,
              remainingTiles: playerTiles.filter(t => t.id !== playerTile.id),
              tilesPlayed: 1
            };
          }
        }
      }
    }

    return null;
  }

  findMatchingTilesOnTable(number, excludeColors, tableSets, excludeSetIdx) {
    const matches = [];
    const excludeSet = new Set(excludeColors);

    for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
      if (setIdx === excludeSetIdx) continue;
      
      const set = tableSets[setIdx];
      for (const tile of set) {
        if (tile.isJoker) continue;
        if (tile.number === number && !excludeSet.has(tile.color)) {
          // Check if removable
          const remaining = set.filter(t => t.id !== tile.id);
          if (remaining.length >= 3 && isValidSet(remaining).valid) {
            matches.push({ tile, setIdx, remaining });
          }
        }
      }
    }

    return matches;
  }

  removeFromSet(tableSets, setIdx, tile) {
    const set = tableSets[setIdx];
    const remaining = set.filter(t => t.id !== tile.id);
    
    if (remaining.length < 3) return null;
    if (!isValidSet(remaining).valid) return null;

    return tableSets.map((s, idx) => 
      idx === setIdx ? remaining : [...s]
    );
  }

  findAllPossibleSets(tiles) {
    const sets = [];
    
    // Find groups
    const byNumber = {};
    for (const tile of tiles) {
      if (tile.isJoker) continue;
      if (!byNumber[tile.number]) byNumber[tile.number] = [];
      byNumber[tile.number].push(tile);
    }

    for (const number in byNumber) {
      const tilesOfNumber = byNumber[number];
      const byColor = {};
      for (const tile of tilesOfNumber) {
        if (!byColor[tile.color]) byColor[tile.color] = tile;
      }
      const uniqueColorTiles = Object.values(byColor);
      if (uniqueColorTiles.length >= 3) {
        sets.push(uniqueColorTiles.slice(0, Math.min(4, uniqueColorTiles.length)));
      }
    }

    // Find runs
    const colors = Object.values(TILE_COLORS);
    for (const color of colors) {
      const colorTiles = tiles
        .filter(t => !t.isJoker && t.color === color)
        .sort((a, b) => a.number - b.number);

      // Remove duplicates
      const unique = [];
      const seen = new Set();
      for (const t of colorTiles) {
        if (!seen.has(t.number)) {
          seen.add(t.number);
          unique.push(t);
        }
      }

      // Find consecutive runs
      for (let start = 0; start < unique.length - 2; start++) {
        let run = [unique[start]];
        for (let i = start + 1; i < unique.length; i++) {
          if (unique[i].number === run[run.length - 1].number + 1) {
            run.push(unique[i]);
          } else {
            break;
          }
        }
        if (run.length >= 3) {
          sets.push(run);
        }
      }
    }

    return sets;
  }
}
