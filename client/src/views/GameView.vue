<template>
  <v-container fluid class="pa-2 game-container">
    <v-row no-gutters class="flex-grow-1 flex-nowrap" style="min-height: 0;">
      <!-- Main Game Area -->
      <v-col cols="12" :md="showChat ? 9 : 12" class="d-flex flex-column game-main-column">
        <!-- Top Bar: Redesigned Game Info -->
        <v-card color="surface" class="mb-2 top-bar">
          <div class="top-bar-content">
            <!-- Left: Turn Order / Players -->
            <div class="players-section">
              <div class="section-label">
                <v-icon size="x-small">mdi-account-group</v-icon>
                Turn Order
              </div>
              <div class="player-list">
                <div
                  v-for="(player, index) in gameStore.players"
                  :key="player.socketId"
                  class="player-item"
                  :class="{ 
                    'active': index === gameStore.currentPlayerIndex,
                    'is-me': player.socketId === gameStore.myPlayer?.socketId
                  }"
                >
                  <div class="player-indicator" :class="{ 'active': index === gameStore.currentPlayerIndex }">
                    {{ index + 1 }}
                  </div>
                  <div class="player-info">
                    <div class="player-name-row">
                      <v-icon v-if="player.isBot" size="x-small" class="mr-1">mdi-robot</v-icon>
                      <span class="player-name">{{ player.username }}</span>
                      <span v-if="player.socketId === gameStore.myPlayer?.socketId" class="you-badge">(you)</span>
                      <v-icon v-if="player.isDisconnected" size="x-small" color="warning" class="ml-1">mdi-wifi-off</v-icon>
                    </div>
                    <div class="tile-count">{{ player.tileCount }} tiles</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Center: Timers -->
            <div class="timers-section">
              <!-- Turn Timer (visible to all) -->
              <div class="timer-box turn-timer" :class="{ 'urgent': gameStore.currentTurnTimeRemaining <= 10 }">
                <div class="timer-label">Turn</div>
                <div class="timer-value">{{ formatTime(gameStore.currentTurnTimeRemaining) }}</div>
              </div>
              
              <!-- Total Game Timer -->
              <div class="timer-box game-timer">
                <div class="timer-label">Game</div>
                <div class="timer-value">{{ formatTime(gameStore.totalGameTime) }}</div>
              </div>
            </div>
            
            <!-- Right: Pool & Actions -->
            <div class="actions-section">
              <div class="pool-display">
                <v-icon size="small">mdi-cards</v-icon>
                <span class="pool-count">{{ gameStore.poolCount }}</span>
                <span class="pool-label">tiles</span>
              </div>
              
              <v-btn
                :icon="showChat ? 'mdi-chat' : 'mdi-chat-outline'"
                variant="text"
                :color="showChat ? 'primary' : 'default'"
                @click="showChat = !showChat"
                class="chat-toggle"
              />
            </div>
          </div>
        </v-card>
        
        <!-- Game Table (Played Sets) -->
        <v-card color="surface" class="mb-2 pa-4 game-table">
          <div class="text-subtitle-2 text-medium-emphasis mb-2">
            <v-icon size="small" class="mr-1">mdi-table-furniture</v-icon>
            Table
          </div>
          
          <div class="table-area">
            <!-- Existing sets on table -->
            <div class="table-sets">
              <div
                v-for="(set, setIndex) in localTableSets"
                :key="getSetKey(set, setIndex)"
                class="tile-set"
                :class="{ 'invalid-set': !isSetValid(set) }"
              >
                <draggable
                  :list="set"
                  :group="{ name: 'tiles', pull: gameStore.isMyTurn, put: gameStore.isMyTurn }"
                  item-key="id"
                  class="set-tiles"
                  :animation="0"
                  ghost-class="tile-ghost"
                  chosen-class="tile-chosen"
                  drag-class="tile-dragging"
                  :move="onTableTileMove"
                  @start="onDragStart"
                  @change="onSetChange(setIndex)"
                >
                  <template #item="{ element: tile }">
                    <TileComponent 
                      :tile="tile" 
                      :draggable="gameStore.isMyTurn" 
                      :highlighted="gameStore.highlightedTileIds.has(tile.id)"
                    />
                  </template>
                </draggable>
              </div>
            </div>
            
            <!-- Drop zone for new sets -->
            <draggable
              v-if="gameStore.isMyTurn"
              v-model="newSetDropZone"
              :group="{ name: 'tiles', pull: false, put: true }"
              item-key="id"
              class="new-set-zone"
              :animation="0"
              ghost-class="tile-ghost"
              chosen-class="tile-chosen"
              @start="onDragStart"
              @change="onNewSetDrop"
            >
              <template #item="{ element: tile }">
                <TileComponent :tile="tile" :draggable="true" />
              </template>
              <template #header>
                <div v-if="newSetDropZone.length === 0" class="new-set-placeholder">
                  <v-icon>mdi-plus</v-icon>
                  Drop here to create new set
                </div>
              </template>
            </draggable>
          </div>
        </v-card>
        
        <!-- Player Rack -->
        <v-card color="surface" class="pa-4 player-rack">
          <div class="rack-header">
            <div class="rack-title">
              <v-icon size="small" class="mr-1">mdi-hand-back-left</v-icon>
              Your Tiles ({{ localMyTiles.length }})
            </div>
            
            <div class="rack-controls">
              <!-- Sort buttons - improved styling -->
              <div class="sort-buttons">
                <v-btn
                  size="small"
                  variant="tonal"
                  color="secondary"
                  @click="gameStore.sortTilesByColor()"
                  title="Sort by color"
                  class="sort-btn"
                >
                  <v-icon start size="small">mdi-palette</v-icon>
                  Color
                </v-btn>
                <v-btn
                  size="small"
                  variant="tonal"
                  color="secondary"
                  @click="gameStore.sortTilesByNumber()"
                  title="Sort by number"
                  class="sort-btn"
                >
                  <v-icon start size="small">mdi-sort-numeric-ascending</v-icon>
                  Number
                </v-btn>
              </div>
              
              <!-- Action buttons -->
              <div class="action-buttons">
                <v-btn
                  v-if="gameStore.isMyTurn && gameStore.hasChanges"
                  color="warning"
                  size="small"
                  variant="outlined"
                  @click="revertChanges"
                  class="action-btn"
                >
                  <v-icon start size="small">mdi-undo</v-icon>
                  Revert
                </v-btn>
                
                <v-btn
                  v-if="gameStore.isMyTurn && !gameStore.hasChanges"
                  color="info"
                  size="small"
                  @click="drawTile"
                  :disabled="gameStore.poolCount === 0"
                  :loading="isDrawing"
                  class="action-btn"
                >
                  <v-icon start size="small">mdi-download</v-icon>
                  Draw
                </v-btn>
                
                <v-btn
                  v-if="gameStore.isMyTurn"
                  color="success"
                  size="small"
                  @click="endTurn"
                  :disabled="!gameStore.hasChanges && gameStore.poolCount > 0"
                  :loading="isEndingTurn"
                  class="action-btn"
                >
                  <v-icon start size="small">mdi-check</v-icon>
                  End Turn
                </v-btn>
              </div>
            </div>
          </div>
          
          <draggable
            v-model="localMyTiles"
            :group="{ name: 'tiles', pull: gameStore.isMyTurn, put: gameStore.isMyTurn }"
            item-key="id"
            class="rack-tiles"
            :animation="0"
            ghost-class="tile-ghost"
            chosen-class="tile-chosen"
            drag-class="tile-dragging"
            @start="onDragStart"
            @change="onRackChange"
          >
            <template #item="{ element: tile }">
              <TileComponent 
                :tile="tile" 
                :draggable="gameStore.isMyTurn" 
                :highlighted="gameStore.highlightedHandTileIds.has(tile.id)"
              />
            </template>
          </draggable>
        </v-card>
      </v-col>
      
      <!-- Chat Panel -->
      <v-col v-if="showChat" cols="12" md="3" class="pl-md-2">
        <ChatPanel
          :messages="gameStore.chatMessages"
          @send="sendMessage"
          class="fill-height"
        />
      </v-col>
    </v-row>
    
    <!-- Turn notification -->
    <v-snackbar
      v-model="showTurnNotification"
      color="primary"
      timeout="3000"
      location="top"
    >
      <v-icon class="mr-2">mdi-bell</v-icon>
      It's your turn!
    </v-snackbar>
    
    <!-- Error snackbar -->
    <v-snackbar
      v-model="showError"
      color="error"
      timeout="5000"
      location="top"
    >
      {{ errorMessage }}
    </v-snackbar>
    
    <!-- Invalid move snackbar -->
    <v-snackbar
      v-model="showInvalidMoveAlert"
      color="warning"
      timeout="3000"
      location="top center"
    >
      <v-icon class="mr-2">mdi-alert</v-icon>
      {{ invalidMoveMessage }}
    </v-snackbar>
    
    <!-- Disconnect timeout dialog (for host) -->
    <v-dialog v-model="showDisconnectDialog" persistent max-width="400">
      <v-card>
        <v-card-title>Player Disconnected</v-card-title>
        <v-card-text>
          {{ gameStore.disconnectTimeout?.username }} has been disconnected for too long.
          What would you like to do?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="error"
            variant="text"
            @click="handleDisconnect('kick')"
          >
            Kick Player
          </v-btn>
          <v-btn
            color="primary"
            @click="handleDisconnect('replace-with-bot')"
          >
            Replace with Bot
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- Spectator indicator -->
    <v-alert
      v-if="gameStore.isSpectator"
      type="info"
      variant="tonal"
      class="spectator-alert"
    >
      <v-icon class="mr-2">mdi-eye</v-icon>
      You are spectating this game
    </v-alert>
  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '@/stores/gameStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { isValidSet } from '../../../common/rules.js';
