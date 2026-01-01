<template>
  <v-container fluid class="fill-height pa-6">
    <v-row align="center" justify="center">
      <v-col cols="12" md="8" lg="6">
        <!-- Winner Announcement -->
        <v-card color="surface" class="text-center pa-6 mb-6">
          <div class="confetti" v-if="isWinner" />
          
          <v-avatar
            :color="isWinner ? 'warning' : 'primary'"
            size="80"
            class="mb-4"
          >
            <v-icon size="48">
              {{ isWinner ? 'mdi-trophy' : 'mdi-flag-checkered' }}
            </v-icon>
          </v-avatar>
          
          <h1 class="text-h3 mb-2" :class="isWinner ? 'text-warning' : 'text-primary'">
            {{ isWinner ? 'You Won!' : 'Game Over' }}
          </h1>
          
          <h2 class="text-h5 text-medium-emphasis mb-4">
            {{ gameStore.winner?.username }} wins the game!
          </h2>
          
          <!-- Game Stats -->
          <v-row class="mt-4 mb-6" justify="center">
            <v-col cols="auto">
              <v-card color="surface-variant" class="pa-4 text-center" min-width="120">
                <v-icon size="large" class="mb-2">mdi-timer</v-icon>
                <div class="text-h6">{{ formatDuration(gameStore.stats?.duration) }}</div>
                <div class="text-caption text-medium-emphasis">Duration</div>
              </v-card>
            </v-col>
            <v-col cols="auto">
              <v-card color="surface-variant" class="pa-4 text-center" min-width="120">
                <v-icon size="large" class="mb-2">mdi-counter</v-icon>
                <div class="text-h6">{{ gameStore.stats?.turnsPlayed || 0 }}</div>
                <div class="text-caption text-medium-emphasis">Turns Played</div>
              </v-card>
            </v-col>
          </v-row>
        </v-card>
        
        <!-- Scoreboard -->
        <v-card color="surface" class="mb-6">
          <v-card-title class="text-center">
            <v-icon class="mr-2">mdi-podium</v-icon>
            Final Scores
          </v-card-title>
          
          <v-card-text>
            <v-table class="bg-transparent">
              <thead>
                <tr>
                  <th class="text-left">Rank</th>
                  <th class="text-left">Player</th>
                  <th class="text-center">Tiles Left</th>
                  <th class="text-center">Penalty Points</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(score, index) in gameStore.scores"
                  :key="score.socketId"
                  :class="{ 'winner-row': score.isWinner }"
                >
                  <td>
                    <v-avatar
                      :color="getRankColor(index)"
                      size="32"
                    >
                      <span v-if="index < 3">{{ getRankIcon(index) }}</span>
                      <span v-else>{{ index + 1 }}</span>
                    </v-avatar>
                  </td>
                  <td>
                    <div class="d-flex align-center">
                      <strong>{{ score.username }}</strong>
                      <v-chip
                        v-if="score.isWinner"
                        color="warning"
                        size="x-small"
                        class="ml-2"
                      >
                        Winner
                      </v-chip>
                    </div>
                  </td>
                  <td class="text-center">{{ score.tilesRemaining }}</td>
                  <td class="text-center">
                    <v-chip
                      :color="score.penaltyPoints === 0 ? 'success' : 'error'"
                      size="small"
                    >
                      {{ score.penaltyPoints }}
                    </v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
        
        <!-- Rematch Voting -->
        <v-card color="surface" class="mb-6">
          <v-card-title class="text-center">
            <v-icon class="mr-2">mdi-vote</v-icon>
            Rematch Vote
          </v-card-title>
          
          <v-card-text class="text-center">
            <!-- Voting Status -->
            <div v-if="gameStore.rematchVoteStats.totalPlayers > 0" class="mb-4">
              <v-progress-linear
                :model-value="voteProgress"
                color="success"
                height="24"
                rounded
                class="mb-2"
              >
                <template v-slot:default>
                  <span class="text-body-2 font-weight-bold">
                    {{ gameStore.rematchVoteStats.yesVotes }} / {{ gameStore.rematchVoteStats.totalPlayers }} ready
                  </span>
                </template>
              </v-progress-linear>
              
              <!-- Player Vote Indicators -->
              <div class="d-flex flex-wrap justify-center ga-2 mt-3">
                <v-chip
                  v-for="score in humanPlayers"
                  :key="score.socketId"
                  :color="getVoteColor(score.socketId)"
                  variant="tonal"
                  size="small"
                >
                  <v-icon start size="small">{{ getVoteIcon(score.socketId) }}</v-icon>
                  {{ score.username }}
                </v-chip>
              </div>
            </div>
            
            <!-- Vote Buttons (if not voted yet) -->
            <div v-if="!gameStore.hasVotedRematch && !isBot">
              <div class="text-body-1 mb-4 text-medium-emphasis">
                Would you like to play again with the same players?
              </div>
              <v-row justify="center">
                <v-col cols="auto">
                  <v-btn
                    color="success"
                    size="large"
                    @click="voteYes"
                    variant="elevated"
                  >
                    <v-icon left>mdi-check</v-icon>
                    Yes, Rematch!
                  </v-btn>
                </v-col>
                <v-col cols="auto">
                  <v-btn
                    color="error"
                    size="large"
                    @click="voteNo"
                    variant="outlined"
                  >
                    <v-icon left>mdi-close</v-icon>
                    No Thanks
                  </v-btn>
                </v-col>
              </v-row>
            </div>
            
            <!-- Waiting for others (if already voted) -->
            <div v-else-if="gameStore.hasVotedRematch" class="text-center">
              <v-progress-circular
                indeterminate
                color="primary"
                size="32"
                class="mr-2"
              />
              <span class="text-body-1">Waiting for other players to vote...</span>
            </div>
          </v-card-text>
        </v-card>
        
        <!-- Return to Lobbies Button (always visible) -->
        <v-row justify="center">
          <v-col cols="auto">
            <v-btn
              color="secondary"
              size="large"
              variant="outlined"
              @click="returnToLobby"
            >
              <v-icon left>mdi-home</v-icon>
              Return to Lobbies
            </v-btn>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '@/stores/gameStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useUserStore } from '@/stores/userStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { getSocket } from '@/plugins/socket';

