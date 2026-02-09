import cron from "node-cron";
import HistoricalStatsService from "../services/historicalStats.service.js";

// Exécuter tous les jours à minuit
cron.schedule("* * * * *", async () => {
  console.log("📊 Collecte des données historiques quotidiennes...");
  await HistoricalStatsService.collectDailyStats();
});

// Exécuter tous les lundis à 1h00 pour les données hebdomadaires
cron.schedule("* * * * *", async () => {
  console.log("📊 Agrégation des données hebdomadaires...");
  // Implémenter l'agrégation hebdomadaire si nécessaire
});

export default {};