import TileComponent from '@/components/TileComponent.vue';
import ChatPanel from '@/components/ChatPanel.vue';
import draggable from 'vuedraggable';

const router = useRouter();
const gameStore = useGameStore();
const notificationStore = useNotificationStore();

const showChat = ref(true);
const showTurnNotification = ref(false);
const showError = ref(false);
const errorMessage = ref('');
const isDrawing = ref(false);
const isEndingTurn = ref(false);
const newSetDropZone = ref([]);

// Snackbar for invalid move notifications
const showInvalidMoveAlert = ref(false);
const invalidMoveMessage = ref('');

// Local state for drag-and-drop (synced with store)
const localTableSets = computed({
  get: () => gameStore.localTableSets,
  set: (value) => gameStore.updateLocalTableSets(value)
});

// Generate a stable key for each set - use sorted tile IDs to be stable after reordering
function getSetKey(set, index) {
  if (!set || set.length === 0) return `empty-${index}`;
  // Use sorted tile IDs to create a stable key that doesn't change when tiles are reordered
  const ids = set.map(t => t.id).sort().join('-');
  return `set-${ids}`;
}

const localMyTiles = computed({
  get: () => gameStore.localMyTiles,
  set: (value) => gameStore.updateLocalMyTiles(value)
});

const showDisconnectDialog = computed(() => !!gameStore.disconnectTimeout);

