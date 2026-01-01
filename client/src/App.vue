<template>
  <v-app>
    <v-main class="app-background">
      <router-view />
    </v-main>
    
    <!-- Notification Panel -->
    <NotificationPanel />
    
    <!-- Invite Popup -->
    <InvitePopup />
  </v-app>
</template>

<script setup>
import NotificationPanel from '@/components/NotificationPanel.vue';
import InvitePopup from '@/components/InvitePopup.vue';
</script>

<style>
/* Modern animated gradient background */
.app-background {
  background: linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #1a1a24 100%);
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

/* Animated gradient orbs */
.app-background::before {
  content: '';
  position: fixed;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: 
    radial-gradient(circle at 20% 80%, rgba(124, 58, 237, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 40% 40%, rgba(20, 184, 166, 0.08) 0%, transparent 40%);
  animation: float 20s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  33% { transform: translate(2%, 2%) rotate(2deg); }
  66% { transform: translate(-1%, 1%) rotate(-1deg); }
}

/* Glass morphism card style */
.glass-card {
  background: rgba(18, 18, 26, 0.8) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}

/* Glow effect for primary elements */
.glow-primary {
  box-shadow: 0 0 20px rgba(124, 58, 237, 0.4);
}

.glow-secondary {
  box-shadow: 0 0 20px rgba(20, 184, 166, 0.4);
}

/* Smooth transitions globally */
* {
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(124, 58, 237, 0.5);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(124, 58, 237, 0.7);
}

/* Button hover glow */
.v-btn--variant-flat:hover {
  box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
}

/* Input focus glow */
.v-field--focused {
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
}

/* Chip styling */
.v-chip {
  font-weight: 500;
}
</style>
