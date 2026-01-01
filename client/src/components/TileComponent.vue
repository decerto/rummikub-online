<template>
  <div
    class="tile"
    :class="[
      `tile-${tile.isJoker ? 'joker' : tile.color}`,
      { 'tile-draggable': draggable },
      { 'tile-highlighted': highlighted }
    ]"
  >
    <template v-if="tile.isJoker">
      <div class="tile-joker">
        <v-icon size="24">mdi-star-four-points</v-icon>
      </div>
    </template>
    <template v-else>
      <div class="tile-number">{{ tile.number }}</div>
    </template>
    <div class="tile-shine"></div>
  </div>
</template>

<script setup>
defineProps({
  tile: {
    type: Object,
    required: true
  },
  draggable: {
    type: Boolean,
    default: false
  },
  highlighted: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped>
.tile {
  width: 48px;
  height: 68px;
  border-radius: 10px;
  background: linear-gradient(165deg, #fafafa 0%, #e8e8e8 50%, #d4d4d4 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 24px;
  user-select: none;
  cursor: default;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.2),
    inset 0 2px 0 rgba(255, 255, 255, 0.8),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
}

/* Glossy shine effect */
.tile-shine {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 100%);
  border-radius: 10px 10px 50% 50%;
  pointer-events: none;
}

.tile-draggable {
  cursor: grab;
}

.tile-draggable:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 
    0 12px 24px rgba(0, 0, 0, 0.4),
    0 4px 8px rgba(0, 0, 0, 0.3),
    inset 0 2px 0 rgba(255, 255, 255, 0.8),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
}

.tile-draggable:active {
  cursor: grabbing;
  transform: scale(1.08) rotate(2deg);
  box-shadow: 
    0 16px 32px rgba(0, 0, 0, 0.5),
    0 6px 12px rgba(0, 0, 0, 0.4);
}

/* Tile colors with gradients */
.tile-black .tile-number {
  color: #1e1e2e;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
}

.tile-red .tile-number {
  color: #ef4444;
  text-shadow: 0 1px 2px rgba(239, 68, 68, 0.3);
}

.tile-blue .tile-number {
  color: #3b82f6;
  text-shadow: 0 1px 2px rgba(59, 130, 246, 0.3);
}

.tile-orange .tile-number {
  color: #f97316;
  text-shadow: 0 1px 2px rgba(249, 115, 22, 0.3);
}

.tile-joker {
  background: linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: rainbow 3s ease infinite;
  background-size: 400% 400%;
}

@keyframes rainbow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.tile-number {
  font-family: 'Segoe UI', system-ui, sans-serif;
  letter-spacing: -1px;
  position: relative;
  z-index: 1;
}

/* Color indicator dot at bottom */
.tile::after {
  content: '';
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.tile-black::after { background: #1e1e2e; }
.tile-red::after { background: #ef4444; box-shadow: 0 0 6px rgba(239, 68, 68, 0.5); }
.tile-blue::after { background: #3b82f6; box-shadow: 0 0 6px rgba(59, 130, 246, 0.5); }
.tile-orange::after { background: #f97316; box-shadow: 0 0 6px rgba(249, 115, 22, 0.5); }
.tile-joker::after { 
  background: linear-gradient(135deg, #ef4444, #3b82f6); 
  width: 8px;
  height: 8px;
  animation: pulse 2s ease infinite;
}

@keyframes pulse {
  0%, 100% { transform: translateX(-50%) scale(1); opacity: 1; }
  50% { transform: translateX(-50%) scale(1.2); opacity: 0.8; }
}

/* Highlighted tile animation for newly placed tiles */
.tile-highlighted {
  animation: highlight-glow 1s ease-in-out 3;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.2),
    0 0 20px rgba(34, 197, 94, 0.6),
    0 0 40px rgba(34, 197, 94, 0.3),
    inset 0 2px 0 rgba(255, 255, 255, 0.8),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
}

@keyframes highlight-glow {
  0%, 100% { 
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 2px 4px rgba(0, 0, 0, 0.2),
      0 0 15px rgba(34, 197, 94, 0.5),
      0 0 30px rgba(34, 197, 94, 0.2),
      inset 0 2px 0 rgba(255, 255, 255, 0.8),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  }
  50% { 
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 2px 4px rgba(0, 0, 0, 0.2),
      0 0 25px rgba(34, 197, 94, 0.8),
      0 0 50px rgba(34, 197, 94, 0.4),
      inset 0 2px 0 rgba(255, 255, 255, 0.8),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    transform: scale(1.05);
  }
}
</style>
