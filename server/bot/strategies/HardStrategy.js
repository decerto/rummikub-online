// Hard Bot Strategy - Expert AI with look-ahead, cascade plays, and strategic joker usage
// This bot is designed to be a real challenge for experienced players
import { isValidSet, validateTableState, calculateInitialMeldPoints } from '../../../common/rules.js';
import { TILE_COLORS } from '../../../common/constants.js';
import { MediumStrategy } from './MediumStrategy.js';

export class HardStrategy {
  constructor() {
    this.mediumStrategy = new MediumStrategy();
    // Balanced for ~5-15 second turns - smart but responsive
    this.maxSearchDepth = 200;      // Starting moves to evaluate in look-ahead
    this.maxCombinations = 10000;    // Set combinations to explore (main compute cost)
    this.maxIterations = 2000;       // Cascade play attempts per strategy
    this.explorationDepth = 100;     // Depth per starting move (lower = faster, breadth > depth)
  }

  play(state) {
    const { playerTiles, tableSets, hasPlayedInitialMeld, rules } = state;

    // If no initial meld yet, try optimal initial meld strategy
    if (!hasPlayedInitialMeld) {
      const initialMeldResult = this.findOptimalInitialMeld(playerTiles, tableSets, rules);
      if (initialMeldResult) {
        return initialMeldResult;
      }
      // Try medium strategy fallback (which uses easy strategy for initial melds)
      const fallbackResult = this.mediumStrategy.play(state);
      if (fallbackResult.action === 'play') {
        return fallbackResult;
      }
      // If still no play, draw
      return { action: 'draw' };
    }

    // Main strategy: Find the best possible play using look-ahead
    const bestPlay = this.findBestPlay(playerTiles, tableSets);
    
    if (bestPlay && bestPlay.tilesPlayed > 0) {
      return {
        action: 'play',
        tableSets: bestPlay.tableSets,
        playerTiles: bestPlay.remainingTiles,
        tilesPlayed: bestPlay.tilesPlayed,
        playedInitialMeld: false
      };
    }

    return { action: 'draw' };
  }

  // Find the best play considering multiple strategies and look-ahead
  findBestPlay(playerTiles, tableSets) {
    const candidates = [];

    // Strategy 1: Exhaustive table rearrangement search (new!)
    const exhaustiveResult = this.tryExhaustiveRearrangement(playerTiles, tableSets);
    if (exhaustiveResult) candidates.push(exhaustiveResult);

    // Strategy 2: Reclaim jokers first, then cascade
    const reclaimFirst = this.tryReclaimThenCascade(playerTiles, tableSets);
    if (reclaimFirst) candidates.push(reclaimFirst);

    // Strategy 3: Multi-set plays from hand
    const multiSetPlay = this.tryMultiSetPlay(playerTiles, tableSets);
    if (multiSetPlay) candidates.push(multiSetPlay);

    // Strategy 4: Deep table manipulation with look-ahead
    const deepManip = this.tryDeepManipulation(playerTiles, tableSets);
    if (deepManip) candidates.push(deepManip);

    // Strategy 5: Multi-step look-ahead simulation (new!)
    const lookAheadResult = this.tryLookAheadSimulation(playerTiles, tableSets);
    if (lookAheadResult) candidates.push(lookAheadResult);

    // Strategy 6: Joker-powered plays
    const jokerPlay = this.tryJokerPoweredPlay(playerTiles, tableSets);
    if (jokerPlay) candidates.push(jokerPlay);

    // Strategy 7: Chain manipulation (take from multiple sets)
    const chainManip = this.tryChainManipulation(playerTiles, tableSets);
    if (chainManip) candidates.push(chainManip);

    // Strategy 8: Decompose and rebuild table sets (new!)
    const decomposeResult = this.tryDecomposeAndRebuild(playerTiles, tableSets);
    if (decomposeResult) candidates.push(decomposeResult);

    // Strategy 9: Medium strategy fallback
    const mediumPlay = this.mediumStrategy.play({
      playerTiles,
      tableSets,
      hasPlayedInitialMeld: true,
      rules: {}
    });
    if (mediumPlay.action === 'play') {
      candidates.push({
        tableSets: mediumPlay.tableSets,
        remainingTiles: mediumPlay.playerTiles,
        tilesPlayed: mediumPlay.tilesPlayed,
        score: this.evaluatePlay(mediumPlay.playerTiles, mediumPlay.tableSets)
      });
    }

    if (candidates.length === 0) return null;

    // Score each candidate and pick the best
    for (const candidate of candidates) {
      if (candidate.score === undefined) {
        candidate.score = this.evaluatePlay(candidate.remainingTiles, candidate.tableSets);
      }
    }

    // Sort by score (higher is better) - prioritize emptying hand
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  // Evaluate a play based on hand quality after the play
  evaluatePlay(remainingTiles, tableSets) {
    let score = 0;
    
    // Huge bonus for playing tiles (each tile played is worth a lot)
    const tilesPlayed = 14 - remainingTiles.length; // Assuming start with ~14
    score += tilesPlayed * 100;

    // Bonus for having jokers remaining (they're valuable)
    const jokersInHand = remainingTiles.filter(t => t.isJoker).length;
    score += jokersInHand * 20;

    // Bonus for potential sets in remaining hand
    const potentialSets = this.findAllPotentialSets(remainingTiles);
    score += potentialSets.length * 15;

    // Penalty for high-value tiles stuck in hand
    for (const tile of remainingTiles) {
      if (!tile.isJoker) {
        score -= tile.number; // Higher numbers are worse to keep
      }
    }

    // Bonus if close to winning
    if (remainingTiles.length <= 3) score += 200;
    if (remainingTiles.length <= 1) score += 500;
    if (remainingTiles.length === 0) score += 10000; // Win!

    return score;
  }

  // Try to reclaim jokers from table, then cascade into more plays
  tryReclaimThenCascade(playerTiles, tableSets) {
    let currentTiles = [...playerTiles];
    let currentSets = tableSets.map(s => [...s]);
    let totalPlayed = 0;

    // Phase 1: Reclaim all possible jokers
    let jokersReclaimed = true;
    while (jokersReclaimed) {
      jokersReclaimed = false;
      const result = this.tryReclaimOneJoker(currentTiles, currentSets);
      if (result) {
        currentTiles = result.remainingTiles;
        currentSets = result.tableSets;
        jokersReclaimed = true;
      }
    }

    // Phase 2: Cascade plays with our new jokers
    let madePlay = true;
    let iterations = 0;
    while (madePlay && iterations < this.maxIterations) {
      madePlay = false;
      iterations++;

      // Try playing new sets
      const newSetResult = this.tryPlayBestNewSet(currentTiles, currentSets);
      if (newSetResult) {
        totalPlayed += newSetResult.tilesPlayed;
        currentTiles = newSetResult.remainingTiles;
        currentSets = newSetResult.tableSets;
        madePlay = true;
        continue;
      }

      // Try extending sets
      const extendResult = this.tryExtendAnySets(currentTiles, currentSets);
      if (extendResult) {
        totalPlayed += extendResult.tilesPlayed;
        currentTiles = extendResult.remainingTiles;
        currentSets = extendResult.tableSets;
        madePlay = true;
        continue;
      }

      // Try table manipulation
      const manipResult = this.trySingleManipulation(currentTiles, currentSets);
      if (manipResult) {
        totalPlayed += manipResult.tilesPlayed;
        currentTiles = manipResult.remainingTiles;
        currentSets = manipResult.tableSets;
        madePlay = true;
      }
    }

    if (totalPlayed > 0 && validateTableState(currentSets).valid) {
      return { tableSets: currentSets, remainingTiles: currentTiles, tilesPlayed: totalPlayed };
    }
    return null;
  }

  // Reclaim one joker from the table
  tryReclaimOneJoker(playerTiles, tableSets) {
    for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
      const set = tableSets[setIdx];
      for (let tileIdx = 0; tileIdx < set.length; tileIdx++) {
        if (!set[tileIdx].isJoker) continue;

        const result = isValidSet(set);
        if (!result.valid) continue;

        const replacementTile = this.findJokerReplacement(set, tileIdx, playerTiles, result.type);
        if (replacementTile) {
          const newSets = tableSets.map(s => [...s]);
          const joker = newSets[setIdx][tileIdx];
          newSets[setIdx][tileIdx] = replacementTile;

          if (validateTableState(newSets).valid) {
            const newTiles = playerTiles.filter(t => t.id !== replacementTile.id);
            newTiles.push(joker);
            return { tableSets: newSets, remainingTiles: newTiles };
          }
        }
      }
    }
    return null;
  }

