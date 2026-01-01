<template>
  <v-container fluid class="pa-2 game-container">
    <v-row no-gutters class="flex-grow-1 flex-nowrap" style="min-height: 0;">
      <!-- Main Game Area -->
      <v-col cols="12" :md="showChat ? 9 : 12" class="d-flex flex-column game-main-column">
        <!-- Top Bar: Players Info & Timer -->
        <v-card color="surface" class="mb-2 pa-2">
          <div class="d-flex align-center justify-space-between flex-wrap ga-2">
            <!-- Players -->
            <div class="d-flex align-center ga-2 flex-wrap">
              <template v-for="(player, index) in gameStore.players" :key="player.socketId">
                <v-chip
                  :color="index === gameStore.currentPlayerIndex ? 'primary' : 'surface-variant'"
                  :variant="index === gameStore.currentPlayerIndex ? 'elevated' : 'flat'"
                  :class="['player-chip', { 'current-player': index === gameStore.currentPlayerIndex }]"
                >
                  <v-avatar start :color="player.isBot ? 'secondary' : 'accent'" size="24">
                    <v-icon v-if="player.isBot" size="small" color="white">mdi-robot</v-icon>
                    <span v-else class="text-caption font-weight-bold">{{ player.username.charAt(0) }}</span>
                  </v-avatar>
                  <span class="player-name">{{ player.username }}</span>
                  <v-chip size="x-small" class="ml-1" color="info">
                    {{ player.tileCount }}
                  </v-chip>
                  <v-icon v-if="player.isDisconnected" size="small" color="warning" class="ml-1">
                    mdi-wifi-off
                  </v-icon>
                </v-chip>
              </template>
            </div>
            
            <!-- Timer & Pool -->
            <div class="d-flex align-center ga-3">
              <v-chip color="info">
                <v-icon start>mdi-cards</v-icon>
                Pool: {{ gameStore.poolCount }}
              </v-chip>
              
              <v-chip
                v-if="gameStore.isMyTurn"
                :color="gameStore.turnTimeRemaining <= 10 ? 'error' : 'warning'"
                class="timer-chip"
              >
                <v-icon start>mdi-timer</v-icon>
                {{ formatTime(gameStore.turnTimeRemaining) }}
              </v-chip>
              
              <v-btn
                icon="mdi-chat"
                variant="text"
                @click="showChat = !showChat"
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
                :key="setIndex"
                class="tile-set"
                :class="{ 'invalid-set': !isSetValid(set) }"
              >
                <draggable
                  :list="set"
                  :group="{ name: 'tiles', pull: gameStore.isMyTurn, put: gameStore.isMyTurn }"
                  item-key="id"
                  class="set-tiles"
                  :animation="150"
                  ghost-class="tile-ghost"
                  drag-class="tile-dragging"
                  :force-fallback="true"
                  :fallback-class="'tile-fallback'"
                  :fallback-on-body="true"
                  :move="onTableTileMove"
                  @start="onDragStart"
                  @change="onSetChange(setIndex)"
                >
                  <template #item="{ element: tile }">
                    <TileComponent 
                      :tile="tile" 
                      :draggable="gameStore.isMyTurn && !tile.isJoker" 
                      :highlighted="gameStore.highlightedTileIds.has(tile.id)"
                      :class="{ 'tile-locked': tile.isJoker }"
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
              ghost-class="tile-ghost"
              :force-fallback="true"
              :fallback-class="'tile-fallback'"
              :fallback-on-body="true"
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
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="text-subtitle-2">
              <v-icon size="small" class="mr-1">mdi-hand-back-left</v-icon>
              Your Tiles ({{ localMyTiles.length }})
            </div>
            
            <div class="d-flex ga-2">
              <!-- Sort buttons -->
              <v-btn-group density="compact" variant="outlined" color="secondary">
                <v-btn
                  size="small"
                  @click="gameStore.sortTilesByColor()"
                  title="Sort by color"
                >
                  <v-icon>mdi-palette</v-icon>
                </v-btn>
                <v-btn
                  size="small"
                  @click="gameStore.sortTilesByNumber()"
                  title="Sort by number"
                >
                  <v-icon>mdi-sort-numeric-ascending</v-icon>
                </v-btn>
              </v-btn-group>
              
              <v-btn
                v-if="gameStore.isMyTurn && gameStore.hasChanges"
                color="warning"
                size="small"
                variant="outlined"
                @click="revertChanges"
              >
                <v-icon left>mdi-undo</v-icon>
                Revert
              </v-btn>
              
              <v-btn
                v-if="gameStore.isMyTurn && !gameStore.hasChanges"
                color="info"
                size="small"
                @click="drawTile"
                :disabled="gameStore.poolCount === 0"
                :loading="isDrawing"
              >
                <v-icon left>mdi-download</v-icon>
                Draw Tile
              </v-btn>
              
              <v-btn
                v-if="gameStore.isMyTurn"
                color="success"
                size="small"
                @click="endTurn"
                :disabled="!gameStore.hasChanges && gameStore.poolCount > 0"
                :loading="isEndingTurn"
              >
                <v-icon left>mdi-check</v-icon>
                End Turn
              </v-btn>
            </div>
          </div>
          
          <draggable
            v-model="localMyTiles"
            :group="{ name: 'tiles', pull: gameStore.isMyTurn, put: gameStore.isMyTurn }"
            item-key="id"
            class="rack-tiles"
            :animation="150"
            ghost-class="tile-ghost"
            drag-class="tile-dragging"
            :force-fallback="true"
            :fallback-class="'tile-fallback'"
            :fallback-on-body="true"
            @start="onDragStart"
            @change="onRackChange"
          >
            <template #item="{ element: tile }">
              <TileComponent :tile="tile" :draggable="gameStore.isMyTurn" />
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
  const sets = [...localTableSets.value];
  let set = sets[setIndex];
  
  // Clean up empty sets
  if (!set || set.length === 0) {
    sets.splice(setIndex, 1);
    gameStore.updateLocalTableSets(sets);
    return;
  }
  
  // Auto-sort runs (same color tiles should be sorted by number)
  set = autoSortSet(set);
  sets[setIndex] = set;
  
  // Update the sets before validation so the sorted version is shown
  gameStore.updateLocalTableSets(sets);
  
  // Validate the set
  const error = validateSetPlacement(set);
  if (error) {
    showInvalidMove(error);
    revertToSavedState();
    return;
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

// Insert jokers into gaps in a run
function insertJokersInGaps(sortedSet) {
  const regularTiles = sortedSet.filter(t => !t.isJoker);
  const jokers = sortedSet.filter(t => t.isJoker);
  
  if (jokers.length === 0 || regularTiles.length === 0) return sortedSet;
  
  // Build the run with jokers filling gaps
  const result = [];
  let jokerIndex = 0;
  
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
  
  // Add remaining jokers at the end
  while (jokerIndex < jokers.length) {
    result.push(jokers[jokerIndex++]);
  }
  
  return result;
}

// Called before any drag starts to save current state
function onDragStart() {
  saveState();
}

// Prevent jokers on the table from being moved to the player's rack
function onTableTileMove(evt) {
  // If the tile being moved is a joker and it's going to the rack, prevent it
  const draggedTile = evt.draggedContext?.element;
  const toRack = evt.to?.classList?.contains('rack-tiles');
  
  if (draggedTile?.isJoker && toRack) {
    showInvalidMove('Jokers on the table cannot be taken back to your hand');
    return false;
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

/* Drag and drop styles */
.tile-ghost {
  opacity: 0.4;
  background: rgba(124, 58, 237, 0.3) !important;
  border: 2px dashed rgba(124, 58, 237, 0.6) !important;
  border-radius: 10px;
}

.tile-dragging {
  opacity: 0;
}

.tile-fallback {
  opacity: 1 !important;
  transform: rotate(5deg);
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.5),
    0 0 30px rgba(124, 58, 237, 0.3) !important;
  z-index: 9999 !important;
}

/* Prevent layout shifts during drag */
.set-tiles {
  min-width: max-content;
}

.tile-set {
  flex-shrink: 0;
}

.sortable-ghost {
  opacity: 0.4;
}

.sortable-drag {
  opacity: 0;
}

/* Jokers on table are locked (cannot be dragged to hand) */
.tile-locked {
  cursor: not-allowed !important;
  position: relative;
}

.tile-locked::before {
  content: '🔒';
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 12px;
  z-index: 10;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}
</style>
