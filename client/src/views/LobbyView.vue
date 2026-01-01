<template>
  <v-container fluid class="pa-6">
    <v-row>
      <!-- Main Lobby Content -->
      <v-col cols="12" md="8">
        <v-card color="surface" class="mb-4">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-home</v-icon>
            {{ lobby?.hostUsername }}'s Lobby
            <v-chip
              class="ml-2"
              :color="lobby?.isPublic ? 'success' : 'warning'"
              size="small"
            >
              {{ lobby?.isPublic ? 'Public' : 'Private' }}
            </v-chip>
            <v-spacer />
            <v-btn
              variant="outlined"
              color="error"
              size="small"
              @click="leaveLobby"
            >
              <v-icon left>mdi-exit-to-app</v-icon>
              Leave
            </v-btn>
          </v-card-title>
          
          <v-card-text>
            <!-- Players List -->
            <h3 class="text-h6 mb-3">
              <v-icon class="mr-1">mdi-account-group</v-icon>
              Players ({{ lobby?.players.length || 0 }}/{{ lobby?.rules.maxPlayers || 4 }})
            </h3>
            
            <v-row>
              <v-col
                v-for="player in lobby?.players"
                :key="player.socketId"
                cols="12"
                sm="6"
                md="4"
              >
                <v-card
                  :color="player.username === lobby?.hostUsername ? 'primary' : 'surface-variant'"
                  class="pa-3 player-card"
                >
                  <div class="d-flex align-center">
                    <v-avatar
                      :color="player.isBot ? 'secondary' : 'accent'"
                      size="40"
                      class="mr-3"
                    >
                      <v-icon v-if="player.isBot">mdi-robot</v-icon>
                      <span v-else>{{ player.username.charAt(0).toUpperCase() }}</span>
                    </v-avatar>
                    
                    <div class="flex-grow-1">
                      <div class="font-weight-bold">{{ player.username }}</div>
                      <div class="text-caption text-medium-emphasis">
                        <span v-if="player.username === lobby?.hostUsername">
                          <v-icon size="x-small">mdi-crown</v-icon> Host
                        </span>
                        <span v-else-if="player.isBot">
                          {{ player.botDifficulty }} bot
                        </span>
                        <span v-else>Player</span>
                      </div>
                    </div>
                    
                    <v-btn
                      v-if="isHost && player.username !== lobby?.hostUsername"
                      icon="mdi-close"
                      variant="text"
                      size="small"
                      color="error"
                      @click="removePlayer(player.socketId)"
                    />
                  </div>
                </v-card>
              </v-col>
              
              <!-- Add Bot Button -->
              <v-col
                v-if="isHost && (lobby?.players.length || 0) < (lobby?.rules.maxPlayers || 4)"
                cols="12"
                sm="6"
                md="4"
              >
                <v-card
                  color="surface-variant"
                  class="pa-3 add-bot-card player-card"
                  @click="showAddBotDialog = true"
                >
                  <div class="d-flex align-center justify-center add-bot-content" style="height: 40px;">
                    <v-icon class="mr-2">mdi-robot</v-icon>
                    Add Bot
                  </div>
                </v-card>
              </v-col>
            </v-row>
            
            <!-- Invite Section (Host only) -->
            <div v-if="isHost" class="mt-6">
              <h3 class="text-h6 mb-3">
                <v-icon class="mr-1">mdi-account-plus</v-icon>
                Invite Player
              </h3>
              
              <v-row>
                <v-col cols="12" sm="8">
                  <v-autocomplete
                    v-model="selectedUser"
                    :items="availableUsers"
                    item-title="username"
                    item-value="username"
                    label="Select a player to invite"
                    prepend-inner-icon="mdi-account-search"
                    clearable
                    no-data-text="No available players"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-btn
                    block
                    :disabled="!selectedUser"
                    @click="invitePlayer"
                    :loading="isInviting"
                  >
                    <v-icon left>mdi-send</v-icon>
                    Send Invite
                  </v-btn>
                </v-col>
              </v-row>
            </div>
          </v-card-text>
        </v-card>
        
        <!-- Rules Configuration (Host only) -->
        <v-card v-if="isHost" color="surface">
          <v-card-title>
            <v-icon class="mr-2">mdi-cog</v-icon>
            Game Rules
          </v-card-title>
          
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="rulePreset"
                  :items="['Official', 'Custom']"
                  label="Rule Preset"
                  @update:model-value="onPresetChange"
                />
              </v-col>
              
              <v-col cols="12" sm="6">
                <v-switch
                  v-model="isPublic"
                  label="Public Lobby"
                  color="primary"
                  @update:model-value="toggleVisibility"
                />
              </v-col>
            </v-row>
            
            <v-expand-transition>
              <div v-if="rulePreset === 'Custom'">
                <v-row>
                  <v-col cols="12" sm="4">
                    <v-text-field
                      v-model.number="customRules.initialMeldPoints"
                      type="number"
                      label="Initial Meld Points"
                      min="0"
                      max="100"
                      @update:model-value="updateRules"
                    />
                  </v-col>
                  
                  <v-col cols="12" sm="4">
                    <v-text-field
                      v-model.number="customRules.turnTimerSeconds"
                      type="number"
                      label="Turn Timer (seconds)"
                      min="15"
                      max="300"
                      @update:model-value="updateRules"
                    />
                  </v-col>
                  
                  <v-col cols="12" sm="4">
                    <v-text-field
                      v-model.number="customRules.jokerCount"
                      type="number"
                      label="Number of Jokers"
                      min="0"
                      max="4"
                      @update:model-value="updateRules"
                    />
                  </v-col>
                </v-row>
              </div>
            </v-expand-transition>
            
            <!-- Current Rules Display -->
            <v-alert type="info" variant="tonal" class="mt-4">
              <div class="d-flex flex-wrap ga-2">
                <v-chip size="small">
                  <v-icon start size="small">mdi-numeric</v-icon>
                  {{ lobby?.rules.initialMeldPoints }} pts initial meld
                </v-chip>
                <v-chip size="small">
                  <v-icon start size="small">mdi-timer</v-icon>
                  {{ lobby?.rules.turnTimerSeconds }}s turns
                </v-chip>
                <v-chip size="small">
                  <v-icon start size="small">mdi-cards</v-icon>
                  {{ lobby?.rules.jokerCount }} jokers
                </v-chip>
              </div>
            </v-alert>
          </v-card-text>
        </v-card>
        
        <!-- Rules Display (Non-host) -->
        <v-card v-else color="surface">
          <v-card-title>
            <v-icon class="mr-2">mdi-information</v-icon>
            Game Rules
          </v-card-title>
          
          <v-card-text>
            <v-alert type="info" variant="tonal">
              <div class="d-flex flex-wrap ga-2">
                <v-chip size="small">{{ lobby?.rules.name }}</v-chip>
                <v-chip size="small">{{ lobby?.rules.initialMeldPoints }} pts initial meld</v-chip>
                <v-chip size="small">{{ lobby?.rules.turnTimerSeconds }}s turns</v-chip>
                <v-chip size="small">{{ lobby?.rules.jokerCount }} jokers</v-chip>
              </div>
            </v-alert>
          </v-card-text>
        </v-card>
        
        <!-- Start Game Button (Host only) -->
        <v-btn
          v-if="isHost"
          color="success"
          size="x-large"
          block
          class="mt-4"
          :disabled="!canStartGame"
          :loading="isStarting"
          @click="startGame"
        >
          <v-icon left size="large">mdi-play</v-icon>
          Start Game
        </v-btn>
        
        <v-alert
          v-else
          type="info"
          variant="tonal"
          class="mt-4"
        >
          Waiting for host to start the game...
        </v-alert>
      </v-col>
      
      <!-- Chat Panel -->
      <v-col cols="12" md="4">
        <ChatPanel
          :messages="lobbyStore.chatMessages"
          @send="sendMessage"
        />
      </v-col>
    </v-row>
    
    <!-- Add Bot Dialog -->
    <v-dialog v-model="showAddBotDialog" max-width="400">
      <v-card>
        <v-card-title>Add Bot Player</v-card-title>
        
        <v-card-text>
          <v-radio-group v-model="selectedBotDifficulty">
            <v-radio value="easy" color="success">
              <template #label>
                <div>
                  <strong>Easy</strong>
                  <div class="text-caption text-medium-emphasis">
                    Plays simple, obvious sets
                  </div>
                </div>
              </template>
            </v-radio>
            
            <v-radio value="medium" color="warning">
              <template #label>
                <div>
                  <strong>Medium</strong>
                  <div class="text-caption text-medium-emphasis">
                    Plans multi-tile plays with basic strategy
                  </div>
                </div>
              </template>
            </v-radio>
            
            <v-radio value="hard" color="error">
              <template #label>
                <div>
                  <strong>Hard</strong>
                  <div class="text-caption text-medium-emphasis">
                    Uses table manipulation and optimal strategies
                  </div>
                </div>
              </template>
            </v-radio>
          </v-radio-group>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showAddBotDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="addBot">Add Bot</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useUserStore } from '@/stores/userStore';
