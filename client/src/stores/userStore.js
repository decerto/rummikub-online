import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useUserStore = defineStore('user', () => {
  const username = ref('');
  const isRegistered = ref(false);
  const onlineUsers = ref([]);

  const isRegisteredComputed = computed(() => isRegistered.value && username.value);

  function setUser(user) {
    username.value = user.username;
    isRegistered.value = true;
  }

  function clearUser() {
    username.value = '';
    isRegistered.value = false;
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
