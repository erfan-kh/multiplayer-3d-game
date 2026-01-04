const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for now
  },
});

const PORT = 3001;

io.on('connection', (socket) => {
  console.log('🟢 A user connected:', socket.id);

  socket.on('player-move', (data) => {
    // Broadcast movement to all other players
    socket.broadcast.emit('player-move', data);
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
