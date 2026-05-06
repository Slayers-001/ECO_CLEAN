const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// State Management
const players = new Map();
let globalEcoScore = 0; // 0 = Toxic, 1000 = Clear Blue

io.on('connection', (socket) => {
  // Initialize new player
  players.set(socket.id, {
    id: socket.id,
    coins: 0,
    bagCapacity: 10,
    currentTrash: 0,
    status: "Normal", // Normal | Specialist | Overlord | Developer
  });

  socket.emit('init', players.get(socket.id));

  // --- The Simulator Loop (Collection & Deposit) ---
  socket.on('collect_trash', () => {
    const player = players.get(socket.id);
    if (!player) return;

    // Server-side validation: prevent over-filling
    if (player.currentTrash >= player.bagCapacity && player.status !== "Overlord") {
      socket.emit('error', "Bag Full! Deposit at Vault.");
      return;
    }

    player.currentTrash++;
    globalEcoScore = Math.min(1000, globalEcoScore + 1); // Eco-Evolution
    
    // Sync state to prevent race conditions
    socket.emit('sync_state', player);
    io.emit('eco_update', globalEcoScore);
  });

  socket.on('deposit', () => {
    const player = players.get(socket.id);
    if (!player || player.currentTrash === 0) return;

    // Multiplier Logic
    const multiplier = player.status === "Specialist" ? 3 : 1;
    const earned = player.currentTrash * 10 * multiplier;
    
    player.coins += earned;
    player.currentTrash = 0; // Empty bag
    
    socket.emit('sync_state', player);
  });

  // --- Master "Owner" Command Listener ---
  socket.on('chat_command', (cmd) => {
    const player = players.get(socket.id);
    if (!player) return;

    if (cmd === "PVP_PRO") {
      player.status = "Overlord";
      player.bagCapacity = Infinity; // Infinite storage
      socket.emit('sync_state', player);
      io.emit('system_msg', "An Overlord has awoken!");
    } 
    else if (cmd === "Slayers") {
      player.status = "Specialist";
      socket.emit('sync_state', player);
      io.emit('system_msg', "A Specialist has joined the cleanup.");
    }
    else if (cmd === "NordenMC") {
      player.status = "Developer";
      socket.emit('unlock_dashboard'); // Unlocks admin UI
    }
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
