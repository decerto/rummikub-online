<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-6">
      <v-col>
        <div class="d-flex align-center justify-space-between">
          <div>
            <h1 class="text-h4 text-primary">
              <v-icon class="mr-2">mdi-cards-playing</v-icon>
              Lobby Browser
            </h1>
            <p class="text-medium-emphasis mt-1">
              Welcome, <strong class="text-primary">{{ userStore.username }}</strong>!
              Join a game or create your own lobby.
            </p>
          </div>
          
          <div class="d-flex align-center ga-2">
            <v-badge
              :content="notificationStore.unreadCount"
              :model-value="notificationStore.hasUnread"
              color="error"
            >
              <v-btn
                icon="mdi-bell"
                variant="outlined"
                @click="notificationStore.togglePanel"
              />
            </v-badge>
            
            <v-btn
              color="primary"
              size="large"
              @click="createNewLobby"
              :loading="isCreating"
            >
              <v-icon left>mdi-plus</v-icon>
              Create Lobby
            </v-btn>
          </div>
        </div>
      </v-col>
    </v-row>
    
    <!-- Public Lobbies -->
    <v-row>
      <v-col cols="12">
        <v-card color="surface">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-account-group</v-icon>
            Public Lobbies
            <v-spacer />
            <v-btn
              icon="mdi-refresh"
              variant="text"
              size="small"
              @click="refreshLobbies"
              :loading="isRefreshing"
            />
          </v-card-title>
          
          <v-card-text>
            <v-row v-if="lobbyStore.publicLobbies.length > 0">
              <v-col
                v-for="lobby in lobbyStore.publicLobbies"
                :key="lobby.id"
                cols="12"
                sm="6"
                md="4"
                lg="3"
              >
                <v-card
                  color="surface-variant"
                  class="lobby-card"
                  @click="joinLobby(lobby.id)"
                >
                  <v-card-title class="text-h6">
                    {{ lobby.hostUsername }}'s Lobby
                  </v-card-title>
                  
                  <v-card-text>
                    <div class="d-flex align-center mb-2">
                      <v-icon size="small" class="mr-1">mdi-account-multiple</v-icon>
                      {{ lobby.playerCount }} / {{ lobby.maxPlayers }} players
                    </div>
                    
                    <v-chip
                      size="small"
                      :color="lobby.rules.name === 'Official' ? 'success' : 'warning'"
                      class="mr-1"
                    >
                      {{ lobby.rules.name }}
                    </v-chip>
                    
                    <v-chip size="small" color="info">
                      {{ lobby.rules.turnTimerSeconds }}s turns
                    </v-chip>
                  </v-card-text>
                  
                  <v-card-actions>
                    <v-btn
                      color="primary"
                      variant="elevated"
                      block
                      :disabled="lobby.playerCount >= lobby.maxPlayers"
                    >
                      <v-icon left>mdi-login</v-icon>
                      Join
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>
            
            <v-alert
              v-else
              type="info"
              variant="tonal"
              class="text-center"
            >
              <v-icon class="mr-2">mdi-information</v-icon>
              No public lobbies available. Create one to get started!
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    
    <!-- Online Users -->
    <v-row class="mt-4">
      <v-col cols="12" md="6">
        <v-card color="surface">
          <v-card-title>
            <v-icon class="mr-2">mdi-account-circle</v-icon>
            Online Users
            <v-chip size="small" class="ml-2" color="success">
              {{ userStore.onlineUsers.length }}
            </v-chip>
          </v-card-title>
          
          <v-card-text>
            <v-list density="compact" bg-color="transparent">
              <v-list-item
                v-for="user in userStore.onlineUsers"
                :key="user.username"
              >
                <template #prepend>
                  <v-avatar color="primary" size="32">
                    {{ user.username.charAt(0).toUpperCase() }}
                  </v-avatar>
                </template>
                
                <v-list-item-title>{{ user.username }}</v-list-item-title>
                
                <v-list-item-subtitle v-if="user.lobbyId">
                  In a lobby
                </v-list-item-subtitle>
                <v-list-item-subtitle v-else class="text-success">
                  Available
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
            
            <v-alert
              v-if="userStore.onlineUsers.length === 0"
              type="info"
              variant="tonal"
              density="compact"
            >
              No other users online
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
      
      <!-- Quick Start with Bots -->
      <v-col cols="12" md="6">
        <v-card color="surface">
          <v-card-title>
            <v-icon class="mr-2">mdi-robot</v-icon>
            Quick Play
          </v-card-title>
          
          <v-card-text>
            <p class="text-medium-emphasis mb-4">
              Start a game immediately with AI opponents
            </p>
            
            <v-btn
              color="secondary"
              block
              class="mb-2"
              @click="quickPlayWithBots('easy')"
            >
              <v-icon left>mdi-emoticon-happy</v-icon>
              Play vs Easy Bots
            </v-btn>
            
            <v-btn
              color="warning"
              block
              class="mb-2"
              @click="quickPlayWithBots('medium')"
            >
              <v-icon left>mdi-emoticon-neutral</v-icon>
              Play vs Medium Bots
            </v-btn>
            
            <v-btn
              color="error"
              block
              @click="quickPlayWithBots('hard')"
            >
              <v-icon left>mdi-emoticon-devil</v-icon>
              Play vs Hard Bots
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/userStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { getSocket } from '@/plugins/socket';

const router = useRouter();
const userStore = useUserStore();
const lobbyStore = useLobbyStore();
const notificationStore = useNotificationStore();

const isCreating = ref(false);
const isRefreshing = ref(false);

onMounted(() => {
  refreshLobbies();
  fetchOnlineUsers();
});

function refreshLobbies() {
  isRefreshing.value = true;
  lobbyStore.fetchPublicLobbies();
  setTimeout(() => {
    isRefreshing.value = false;
  }, 500);
}

function fetchOnlineUsers() {
  const socket = getSocket();
  socket.emit('get-online-users', (users) => {
    userStore.setOnlineUsers(users);
  });
}

async function createNewLobby() {
  isCreating.value = true;
  try {
    await lobbyStore.createLobby(true);
    router.push({ name: 'Lobby' });
  } catch (error) {
    notificationStore.addNotification({
      type: 'error',
      title: 'Error',
      message: error.message
    });
  } finally {
    isCreating.value = false;
  }
}

async function joinLobby(lobbyId) {
  try {
    await lobbyStore.joinLobby(lobbyId);
    router.push({ name: 'Lobby', params: { id: lobbyId } });
  } catch (error) {
    notificationStore.addNotification({
      type: 'error',
      title: 'Could not join lobby',
      message: error.message
    });
  }
}

async function quickPlayWithBots(difficulty) {
  isCreating.value = true;
  try {
    await lobbyStore.createLobby(false);
    // Add a bot
    await lobbyStore.addBot(difficulty);
    router.push({ name: 'Lobby' });
  } catch (error) {
    notificationStore.addNotification({
      type: 'error',
      title: 'Error',
      message: error.message
    });
  } finally {
    isCreating.value = false;
  }
}
</script>

<style scoped>
.lobby-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.lobby-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
}
</style>