  findJokerReplacement(set, jokerIdx, playerTiles, setType) {
    const nonJokers = set.filter(t => !t.isJoker);
    if (nonJokers.length === 0) return null;

    if (setType === 'run') {
      const color = nonJokers[0].color;
      const anchorPos = set.findIndex(t => !t.isJoker);
      const anchorNum = set[anchorPos].number;
      const jokerNum = anchorNum + (jokerIdx - anchorPos);

      return playerTiles.find(t => 
        !t.isJoker && t.color === color && t.number === jokerNum
      );
    } else {
      const number = nonJokers[0].number;
      const usedColors = new Set(nonJokers.map(t => t.color));
      return playerTiles.find(t => 
        !t.isJoker && t.number === number && !usedColors.has(t.color)
      );
    }
  }

  // Try playing multiple sets at once from hand
  tryMultiSetPlay(playerTiles, tableSets) {
    const allSets = this.findAllPotentialSets(playerTiles);
    if (allSets.length === 0) return null;

    // Find the best combination of non-overlapping sets
    const bestCombos = this.findBestSetCombinations(allSets, playerTiles, 4);
    
    if (bestCombos.length === 0) return null;

    // Pick the combo that plays the most tiles
    const bestCombo = bestCombos.reduce((best, curr) => {
      const bestCount = best.reduce((sum, s) => sum + s.length, 0);
      const currCount = curr.reduce((sum, s) => sum + s.length, 0);
      return currCount > bestCount ? curr : best;
    });

    const usedIds = new Set();
    for (const set of bestCombo) {
      for (const tile of set) usedIds.add(tile.id);
    }

    const newSets = [...tableSets.map(s => [...s]), ...bestCombo];
    
    if (validateTableState(newSets).valid) {
      return {
        tableSets: newSets,
        remainingTiles: playerTiles.filter(t => !usedIds.has(t.id)),
        tilesPlayed: usedIds.size
      };
    }

    return null;
  }

  // Find combinations of sets that don't share tiles
  findBestSetCombinations(sets, playerTiles, maxSets) {
    const validSets = sets.filter(s => isValidSet(s).valid);
    const combos = [];

    // Single sets
    for (const set of validSets) {
      if (this.tilesAvailable(set, playerTiles)) {
        combos.push([set]);
      }
    }

    // Pairs
    for (let i = 0; i < validSets.length && combos.length < this.maxCombinations; i++) {
      for (let j = i + 1; j < validSets.length && combos.length < this.maxCombinations; j++) {
        if (!this.setsShareTiles(validSets[i], validSets[j])) {
          const combined = [validSets[i], validSets[j]];
          if (this.tilesAvailable([...combined[0], ...combined[1]], playerTiles)) {
            combos.push(combined);
          }
        }
      }
    }

    // Triples
    for (let i = 0; i < validSets.length && combos.length < this.maxCombinations; i++) {
      for (let j = i + 1; j < validSets.length && combos.length < this.maxCombinations; j++) {
        for (let k = j + 1; k < validSets.length && combos.length < this.maxCombinations; k++) {
          if (!this.setsShareTiles(validSets[i], validSets[j]) &&
              !this.setsShareTiles(validSets[i], validSets[k]) &&
              !this.setsShareTiles(validSets[j], validSets[k])) {
            const combined = [validSets[i], validSets[j], validSets[k]];
            const allTiles = [...combined[0], ...combined[1], ...combined[2]];
            if (this.tilesAvailable(allTiles, playerTiles)) {
              combos.push(combined);
            }
          }
        }
      }
    }

    // Quadruples (4 sets) - important for reaching 30 points with small sets
    if (maxSets >= 4) {
      for (let i = 0; i < validSets.length && combos.length < this.maxCombinations; i++) {
        for (let j = i + 1; j < validSets.length && combos.length < this.maxCombinations; j++) {
          if (this.setsShareTiles(validSets[i], validSets[j])) continue;
          for (let k = j + 1; k < validSets.length && combos.length < this.maxCombinations; k++) {
            if (this.setsShareTiles(validSets[i], validSets[k]) || 
                this.setsShareTiles(validSets[j], validSets[k])) continue;
            for (let l = k + 1; l < validSets.length && combos.length < this.maxCombinations; l++) {
              if (!this.setsShareTiles(validSets[i], validSets[l]) &&
                  !this.setsShareTiles(validSets[j], validSets[l]) &&
                  !this.setsShareTiles(validSets[k], validSets[l])) {
                const combined = [validSets[i], validSets[j], validSets[k], validSets[l]];
                const allTiles = combined.flat();
                if (this.tilesAvailable(allTiles, playerTiles)) {
                  combos.push(combined);
                }
              }
            }
          }
        }
      }
    }

    // Quintuples (5 sets) - for really spread out hands
    if (maxSets >= 5) {
      for (let i = 0; i < Math.min(validSets.length, 20) && combos.length < this.maxCombinations; i++) {
        for (let j = i + 1; j < Math.min(validSets.length, 25) && combos.length < this.maxCombinations; j++) {
          if (this.setsShareTiles(validSets[i], validSets[j])) continue;
          for (let k = j + 1; k < Math.min(validSets.length, 30) && combos.length < this.maxCombinations; k++) {
            if (this.setsShareTiles(validSets[i], validSets[k]) || 
                this.setsShareTiles(validSets[j], validSets[k])) continue;
            for (let l = k + 1; l < Math.min(validSets.length, 35) && combos.length < this.maxCombinations; l++) {
              if (this.setsShareTiles(validSets[i], validSets[l]) ||
                  this.setsShareTiles(validSets[j], validSets[l]) ||
                  this.setsShareTiles(validSets[k], validSets[l])) continue;
              for (let m = l + 1; m < validSets.length && combos.length < this.maxCombinations; m++) {
                if (!this.setsShareTiles(validSets[i], validSets[m]) &&
                    !this.setsShareTiles(validSets[j], validSets[m]) &&
                    !this.setsShareTiles(validSets[k], validSets[m]) &&
                    !this.setsShareTiles(validSets[l], validSets[m])) {
                  const combined = [validSets[i], validSets[j], validSets[k], validSets[l], validSets[m]];
                  const allTiles = combined.flat();
                  if (this.tilesAvailable(allTiles, playerTiles)) {
                    combos.push(combined);
                  }
                }
              }
            }
          }
        }
      }
    }

    return combos;
  }

  tilesAvailable(tiles, playerTiles) {
    const usedIds = new Set();
    for (const tile of tiles) {
      if (usedIds.has(tile.id)) return false;
      if (!playerTiles.some(t => t.id === tile.id)) return false;
      usedIds.add(tile.id);
    }
    return true;
  }

  setsShareTiles(set1, set2) {
    const ids1 = new Set(set1.map(t => t.id));
    return set2.some(t => ids1.has(t.id));
  }

