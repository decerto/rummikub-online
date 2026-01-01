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
      <div class="joker-container">
        <div class="joker-hat">
          <div class="hat-point left"></div>
          <div class="hat-point center"></div>
          <div class="hat-point right"></div>
        </div>
        <div class="joker-face">
          <div class="joker-eyes">
            <div class="joker-eye left"></div>
            <div class="joker-eye right"></div>
          </div>
          <div class="joker-smile"></div>
        </div>
        <div class="joker-label">JOKER</div>
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

/* Joker tile special styling */
.tile-joker {
  background: linear-gradient(165deg, #fef3c7 0%, #fde68a 50%, #fbbf24 100%);
  border: 2px solid #f59e0b;
}

.joker-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
}

/* Jester hat */
.joker-hat {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  margin-bottom: 2px;
  margin-top: -2px;
}

.hat-point {
  width: 8px;
  height: 12px;
  border-radius: 50% 50% 0 0;
  position: relative;
}

.hat-point::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.hat-point.left {
  background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
  transform: rotate(-20deg);
  margin-right: -2px;
}
.hat-point.left::after { background: #fbbf24; }

.hat-point.center {
  background: linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%);
  height: 14px;
  width: 10px;
  z-index: 1;
}
.hat-point.center::after { background: #fbbf24; width: 6px; height: 6px; }

.hat-point.right {
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
  transform: rotate(20deg);
  margin-left: -2px;
}
.hat-point.right::after { background: #fbbf24; }

/* Joker face */
.joker-face {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2px;
}

.joker-eyes {
  display: flex;
  gap: 8px;
  margin-bottom: 2px;
}

.joker-eye {
  width: 6px;
  height: 6px;
  background: #1e1e2e;
  border-radius: 50%;
  position: relative;
}

.joker-eye::after {
  content: '';
  position: absolute;
  top: 1px;
  left: 1px;
  width: 2px;
  height: 2px;
  background: white;
  border-radius: 50%;
}

.joker-smile {
  width: 14px;
  height: 7px;
  border: 2px solid #dc2626;
  border-top: none;
  border-radius: 0 0 14px 14px;
  background: #fecaca;
}

.joker-label {
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.5px;
  background: linear-gradient(90deg, #ef4444, #f97316, #8b5cf6, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-top: 1px;
}

.tile-joker .tile-shine {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 100%);
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
  display: none; /* Joker has its own design, no need for dot */
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
