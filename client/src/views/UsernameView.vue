<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="pa-6" color="surface">
          <v-card-title class="text-center text-h4 text-primary mb-4">
            <v-icon size="48" class="mr-3">mdi-cards-playing</v-icon>
            Rummikub Online
          </v-card-title>
          
          <v-card-text>
            <v-form @submit.prevent="handleSubmit" ref="form">
              <v-text-field
                v-model="username"
                label="Choose your username"
                placeholder="Enter a unique username"
                prepend-inner-icon="mdi-account"
                :error-messages="errorMessage"
                :loading="isLoading"
                :disabled="isLoading"
                counter="20"
                maxlength="20"
                autofocus
                @keyup.enter="handleSubmit"
              />
              
              <v-btn
                type="submit"
                block
                size="large"
                class="mt-4"
                :loading="isLoading"
                :disabled="!isValid"
              >
                <v-icon left>mdi-login</v-icon>
                Enter Game
              </v-btn>
            </v-form>
          </v-card-text>
          
          <v-card-text class="text-center text-medium-emphasis">
            <v-divider class="mb-4" />
            <p class="text-body-2">
              Join the classic tile-rummy game online!
              <br />
              Play with friends or challenge our AI bots.
            </p>
            <v-btn
              variant="text"
              color="primary"
              class="mt-2"
              :to="{ name: 'Rules' }"
            >
              <v-icon start>mdi-book-open-page-variant</v-icon>
              How to Play
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { getSocket } from '@/plugins/socket';
import { useUserStore } from '@/stores/userStore';

const router = useRouter();
const userStore = useUserStore();

const username = ref('');
const errorMessage = ref('');
const isLoading = ref(false);

const isValid = computed(() => {
  const trimmed = username.value.trim();
  return trimmed.length >= 2 && trimmed.length <= 20;
});

async function handleSubmit() {
  if (!isValid.value) return;
  
  errorMessage.value = '';
  isLoading.value = true;
  
  const socket = getSocket();
  const trimmedUsername = username.value.trim();
  
  socket.emit('register-username', trimmedUsername, (response) => {
    isLoading.value = false;
    
    if (response.success) {
      userStore.setUser(response.user);
      router.push({ name: 'LobbyBrowser' });
    } else {
      errorMessage.value = response.error;
    }
  });
}
</script>
