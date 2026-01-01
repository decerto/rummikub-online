<template>
  <v-card color="surface" class="chat-panel d-flex flex-column" :class="{ 'fill-height': fillHeight }">
    <v-card-title class="flex-shrink-0">
      <v-icon class="mr-2">mdi-chat</v-icon>
      Chat
    </v-card-title>
    
    <v-card-text class="flex-grow-1 overflow-y-auto chat-messages" ref="messagesContainer">
      <div
        v-for="message in messages"
        :key="message.id"
        class="chat-message mb-2"
        :class="`message-${message.type}`"
      >
        <template v-if="message.type === 'system' || message.type === 'join' || message.type === 'leave'">
          <v-chip size="x-small" :color="getSystemMessageColor(message.type)" variant="tonal">
            {{ message.message }}
          </v-chip>
        </template>
        <template v-else-if="message.type === 'action'">
          <div class="action-message">
            <v-icon size="x-small" class="mr-1">mdi-arrow-right-bold</v-icon>
            <span class="action-text">{{ message.message }}</span>
          </div>
        </template>
        <template v-else>
          <div class="message-header">
            <strong class="text-primary">{{ message.username }}</strong>
            <span class="text-caption text-medium-emphasis ml-2">
              {{ formatTime(message.timestamp) }}
            </span>
          </div>
          <div class="message-content">{{ message.message }}</div>
        </template>
      </div>
      
      <div v-if="messages.length === 0" class="text-center text-medium-emphasis">
        <v-icon>mdi-chat-outline</v-icon>
        <div class="text-caption">No messages yet</div>
      </div>
      
      <!-- Scroll anchor for auto-scroll -->
      <div ref="messagesEndRef" class="scroll-anchor"></div>
    </v-card-text>
    
    <v-divider />
    
    <v-card-actions class="flex-shrink-0 pa-2">
      <v-text-field
        v-model="newMessage"
        placeholder="Type a message..."
        density="compact"
        hide-details
        variant="outlined"
        class="flex-grow-1"
        @keyup.enter="sendMessage"
        maxlength="200"
      >
        <template #append-inner>
          <v-btn
            icon="mdi-send"
            size="small"
            variant="text"
            color="primary"
            @click="sendMessage"
            :disabled="!newMessage.trim()"
          />
        </template>
      </v-text-field>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUpdated } from 'vue';

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  fillHeight: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['send']);

const newMessage = ref('');
const messagesContainer = ref(null);
const messagesEndRef = ref(null);

// Auto-scroll to bottom when new messages arrive
watch(() => props.messages, async () => {
  await nextTick();
  scrollToBottom();
}, { deep: true });

// Also scroll on mount and after each update
onMounted(() => {
  scrollToBottom();
});

onUpdated(() => {
  scrollToBottom();
});

function scrollToBottom() {
  // Use the end marker element for more reliable scrolling
  if (messagesEndRef.value) {
    messagesEndRef.value.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return;
  }
  
  // Fallback to container scroll
  if (messagesContainer.value) {
    const el = messagesContainer.value.$el || messagesContainer.value;
    if (el && el.scrollHeight) {
      el.scrollTop = el.scrollHeight;
    }
  }
}

function sendMessage() {
  if (newMessage.value.trim()) {
    emit('send', newMessage.value.trim());
    newMessage.value = '';
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getSystemMessageColor(type) {
  switch (type) {
    case 'join': return 'success';
    case 'leave': return 'warning';
    default: return 'info';
  }
}
</script>

<style scoped>
.chat-panel {
  max-height: 100%;
  background: rgba(18, 18, 26, 0.9) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.chat-messages {
  max-height: 400px;
  min-height: 200px;
  scrollbar-width: thin;
}

.fill-height .chat-messages {
  max-height: none;
}

.chat-message {
  padding: 6px 0;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-header {
  font-size: 12px;
}

.message-content {
  padding-left: 0;
  word-wrap: break-word;
  background: rgba(255, 255, 255, 0.03);
  padding: 8px 12px;
  border-radius: 8px;
  margin-top: 4px;
}

.message-system,
.message-join,
.message-leave {
  text-align: center;
}

.action-message {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: linear-gradient(90deg, rgba(124, 58, 237, 0.15), rgba(124, 58, 237, 0.05));
  border-left: 3px solid rgb(124, 58, 237);
  border-radius: 0 8px 8px 0;
  font-size: 13px;
  color: rgba(226, 232, 240, 0.9);
}

.action-text {
  font-style: italic;
}

.message-action {
  padding: 4px 0;
}

.scroll-anchor {
  height: 1px;
  width: 100%;
}
</style>
