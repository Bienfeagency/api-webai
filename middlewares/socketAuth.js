// middleware/socketAuth.js
import jwt from "jsonwebtoken";
import User from "../models/user.js";

export const socketAuth = async (socket, next) => {
  try {
    // Récupérer le token depuis la query string ou les headers
    const token = socket.handshake.auth.token || 
                  socket.handshake.query.token ||
                  socket.request.headers.cookie?.match(/token=([^;]+)/)?.[1];

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};

export default socketAuth;