import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref([]);
  const pendingInvite = ref(null);
  const showPanel = ref(false);

  const hasUnread = computed(() => 
    notifications.value.some(n => !n.read)
  );

  const unreadCount = computed(() => 
    notifications.value.filter(n => !n.read).length
  );

  function addNotification(notification) {
    const id = Date.now().toString();
    notifications.value.unshift({
      id,
      ...notification,
      read: false,
      timestamp: Date.now()
    });

    // Keep only last 50 notifications
    if (notifications.value.length > 50) {
      notifications.value = notifications.value.slice(0, 50);
    }
  }

  function addInvite(invite) {
    pendingInvite.value = {
      ...invite,
      timestamp: Date.now()
    };

    // Also add to notification history
    addNotification({
      type: 'invite',
      title: 'Lobby Invite',
      message: `${invite.hostUsername} invited you to their lobby`
    });
  }

  function clearInvite() {
    pendingInvite.value = null;
  }

  function markAsRead(id) {
    const notification = notifications.value.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
  }

  function markAllAsRead() {
    notifications.value.forEach(n => n.read = true);
  }

  function clearAll() {
    notifications.value = [];
  }

  function togglePanel() {
    showPanel.value = !showPanel.value;
    if (showPanel.value) {
      markAllAsRead();
    }
  }

  return {
    notifications,
    pendingInvite,
    showPanel,
    hasUnread,
    unreadCount,
    addNotification,
    addInvite,
    clearInvite,
    markAsRead,
    markAllAsRead,
    clearAll,
    togglePanel
  };
});
