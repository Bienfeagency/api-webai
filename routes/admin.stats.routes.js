// routes/adminStatsRoutes.js
import express from "express";
import {
    getAdminDashboardStats,
    getUsersAnalytics,
    getFinancialAnalytics,
    getTechnicalAnalytics,
    getSitesPerformanceData,
    getHistoricalData,
    getGrowthChartData,
    getMetricsWithGrowth,
    getPremiumAnalytics
} from "../controllers/adminStatsController.js";

const router = express.Router();

// Route principale du dashboard
router.get("/dashboard", getAdminDashboardStats);

// Routes analytiques détaillées
router.get("/analytics/users", getUsersAnalytics);
router.get("/analytics/financial", getFinancialAnalytics);
router.get("/analytics/technical", getTechnicalAnalytics);
router.get('/analytics/premium', getPremiumAnalytics);
router.get("/performance/sites", getSitesPerformanceData);
router.get("/historical", getHistoricalData);
router.get("/growth-chart", getGrowthChartData);
router.get("/metrics-with-growth", getMetricsWithGrowth);

export default router;