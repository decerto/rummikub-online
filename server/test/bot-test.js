/**
 * Bot-vs-Bot Testing Script
 * 
 * This script creates automated games with only bot players to stress test
 * the game logic and find bugs. It connects via Socket.io like a real client.
 * 
 * Usage: node server/test/bot-test.js [numberOfGames]
 */

import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const NUM_GAMES = parseInt(process.argv[2]) || 5;
const BOTS_PER_GAME = 3; // Host + 3 bots = 4 players
const BOT_DIFFICULTIES = ['easy', 'medium', 'hard'];

let gamesCompleted = 0;
let gamesErrored = 0;
let gameStats = [];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createSocketClient(username) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Connection timeout for ${username}`));
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      console.log(`[${username}] Connected to server`);
      
      socket.emit('register-username', username, (response) => {
        if (response.success) {
          console.log(`[${username}] Registered successfully`);
          resolve({ socket, username });
        } else {
          socket.disconnect();
          reject(new Error(`Failed to register ${username}: ${response.error}`));
        }
      });
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Connection error for ${username}: ${error.message}`));
    });
  });
}

function createLobby(client) {
  return new Promise((resolve, reject) => {
    client.socket.emit('create-lobby', {
      isPublic: false,
      rules: {
        maxPlayers: 4, // Host + 3 bots
        initialMeldPoints: 30,
        turnTimerSeconds: 30, // Faster for testing
        jokerCount: 2
      }
    }, (response) => {
      if (response.success) {
        const lobbyId = response.lobby.id;
        console.log(`[${client.username}] Created lobby: ${lobbyId}`);
        resolve(lobbyId);
      } else {
        reject(new Error(`Failed to create lobby: ${response.error}`));
      }
    });
  });
}

function addBot(client, lobbyId, difficulty) {
  return new Promise((resolve, reject) => {
    // Server expects just the difficulty, not an object
    client.socket.emit('add-bot', difficulty, (response) => {
      if (response.success) {
        console.log(`[${client.username}] Added ${difficulty} bot`);
        resolve();
      } else {
        reject(new Error(`Failed to add bot: ${response.error}`));
      }
    });
  });
}

function startGame(client, lobbyId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Game start timeout'));
    }, 10000);

    client.socket.once('game-started', (data) => {
      clearTimeout(timeout);
      console.log(`[${client.username}] Game started with ${data.players.length} players`);
      resolve(data);
    });

    // Server expects just a callback, not a lobbyId
    client.socket.emit('start-game', (response) => {
      if (!response.success) {
        clearTimeout(timeout);
        reject(new Error(`Failed to start game: ${response.error}`));
      }
    });
  });
}

function waitForGameEnd(client, gameNumber) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log(`[Game ${gameNumber}] TIMEOUT after ${turnCount} turns`);
      reject(new Error(`Game ${gameNumber} timeout - game took too long (${turnCount} turns)`));
    }, 180000); // 3 minute max per game

    let turnCount = 0;
    let lastTurnTime = Date.now();

    // When it's our turn, just draw a tile to keep the game moving
    client.socket.on('turn-start', (data) => {
      console.log(`[Game ${gameNumber}] Our turn - drawing tile`);
      client.socket.emit('draw-tile', (response) => {
        if (!response.success) {
          console.log(`[Game ${gameNumber}] Failed to draw: ${response.error}`);
        }
      });
    });

    client.socket.on('game-state-update', (state) => {
      turnCount++;
      const currentPlayer = state.players[state.currentPlayerIndex];
      const elapsed = Date.now() - lastTurnTime;
      lastTurnTime = Date.now();
      
      // Log every turn
      console.log(`[Game ${gameNumber}] Turn ${turnCount}: ${currentPlayer.username}'s turn (${elapsed}ms)`);
      console.log(`  Pool: ${state.poolCount}, Players: ${state.players.map(p => `${p.username}(${p.tileCount})`).join(', ')}`);
    });

    client.socket.once('game-ended', (result) => {
      clearTimeout(timeout);
      console.log(`\n[Game ${gameNumber}] GAME ENDED!`);
      console.log(`  Winner: ${result.winner.username}`);
      console.log(`  Total turns: ${turnCount}`);
      console.log(`  Final scores:`);
      result.scores.forEach(s => {
        console.log(`    ${s.username}: ${s.penaltyPoints} penalty points`);
      });
      
      resolve({
        gameNumber,
        winner: result.winner.username,
        turns: turnCount,
        scores: result.scores
      });
    });

    client.socket.on('error', (error) => {
      console.error(`[Game ${gameNumber}] Socket error:`, error);
    });
  });
}

