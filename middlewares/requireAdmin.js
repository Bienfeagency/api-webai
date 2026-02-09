import jwt from "jsonwebtoken";
import User from "../models/user.js";

export const requireAdmin = async (req, res, next) => {
  try {
    const token = req.cookies.admin_token;
    if (!token) return res.status(401).json({ message: "Non authentifié" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token invalide" });
  }
};
