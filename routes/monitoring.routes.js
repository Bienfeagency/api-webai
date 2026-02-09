// routes/monitoring.js
import express from "express";
import Monitoring from "../models/monitoring.js";
import authMiddleware from '../middlewares/authMiddleware.js';
import { Op } from "sequelize";

const router = express.Router();

// GET /api/sites/:siteId/monitoring
router.get("/sites/:siteId/monitoring", authMiddleware, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { range = "24h" } = req.query;

    let whereCondition = { siteId: parseInt(siteId) };
    
    // Filtre par période
    const now = new Date();
    let startDate = new Date();
    
    switch (range) {
      case "24h":
        startDate.setHours(now.getHours() - 24);
        break;
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate.setHours(now.getHours() - 24);
    }

    whereCondition.checkedAt = {
      [Op.gte]: startDate
    };

    const monitoringData = await Monitoring.findAll({
      where: whereCondition,
      order: [["checkedAt", "ASC"]],
      limit: range === "24h" ? 100 : 200 // Limite selon la période
    });

    res.json(monitoringData);
  } catch (error) {
    console.error("Erreur récupération monitoring:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;