// Watch for turn changes
watch(() => gameStore.isMyTurn, (isMyTurn) => {
  if (isMyTurn) {
    showTurnNotification.value = true;
  }
});

// Watch for game end
watch(() => gameStore.gameEnded, (ended) => {
  if (ended) {
    router.push({ name: 'Results' });
  }
});

onMounted(() => {
  if (!gameStore.isInGame) {
    router.push({ name: 'LobbyBrowser' });
  }
});

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function isSetValid(set) {
  if (!set || set.length < 3) return false;
  return isValidSet(set).valid;
}

// Show invalid move notification
function showInvalidMove(message) {
  invalidMoveMessage.value = message;
  showInvalidMoveAlert.value = true;
}

// Validate a set and return error message if invalid
function validateSetPlacement(set) {
  if (!set || set.length === 0) return null; // Empty sets are fine (will be cleaned up)
  
  if (set.length === 1) return null; // Single tile is allowed while building
  
  if (set.length === 2) {
    // Check if the two tiles could potentially form a valid set
    const [t1, t2] = set;
    
    // Check for duplicate (same number and same color)
    if (!t1.isJoker && !t2.isJoker && t1.number === t2.number && t1.color === t2.color) {
      return 'Cannot place two identical tiles together';
    }
    
    // For groups: same number, different colors
    if (!t1.isJoker && !t2.isJoker && t1.number === t2.number && t1.color !== t2.color) {
      return null; // Valid start of a group
    }
    
    // For runs: same color, consecutive numbers
    if (!t1.isJoker && !t2.isJoker && t1.color === t2.color) {
      const diff = Math.abs(t1.number - t2.number);
      if (diff === 1) return null; // Valid start of a run
      if (diff === 0) return 'Cannot place two identical tiles together';
      return 'Run tiles must be consecutive numbers';
    }
    
    // Joker with any tile is fine
    if (t1.isJoker || t2.isJoker) return null;
    
    // Different colors AND different numbers - not valid for either type
    return 'Tiles must form a run (same color, consecutive) or group (same number, different colors)';
  }
  
  // For 3+ tiles, do full validation
  const result = isValidSet(set);
  if (!result.valid) {
    // Determine the error type
    const regularTiles = set.filter(t => !t.isJoker);
    if (regularTiles.length >= 2) {
      const colors = new Set(regularTiles.map(t => t.color));
      const numbers = new Set(regularTiles.map(t => t.number));
      
      if (colors.size === 1) {
        // Trying to be a run
        return 'Invalid run: tiles must be consecutive numbers of the same color';
      } else if (numbers.size === 1) {
        // Trying to be a group
        const colorCounts = {};
        regularTiles.forEach(t => {
          colorCounts[t.color] = (colorCounts[t.color] || 0) + 1;
        });
        const duplicateColor = Object.values(colorCounts).some(c => c > 1);
        if (duplicateColor) {
          return 'Invalid group: each color can only appear once';
        }
        return 'Invalid group: tiles must have the same number with different colors';
      } else {
        return 'Invalid set: must be a run (same color, consecutive) or group (same number, different colors)';
      }
    }
    return 'Invalid tile placement';
  }
  
  return null; // Valid
}

