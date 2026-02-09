import UserSite from "../models/userSite.js";
import Monitoring from "../models/monitoring.js";
import axios from "axios";

const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.BASE_URL_PRODUCTION 
  : process.env.BASE_URL || 'http://localhost';

export const getUserSites = async (req, res) => {
  try {
    const userId = req.user.id;

    const sites = await UserSite.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]]
    });

    const results = [];

    for (const site of sites) {

      // 🔍 Dernier monitoring en base
      const lastMonitoring = await Monitoring.findOne({
        where: { siteId: site.id },
        order: [["checkedAt", "DESC"]]
      });

      let liveHealth = null;

      try {
        // 🌐 Appel live du healthcheck WordPress
        console.log(`🔔 Vérification live du site ID ${site.id} sur le port ${site.port}`);
        const response = await axios.get(
        `${BASE_URL}:${site.port}/wp-json/custom/healthcheck`,
        { timeout: 3000 }
        );
        console.log(`✅ Réponse reçue pour le site ID ${site.id}:`, response.data);

        liveHealth = response.data;
        console.log(liveHealth)

        // 👌 Détermination du statut
        const wpStatus =
          response.data.status === "healthy"
            ? "healthy"
            : response.data.status === "warning"
            ? "warning"
            : "down";

        // 🔄 Mise à jour du site dans la base
        await site.update({
          healthStatus: wpStatus,
          lastHealthCheck: new Date(),

          cpuUsage: response.data.server?.cpu_load || null,

          memoryUsageMB: response.data.server?.memory_current || null,
          memoryLimitMB: response.data.server?.memory_limit || null,

          diskUsageMB: response.data.server?.disk_used || null,

          wordpressVersion: response.data.wp_version || null,
          phpVersion: response.data.php_version || null,
          dbVersion: response.data.db_version || null
        });

      } catch (err) {
        // ❌ Site inaccessible
        console.log("⚠️ Site inaccessible:", site.id, err);
        liveHealth = { status: "down", message: "Site unreachable" };

        await site.update({
          healthStatus: "down",
          lastHealthCheck: new Date(),
          failedChecksCount: site.failedChecksCount + 1
        });
      }

      results.push({
        ...site.toJSON(),
        lastMonitoring,
        liveHealth
      });
    }

    res.json(results);

  } catch (error) {
    console.error("🔥 Erreur getUserSites:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
