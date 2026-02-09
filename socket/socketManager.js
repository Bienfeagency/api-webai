// socket/socketManager.js - Version corrigée
import { Server } from 'socket.io';
import socketAuth from '../middlewares/socketAuth.js';

let io;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        process.env.FRONTEND_URL_PRODUCTION,
        process.env.FRONTEND_URL,
        "http://localhost:3000"
      ],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Middleware d'authentification
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log('🔗 User connected via Socket.io:', socket.user.id, socket.user.name);

    // Rejoindre la room utilisateur
    socket.join(`user_${socket.user.id}`);
    console.log(`🎯 User ${socket.user.name} joined user_${socket.user.id}`);

    // Rejoindre la room admin si admin
    if (socket.user.role === 'admin') {
      socket.join('admin_room');
      console.log(`👑 Admin ${socket.user.name} joined admin_room`);
    }

    // Événement de test
    socket.on('test_ping', (data) => {
      console.log('🏓 Ping reçu:', data);
      socket.emit('test_pong', { message: 'Pong!', user: socket.user.name });
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 User disconnected:', socket.user.name, '- Reason:', reason);
    });
  });

  console.log('✅ Socket.io initialisé avec succès');
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export const emitNotification = (event, data, target = null) => {
  const io = getIO();
  
  console.log('📢 Emission notification:', {
    event,
    target,
    data: { ...data, message: data.message?.substring(0, 50) + '...' }
  });

  if (target === 'admin') {
    io.to('admin_room').emit(event, data);
    console.log(`📢 Notification envoyée à admin_room: ${event}`);
  } else if (target) {
    io.to(`user_${target}`).emit(event, data);
    console.log(`📢 Notification envoyée à user_${target}: ${event}`);
  } else {
    console.warn('⚠️ Aucune cible spécifiée pour la notification');
  }
};