// Store previous states for reverting
let previousTableSets = null;
let previousMyTiles = null;

function saveState() {
  previousTableSets = JSON.parse(JSON.stringify(gameStore.localTableSets));
  previousMyTiles = JSON.parse(JSON.stringify(gameStore.localMyTiles));
}

function revertToSavedState() {
  if (previousTableSets !== null) {
    gameStore.updateLocalTableSets(previousTableSets);
  }
  if (previousMyTiles !== null) {
    gameStore.updateLocalMyTiles(previousMyTiles);
  }
}

function onSetChange(setIndex) {
  // Deep clone ALL sets to ensure we have fresh references
  const sets = localTableSets.value.map(s => [...s]);
  let set = sets[setIndex];
  
  // Clean up empty sets
  if (!set || set.length === 0) {
    sets.splice(setIndex, 1);
    gameStore.updateLocalTableSets(sets);
    return;
  }
  
  // Auto-sort runs FIRST (same color tiles should be sorted by number)
  set = autoSortSet(set);
  sets[setIndex] = set;
  
  // Update the store immediately with sorted version
  gameStore.updateLocalTableSets(sets);
  
  // Validate AFTER sorting - if invalid, show message but don't revert
  // (allow user to continue building the set)
  const error = validateSetPlacement(set);
  if (error && set.length >= 3) {
    // Only show error for sets with 3+ tiles that are still invalid after sorting
    showInvalidMove(error);
    revertToSavedState();
  }
}

// Auto-sort a set if it's a run (same color, should be consecutive numbers)
function autoSortSet(set) {
  if (!set || set.length < 2) return set;
  
  // Check if all non-joker tiles are the same color (potential run)
  const regularTiles = set.filter(t => !t.isJoker);
  if (regularTiles.length === 0) return set;
  
  const colors = new Set(regularTiles.map(t => t.color));
  
  // If all tiles are the same color, it's a run - sort by number
  if (colors.size === 1) {
    // Sort tiles: jokers stay in relative position if they're filling gaps,
    // otherwise sort all by number with jokers at the end temporarily
    const sortedSet = [...set].sort((a, b) => {
      // Jokers go after regular tiles for now
      if (a.isJoker && b.isJoker) return 0;
      if (a.isJoker) return 1;
      if (b.isJoker) return -1;
      return a.number - b.number;
    });
    
    // Now insert jokers in gaps if needed
    return insertJokersInGaps(sortedSet);
  }
  
  // If different colors but same number, it's a group - no sorting needed
  return set;
}