import { useGameStore } from '@/stores/gameStore';
import { useNotificationStore } from '@/stores/notificationStore';
import ChatPanel from '@/components/ChatPanel.vue';

const router = useRouter();
const route = useRoute();
const lobbyStore = useLobbyStore();
const userStore = useUserStore();
const gameStore = useGameStore();
const notificationStore = useNotificationStore();

const showAddBotDialog = ref(false);
const selectedBotDifficulty = ref('medium');
const selectedUser = ref(null);
const isInviting = ref(false);
const isStarting = ref(false);
const rulePreset = ref('Official');
const isPublic = ref(true);
const customRules = ref({
  initialMeldPoints: 30,
  turnTimerSeconds: 120,
  jokerCount: 2
});

const lobby = computed(() => lobbyStore.currentLobby);
const isHost = computed(() => lobbyStore.isHost);
const canStartGame = computed(() => {
  return lobby.value && lobby.value.players.length >= 2;
});

const availableUsers = computed(() => {
  return userStore.getAvailableUsers().filter(u => 
    !lobby.value?.players.some(p => p.username === u.username)
  );
});

onMounted(async () => {
  // If no lobby, check if we should join one
  if (!lobby.value && route.params.id) {
    try {
      await lobbyStore.joinLobby(route.params.id);
    } catch (error) {
      router.push({ name: 'LobbyBrowser' });
    }
  } else if (!lobby.value) {
    router.push({ name: 'LobbyBrowser' });
  }
  
  // Update local state from lobby
  if (lobby.value) {
    isPublic.value = lobby.value.isPublic;
    rulePreset.value = lobby.value.rules.name;
    if (lobby.value.rules.name === 'Custom') {
      customRules.value = {
        initialMeldPoints: lobby.value.rules.initialMeldPoints,
        turnTimerSeconds: lobby.value.rules.turnTimerSeconds,
        jokerCount: lobby.value.rules.jokerCount
      };
    }
  }
});

