<template>
  <v-container class="rules-container py-8" style="max-width: 900px;">
    <v-btn
      variant="text"
      color="primary"
      class="mb-4"
      @click="goBack"
    >
      <v-icon start>mdi-arrow-left</v-icon>
      Back
    </v-btn>

    <v-card class="pa-6 pa-md-8">
      <div class="text-center mb-6">
        <v-icon size="64" color="primary" class="mb-4">mdi-book-open-page-variant</v-icon>
        <h1 class="text-h3 font-weight-bold text-primary">How to Play Rummikub</h1>
        <p class="text-subtitle-1 text-medium-emphasis mt-2">
          Learn the rules and become a Rummikub master!
        </p>
      </div>

      <v-divider class="my-6" />

      <!-- Objective -->
      <section class="mb-8">
        <h2 class="text-h5 font-weight-bold mb-3 d-flex align-center">
          <v-icon color="primary" class="mr-2">mdi-target</v-icon>
          Objective
        </h2>
        <p class="text-body-1">
          Be the first player to place all your tiles on the table by forming valid sets. 
          The player who empties their rack first wins the round!
        </p>
      </section>

      <!-- The Tiles -->
      <section class="mb-8">
        <h2 class="text-h5 font-weight-bold mb-3 d-flex align-center">
          <v-icon color="primary" class="mr-2">mdi-cards</v-icon>
          The Tiles
        </h2>
        <p class="text-body-1 mb-3">
          The game uses <strong>106 tiles</strong>:
        </p>
        <v-list density="compact" class="bg-transparent">
          <v-list-item>
            <template #prepend>
              <div class="tile-sample tile-black mr-3">1</div>
            </template>
            <v-list-item-title>Numbers 1-13 in <strong>Black</strong> (2 sets)</v-list-item-title>
          </v-list-item>
          <v-list-item>
            <template #prepend>
              <div class="tile-sample tile-red mr-3">5</div>
            </template>
            <v-list-item-title>Numbers 1-13 in <strong>Red</strong> (2 sets)</v-list-item-title>
          </v-list-item>
          <v-list-item>
            <template #prepend>
              <div class="tile-sample tile-blue mr-3">9</div>
            </template>
            <v-list-item-title>Numbers 1-13 in <strong>Blue</strong> (2 sets)</v-list-item-title>
          </v-list-item>
          <v-list-item>
            <template #prepend>
              <div class="tile-sample tile-orange mr-3">13</div>
            </template>
            <v-list-item-title>Numbers 1-13 in <strong>Orange</strong> (2 sets)</v-list-item-title>
          </v-list-item>
          <v-list-item>
            <template #prepend>
              <div class="tile-sample tile-joker mr-3">★</div>
            </template>
            <v-list-item-title><strong>2 Jokers</strong> - Wild tiles that can substitute any tile</v-list-item-title>
          </v-list-item>
        </v-list>
      </section>

      <!-- Valid Sets -->
      <section class="mb-8">
        <h2 class="text-h5 font-weight-bold mb-3 d-flex align-center">
          <v-icon color="primary" class="mr-2">mdi-checkbox-marked-circle</v-icon>
          Valid Sets
        </h2>
        <p class="text-body-1 mb-4">
          All tiles on the table must be arranged in valid sets of <strong>3 or more tiles</strong>. 
          There are two types:
        </p>

        <v-card variant="outlined" class="pa-4 mb-4">
          <h3 class="text-h6 font-weight-bold mb-2 text-success">
            <v-icon color="success" class="mr-1">mdi-arrow-right-bold</v-icon>
            Runs
          </h3>
          <p class="text-body-2 mb-3">
            3 or more consecutive numbers of the <strong>same color</strong>.
          </p>
          <div class="d-flex ga-1 flex-wrap">
            <div class="tile-sample tile-blue">3</div>
            <div class="tile-sample tile-blue">4</div>
            <div class="tile-sample tile-blue">5</div>
            <div class="tile-sample tile-blue">6</div>
          </div>
          <p class="text-caption text-medium-emphasis mt-2">Example: Blue 3-4-5-6</p>
        </v-card>

        <v-card variant="outlined" class="pa-4">
          <h3 class="text-h6 font-weight-bold mb-2 text-info">
            <v-icon color="info" class="mr-1">mdi-checkbox-multiple-blank</v-icon>
            Groups
          </h3>
          <p class="text-body-2 mb-3">
            3 or 4 tiles of the <strong>same number</strong> in <strong>different colors</strong>.
          </p>
          <div class="d-flex ga-1 flex-wrap">
            <div class="tile-sample tile-black">7</div>
            <div class="tile-sample tile-red">7</div>
            <div class="tile-sample tile-blue">7</div>
            <div class="tile-sample tile-orange">7</div>
          </div>
          <p class="text-caption text-medium-emphasis mt-2">Example: Four 7s in different colors</p>
        </v-card>
      </section>

      <!-- Initial Meld -->
      <section class="mb-8">
        <h2 class="text-h5 font-weight-bold mb-3 d-flex align-center">
          <v-icon color="primary" class="mr-2">mdi-door-open</v-icon>
          Initial Meld
        </h2>
        <v-alert type="warning" variant="tonal" class="mb-4">
          <strong>Important:</strong> Your first play must total at least <strong>30 points</strong>!
        </v-alert>
        <p class="text-body-1 mb-3">
          Before you can manipulate tiles on the table, you must make an "initial meld" using 
          <strong>only tiles from your own rack</strong>. The sum of all tile values must be 30 or more.
        </p>
        <p class="text-body-2 text-medium-emphasis">
          <strong>Tip:</strong> Jokers count as the value of the tile they replace. 
          For example, a Joker replacing a 12 in a run counts as 12 points.
        </p>
      </section>

      <!-- Gameplay -->
      <section class="mb-8">
        <h2 class="text-h5 font-weight-bold mb-3 d-flex align-center">
          <v-icon color="primary" class="mr-2">mdi-play-circle</v-icon>
          Gameplay
        </h2>
        
        <v-timeline density="compact" side="end">
          <v-timeline-item dot-color="primary" size="small">
            <div class="text-body-1">
              <strong>Your Turn</strong> - You have <strong>60 seconds</strong> to make your moves.
            </div>
          </v-timeline-item>
          
          <v-timeline-item dot-color="success" size="small">
            <div class="text-body-1">
              <strong>Play Tiles</strong> - Drag tiles from your rack to create new sets or add to existing ones.
            </div>
          </v-timeline-item>
          
          <v-timeline-item dot-color="info" size="small">
            <div class="text-body-1">
              <strong>Manipulate Table</strong> - After your initial meld, you can rearrange table tiles 
              to create new valid combinations.
            </div>
          </v-timeline-item>
          
          <v-timeline-item dot-color="warning" size="small">
            <div class="text-body-1">
              <strong>End Turn</strong> - Click "End Turn" to validate your moves. If any set is invalid, 
              your changes are reverted.
            </div>
          </v-timeline-item>
          
          <v-timeline-item dot-color="error" size="small">
            <div class="text-body-1">
              <strong>Draw Tile</strong> - If you can't play, draw a tile from the pool and your turn ends.
            </div>
          </v-timeline-item>
        </v-timeline>
      </section>

      <!-- Jokers -->
      <section class="mb-8">
        <h2 class="text-h5 font-weight-bold mb-3 d-flex align-center">
          <v-icon color="primary" class="mr-2">mdi-star-four-points</v-icon>
          Jokers
        </h2>
        <p class="text-body-1 mb-3">
          Jokers are wild tiles that can substitute for any tile in a set.
        </p>
        <v-alert type="info" variant="tonal" class="mb-3">
          <v-icon class="mr-1">mdi-lock</v-icon>
          <strong>Joker Rule:</strong> Jokers on the table cannot be taken into your hand. 
          They can only be moved between sets on the table.
        </v-alert>
        <div class="d-flex ga-1 flex-wrap align-center">
          <div class="tile-sample tile-red">10</div>
          <div class="tile-sample tile-red">11</div>
          <div class="tile-sample tile-joker">★</div>
          <span class="text-body-2 ml-2">= Red 10-11-12 (Joker as 12)</span>
        </div>
      </section>

      <!-- Winning -->
      <section class="mb-8">
        <h2 class="text-h5 font-weight-bold mb-3 d-flex align-center">
          <v-icon color="primary" class="mr-2">mdi-trophy</v-icon>
          Winning
        </h2>
        <p class="text-body-1 mb-3">
          The first player to play all their tiles wins the round! 🎉
        </p>
        <p class="text-body-2 text-medium-emphasis">
          <strong>Scoring:</strong> Other players lose points equal to the sum of tiles remaining in their rack. 
          Jokers count as 30 points each!
        </p>
      </section>

      <!-- Tips -->
      <section class="mb-4">
        <h2 class="text-h5 font-weight-bold mb-3 d-flex align-center">
          <v-icon color="primary" class="mr-2">mdi-lightbulb</v-icon>
          Pro Tips
        </h2>
        <v-list density="compact" class="bg-transparent">
          <v-list-item prepend-icon="mdi-numeric-1-circle">
            <v-list-item-title>Try to keep tiles that form multiple potential sets</v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-numeric-2-circle">
            <v-list-item-title>Watch what other players draw - it hints at what they need</v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-numeric-3-circle">
            <v-list-item-title>Save jokers for when you really need them</v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-numeric-4-circle">
            <v-list-item-title>Use the sort buttons to organize your rack by color or number</v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-numeric-5-circle">
            <v-list-item-title>Plan your initial meld carefully to open up table manipulation</v-list-item-title>
          </v-list-item>
        </v-list>
      </section>

      <v-divider class="my-6" />

      <div class="text-center">
        <v-btn
          color="primary"
          size="large"
          @click="goBack"
        >
          <v-icon start>mdi-play</v-icon>
          Start Playing!
        </v-btn>
      </div>
    </v-card>
  </v-container>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

function goBack() {
  // Go back to previous page or home
  if (window.history.length > 2) {
    router.back();
  } else {
    router.push('/');
  }
}
</script>

<style scoped>
.rules-container {
  min-height: 100vh;
}

.tile-sample {
  width: 36px;
  height: 48px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 16px;
  background: linear-gradient(165deg, #fafafa 0%, #e8e8e8 50%, #d4d4d4 100%);
  box-shadow: 
    0 2px 6px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.tile-black {
  color: #1e1e2e;
}

.tile-red {
  color: #dc2626;
}

.tile-blue {
  color: #2563eb;
}

.tile-orange {
  color: #ea580c;
}

.tile-joker {
  background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
  color: white;
}

section {
  scroll-margin-top: 80px;
}
</style>
