// middleware/siteHealthMonitor.js
import { UserSite } from '../models/userSite.js';
import notificationService from '../services/notification.service.js';

const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.BASE_URL_PRODUCTION 
  : process.env.BASE_URL || 'http://localhost';

/**
 * Middleware pour surveiller et notifier la santé des sites
 */
export const monitorSiteHealth = async (req, res, next) => {
  try {
    // Vérifier la santé des sites toutes les 5 minutes
    const lastCheck = await getLastHealthCheck();
    const now = new Date();
    
    if (!lastCheck || (now - lastCheck) > 5 * 60 * 1000) {
      await performHealthChecks();
      await updateLastHealthCheck(now);
    }
  } catch (error) {
    console.warn('⚠️ Erreur monitoring santé sites:', error.message);
  }
  
  next();
};

/**
 * Effectue les vérifications de santé pour tous les sites
 */
async function performHealthChecks() {
  try {
    const sites = await UserSite.findAll({
      where: { status: 'active' },
      include: ['user']
    });

    for (const site of sites) {
      try {
        const healthStatus = await checkSiteHealth(site);
        
        if (healthStatus !== site.healthStatus) {
          // Mettre à jour le statut
          site.healthStatus = healthStatus;
          site.lastHealthCheck = new Date();
          
          if (healthStatus === 'down') {
            site.failedChecksCount += 1;
          } else {
            site.failedChecksCount = 0;
          }
          
          await site.save();
          
          // Notifier si le statut a changé
          if (healthStatus === 'warning' || healthStatus === 'down') {
            await notificationService.notifySiteHealthAlert({
              siteId: site.id,
              sitePort: site.port,
              userId: site.userId,
              siteName: site.name,
              userName: site.user.name,
              healthStatus: healthStatus,
              failedChecks: site.failedChecksCount,
              containerName: site.containerName
            });
          }
        }
      } catch (siteError) {
        console.warn(`⚠️ Erreur vérification santé site ${site.name}:`, siteError.message);
      }
    }
  } catch (error) {
    console.error('❌ Erreur vérifications santé:', error);
  }
}

/**
 * Vérifie la santé d'un site spécifique
 */
async function checkSiteHealth(site) {
  try {
    const response = await fetch(`${BASE_URL}:${site.port}`, {
      timeout: 10000
    });
    
    if (response.status === 200) {
      return 'healthy';
    } else if (response.status >= 500) {
      return 'down';
    } else {
      return 'warning';
    }
  } catch (error) {
    return 'down';
  }
}

// Fonctions helper pour le cache des vérifications
let lastHealthCheck = null;

async function getLastHealthCheck() {
  return lastHealthCheck;
}

async function updateLastHealthCheck(timestamp) {
  lastHealthCheck = timestamp;
}

export default monitorSiteHealth;