// Watch for game start
watch(() => gameStore.isInGame, (inGame) => {
  if (inGame) {
    router.push({ name: 'Game' });
  }
});

async function leaveLobby() {
  await lobbyStore.leaveLobby();
  router.push({ name: 'LobbyBrowser' });
}

async function addBot() {
  try {
    await lobbyStore.addBot(selectedBotDifficulty.value);
    showAddBotDialog.value = false;
  } catch (error) {
    notificationStore.addNotification({
      type: 'error',
      title: 'Error',
      message: error.message
    });
  }
}

async function removePlayer(socketId) {
  try {
    await lobbyStore.removePlayer(socketId);
  } catch (error) {
    notificationStore.addNotification({
      type: 'error',
      title: 'Error',
      message: error.message
    });
  }
}

async function invitePlayer() {
  if (!selectedUser.value) return;
  
  isInviting.value = true;
  try {
    await lobbyStore.inviteUser(selectedUser.value);
    notificationStore.addNotification({
      type: 'success',
      title: 'Invite Sent',
      message: `Invitation sent to ${selectedUser.value}`
    });
    selectedUser.value = null;
  } catch (error) {
    notificationStore.addNotification({
      type: 'error',
      title: 'Error',
      message: error.message
    });
  } finally {
    isInviting.value = false;
  }
}

function onPresetChange(preset) {
  if (preset === 'Official') {
    updateRules({
      name: 'Official',
      initialMeldPoints: 30,
      turnTimerSeconds: 120,
      jokerCount: 2
    });
  } else {
    updateRules({
      name: 'Custom',
      ...customRules.value
    });
  }
}

async function updateRules(rules) {
  try {
    await lobbyStore.updateRules(rules || {
      name: 'Custom',
      ...customRules.value
    });
  } catch (error) {
    notificationStore.addNotification({
      type: 'error',
      title: 'Error',
      message: error.message
    });
  }
}

async function toggleVisibility(value) {
  try {
    await lobbyStore.togglePublic(value);
  } catch (error) {
    notificationStore.addNotification({
      type: 'error',
      title: 'Error',
      message: error.message
    });
  }
}

async function startGame() {
  isStarting.value = true;
  try {
    await lobbyStore.startGame();
    // Navigation handled by watcher
  } catch (error) {
    notificationStore.addNotification({
      type: 'error',
      title: 'Cannot Start Game',
      message: error.message
    });
  } finally {
    isStarting.value = false;
  }
}

function sendMessage(message) {
  lobbyStore.sendMessage(message);
}
</script>

<style scoped>
.player-card {
  color: #e2e8f0 !important;
}

.player-card .font-weight-bold,
.player-card .text-caption,
.player-card span {
  color: #e2e8f0 !important;
}

.add-bot-card {
  cursor: pointer;
  border: 2px dashed rgba(255, 255, 255, 0.3);
  transition: border-color 0.2s;
}

.add-bot-card:hover {
  border-color: rgb(var(--v-theme-primary));
}

.add-bot-content {
  color: #e2e8f0 !important;
}
</style>