  // Deep manipulation: try multiple table manipulations together
  tryDeepManipulation(playerTiles, tableSets) {
    let bestResult = null;
    let bestTilesPlayed = 0;

    for (const tile of playerTiles) {
      if (tile.isJoker) continue;

      // Try each manipulation strategy
      const strategies = [
        () => this.tryInsertIntoRun(tile, playerTiles, tableSets),
        () => this.tryFormGroupFromTable(tile, playerTiles, tableSets),
        () => this.trySplitAndInsert(tile, playerTiles, tableSets),
        () => this.tryReorganizeForTile(tile, playerTiles, tableSets)
      ];

      for (const strategy of strategies) {
        const result = strategy();
        if (result && result.tilesPlayed > bestTilesPlayed) {
          // Try to cascade more plays after this manipulation
          const cascadeResult = this.tryCascadePlays(result.remainingTiles, result.tableSets);
          const totalPlayed = result.tilesPlayed + (cascadeResult?.tilesPlayed || 0);
          
          if (totalPlayed > bestTilesPlayed) {
            bestTilesPlayed = totalPlayed;
            bestResult = cascadeResult || result;
            bestResult.tilesPlayed = totalPlayed;
          }
        }
      }
    }

    return bestResult;
  }

  // Try to insert a tile into an existing run by splitting it
  tryInsertIntoRun(tile, playerTiles, tableSets) {
    for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
      const set = tableSets[setIdx];
      const result = isValidSet(set);
      if (result.type !== 'run' || set.length < 6) continue;

      const nonJokers = set.filter(t => !t.isJoker);
      if (nonJokers.length === 0) continue;
      
      const color = nonJokers[0].color;
      if (tile.color !== color) continue;

      // Calculate run range
      const anchorPos = set.findIndex(t => !t.isJoker);
      const anchorNum = set[anchorPos].number;
      const startNum = anchorNum - anchorPos;
      const endNum = startNum + set.length - 1;

      // Can we split and insert?
      for (let splitAt = 3; splitAt <= set.length - 3; splitAt++) {
        const splitNum = startNum + splitAt - 1;
        
        if (tile.number === splitNum + 1) {
          // Tile can be inserted between the two halves
          const firstHalf = set.slice(0, splitAt);
          const secondHalf = set.slice(splitAt);

          if (isValidSet(firstHalf).valid && isValidSet(secondHalf).valid) {
            // Add tile to end of first half or start of second
            const newFirst = [...firstHalf, tile];
            if (isValidSet(newFirst).valid) {
              const newSets = tableSets.filter((_, i) => i !== setIdx);
              newSets.push(newFirst, secondHalf);

              if (validateTableState(newSets).valid) {
                return {
                  tableSets: newSets,
                  remainingTiles: playerTiles.filter(t => t.id !== tile.id),
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

  // Try to form a group by taking tiles from the table
  tryFormGroupFromTable(tile, playerTiles, tableSets) {
    if (tile.isJoker) return null;

    const matchingTableTiles = [];
    const setIndices = [];

    // Find all table tiles with the same number (different colors)
    for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
      const set = tableSets[setIdx];
      const result = isValidSet(set);
      if (!result.valid) continue;

      for (let tileIdx = 0; tileIdx < set.length; tileIdx++) {
        const tableTile = set[tileIdx];
        if (tableTile.isJoker) continue;
        if (tableTile.number !== tile.number) continue;
        if (tableTile.color === tile.color) continue;

        // Check if we can take this tile
        const remainingSet = set.filter((_, i) => i !== tileIdx);
        if (remainingSet.length >= 3 && isValidSet(remainingSet).valid) {
          matchingTableTiles.push({ tile: tableTile, setIdx, tileIdx });
        } else if (result.type === 'group' && set.length === 4) {
          // Can take from a group of 4
          matchingTableTiles.push({ tile: tableTile, setIdx, tileIdx });
        }
      }
    }

    // Need at least 2 matching tiles to form a group of 3 with our tile
    if (matchingTableTiles.length >= 2) {
      // Take the first 2 (or 3) to form a group
      const toTake = matchingTableTiles.slice(0, Math.min(3, matchingTableTiles.length));
      
      // Ensure different colors
      const colors = new Set([tile.color]);
      const filtered = toTake.filter(t => {
        if (colors.has(t.tile.color)) return false;
        colors.add(t.tile.color);
        return true;
      });

      if (filtered.length >= 2) {
        const newSets = tableSets.map(s => [...s]);
        const newGroup = [tile];

        // Remove tiles from their original sets
        const setsToRemoveFrom = new Map();
        for (const { tile: tableTile, setIdx, tileIdx } of filtered) {
          if (!setsToRemoveFrom.has(setIdx)) {
            setsToRemoveFrom.set(setIdx, []);
          }
          setsToRemoveFrom.get(setIdx).push(tileIdx);
          newGroup.push(tableTile);
        }

        // Apply removals (in reverse order to preserve indices)
        for (const [setIdx, indices] of setsToRemoveFrom) {
          indices.sort((a, b) => b - a);
          for (const idx of indices) {
            newSets[setIdx] = newSets[setIdx].filter((_, i) => i !== idx);
          }
        }

        // Remove empty sets
        const finalSets = newSets.filter(s => s.length > 0);
        finalSets.push(newGroup);

        if (validateTableState(finalSets).valid) {
          return {
            tableSets: finalSets,
            remainingTiles: playerTiles.filter(t => t.id !== tile.id),
            tilesPlayed: 1
          };
        }
      }
    }

    return null;
  }

  // Split a run and insert our tile
  trySplitAndInsert(tile, playerTiles, tableSets) {
    for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
      const set = tableSets[setIdx];
      const result = isValidSet(set);
      if (result.type !== 'run') continue;

      const nonJokers = set.filter(t => !t.isJoker);
      if (nonJokers.length === 0) continue;
      
      const color = nonJokers[0].color;
      if (tile.isJoker || tile.color !== color) continue;

      // Find where our tile could fit
      const anchorPos = set.findIndex(t => !t.isJoker);
      const anchorNum = set[anchorPos].number;
      const startNum = anchorNum - anchorPos;
      const endNum = startNum + set.length - 1;

      // Check if tile fits at start
      if (tile.number === startNum - 1) {
        const newSet = [tile, ...set];
        if (isValidSet(newSet).valid) {
          const newSets = tableSets.map((s, i) => i === setIdx ? newSet : [...s]);
          if (validateTableState(newSets).valid) {
            return {
              tableSets: newSets,
              remainingTiles: playerTiles.filter(t => t.id !== tile.id),
              tilesPlayed: 1
            };
          }
        }
      }

      // Check if tile fits at end
      if (tile.number === endNum + 1) {
        const newSet = [...set, tile];
        if (isValidSet(newSet).valid) {
          const newSets = tableSets.map((s, i) => i === setIdx ? newSet : [...s]);
          if (validateTableState(newSets).valid) {
            return {
              tableSets: newSets,
              remainingTiles: playerTiles.filter(t => t.id !== tile.id),
              tilesPlayed: 1
            };
          }
        }
      }
    }
    return null;
  }

  // Try reorganizing multiple sets to accommodate a tile
  tryReorganizeForTile(tile, playerTiles, tableSets) {
    if (tile.isJoker) return null;

    // Look for opportunities to take ends from runs and combine with our tile
    for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
      const set = tableSets[setIdx];
      const result = isValidSet(set);
      if (result.type !== 'run' || set.length < 4) continue;

      const nonJokers = set.filter(t => !t.isJoker);
      if (nonJokers.length === 0) continue;

      // Try taking the end tile to form a group with our tile
      const endTile = set[set.length - 1];
      const startTile = set[0];

      for (const target of [endTile, startTile]) {
        if (target.isJoker) continue;
        if (target.number !== tile.number) continue;
        if (target.color === tile.color) continue;

        // Find a third tile from hand or another set
        const thirdFromHand = playerTiles.find(t =>
          !t.isJoker && t.id !== tile.id &&
          t.number === tile.number && t.color !== tile.color && t.color !== target.color
        );

        if (thirdFromHand) {
          const newSets = tableSets.map(s => [...s]);
          
          // Remove the target tile from its set
          if (target === endTile) {
            newSets[setIdx] = set.slice(0, -1);
          } else {
            newSets[setIdx] = set.slice(1);
          }

          // Validate the shortened set
          if (newSets[setIdx].length >= 3 && isValidSet(newSets[setIdx]).valid) {
            const newGroup = [tile, target, thirdFromHand];
            newSets.push(newGroup);

            if (validateTableState(newSets).valid) {
              return {
                tableSets: newSets,
                remainingTiles: playerTiles.filter(t => t.id !== tile.id && t.id !== thirdFromHand.id),
                tilesPlayed: 2
              };
            }
          }
        }
      }
    }

    return null;
  }

  // Cascade plays after an initial manipulation - now with more iterations and manipulation attempts
  tryCascadePlays(playerTiles, tableSets) {
    let currentTiles = [...playerTiles];
    let currentSets = tableSets.map(s => [...s]);
    let totalPlayed = 0;
    let iterations = 0;

    while (iterations < this.maxIterations) {
      iterations++;
      let madProgress = false;

      // Try playing new sets
      const newSetResult = this.tryPlayBestNewSet(currentTiles, currentSets);
      if (newSetResult) {
        totalPlayed += newSetResult.tilesPlayed;
        currentTiles = newSetResult.remainingTiles;
        currentSets = newSetResult.tableSets;
        madProgress = true;
        continue; // Restart the loop to try more
      }

      // Try extending
      const extendResult = this.tryExtendAnySets(currentTiles, currentSets);
      if (extendResult) {
        totalPlayed += extendResult.tilesPlayed;
        currentTiles = extendResult.remainingTiles;
        currentSets = extendResult.tableSets;
        madProgress = true;
        continue;
      }

      // Try single tile manipulation
      const manipResult = this.trySingleManipulation(currentTiles, currentSets);
      if (manipResult) {
        totalPlayed += manipResult.tilesPlayed;
        currentTiles = manipResult.remainingTiles;
        currentSets = manipResult.tableSets;
        madProgress = true;
        continue;
      }

      // Try taking from table to form new sets
      const takeResult = this.tryTakeAndForm(currentTiles, currentSets);
      if (takeResult) {
        totalPlayed += takeResult.tilesPlayed;
        currentTiles = takeResult.remainingTiles;
        currentSets = takeResult.tableSets;
        madProgress = true;
        continue;
      }

      if (!madProgress) break;
    }

    if (totalPlayed > 0) {
      return { tableSets: currentSets, remainingTiles: currentTiles, tilesPlayed: totalPlayed };
    }
    return null;
  }

  // Try to play the best possible new set from hand
  tryPlayBestNewSet(playerTiles, tableSets) {
    const sets = this.findAllPotentialSets(playerTiles);
    const validSets = sets.filter(s => isValidSet(s).valid);

    if (validSets.length === 0) return null;

    // Sort by length (play longer sets first)
    validSets.sort((a, b) => b.length - a.length);

    for (const set of validSets) {
      if (!this.tilesAvailable(set, playerTiles)) continue;

      const newSets = [...tableSets.map(s => [...s]), set];
      if (validateTableState(newSets).valid) {
        const usedIds = new Set(set.map(t => t.id));
        return {
          tableSets: newSets,
          remainingTiles: playerTiles.filter(t => !usedIds.has(t.id)),
          tilesPlayed: set.length
        };
      }
    }
    return null;
  }

  // Try extending any table set
  tryExtendAnySets(playerTiles, tableSets) {
    let currentTiles = [...playerTiles];
    let currentSets = tableSets.map(s => [...s]);
    let tilesPlayed = 0;

    for (let setIdx = 0; setIdx < currentSets.length; setIdx++) {
      const set = currentSets[setIdx];
      const result = isValidSet(set);
      if (!result.valid) continue;

      if (result.type === 'run') {
        const extended = this.tryExtendRun(set, currentTiles);
        if (extended) {
          currentSets[setIdx] = extended.newSet;
          currentTiles = currentTiles.filter(t => !extended.usedIds.has(t.id));
          tilesPlayed += extended.usedIds.size;
        }
      } else if (result.type === 'group' && set.length < 4) {
        const extended = this.tryExtendGroup(set, currentTiles);
        if (extended) {
          currentSets[setIdx] = extended.newSet;
          currentTiles = currentTiles.filter(t => !extended.usedIds.has(t.id));
          tilesPlayed += extended.usedIds.size;
        }
      }
    }

    if (tilesPlayed > 0 && validateTableState(currentSets).valid) {
      return { tableSets: currentSets, remainingTiles: currentTiles, tilesPlayed };
    }
    return null;
  }

  tryExtendRun(set, playerTiles) {
    const nonJokers = set.filter(t => !t.isJoker);
    if (nonJokers.length === 0) return null;

    const color = nonJokers[0].color;
    const anchorPos = set.findIndex(t => !t.isJoker);
    const anchorNum = set[anchorPos].number;
    const startNum = anchorNum - anchorPos;
    const endNum = startNum + set.length - 1;

    let newSet = [...set];
    const usedIds = new Set();

    // Extend at end
    for (let num = endNum + 1; num <= 13; num++) {
      const tile = playerTiles.find(t => 
        !t.isJoker && t.color === color && t.number === num && !usedIds.has(t.id)
      );
      if (tile) {
        newSet.push(tile);
        usedIds.add(tile.id);
      } else {
        break;
      }
    }

    // Extend at start
    for (let num = startNum - 1; num >= 1; num--) {
      const tile = playerTiles.find(t => 
        !t.isJoker && t.color === color && t.number === num && !usedIds.has(t.id)
      );
      if (tile) {
        newSet = [tile, ...newSet];
        usedIds.add(tile.id);
      } else {
        break;
      }
    }

    if (usedIds.size > 0 && isValidSet(newSet).valid) {
      return { newSet, usedIds };
    }
    return null;
  }

  tryExtendGroup(set, playerTiles) {
    const nonJokers = set.filter(t => !t.isJoker);
    if (nonJokers.length === 0) return null;

    const number = nonJokers[0].number;
    const usedColors = new Set(nonJokers.map(t => t.color));
    const usedIds = new Set();

    let newSet = [...set];

    for (const color of Object.values(TILE_COLORS)) {
      if (usedColors.has(color)) continue;
      if (newSet.length >= 4) break;

      const tile = playerTiles.find(t => 
        !t.isJoker && t.number === number && t.color === color
      );
      if (tile) {
        newSet.push(tile);
        usedIds.add(tile.id);
        usedColors.add(color);
      }
    }

    if (usedIds.size > 0 && isValidSet(newSet).valid) {
      return { newSet, usedIds };
    }
    return null;
  }

  // Single manipulation attempt
  trySingleManipulation(playerTiles, tableSets) {
    for (const tile of playerTiles) {
      if (tile.isJoker) continue;

      const result = this.mediumStrategy.tryAllManipulations([tile], tableSets);
      if (result && result.tilesPlayed > 0) {
        return {
          tableSets: result.tableSets,
          remainingTiles: playerTiles.filter(t => t.id !== tile.id),
          tilesPlayed: 1
        };
      }
    }
    return null;
  }

  // Joker-powered plays: use jokers aggressively
  tryJokerPoweredPlay(playerTiles, tableSets) {
    const jokers = playerTiles.filter(t => t.isJoker);
    if (jokers.length === 0) return null;

    let bestResult = null;
    let bestScore = -Infinity;

    // Find all sets that could be completed with jokers
    const potentialSets = this.findAllPotentialSets(playerTiles);

    for (const set of potentialSets) {
      if (!isValidSet(set).valid) continue;
      if (!this.tilesAvailable(set, playerTiles)) continue;

      const usedIds = new Set(set.map(t => t.id));
      const remainingTiles = playerTiles.filter(t => !usedIds.has(t.id));
      const newSets = [...tableSets.map(s => [...s]), set];

      if (!validateTableState(newSets).valid) continue;

      // Try cascading after this play
      const cascadeResult = this.tryCascadePlays(remainingTiles, newSets);
      const finalTiles = cascadeResult?.remainingTiles || remainingTiles;
      const finalSets = cascadeResult?.tableSets || newSets;
      const totalPlayed = set.length + (cascadeResult?.tilesPlayed || 0);

      const score = this.evaluatePlay(finalTiles, finalSets);
      if (score > bestScore) {
        bestScore = score;
        bestResult = {
          tableSets: finalSets,
          remainingTiles: finalTiles,
          tilesPlayed: totalPlayed
        };
      }
    }

    return bestResult;
  }

  // Chain manipulation: take from multiple sets to form new combinations
  tryChainManipulation(playerTiles, tableSets) {
    // Try taking tiles from multiple groups/runs to form new sets with our tiles
    for (const tile of playerTiles) {
      if (tile.isJoker) continue;

      // Find all table tiles with same number
      const samNumberTiles = [];
      for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
        const set = tableSets[setIdx];
        const result = isValidSet(set);
        if (!result.valid) continue;

        for (let tileIdx = 0; tileIdx < set.length; tileIdx++) {
          const tableTile = set[tileIdx];
          if (tableTile.isJoker) continue;
          if (tableTile.number !== tile.number) continue;
          if (tableTile.color === tile.color) continue;

          // Check if removable
          const remaining = set.filter((_, i) => i !== tileIdx);
          if (remaining.length >= 3 && isValidSet(remaining).valid) {
            samNumberTiles.push({ tile: tableTile, setIdx, tileIdx, canRemove: true });
          } else if (result.type === 'group' && set.length >= 4) {
            samNumberTiles.push({ tile: tableTile, setIdx, tileIdx, canRemove: true });
          }
        }
      }

      // If we have at least 2, we can form a group
      const canRemove = samNumberTiles.filter(t => t.canRemove);
      if (canRemove.length >= 2) {
        // Filter for unique colors
        const colors = new Set([tile.color]);
        const toUse = [];
        for (const entry of canRemove) {
          if (!colors.has(entry.tile.color)) {
            colors.add(entry.tile.color);
            toUse.push(entry);
            if (toUse.length >= 3) break;
          }
        }

        if (toUse.length >= 2) {
          const newSets = tableSets.map(s => [...s]);
          
          // Remove tiles from their sets (in reverse order by setIdx)
          const bySetIdx = new Map();
          for (const entry of toUse) {
            if (!bySetIdx.has(entry.setIdx)) bySetIdx.set(entry.setIdx, []);
            bySetIdx.get(entry.setIdx).push(entry.tileIdx);
          }

          for (const [setIdx, indices] of bySetIdx) {
            indices.sort((a, b) => b - a);
            for (const idx of indices) {
              newSets[setIdx] = newSets[setIdx].filter((_, i) => i !== idx);
            }
          }

          // Remove empty sets
          const filteredSets = newSets.filter(s => s.length > 0);

          // Add new group
          const newGroup = [tile, ...toUse.map(e => e.tile)];
          if (isValidSet(newGroup).valid) {
            filteredSets.push(newGroup);

            if (validateTableState(filteredSets).valid) {
              return {
                tableSets: filteredSets,
                remainingTiles: playerTiles.filter(t => t.id !== tile.id),
                tilesPlayed: 1
              };
            }
          }
        }
      }
    }

    return null;
  }

  // Find optimal initial meld
  findOptimalInitialMeld(playerTiles, tableSets, rules) {
    const minPoints = rules?.initialMeldPoints || 30;
    
    // Find all potential sets including those with jokers
    const allSets = this.findAllPotentialSets(playerTiles);
    const validSets = allSets.filter(s => isValidSet(s).valid);

    // Also try to find sets we might have missed - specifically look for 30+ point single sets
    const additionalSets = this.findHighValueSets(playerTiles, minPoints);
    for (const set of additionalSets) {
      if (isValidSet(set).valid && !validSets.some(vs => this.setsShareTiles(vs, set))) {
        validSets.push(set);
      }
    }

    // Find combinations that meet the minimum points
    const combos = this.findBestSetCombinations(validSets, playerTiles, 6);
    
    // Also add individual sets that meet the threshold on their own
    for (const set of validSets) {
      const points = this.calculateSetPoints(set);
      if (points >= minPoints && this.tilesAvailable(set, playerTiles)) {
        combos.push([set]);
      }
    }
    
    const validCombos = combos.filter(combo => {
      const points = combo.reduce((sum, set) => sum + this.calculateSetPoints(set), 0);
      return points >= minPoints;
    });

    if (validCombos.length === 0) return null;

    // Sort by tiles played (most first), then by points (highest first)
    validCombos.sort((a, b) => {
      const aCount = a.reduce((sum, s) => sum + s.length, 0);
      const bCount = b.reduce((sum, s) => sum + s.length, 0);
      if (bCount !== aCount) return bCount - aCount;
      const aPoints = a.reduce((sum, set) => sum + this.calculateSetPoints(set), 0);
      const bPoints = b.reduce((sum, set) => sum + this.calculateSetPoints(set), 0);
      return bPoints - aPoints;
    });
    
    const bestCombo = validCombos[0];

    const usedIds = new Set();
    for (const set of bestCombo) {
      for (const tile of set) usedIds.add(tile.id);
    }

    // Include existing table sets plus our new sets
    const newTableSets = [...tableSets.map(s => [...s]), ...bestCombo];

    return {
      action: 'play',
      tableSets: newTableSets,
      playerTiles: playerTiles.filter(t => !usedIds.has(t.id)),
      tilesPlayed: usedIds.size,
      playedInitialMeld: true
    };
  }

  // Find high-value sets that could meet initial meld on their own
  findHighValueSets(playerTiles, minPoints) {
    const sets = [];
    const jokers = playerTiles.filter(t => t.isJoker);
    const nonJokers = playerTiles.filter(t => !t.isJoker);
    
    // Look for runs of high numbers (e.g., 10-11-12-13)
    for (const color of Object.values(TILE_COLORS)) {
      const colorTiles = nonJokers
        .filter(t => t.color === color)
        .sort((a, b) => b.number - a.number); // Sort descending
      
      const byNum = {};
      for (const t of colorTiles) {
        if (!byNum[t.number]) byNum[t.number] = t;
      }
      
      // Try to build runs starting from high numbers
      for (let start = 13; start >= 10; start--) {
        for (let len = 3; len <= 5; len++) {
          const run = [];
          let jokersUsed = 0;
          let valid = true;
          
          for (let num = start; num > start - len && num >= 1; num--) {
            if (byNum[num]) {
              run.unshift(byNum[num]);
            } else if (jokersUsed < jokers.length) {
              run.unshift(jokers[jokersUsed]);
              jokersUsed++;
            } else {
              valid = false;
              break;
            }
          }
          
          if (valid && run.length >= 3 && isValidSet(run).valid) {
            const points = this.calculateSetPoints(run);
            if (points >= minPoints) {
              sets.push(run);
            }
          }
        }
      }
    }
    
    // Look for groups of high numbers
    for (let num = 13; num >= 8; num--) {
      const tiles = nonJokers.filter(t => t.number === num);
      const uniqueColors = new Map();
      for (const t of tiles) {
        if (!uniqueColors.has(t.color)) uniqueColors.set(t.color, t);
      }
      
      const uniqueTiles = Array.from(uniqueColors.values());
      
      // Try 3 or 4 tile groups
      if (uniqueTiles.length >= 3) {
        const group = uniqueTiles.slice(0, Math.min(4, uniqueTiles.length));
        if (isValidSet(group).valid) {
          const points = this.calculateSetPoints(group);
          if (points >= minPoints) {
            sets.push(group);
          }
        }
      }
      
      // Try with joker
      if (uniqueTiles.length >= 2 && jokers.length > 0) {
        const group = [...uniqueTiles.slice(0, 2), jokers[0]];
        if (isValidSet(group).valid) {
          const points = this.calculateSetPoints(group);
          if (points >= minPoints) {
            sets.push(group);
          }
        }
      }
    }
    
    return sets;
  }

  calculateSetPoints(set) {
    const result = isValidSet(set);
    if (!result.valid) return 0;

    if (result.type === 'run') {
      const nonJokers = set.filter(t => !t.isJoker);
      if (nonJokers.length === 0) return 0;

      const anchorIdx = set.findIndex(t => !t.isJoker);
      const anchorNum = set[anchorIdx].number;
      const startNum = anchorNum - anchorIdx;

      let total = 0;
      for (let i = 0; i < set.length; i++) {
        total += startNum + i;
      }
      return total;
    } else {
      const nonJokers = set.filter(t => !t.isJoker);
      if (nonJokers.length === 0) return 0;
      return nonJokers[0].number * set.length;
    }
  }

  // Find all potential sets from tiles (including with jokers)
  findAllPotentialSets(tiles) {
    const sets = [];
    const jokers = tiles.filter(t => t.isJoker);
    const nonJokers = tiles.filter(t => !t.isJoker);

    // Complete groups
    const byNumber = {};
    for (const tile of nonJokers) {
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
        sets.push([...uniqueTiles.slice(0, Math.min(4, uniqueTiles.length))]);
      }

      // With joker
      if (uniqueTiles.length === 2 && jokers.length >= 1) {
        sets.push([...uniqueTiles, jokers[0]]);
      }
      if (uniqueTiles.length === 2 && jokers.length >= 2) {
        sets.push([...uniqueTiles, jokers[0], jokers[1]]);
      }
      if (uniqueTiles.length === 1 && jokers.length >= 2) {
        sets.push([uniqueTiles[0], jokers[0], jokers[1]]);
      }
    }

    // Complete runs and runs with jokers
    for (const color of Object.values(TILE_COLORS)) {
      const colorTiles = nonJokers
        .filter(t => t.color === color)
        .sort((a, b) => a.number - b.number);

      const byNum = {};
      for (const t of colorTiles) {
        if (!byNum[t.number]) byNum[t.number] = t;
      }
      const unique = Object.values(byNum).sort((a, b) => a.number - b.number);

      // Complete runs
      for (let i = 0; i < unique.length; i++) {
        let run = [unique[i]];
        for (let j = i + 1; j < unique.length; j++) {
          if (unique[j].number === run[run.length - 1].number + 1) {
            run.push(unique[j]);
            if (run.length >= 3) {
              sets.push([...run]);
            }
          } else {
            break;
          }
        }
      }

      // Runs with jokers filling gaps
      if (jokers.length > 0) {
        for (let i = 0; i < unique.length - 1; i++) {
          const gap = unique[i + 1].number - unique[i].number;
          
          if (gap === 2) {
            // One gap - joker fills
            sets.push([unique[i], jokers[0], unique[i + 1]]);
          }
          
          if (gap === 1) {
            // Consecutive pair - joker extends
            if (unique[i].number > 1) {
              sets.push([jokers[0], unique[i], unique[i + 1]]);
            }
            if (unique[i + 1].number < 13) {
              sets.push([unique[i], unique[i + 1], jokers[0]]);
            }
          }
        }

        // Single tile with 2 jokers
        if (jokers.length >= 2) {
          for (const tile of unique) {
            if (tile.number > 1 && tile.number < 13) {
              sets.push([jokers[0], tile, jokers[1]]);
            } else if (tile.number === 1) {
              sets.push([tile, jokers[0], jokers[1]]);
            } else if (tile.number === 13) {
              sets.push([jokers[0], jokers[1], tile]);
            }
          }
        }
      }
    }

    return sets;
  }

  // ========== NEW ADVANCED STRATEGIES ==========

  // Exhaustive table rearrangement: try all ways to break apart and reform table sets
  tryExhaustiveRearrangement(playerTiles, tableSets) {
    let bestResult = null;
    let bestScore = -Infinity;

    // For each tile in hand, try to find ANY way to play it by rearranging the table
    for (const tile of playerTiles) {
      if (tile.isJoker) continue;

      // Get all "borrowable" tiles from the table (tiles that can be removed from their sets)
      const borrowable = this.findBorrowableTiles(tableSets);
      
      // Try forming sets using our tile + borrowable tiles
      const result = this.tryFormWithBorrowable(tile, playerTiles, tableSets, borrowable);
      if (result) {
        const score = this.evaluatePlay(result.remainingTiles, result.tableSets);
        if (score > bestScore) {
          bestScore = score;
          bestResult = result;
        }
      }
    }

    // Also try borrowing to extend runs in hand
    const extendResult = this.tryBorrowToCompleteHandSets(playerTiles, tableSets);
    if (extendResult) {
      const score = this.evaluatePlay(extendResult.remainingTiles, extendResult.tableSets);
      if (score > bestScore) {
        bestResult = extendResult;
      }
    }

    return bestResult;
  }

  // Find all tiles that can be borrowed from table sets
  findBorrowableTiles(tableSets) {
    const borrowable = [];

    for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
      const set = tableSets[setIdx];
      const result = isValidSet(set);
      if (!result.valid) continue;

      if (result.type === 'run') {
        // Can borrow from ends if run has 4+ tiles
        if (set.length >= 4) {
          // Start tile
          if (!set[0].isJoker) {
            borrowable.push({ tile: set[0], setIdx, position: 'start', type: 'run' });
          }
          // End tile
          if (!set[set.length - 1].isJoker) {
            borrowable.push({ tile: set[set.length - 1], setIdx, position: 'end', type: 'run' });
          }
        }
        // Can borrow both ends if run has 5+ tiles
        if (set.length >= 5) {
          if (!set[0].isJoker && !set[set.length - 1].isJoker) {
            borrowable.push({ 
              tiles: [set[0], set[set.length - 1]], 
              setIdx, 
              position: 'both', 
              type: 'run' 
            });
          }
        }
      } else if (result.type === 'group') {
        // Can borrow from groups of 4
        if (set.length === 4) {
          for (let i = 0; i < set.length; i++) {
            if (!set[i].isJoker) {
              borrowable.push({ tile: set[i], setIdx, position: i, type: 'group' });
            }
          }
        }
      }
    }

    return borrowable;
  }

  // Try to form a set using our tile + borrowed tiles
  tryFormWithBorrowable(handTile, playerTiles, tableSets, borrowable) {
    // Try to form groups
    const sameNumber = borrowable.filter(b => 
      b.tile && !b.tile.isJoker && 
      b.tile.number === handTile.number && 
      b.tile.color !== handTile.color
    );

    if (sameNumber.length >= 2) {
      // Can form a group of 3 or 4
      const uniqueColors = new Set([handTile.color]);
      const toUse = [];
      
      for (const b of sameNumber) {
        if (!uniqueColors.has(b.tile.color) && toUse.length < 3) {
          uniqueColors.add(b.tile.color);
          toUse.push(b);
        }
      }

      if (toUse.length >= 2) {
        const newGroup = [handTile, ...toUse.map(b => b.tile)];
        if (isValidSet(newGroup).valid) {
          const newSets = this.applyBorrows(tableSets, toUse);
          if (newSets) {
            newSets.push(newGroup);
            if (validateTableState(newSets).valid) {
              // Cascade more plays
              const remaining = playerTiles.filter(t => t.id !== handTile.id);
              const cascaded = this.tryCascadePlays(remaining, newSets);
              
              return {
                tableSets: cascaded?.tableSets || newSets,
                remainingTiles: cascaded?.remainingTiles || remaining,
                tilesPlayed: 1 + (cascaded?.tilesPlayed || 0)
              };
            }
          }
        }
      }
    }

    // Try to form runs with borrowed tiles
    const sameColor = borrowable.filter(b => 
      b.tile && !b.tile.isJoker && 
      b.tile.color === handTile.color &&
      Math.abs(b.tile.number - handTile.number) <= 2
    );

    for (const b of sameColor) {
      const diff = b.tile.number - handTile.number;
      
      // Look for a third tile to complete the run
      const thirdNeeded = diff === 1 ? handTile.number - 1 : 
                          diff === -1 ? handTile.number + 1 :
                          diff === 2 ? handTile.number + 1 : handTile.number - 1;

      // Check in hand
      const thirdFromHand = playerTiles.find(t => 
        t.id !== handTile.id && !t.isJoker && 
        t.color === handTile.color && t.number === thirdNeeded
      );

      if (thirdFromHand) {
        const newRun = [handTile, b.tile, thirdFromHand].sort((a, b) => a.number - b.number);
        if (isValidSet(newRun).valid) {
          const newSets = this.applyBorrows(tableSets, [b]);
          if (newSets) {
            newSets.push(newRun);
            if (validateTableState(newSets).valid) {
              const remaining = playerTiles.filter(t => 
                t.id !== handTile.id && t.id !== thirdFromHand.id
              );
              const cascaded = this.tryCascadePlays(remaining, newSets);
              
              return {
                tableSets: cascaded?.tableSets || newSets,
                remainingTiles: cascaded?.remainingTiles || remaining,
                tilesPlayed: 2 + (cascaded?.tilesPlayed || 0)
              };
            }
          }
        }
      }

      // Check in borrowable
      const thirdBorrowable = sameColor.find(b2 => 
        b2.tile.number === thirdNeeded && b2.setIdx !== b.setIdx
      );

      if (thirdBorrowable) {
        const newRun = [handTile, b.tile, thirdBorrowable.tile].sort((a, b) => a.number - b.number);
        if (isValidSet(newRun).valid) {
          const newSets = this.applyBorrows(tableSets, [b, thirdBorrowable]);
          if (newSets) {
            newSets.push(newRun);
            if (validateTableState(newSets).valid) {
              const remaining = playerTiles.filter(t => t.id !== handTile.id);
              const cascaded = this.tryCascadePlays(remaining, newSets);
              
              return {
                tableSets: cascaded?.tableSets || newSets,
                remainingTiles: cascaded?.remainingTiles || remaining,
                tilesPlayed: 1 + (cascaded?.tilesPlayed || 0)
              };
            }
          }
        }
      }
    }

    return null;
  }

  // Apply borrows to table sets (remove borrowed tiles)
  applyBorrows(tableSets, borrows) {
    const newSets = tableSets.map(s => [...s]);

    // Group by setIdx to handle multiple borrows from same set
    const bySet = new Map();
    for (const b of borrows) {
      if (!bySet.has(b.setIdx)) bySet.set(b.setIdx, []);
      bySet.get(b.setIdx).push(b);
    }

    for (const [setIdx, setBorrows] of bySet) {
      let set = newSets[setIdx];
      
      for (const b of setBorrows) {
        if (b.position === 'start') {
          set = set.slice(1);
        } else if (b.position === 'end') {
          set = set.slice(0, -1);
        } else if (b.position === 'both') {
          set = set.slice(1, -1);
        } else if (typeof b.position === 'number') {
          set = set.filter((_, i) => i !== b.position);
        }
      }

      // Validate shortened set
      if (set.length < 3 || !isValidSet(set).valid) {
        return null; // Can't borrow - would break the set
      }
      newSets[setIdx] = set;
    }

    return newSets.filter(s => s.length > 0);
  }

  // Try to borrow tiles to complete sets we almost have in hand
  tryBorrowToCompleteHandSets(playerTiles, tableSets) {
    const nonJokers = playerTiles.filter(t => !t.isJoker);
    const borrowable = this.findBorrowableTiles(tableSets);

    // Look for pairs in hand that could become runs with a borrowed tile
    const byColor = {};
    for (const tile of nonJokers) {
      if (!byColor[tile.color]) byColor[tile.color] = [];
      byColor[tile.color].push(tile);
    }

    for (const color in byColor) {
      const colorTiles = byColor[color].sort((a, b) => a.number - b.number);
      
      for (let i = 0; i < colorTiles.length - 1; i++) {
        const t1 = colorTiles[i];
        const t2 = colorTiles[i + 1];
        const gap = t2.number - t1.number;

        if (gap === 1) {
          // Consecutive pair - need one more at either end
          const neededStart = t1.number - 1;
          const neededEnd = t2.number + 1;

          for (const needed of [neededStart, neededEnd]) {
            if (needed < 1 || needed > 13) continue;
            
            const found = borrowable.find(b => 
              b.tile && b.tile.color === color && b.tile.number === needed
            );

            if (found) {
              const newRun = [t1, t2, found.tile].sort((a, b) => a.number - b.number);
              if (isValidSet(newRun).valid) {
                const newSets = this.applyBorrows(tableSets, [found]);
                if (newSets) {
                  newSets.push(newRun);
                  if (validateTableState(newSets).valid) {
                    const remaining = playerTiles.filter(t => 
                      t.id !== t1.id && t.id !== t2.id
                    );
                    const cascaded = this.tryCascadePlays(remaining, newSets);
                    
                    return {
                      tableSets: cascaded?.tableSets || newSets,
                      remainingTiles: cascaded?.remainingTiles || remaining,
                      tilesPlayed: 2 + (cascaded?.tilesPlayed || 0)
                    };
                  }
                }
              }
            }
          }
        } else if (gap === 2) {
          // Gap of one - need the middle tile
          const neededMiddle = t1.number + 1;
          const found = borrowable.find(b => 
            b.tile && b.tile.color === color && b.tile.number === neededMiddle
          );

          if (found) {
            const newRun = [t1, found.tile, t2];
            if (isValidSet(newRun).valid) {
              const newSets = this.applyBorrows(tableSets, [found]);
              if (newSets) {
                newSets.push(newRun);
                if (validateTableState(newSets).valid) {
                  const remaining = playerTiles.filter(t => 
                    t.id !== t1.id && t.id !== t2.id
                  );
                  const cascaded = this.tryCascadePlays(remaining, newSets);
                  
                  return {
                    tableSets: cascaded?.tableSets || newSets,
                    remainingTiles: cascaded?.remainingTiles || remaining,
                    tilesPlayed: 2 + (cascaded?.tilesPlayed || 0)
                  };
                }
              }
            }
          }
        }
      }
    }

    // Look for pairs that could become groups
    const byNumber = {};
    for (const tile of nonJokers) {
      if (!byNumber[tile.number]) byNumber[tile.number] = [];
      byNumber[tile.number].push(tile);
    }

    for (const number in byNumber) {
      const sameTiles = byNumber[number];
      const usedColors = new Set(sameTiles.map(t => t.color));

      if (sameTiles.length >= 2) {
        // Look for a third color to borrow
        const found = borrowable.find(b => 
          b.tile && b.tile.number === parseInt(number) && !usedColors.has(b.tile.color)
        );

        if (found) {
          const newGroup = [...sameTiles.slice(0, 2), found.tile];
          if (isValidSet(newGroup).valid) {
            const newSets = this.applyBorrows(tableSets, [found]);
            if (newSets) {
              newSets.push(newGroup);
              if (validateTableState(newSets).valid) {
                const remaining = playerTiles.filter(t => 
                  t.id !== sameTiles[0].id && t.id !== sameTiles[1].id
                );
                const cascaded = this.tryCascadePlays(remaining, newSets);
                
                return {
                  tableSets: cascaded?.tableSets || newSets,
                  remainingTiles: cascaded?.remainingTiles || remaining,
                  tilesPlayed: 2 + (cascaded?.tilesPlayed || 0)
                };
              }
            }
          }
        }
      }
    }

    return null;
  }

  // Multi-step look-ahead: simulate different move sequences and pick the best
  tryLookAheadSimulation(playerTiles, tableSets) {
    const simulations = [];

    // Generate multiple starting moves
    const startingMoves = this.generateAllPossibleMoves(playerTiles, tableSets);
    
    // Use maxSearchDepth to control how many starting moves to evaluate
    for (const move of startingMoves.slice(0, this.maxSearchDepth)) {
      // Simulate this move and its consequences
      let simTiles = move.remainingTiles;
      let simSets = move.tableSets;
      let totalPlayed = move.tilesPlayed;

      // Do multiple iterations of follow-up moves
      for (let depth = 0; depth < this.explorationDepth; depth++) {
        const followUp = this.findBestFollowUp(simTiles, simSets);
        if (!followUp) break;
        
        totalPlayed += followUp.tilesPlayed;
        simTiles = followUp.remainingTiles;
        simSets = followUp.tableSets;
      }

      simulations.push({
        tableSets: simSets,
        remainingTiles: simTiles,
        tilesPlayed: totalPlayed,
        score: this.evaluatePlay(simTiles, simSets)
      });
    }

    if (simulations.length === 0) return null;

    // Pick the simulation with best end score
    simulations.sort((a, b) => b.score - a.score);
    return simulations[0];
  }

  // Generate all possible single moves
  generateAllPossibleMoves(playerTiles, tableSets) {
    const moves = [];

    // Playing new sets
    const sets = this.findAllPotentialSets(playerTiles);
    for (const set of sets) {
      if (!isValidSet(set).valid) continue;
      if (!this.tilesAvailable(set, playerTiles)) continue;

      const newSets = [...tableSets.map(s => [...s]), set];
      if (validateTableState(newSets).valid) {
        const usedIds = new Set(set.map(t => t.id));
        moves.push({
          tableSets: newSets,
          remainingTiles: playerTiles.filter(t => !usedIds.has(t.id)),
          tilesPlayed: set.length
        });
      }
    }

    // Extending table sets
    for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
      const set = tableSets[setIdx];
      const result = isValidSet(set);
      if (!result.valid) continue;

      for (const tile of playerTiles) {
        if (tile.isJoker) continue;

        // Try adding to this set
        const testSets = [
          [...set, tile], // at end
          [tile, ...set]  // at start
        ];

        for (const testSet of testSets) {
          if (isValidSet(testSet).valid) {
            const newSets = tableSets.map((s, i) => i === setIdx ? testSet : [...s]);
            if (validateTableState(newSets).valid) {
              moves.push({
                tableSets: newSets,
                remainingTiles: playerTiles.filter(t => t.id !== tile.id),
                tilesPlayed: 1
              });
            }
          }
        }
      }
    }

    return moves;
  }