// Insert jokers into gaps in a run, preferring to place at start if possible
function insertJokersInGaps(sortedSet) {
  const regularTiles = sortedSet.filter(t => !t.isJoker);
  const jokers = sortedSet.filter(t => t.isJoker);
  
  if (jokers.length === 0 || regularTiles.length === 0) return sortedSet;
  
  // First, count how many jokers we need to fill gaps
  let gapsNeeded = 0;
  for (let i = 0; i < regularTiles.length - 1; i++) {
    gapsNeeded += regularTiles[i + 1].number - regularTiles[i].number - 1;
  }
  
  // Jokers left after filling gaps
  const jokersForGaps = Math.min(gapsNeeded, jokers.length);
  const extraJokers = jokers.length - jokersForGaps;
  
  // Determine how many extra jokers go at start vs end
  // Prefer start if possible (number > 1 allows prepending)
  const minNumber = regularTiles[0].number;
  const maxNumber = regularTiles[regularTiles.length - 1].number;
  
  // Can prepend up to (minNumber - 1) jokers (can't go below 1)
  const maxPrepend = Math.min(extraJokers, minNumber - 1);
  // Remaining go at end, up to (13 - maxNumber)
  const maxAppend = Math.min(extraJokers - maxPrepend, 13 - maxNumber);
  
  const jokersAtStart = maxPrepend;
  const jokersAtEnd = extraJokers - jokersAtStart;
  
  // Build the result
  const result = [];
  let jokerIndex = 0;
  
  // Add jokers at start
  for (let i = 0; i < jokersAtStart; i++) {
    result.push(jokers[jokerIndex++]);
  }
  
  // Add regular tiles with jokers filling gaps
  for (let i = 0; i < regularTiles.length; i++) {
    result.push(regularTiles[i]);
    
    // Check if there's a gap to the next tile
    if (i < regularTiles.length - 1) {
      const gap = regularTiles[i + 1].number - regularTiles[i].number - 1;
      // Fill gaps with jokers
      for (let g = 0; g < gap && jokerIndex < jokers.length; g++) {
        result.push(jokers[jokerIndex++]);
      }
    }
  }
  
  // Add remaining jokers at end
  while (jokerIndex < jokers.length) {
    result.push(jokers[jokerIndex++]);
  }
  
  return result;
}

// Called before any drag starts to save current state
function onDragStart() {
  saveState();
}

// Restrict which tiles can be taken back from the table
function onTableTileMove(evt) {
  const draggedTile = evt.draggedContext?.element;
  const toRack = evt.to?.classList?.contains('rack-tiles');
  
  // If moving to rack (hand), check restrictions
  if (toRack && draggedTile) {
    // Jokers can never be taken back
    if (draggedTile.isJoker) {
      showInvalidMove('Jokers on the table cannot be taken back to your hand');
      return false;
    }
    
    // Only tiles placed THIS TURN can be taken back
    if (!gameStore.canTakeTileBack(draggedTile)) {
      showInvalidMove('Only tiles you placed this turn can be taken back. Use Revert to undo all changes.');
      return false;
    }
  }
  return true;
}

function onNewSetDrop() {
  // When tiles are dropped in the new set zone, create a new set
  if (newSetDropZone.value.length > 0) {
    const sets = [...localTableSets.value, [...newSetDropZone.value]];
    gameStore.updateLocalTableSets(sets);
    newSetDropZone.value = [];
  }
}

function onRackChange() {
  // Rack change handled automatically by v-model
}

function revertChanges() {
  gameStore.revertChanges();
}

async function drawTile() {
  isDrawing.value = true;
  try {
    await gameStore.drawTile();
  } catch (error) {
    errorMessage.value = error.message;
    showError.value = true;
  } finally {
    isDrawing.value = false;
  }
}

async function endTurn() {
  isEndingTurn.value = true;
  try {
    await gameStore.endTurn();
  } catch (error) {
    errorMessage.value = error.message;
    showError.value = true;
  } finally {
    isEndingTurn.value = false;
  }
}

async function handleDisconnect(action) {
  try {
    await gameStore.handleDisconnectedPlayer(action);
  } catch (error) {
    errorMessage.value = error.message;
    showError.value = true;
  }
}

function sendMessage(message) {
  gameStore.sendMessage(message);
}
</script>

