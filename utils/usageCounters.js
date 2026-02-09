// utils/usageCounters.js
import { UserUsage } from '../models/userUsage.js';
import { UserSite } from '../models/userSite.js';

// Compter les sites de l'utilisateur
export const countUserSites = async (userId) => {
  try {
    return await UserSite.count({
      where: { 
        userId, 
        status: 'active' 
      }
    });
  } catch (error) {
    console.error('❌ Erreur comptage sites:', error);
    return 0;
  }
};

// Compter les générations IA de l'utilisateur
export const countUserAIGenerations = async (userId) => {
  try {
    const result = await UserUsage.sum('count', {
      where: { 
        userId, 
        type: 'ai_generation' 
      }
    });
    return result || 0;
  } catch (error) {
    console.error('❌ Erreur comptage générations IA:', error);
    return 0;
  }
};

// Incrémenter les générations IA
export const incrementAIGenerations = async (userId, count = 1, details = {}) => {
  try {
    await UserUsage.create({
      userId,
      type: 'ai_generation',
      count,
      details
    });
    console.log(`✅ ${count} génération(s) IA enregistrée(s) pour l'utilisateur ${userId}`);
  } catch (error) {
    console.error('❌ Erreur enregistrement générations IA:', error);
  }
};

// Créer un site utilisateur
export const createUserSite = async (userId, siteName, siteSlug, theme, containerName, port) => {
  try {
    await UserSite.create({
      userId,
      name: siteName,
      slug: siteSlug,
      theme,
      containerName,
      port,
      status: 'active',
      metadata: {
        createdAt: new Date().toISOString(),
        container: containerName,
        port: port
      }
    });
    console.log(`✅ Site "${siteName}" enregistré pour l'utilisateur ${userId}`);
  } catch (error) {
    console.error('❌ Erreur création site utilisateur:', error);
  }
};

// Fonction principale pour mettre à jour tous les compteurs
export const updateUsageCounters = async (userId, options = {}) => {
  const {
    numArticles = 0,
    structurePages = 0,
    siteName = null,
    siteSlug = null,
    theme = null,
    containerName = null,
    port = null
  } = options;

  try {
    // 1. Enregistrer les générations IA pour les articles
    if (numArticles > 0) {
      await incrementAIGenerations(userId, numArticles, {
        type: 'article_generation',
        topic: options.articleTopic,
        language: options.language
      });
    }

    // 2. Enregistrer les générations IA pour la structure
    if (structurePages > 0) {
      await incrementAIGenerations(userId, structurePages, {
        type: 'structure_generation',
        pagesCount: structurePages,
        siteName: siteName
      });
    }

    // 3. Enregistrer le nouveau site
    if (siteName && siteSlug) {
      await createUserSite(userId, siteName, siteSlug, theme, containerName, port);
    }

    console.log(`✅ Compteurs mis à jour pour l'utilisateur ${userId}`);
    
    // Retourner le nouvel état
    return {
      sites: await countUserSites(userId),
      aiGenerations: await countUserAIGenerations(userId)
    };

  } catch (error) {
    console.error('❌ Erreur mise à jour compteurs:', error);
    throw error;
  }
};

// Obtenir les statistiques d'usage
export const getUserUsageStats = async (userId) => {
  try {
    const sitesCount = await countUserSites(userId);
    const aiGenerationsCount = await countUserAIGenerations(userId);
    
    // Dernières activités
    const recentActivities = await UserUsage.findAll({
      where: { userId },
      order: [['consumedAt', 'DESC']],
      limit: 10,
      attributes: ['type', 'count', 'details', 'consumedAt']
    });

    return {
      sites: {
        count: sitesCount
      },
      aiGenerations: {
        count: aiGenerationsCount
      },
      recentActivities
    };
  } catch (error) {
    console.error('❌ Erreur récupération stats usage:', error);
    return {
      sites: { count: 0 },
      aiGenerations: { count: 0 },
      recentActivities: []
    };
  }
};