const router = useRouter();
const gameStore = useGameStore();
const lobbyStore = useLobbyStore();
const userStore = useUserStore();
const notificationStore = useNotificationStore();

const isWinner = computed(() => {
  const socket = getSocket();
  return gameStore.winner?.socketId === socket?.id;
});

const isBot = computed(() => {
  const socket = getSocket();
  const myPlayer = gameStore.players.find(p => p.socketId === socket?.id);
  return myPlayer?.isBot || false;
});

const humanPlayers = computed(() => {
  return gameStore.scores.filter(s => !s.isBot);
});

const voteProgress = computed(() => {
  const stats = gameStore.rematchVoteStats;
  if (stats.totalPlayers === 0) return 0;
  return (stats.yesVotes / stats.totalPlayers) * 100;
});

function getVoteColor(socketId) {
  const vote = gameStore.rematchVotes[socketId];
  if (vote === true) return 'success';
  if (vote === false) return 'error';
  return 'grey';
}

function getVoteIcon(socketId) {
  const vote = gameStore.rematchVotes[socketId];
  if (vote === true) return 'mdi-check';
  if (vote === false) return 'mdi-close';
  return 'mdi-help';
}

function getRankColor(index) {
  switch (index) {
    case 0: return 'warning';
    case 1: return 'grey-lighten-1';
    case 2: return 'orange-darken-2';
    default: return 'surface-variant';
  }
}

function getRankIcon(index) {
  switch (index) {
    case 0: return '🥇';
    case 1: return '🥈';
    case 2: return '🥉';
    default: return index + 1;
  }
}

function formatDuration(ms) {
  if (!ms) return '0:00';
  
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function voteYes() {
  gameStore.voteRematch(true);
}

function voteNo() {
  gameStore.declineRematch();
}

function returnToLobby() {
  const socket = getSocket();
  // Properly leave the game on the server
  socket.emit('leave-game', () => {
    gameStore.clearGame();
    gameStore.resetRematchState();
    lobbyStore.clearCurrentLobby();
    router.push({ name: 'LobbyBrowser' });
  });
}
</script>

<style scoped>
.winner-row {
  background: rgba(var(--v-theme-warning), 0.15);
}

/* Ensure all text is readable on dark background */
:deep(.v-table) {
  color: #e2e8f0 !important;
}

:deep(.v-table th) {
  color: #a0aec0 !important;
}

:deep(.v-table td) {
  color: #e2e8f0 !important;
}

:deep(.v-card) {
  color: #e2e8f0 !important;
}

:deep(.v-avatar span) {
  color: #e2e8f0 !important;
}

.text-h3, .text-h5, .text-h6 {
  color: #e2e8f0 !important;
}

.text-medium-emphasis {
  color: #a0aec0 !important;
}

.confetti {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 100vh;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Ccircle cx='25' cy='25' r='3' fill='%23FFD700'/%3E%3Ccircle cx='75' cy='25' r='3' fill='%23FF6B6B'/%3E%3Ccircle cx='25' cy='75' r='3' fill='%234ECDC4'/%3E%3Ccircle cx='75' cy='75' r='3' fill='%23FFE66D'/%3E%3Ccircle cx='50' cy='50' r='3' fill='%23C44569'/%3E%3C/svg%3E");
  animation: confetti-fall 3s linear infinite;
  opacity: 0.6;
}

@keyframes confetti-fall {
  0% { background-position: 0 0; }
  100% { background-position: 0 100vh; }
}
</style>