<style scoped>
/* ========== TOP BAR STYLES ========== */
.top-bar {
  background: linear-gradient(180deg, rgba(26, 26, 36, 0.95) 0%, rgba(18, 18, 26, 0.98) 100%) !important;
  border: 1px solid rgba(124, 58, 237, 0.2) !important;
  padding: 12px 16px !important;
}

.top-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.players-section {
  flex: 1;
  min-width: 200px;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(226, 232, 240, 0.5);
  margin-bottom: 8px;
}

.player-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.2s ease;
}

.player-item.active {
  background: rgba(124, 58, 237, 0.15);
  border-color: rgba(124, 58, 237, 0.4);
  box-shadow: 0 0 12px rgba(124, 58, 237, 0.2);
}

.player-item.is-me {
  border-color: rgba(20, 184, 166, 0.3);
}

.player-item.is-me.active {
  border-color: rgba(124, 58, 237, 0.4);
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(20, 184, 166, 0.1));
}

.player-indicator {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(226, 232, 240, 0.6);
}

.player-indicator.active {
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  color: white;
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(124, 58, 237, 0); }
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.player-name-row {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 500;
  color: #e2e8f0;
}

.you-badge {
  font-size: 10px;
  color: rgba(20, 184, 166, 0.8);
  margin-left: 4px;
}

.tile-count {
  font-size: 11px;
  color: rgba(226, 232, 240, 0.5);
}

.timers-section {
  display: flex;
  gap: 12px;
}

.timer-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  min-width: 80px;
}

.timer-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(226, 232, 240, 0.5);
  margin-bottom: 2px;
}

.timer-value {
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #e2e8f0;
}

.turn-timer {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.08);
}

.turn-timer .timer-value {
  color: #f59e0b;
}

.turn-timer.urgent {
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.1);
  animation: urgent-pulse 0.5s ease-in-out infinite;
}

.turn-timer.urgent .timer-value {
  color: #ef4444;
}

@keyframes urgent-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.game-timer {
  border-color: rgba(99, 102, 241, 0.3);
  background: rgba(99, 102, 241, 0.08);
}

.game-timer .timer-value {
  color: #818cf8;
}

.actions-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pool-display {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 10px;
  color: #38bdf8;
}

.pool-count {
  font-size: 18px;
  font-weight: 600;
  font-family: 'SF Mono', 'Consolas', monospace;
}

.pool-label {
  font-size: 11px;
  opacity: 0.7;
}

.chat-toggle {
  opacity: 0.7;
  transition: opacity 0.2s;
}

.chat-toggle:hover {
  opacity: 1;
}

/* ========== RACK STYLES ========== */
.rack-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.rack-title {
  font-size: 14px;
  font-weight: 500;
  color: #e2e8f0;
  display: flex;
  align-items: center;
}

.rack-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.sort-buttons {
  display: flex;
  gap: 6px;
}

.sort-btn {
  font-size: 12px !important;
  padding: 0 12px !important;
  height: 32px !important;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  font-size: 12px !important;
  height: 32px !important;
}

/* ========== EXISTING STYLES ========== */
.game-container {
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.game-main-column {
  min-height: 0;
  max-height: calc(100vh - 16px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.game-table {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1 1 auto;
  min-height: 150px;
  max-height: calc(100vh - 280px);
  background: linear-gradient(180deg, rgba(26, 26, 36, 0.6) 0%, rgba(18, 18, 26, 0.8) 100%);
  border: 1px solid rgba(124, 58, 237, 0.2);
}

.table-area {
  min-height: 150px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-content: flex-start;
  padding: 8px;
  background: 
    radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.03) 0%, transparent 70%);
}

.table-sets {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
}

.tile-set {
  display: inline-flex;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  padding: 10px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
}

.tile-set:hover {
  border-color: rgba(124, 58, 237, 0.3);
  box-shadow: 
    0 6px 24px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(124, 58, 237, 0.1);
}

.tile-set.invalid-set {
  border-color: #ef4444;
  box-shadow: 
    0 4px 16px rgba(239, 68, 68, 0.2),
    0 0 20px rgba(239, 68, 68, 0.15);
  animation: shake 0.3s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.set-tiles {
  display: flex;
  gap: 6px;
  min-height: 50px;
}

.new-set-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 160px;
  min-height: 90px;
  border: 2px dashed rgba(124, 58, 237, 0.4);
  border-radius: 12px;
  color: rgba(124, 58, 237, 0.7);
  font-size: 13px;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px;
  background: rgba(124, 58, 237, 0.05);
  transition: all 0.2s ease;
}

.new-set-zone:hover {
  border-color: rgba(124, 58, 237, 0.6);
  background: rgba(124, 58, 237, 0.1);
}

.new-set-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.player-rack {
  flex: 0 0 auto;
  min-height: 130px;
  max-height: 180px;
  overflow-y: auto;
  background: linear-gradient(180deg, rgba(18, 18, 26, 0.9) 0%, rgba(26, 26, 36, 0.95) 100%);
  border: 1px solid rgba(20, 184, 166, 0.2);
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.rack-tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 80px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
}

.current-player {
  animation: glow-pulse 2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { 
    box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4),
                0 0 20px rgba(124, 58, 237, 0.2); 
  }
  50% { 
    box-shadow: 0 0 0 8px rgba(124, 58, 237, 0),
                0 0 30px rgba(124, 58, 237, 0.4); 
  }
}

