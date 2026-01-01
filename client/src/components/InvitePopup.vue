<template>
  <v-dialog
    :model-value="!!notificationStore.pendingInvite"
    max-width="400"
    persistent
  >
    <v-card v-if="invite">
      <v-card-title class="text-center pt-6">
        <v-avatar color="primary" size="64" class="mb-4">
          <v-icon size="32">mdi-email-open</v-icon>
        </v-avatar>
        <div>Lobby Invitation</div>
      </v-card-title>
      
      <v-card-text class="text-center">
        <p class="text-h6 mb-2">
          <strong class="text-primary">{{ invite.hostUsername }}</strong>
          <br />
          invited you to their lobby!
        </p>
        
        <v-chip class="ma-1">
          <v-icon start>mdi-account-group</v-icon>
          {{ invite.playerCount }}/{{ invite.maxPlayers }} players
        </v-chip>
      </v-card-text>
      
      <v-card-actions class="justify-center pb-6">
        <v-btn
          color="error"
          variant="outlined"
          @click="declineInvite"
          :loading="isLoading"
        >
          <v-icon left>mdi-close</v-icon>
          Decline
        </v-btn>
        
        <v-btn
          color="success"
          @click="acceptInvite"
          :loading="isLoading"
        >
          <v-icon left>mdi-check</v-icon>
          Accept
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '@/stores/notificationStore';
import { useLobbyStore } from '@/stores/lobbyStore';

const router = useRouter();
const notificationStore = useNotificationStore();
const lobbyStore = useLobbyStore();

const isLoading = ref(false);

const invite = computed(() => notificationStore.pendingInvite);

async function acceptInvite() {
  if (!invite.value) return;
  
  isLoading.value = true;
  try {
    await lobbyStore.joinLobby(invite.value.lobbyId);
    notificationStore.clearInvite();
    router.push({ name: 'Lobby', params: { id: invite.value.lobbyId } });
  } catch (error) {
    notificationStore.addNotification({
      type: 'error',
      title: 'Could not join',
      message: error.message
    });
    notificationStore.clearInvite();
  } finally {
    isLoading.value = false;
  }
}

function declineInvite() {
  notificationStore.clearInvite();
}
</script>