  // Find the best single follow-up move
  findBestFollowUp(playerTiles, tableSets) {
    const moves = this.generateAllPossibleMoves(playerTiles, tableSets);
    if (moves.length === 0) return null;

    // Score and pick best
    for (const move of moves) {
      move.score = this.evaluatePlay(move.remainingTiles, move.tableSets);
    }
    moves.sort((a, b) => b.score - a.score);
    return moves[0];
  }

  // Decompose table sets and rebuild with hand tiles included
  tryDecomposeAndRebuild(playerTiles, tableSets) {
    // Pick a subset of table sets to decompose
    // Focus on sets that share numbers or colors with our tiles
    const relevantSetIndices = new Set();

    for (const tile of playerTiles) {
      if (tile.isJoker) continue;

      for (let setIdx = 0; setIdx < tableSets.length; setIdx++) {
        const set = tableSets[setIdx];
        for (const t of set) {
          if (t.isJoker) continue;
          if (t.number === tile.number || t.color === tile.color) {
            relevantSetIndices.add(setIdx);
            break;
          }
        }
      }
    }

    if (relevantSetIndices.size === 0) return null;

    // Try decomposing 1-2 relevant sets
    const indices = Array.from(relevantSetIndices).slice(0, 3);
    
    for (let numToDecompose = 1; numToDecompose <= Math.min(2, indices.length); numToDecompose++) {
      const combos = this.getCombinations(indices, numToDecompose);
      
      for (const combo of combos) {
        const result = this.tryRebuildWithHand(combo, playerTiles, tableSets);
        if (result && result.tilesPlayed > 0) {
          return result;
        }
      }
    }

    return null;
  }