.timer-chip {
  font-weight: bold;
  font-family: 'SF Mono', 'Consolas', monospace;
  min-width: 85px;
  justify-content: center;
  letter-spacing: 1px;
}

.spectator-alert {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  backdrop-filter: blur(10px);
}

.player-chip {
  color: #e2e8f0 !important;
}

.player-chip .player-name {
  color: #e2e8f0;
  font-weight: 500;
}

/* Ensure the main content column uses flex properly */
:deep(.d-flex.flex-column) {
  min-height: 0;
}

/* Drag and drop styles - scoped */
.tile-ghost {
  opacity: 0.6 !important;
  background: rgba(124, 58, 237, 0.15) !important;
  border: 2px dashed rgba(124, 58, 237, 0.8) !important;
  border-radius: 10px !important;
}

/* Prevent layout shifts during drag */
.set-tiles {
  min-width: max-content;
}

.tile-set {
  flex-shrink: 0;
}
</style>

<!-- Global styles for drag (not scoped because classes may be added to body elements) -->
<style>
/* Tile being picked up - lift effect */
.tile-chosen {
  animation: tile-pickup 0.15s ease-out forwards !important;
  z-index: 1000 !important;
  cursor: grabbing !important;
}

@keyframes tile-pickup {
  0% {
    transform: scale(1) rotate(0deg);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  50% {
    transform: scale(1.15) rotate(-2deg);
  }
  100% {
    transform: scale(1.1) rotate(2deg);
    box-shadow: 
      0 20px 40px rgba(0, 0, 0, 0.4),
      0 0 30px rgba(124, 58, 237, 0.5),
      0 0 60px rgba(124, 58, 237, 0.2);
  }
}

/* Source tile while dragging - fade and shrink */
.tile-dragging {
  opacity: 0.3 !important;
  transform: scale(0.9) !important;
  filter: grayscale(50%) !important;
  transition: all 0.15s ease-out !important;
}

.sortable-drag {
  opacity: 0.3 !important;
  transform: scale(0.9) !important;
}

/* Ghost placeholder - where tile will drop */
.tile-ghost {
  opacity: 0.6 !important;
  background: rgba(124, 58, 237, 0.15) !important;
  border: 2px dashed rgba(124, 58, 237, 0.8) !important;
  border-radius: 10px !important;
  box-shadow: 
    0 0 20px rgba(124, 58, 237, 0.4),
    inset 0 0 20px rgba(124, 58, 237, 0.1) !important;
  animation: ghost-pulse 0.8s ease-in-out infinite !important;
}

@keyframes ghost-pulse {
  0%, 100% {
    border-color: rgba(124, 58, 237, 0.6);
    box-shadow: 0 0 15px rgba(124, 58, 237, 0.3);
  }
  50% {
    border-color: rgba(124, 58, 237, 1);
    box-shadow: 0 0 25px rgba(124, 58, 237, 0.6);
  }
}

/* Tiles in rack/sets get a subtle bounce when receiving */
.rack-tiles .tile,
.set-tiles .tile {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), 
              box-shadow 0.2s ease,
              opacity 0.15s ease !important;
}
</style>