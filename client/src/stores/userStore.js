import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useUserStore = defineStore('user', () => {
  // Try to restore username from sessionStorage
  const storedUsername = sessionStorage.getItem('rummikub-username') || '';
  
  const username = ref(storedUsername);
  const isRegistered = ref(false);
  const onlineUsers = ref([]);

  const isRegisteredComputed = computed(() => isRegistered.value && username.value);

  function setUser(user) {
    username.value = user.username;
    isRegistered.value = true;
    // Persist username for reconnection
    sessionStorage.setItem('rummikub-username', user.username);
  }

  function clearUser() {
    username.value = '';
    isRegistered.value = false;
    sessionStorage.removeItem('rummikub-username');
  }

  function setOnlineUsers(users) {
    onlineUsers.value = users;
  }

  function getAvailableUsers() {
    return onlineUsers.value.filter(u => 
      u.username !== username.value && !u.lobbyId
    );
  }

  return {
    username,
    isRegistered: isRegisteredComputed,
    onlineUsers,
    setUser,
    clearUser,
    setOnlineUsers,
    getAvailableUsers
  };
});
