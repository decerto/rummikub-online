<template>
  <v-navigation-drawer
    v-model="notificationStore.showPanel"
    location="right"
    temporary
    width="350"
  >
    <v-card flat height="100%">
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-bell</v-icon>
        Notifications
        <v-spacer />
        <v-btn
          v-if="notificationStore.notifications.length > 0"
          variant="text"
          size="small"
          @click="notificationStore.clearAll"
        >
          Clear All
        </v-btn>
      </v-card-title>
      
      <v-divider />
      
      <v-card-text class="pa-0">
        <v-list v-if="notificationStore.notifications.length > 0" lines="three">
          <v-list-item
            v-for="notification in notificationStore.notifications"
            :key="notification.id"
            :class="{ 'bg-surface-variant': !notification.read }"
          >
            <template #prepend>
              <v-avatar :color="getNotificationColor(notification.type)" size="40">
                <v-icon>{{ getNotificationIcon(notification.type) }}</v-icon>
              </v-avatar>
            </template>
            
            <v-list-item-title class="font-weight-bold">
              {{ notification.title }}
            </v-list-item-title>
            
            <v-list-item-subtitle>
              {{ notification.message }}
            </v-list-item-subtitle>
            
            <template #append>
              <div class="text-caption text-medium-emphasis">
                {{ formatTime(notification.timestamp) }}
              </div>
            </template>
          </v-list-item>
        </v-list>
        
        <div v-else class="text-center pa-6 text-medium-emphasis">
          <v-icon size="48" class="mb-2">mdi-bell-off</v-icon>
          <div>No notifications</div>
        </div>
      </v-card-text>
    </v-card>
  </v-navigation-drawer>
</template>

<script setup>
import { useNotificationStore } from '@/stores/notificationStore';

const notificationStore = useNotificationStore();

function getNotificationColor(type) {
  switch (type) {
    case 'success': return 'success';
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'invite': return 'primary';
    default: return 'info';
  }
}

function getNotificationIcon(type) {
  switch (type) {
    case 'success': return 'mdi-check-circle';
    case 'error': return 'mdi-alert-circle';
    case 'warning': return 'mdi-alert';
    case 'invite': return 'mdi-email';
    default: return 'mdi-information';
  }
}

function formatTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return new Date(timestamp).toLocaleDateString();
}
</script>