async function runGame(gameNumber) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Starting Game ${gameNumber}`);
  console.log(`${'='.repeat(60)}\n`);

  let client = null;

  try {
    // Create a host client with unique username
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const hostUsername = `Host${randomSuffix}`;
    client = await createSocketClient(hostUsername);

    // Create lobby
    const lobbyId = await createLobby(client);

    // Add bots (one less than max since host counts as a player, but host leaves)
    // Actually, let's make the host leave and have all bots play
    // For simpler testing, we'll add bots and have the host leave
    
    // Add bots with varying difficulties
    for (let i = 0; i < BOTS_PER_GAME; i++) {
      const difficulty = BOT_DIFFICULTIES[i % BOT_DIFFICULTIES.length];
      await addBot(client, lobbyId, difficulty);
      await delay(100); // Small delay between adding bots
    }

    // Leave lobby so it's only bots (the host leaving makes first bot the host-equivalent)
    // Actually, for the game to work, someone needs to start it
    // Let's keep the host and start the game

    // Start the game
    const gameData = await startGame(client, lobbyId);

    // Wait for game to complete
    const stats = await waitForGameEnd(client, gameNumber);
    gameStats.push(stats);
    gamesCompleted++;

    console.log(`\n[Game ${gameNumber}] Completed successfully!`);

  } catch (error) {
    console.error(`\n[Game ${gameNumber}] ERROR:`, error.message);
    gamesErrored++;
  } finally {
    if (client) {
      client.socket.disconnect();
    }
  }
}

async function runTests() {
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`# BOT VS BOT TESTING`);
  console.log(`# Server: ${SERVER_URL}`);
  console.log(`# Games to run: ${NUM_GAMES}`);
  console.log(`# Bots per game: ${BOTS_PER_GAME}`);
  console.log(`${'#'.repeat(60)}\n`);

  const startTime = Date.now();

  for (let i = 1; i <= NUM_GAMES; i++) {
    await runGame(i);
    await delay(1000); // Delay between games
  }

  const totalTime = (Date.now() - startTime) / 1000;

  console.log(`\n${'#'.repeat(60)}`);
  console.log(`# TEST RESULTS`);
  console.log(`${'#'.repeat(60)}`);
  console.log(`\nGames completed: ${gamesCompleted}/${NUM_GAMES}`);
  console.log(`Games errored: ${gamesErrored}/${NUM_GAMES}`);
  console.log(`Total time: ${totalTime.toFixed(1)}s`);
  console.log(`Average time per game: ${(totalTime / NUM_GAMES).toFixed(1)}s`);

  if (gameStats.length > 0) {
    const avgTurns = gameStats.reduce((sum, g) => sum + g.turns, 0) / gameStats.length;
    console.log(`Average turns per game: ${avgTurns.toFixed(1)}`);
    
    // Winner distribution
    const winnerCounts = {};
    gameStats.forEach(g => {
      const difficulty = g.winner.includes('easy') ? 'Easy Bot' 
        : g.winner.includes('medium') ? 'Medium Bot' 
        : g.winner.includes('hard') ? 'Hard Bot' : 'Host';
      winnerCounts[difficulty] = (winnerCounts[difficulty] || 0) + 1;
    });
    console.log(`\nWinner distribution:`);
    Object.entries(winnerCounts).forEach(([diff, count]) => {
      console.log(`  ${diff}: ${count} wins (${(count/gameStats.length*100).toFixed(1)}%)`);
    });
  }

  console.log(`\n${'#'.repeat(60)}\n`);

  process.exit(gamesErrored > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
