// cron/monitorSites.js
import cron from "node-cron";
import axios from "axios";
import { UserSite } from "../models/userSite.js";
import Monitoring from "../models/monitoring.js";

const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.BASE_URL_PRODUCTION 
  : process.env.BASE_URL || 'http://localhost';


async function checkSiteHealth(site) {
  try {
    const url = `${BASE_URL}:${site.port}/wp-json/custom/healthcheck`;

    const { data } = await axios.get(url, { timeout: 4000 });
    console.log(`✅ Healthcheck réussi pour le site ID ${site.id}:`, data);

    return {
      status: data.status || "healthy",
      wp: data.wp_version || null,
      php: data.php_version || null,
      db: data.db_version || null,
      cpu: data.server?.cpu_load || null,
      mem: data.server?.memory_current || null,
      disk: data.server?.disk_used || null,
      responseTime: data.response_time || null
    };

  } catch (e) {
    return { status: "down" };
  }
}

// Exécuter toutes les 5 minutes
cron.schedule("*/5 * * * *", async () => {
  console.log("🔍 Monitoring WordPress sites...");

  const sites = await UserSite.findAll({ where: { status: "active" } });

  for (const site of sites) {
    const result = await checkSiteHealth(site);

    // Déterminer le nombre de checks échoués
    const newFailCount = result.status === "down" ? site.failedChecksCount + 1 : 0;

    // Déterminer le statut final
    const finalStatus =
      newFailCount >= 3
        ? "down"
        : result.status === "warning"
        ? "warning"
        : "healthy";

    // 🔄 Mise à jour du site
    await site.update({
      healthStatus: finalStatus,
      lastHealthCheck: new Date(),
      failedChecksCount: newFailCount,
      wordpressVersion: result.wp,
      phpVersion: result.php,
      dbVersion: result.db,
      cpuUsage: result.cpu,
      memoryUsageMB: result.mem,
      diskUsageMB: result.disk
    });

    // 📝 Créer un historique dans Monitoring
    await Monitoring.create({
      siteId: site.id,
      status: finalStatus,
      responseTime: result.responseTime,
      cpuUsage: result.cpu,
      memoryUsageMB: result.mem,
      diskUsageMB: result.disk,
      wpVersion: result.wp,
      phpVersion: result.php,
      dbVersion: result.db
    });
  }

  console.log("✅ Monitoring terminé.");
});

export default {};
