const express = require('express');
const path = require('path');
const http = require('http');
require("dotenv").config();
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 8000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: true,
});

const emailToSocketIdMap = new Map();
const socketidToEmailMap = new Map();

io.on('connection', (socket) => {
  console.log(`Socket Connected`, socket.id);

  socket.on('room:join', (data) => {
    const { email, room } = data;
    emailToSocketIdMap.set(email, socket.id);
    socketidToEmailMap.set(socket.id, email);
    io.to(room).emit('user:joined', { email, id: socket.id });
    socket.join(room);
    io.to(socket.id).emit('room:join', data);
  });

  socket.on('user:call', ({ to, offer }) => {
    io.to(to).emit('incomming:call', { from: socket.id, offer });
  });

  socket.on('call:accepted', ({ to, ans }) => {
    io.to(to).emit('call:accepted', { from: socket.id, ans });
  });

  socket.on('peer:nego:needed', ({ to, offer }) => {
    console.log('peer:nego:needed', offer);
    io.to(to).emit('peer:nego:needed', { from: socket.id, offer });
  });

  socket.on('peer:nego:done', ({ to, ans }) => {
    console.log('peer:nego:done', ans);
    io.to(to).emit('peer:nego:final', { from: socket.id, ans });
  });

  socket.on('call:disconnect', ({ to }) => {
    io.to(to).emit('call:disconnect');
  });
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

server.listen(process.env.Port, () => {
  console.log(`Server is running on port ${process.env.Host}:${process.env.Port}`);
});