  getCombinations(arr, size) {
    if (size === 1) return arr.map(x => [x]);
    const combos = [];
    for (let i = 0; i < arr.length - size + 1; i++) {
      const head = arr[i];
      const tailCombos = this.getCombinations(arr.slice(i + 1), size - 1);
      for (const tail of tailCombos) {
        combos.push([head, ...tail]);
      }
    }
    return combos;
  }

  // Rebuild decomposed sets with hand tiles
  tryRebuildWithHand(setIndicesToDecompose, playerTiles, tableSets) {
    // Collect all tiles from sets to decompose + hand
    const decomposedTiles = [];
    for (const idx of setIndicesToDecompose) {
      decomposedTiles.push(...tableSets[idx]);
    }

    const allTiles = [...decomposedTiles, ...playerTiles];
    const handTileIds = new Set(playerTiles.map(t => t.id));

    // Find all valid sets from combined pool
    const possibleSets = this.findAllPotentialSets(allTiles);
    const validSets = possibleSets.filter(s => isValidSet(s).valid);

    // Try to find a combination that uses all decomposed tiles + some hand tiles
    const decomposedIds = new Set(decomposedTiles.map(t => t.id));
    
    for (const combination of this.findBestSetCombinations(validSets, allTiles, 5)) {
      const usedIds = new Set();
      for (const set of combination) {
        for (const tile of set) usedIds.add(tile.id);
      }

      // Check if all decomposed tiles are used
      let allDecomposedUsed = true;
      for (const id of decomposedIds) {
        if (!usedIds.has(id)) {
          allDecomposedUsed = false;
          break;
        }
      }

      if (!allDecomposedUsed) continue;

      // Check how many hand tiles are used
      let handTilesUsed = 0;
      for (const id of usedIds) {
        if (handTileIds.has(id)) handTilesUsed++;
      }

      if (handTilesUsed > 0) {
        // Build new table sets
        const newTableSets = tableSets
          .filter((_, idx) => !setIndicesToDecompose.includes(idx))
          .map(s => [...s]);
        
        newTableSets.push(...combination);

        if (validateTableState(newTableSets).valid) {
          const remainingTiles = playerTiles.filter(t => !usedIds.has(t.id));
          
          // Try to cascade more
          const cascaded = this.tryCascadePlays(remainingTiles, newTableSets);
          
          return {
            tableSets: cascaded?.tableSets || newTableSets,
            remainingTiles: cascaded?.remainingTiles || remainingTiles,
            tilesPlayed: handTilesUsed + (cascaded?.tilesPlayed || 0)
          };
        }
      }
    }

    return null;
  }

  // Try taking from table to form new sets with hand tiles
  tryTakeAndForm(playerTiles, tableSets) {
    const borrowable = this.findBorrowableTiles(tableSets);
    
    for (const tile of playerTiles) {
      if (tile.isJoker) continue;

      // Look for borrowable tiles that could form a set with this tile
      const result = this.tryFormWithBorrowable(tile, playerTiles, tableSets, borrowable);
      if (result) return result;
    }

    return null;
  }
}
