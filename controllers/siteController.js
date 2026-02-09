import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import slugify from 'slugify';

import { generateSiteStructure } from '../utils/generateSiteStructure.js';
import { generateArticles } from '../utils/generateArticle.js';
import { 
  createDockerNetwork, 
  getContainerPort, 
  setupDockerEnvironment,
  setupWordPressPluginsAndTheme
} from '../helpers/wordpressHelpers.js';
import {
  prepareExistingContainer,
  configureFinalSite,
  checkAndApplySandbox,
  applyAiStructureToContainer,
  generateAndCreateArticles,
  saveSiteConfig,
  cleanupCustomHomePages,
  createNewSiteContainer,
  updateAdminCredentials
} from '../helpers/generationHelpers.js';
import {
  updateThemeMetrics,
  updateThemeMetricsAndUsage,
  validateSiteGenerationData
} from '../helpers/businessHelpers.js';
import { updateUsageCounters } from '../utils/usageCounters.js';
import WordPressService from '../services/wordpress.service.js';

// NOUVEAU: Service de gestion des modèles IA
import { getAiModelForUser, checkAiGenerationsLimit, recordAiGenerationUsage } from '../services/aiModel.service.js';

// NOUVEAU: Service de notifications
import notificationService from '../services/notification.service.js';
import User from '../models/user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.BASE_URL_PRODUCTION 
  : process.env.BASE_URL || 'http://localhost';

/**
 * Vérifie les limites de générations IA avant toute opération
 */
async function checkAiGenerationLimits(userId, generationType, operationDetails = {}) {
  const limitCheck = await checkAiGenerationsLimit(userId);
  
  if (!limitCheck.allowed) {
    throw new Error(
      `Limite de générations IA atteinte. ${limitCheck.reason === 'no_subscription' 
        ? 'Un abonnement actif est requis.' 
        : 'Passez à un abonnement premium pour plus de générations.'
      }`
    );
  }

  console.log(`✅ Limites IA vérifiées - Type: ${generationType}, Restant: ${limitCheck.remaining}`);
  return limitCheck;
}

/**
 * Récupère le modèle IA approprié pour l'utilisateur
 */
async function getAppropriateAiModel(userId, generationType, operationDetails = {}) {
  try {
    const aiModel = await getAiModelForUser(userId, generationType);
    console.log(`🎯 Modèle IA sélectionné: ${aiModel.name} (${aiModel.provider}/${aiModel.modelId})`);
    
    return aiModel;
  } catch (error) {
    console.warn(`⚠️ Erreur récupération modèle IA, utilisation du modèle par défaut:`, error.message);
    
    // Fallback vers un modèle par défaut
    return {
      id: 0,
      name: 'OpenAI GPT-3.5 Turbo',
      provider: 'openai',
      modelId: 'gpt-3.5-turbo',
      isActive: true,
      isDefault: true
    };
  }
}

/**
 * Notifie les administrateurs d'un nouveau site créé
 */
async function notifyAdminsSiteCreated(userId, siteData) {
  try {
    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email']
    });
    
    await notificationService.notifySiteCreated({
      siteId: siteData.siteId,
      userId: user.id,
      siteName: siteData.siteName,
      userName: user.name,
      userEmail: user.email,
      theme: siteData.theme,
      containerName: siteData.containerName,
      port: siteData.port
    });
    
    console.log('📢 Notification admin envoyée: nouveau site créé');
  } catch (error) {
    console.warn('⚠️ Erreur envoi notification site créé:', error.message);
    // Ne pas bloquer le processus principal
  }
}

/**
 * Notifie l'utilisateur de la création réussie de son site
 */
async function notifyUserSiteCreated(userId, siteData) {
  try {
    await notificationService.createNotification({
      userId: userId,
      type: 'site_created',
      title: 'Site créé avec succès',
      message: `Votre site "${siteData.siteName}" a été créé avec succès et est maintenant accessible.`,
      data: {
        siteId: siteData.siteId,
        siteName: siteData.siteName,
        siteUrl: siteData.siteUrl,
        adminUrl: siteData.adminUrl,
        theme: siteData.theme
      },
      priority: 'medium'
    });
    
    console.log('📢 Notification utilisateur envoyée: site créé');
  } catch (error) {
    console.warn('⚠️ Erreur envoi notification utilisateur:', error.message);
  }
}

/**
 * Notifie les problèmes de santé du site
 */
async function notifySiteHealthStatus(siteData) {
  try {
    await notificationService.notifySiteHealthAlert({
      siteId: siteData.siteId,
      userId: siteData.userId,
      siteName: siteData.siteName,
      userName: siteData.userName,
      healthStatus: siteData.healthStatus,
      failedChecks: siteData.failedChecks
    });
    
    console.log(`📢 Notification santé site envoyée: ${siteData.healthStatus}`);
  } catch (error) {
    console.warn('⚠️ Erreur envoi notification santé:', error.message);
  }
}

/**
 * Génère un site complet WordPress - VERSION MODIFIÉE AVEC NOTIFICATIONS
 */
// Dans controllers/siteGenerationController.js - fonction generateSite

export const generateSite = async (req, res) => {
  try {
    const {
      siteName,
      numArticles,
      selectedTheme,
      language,
      articleTopic,
      structure,
      adminEmail,
      adminPassword,
      businessType,
      targetAudience,
      stylePreference,
      generateImages = false
    } = req.body;

    const userSubscription = req.userSubscription;
    const subscriptionPlan = req.subscriptionPlan;
    const userId = req.user.id;

    // Validation des données
    validateSiteGenerationData(userSubscription, subscriptionPlan, siteName, adminEmail, adminPassword, numArticles);

    const siteSlug = slugify(siteName, { lower: true, strict: true, trim: true });
    const SITE_PATH = path.resolve(__dirname, '../../sites', siteSlug);

    // Vérifier les limites IA si des articles sont demandés OU si une structure est fournie
    if (numArticles > 0 || structure?.pages?.length > 0) {
      await checkAiGenerationLimits(userId, 'article', {
        siteName,
        numArticles,
        topic: articleTopic,
        structurePages: structure?.pages?.length || 0
      });
    }

    // Créer le dossier du site final
    await fs.mkdir(SITE_PATH, { recursive: true });
    console.log('✅ Dossier site créé');

    const wpContainer = `${siteSlug.toLowerCase()}_wp`;
    
    let containerStatus;
    let previewContainerReused = false;

    // Vérifier d'abord si le conteneur de preview existe
    try {
      console.log(`🎯 Vérification du conteneur de preview pour ${siteName}...`);
      containerStatus = await prepareExistingContainer(wpContainer);
      
      if (containerStatus.ready) {
        previewContainerReused = true;
        console.log('✅ Conteneur de preview réutilisé');
      } else {
        throw new Error('Conteneur non utilisable');
      }
    } catch (error) {
      console.log('🔨 Aucun conteneur de preview trouvé, création d\'un nouveau site...');
      
      // Créer un nouveau site from scratch
      containerStatus = await createNewSiteContainer({
        siteSlug,
        siteName,
        selectedTheme,
        adminEmail,
        adminPassword,
        language: language || 'fr_FR'
      });
      
      previewContainerReused = false;
      console.log('✅ Nouveau site créé directement');
    }

    const { port: currentPort, SITE_URL } = containerStatus;

    // Configuration du site final (seulement si nouveau conteneur)
    if (!previewContainerReused) {
      await configureFinalSite(wpContainer, SITE_URL, adminEmail, adminPassword);
    } else {
      // Si réutilisation, mettre à jour la configuration admin
      await updateAdminCredentials(wpContainer, adminEmail, adminPassword);
    }

    // Vérifier et appliquer les modifications du sandbox (seulement si preview existait)
    let sandboxApplied = false;
    if (previewContainerReused) {
      sandboxApplied = await checkAndApplySandbox(siteSlug, wpContainer, selectedTheme);
    }

    // Nettoyer les anciennes pages personnalisées (seulement si preview existait)
    if (previewContainerReused) {
      await cleanupCustomHomePages(wpContainer);
    }

      // Appliquer la structure IA si fournie - AVEC CONTENU GÉNÉRÉ
    if (structure?.pages?.length > 0 && !previewContainerReused) {
      console.log('🏗️ Application structure IA avec contenu généré...');
      
      // Contexte du site pour la génération de contenu
      const siteContext = {
        siteName,
        businessType: businessType || 'Général',
        language: language || 'fr_FR',
        targetAudience: targetAudience || 'Particuliers',
        stylePreference: stylePreference || 'Moderne',
        userId: userId,
        generateImages: generateImages
      };

      await applyAiStructureToContainer(wpContainer, structure, siteContext);
      console.log(`✅ Structure avec contenu IA appliquée (${structure.pages.length} pages)`);
    } else if (structure?.pages?.length > 0 && previewContainerReused) {
      console.log('ℹ️ Structure déjà appliquée lors de la preview - Pas de duplication');
    }

    // Générer les articles si demandés - AVEC GESTION IA
    /*if (numArticles > 0 && articleTopic) {
      try {
        // Récupérer le modèle IA pour la génération d'articles
        const articleAiModel = await getAppropriateAiModel(userId, 'article', {
          siteName,
          topic: articleTopic,
          numArticles
        });

        console.log(`📝 Génération de ${numArticles} articles avec ${articleAiModel.name}...`);
        
        await generateAndCreateArticles(
          wpContainer, 
          numArticles, 
          articleTopic, 
          language,
          userId,
          articleAiModel // Passer le modèle spécifique
        );

        console.log(`✅ ${numArticles} articles générés avec ${articleAiModel.name}`);
      } catch (articleError) {
        console.error('❌ Erreur génération articles:', articleError.message);
        // Continuer même si la génération d'articles échoue
      }
    }*/

    // Optimisations finales
    await WordPressService.flushCache(wpContainer);
    console.log('✅ Optimisations terminées');

    // Sauvegarder la configuration
    await saveSiteConfig(siteSlug, {
      siteName,
      port: currentPort,
      theme: selectedTheme,
      adminEmail,
      businessType,
      targetAudience,
      stylePreference,
      generatedFromPreview: previewContainerReused,
      previewContainerReused: previewContainerReused,
      modificationsApplied: sandboxApplied,
      contentGenerated: !!structure?.pages?.length,
      numArticles: numArticles || 0,
      createdAt: new Date().toISOString()
    });

    // Mettre à jour les métriques et l'usage
    const siteConfig = await updateThemeMetricsAndUsage(selectedTheme, userId, {
      numArticles: numArticles || 0,
      structurePages: structure?.pages?.length || 0,
      siteName,
      siteSlug,
      theme: selectedTheme,
      containerName: wpContainer,
      port: currentPort,
      articleTopic,
      language,
      businessType,
      isNewSite: !previewContainerReused,
      contentGenerated: !!structure?.pages?.length // NOUVEAU
    });

    // Notifications après création réussie
    try {
      // Notifier les administrateurs
      await notifyAdminsSiteCreated(userId, {
        siteId: siteConfig.id || siteSlug,
        siteName,
        userName: req.user.name,
        userEmail: req.user.email,
        theme: selectedTheme,
        containerName: wpContainer,
        port: currentPort,
        siteUrl: SITE_URL,
        adminUrl: `${SITE_URL}/wp-admin`,
        contentGenerated: !!structure?.pages?.length,
        numArticles: numArticles || 0
      });

      // Notifier l'utilisateur
      await notifyUserSiteCreated(userId, {
        siteId: siteConfig.id || siteSlug,
        siteName,
        siteUrl: SITE_URL,
        adminUrl: `${SITE_URL}/wp-admin`,
        theme: selectedTheme,
        contentGenerated: !!structure?.pages?.length,
        numArticles: numArticles || 0
      });
    } catch (notificationError) {
      console.warn('⚠️ Erreur lors des notifications:', notificationError.message);
    }

    console.log('🎉 SITE FINAL GÉNÉRÉ AVEC SUCCÈS!');
    
    return res.json({
      message: previewContainerReused 
        ? `Site "${siteName}" généré avec succès`
        : `Site "${siteName}" créé avec succès`,
      blogUrl: SITE_URL,
      adminUrl: `${SITE_URL}/wp-admin`,
      details: {
        theme: selectedTheme,
        numArticles: numArticles || 0,
        articleTopic: articleTopic || 'Aucun',
        contentPages: structure?.pages?.length || 0,
        businessType: businessType || 'Général',
        previewContainerReused: previewContainerReused,
        modificationsApplied: sandboxApplied,
        contentGenerated: !!structure?.pages?.length,
        resourcesSaved: previewContainerReused,
        creationType: previewContainerReused ? 'from_preview' : 'new_site'
      },
      subscriptionInfo: {
        plan: subscriptionPlan.name,
        sitesUsed: (await updateUsageCounters(userId, { siteName })).sites,
        sitesLimit: subscriptionPlan.maxSites,
        aiGenerationsUsed: (await updateUsageCounters(userId, { 
          numArticles: numArticles || 0,
          structurePages: structure?.pages?.length || 0 
        })).aiGenerations,
        aiGenerationsLimit: subscriptionPlan.aiGenerations,
        modelTier: subscriptionPlan.slug === 'freemium' ? 'standard' : 'premium'
      }
    });

  } catch (error) {
    console.error("❌ Erreur génération site:", error);
    
    // Notifier l'échec de création
    try {
      await notificationService.createNotification({
        userId: req.user.id,
        type: 'system_alert',
        title: 'Échec création site',
        message: `La création du site "${req.body.siteName}" a échoué: ${error.message}`,
        data: {
          siteName: req.body.siteName,
          error: error.message,
          timestamp: new Date().toISOString()
        },
        priority: 'high'
      });
    } catch (notificationError) {
      console.warn('⚠️ Erreur notification échec:', notificationError.message);
    }
    
    return res.status(500).json({ 
      message: "Erreur lors de la génération du site",
      error: error.message,
      code: error.message.includes('Limite de générations') ? 'AI_LIMIT_REACHED' : 'GENERATION_ERROR'
    });
  }
};

/**
 * Gère la prévisualisation d'un site - VERSION MODIFIÉE AVEC NOTIFICATIONS
 */
export const previewSite = async (req, res) => {
  const { selectedTheme } = req.params;
  const { 
    siteName, 
    password,
    structure, 
    numArticles, 
    articleTopic, 
    language,
    businessType, // AJOUT: Récupérer businessType
    targetAudience, // AJOUT: Récupérer targetAudience  
    stylePreference, // AJOUT: Récupérer stylePreference
    forceRefresh = false,
    generateImages = false
  } = req.body;

  if (!siteName) {
    return res.status(400).json({ message: "siteName manquant" });
  }

  try {
    const userId = req.user.id;
    
    // Vérifier les limites IA si des articles sont demandés OU si une structure est fournie
    if (numArticles > 0 || structure?.pages?.length > 0) {
      await checkAiGenerationLimits(userId, 'article', {
        siteName,
        numArticles,
        topic: articleTopic,
        structurePages: structure?.pages?.length || 0,
        context: 'preview'
      });
    }

    // Mettre à jour les métriques du thème
    await updateThemeMetrics(selectedTheme);

    const siteSlug = slugify(siteName, { lower: true, strict: true, trim: true });
    const sandboxDir = path.join(__dirname, "../sandbox", siteSlug);
    await fs.mkdir(sandboxDir, { recursive: true });

    const networkName = `${siteSlug.toLowerCase()}_network`;
    const dbContainer = `${siteSlug.toLowerCase()}_db`;
    const wpContainer = `${siteSlug.toLowerCase()}_wp`;
    const dbName = `${siteSlug.toLowerCase()}_db`;
    const dbUser = "root";
    const dbPass = "root";

    let wpPort;
    let isNewContainer = false;

    try {
      // Vérifier si le conteneur existe déjà
      console.log(`🎯 Vérification du conteneur WP pour preview: ${wpContainer}...`);
      await WordPressService.ensureContainerExists(wpContainer);
      wpPort = await getContainerPort(wpContainer);
      console.log(`✅ Conteneur existant réutilisé: ${wpContainer}`);
    } catch (error) {
      console.log(`❌ Conteneur WP ${wpContainer} non trouvé, création...`);
      isNewContainer = true;
      
      // Configurer l'environnement Docker complet
      wpPort = await setupDockerEnvironment({
        siteSlug,
        networkName,
        dbContainer,
        wpContainer,
        dbName,
        dbUser,
        dbPass,
        sandboxDir,
        siteName,
        language: language || 'fr_FR'
      });

      // Notifier la création d'un nouveau conteneur preview
      try {
        await notificationService.createNotification({
          userId: null,
          type: 'site_created',
          title: 'Nouveau site de prévisualisation créé',
          message: `L'utilisateur ${req.user.name} a créé un nouveau site de preview: ${siteName}`,
          data: {
            siteName,
            userName: req.user.name,
            userEmail: req.user.email,
            theme: selectedTheme,
            containerName: wpContainer,
            port: wpPort,
            isPreview: true,
            contentGenerated: !!structure?.pages?.length
          },
          priority: 'low'
        });
      } catch (notificationError) {
        console.warn('⚠️ Erreur notification preview:', notificationError.message);
      }
    }

    // Configurer les plugins et le thème
    await setupWordPressPluginsAndTheme(wpContainer, dbContainer, selectedTheme);

      // AJOUT: Contexte pour la génération de contenu
    const siteContext = {
      siteName,
      businessType: businessType || 'Général',
      language: language || 'fr_FR',
      targetAudience: targetAudience || 'Particuliers',
      stylePreference: stylePreference || 'Moderne',
      userId: userId,
      generateImages: generateImages
    };

    const shouldApplyStructure = structure && structure.pages && structure.pages.length > 0 && 
                            (isNewContainer || forceRefresh);

    if (shouldApplyStructure) {
      console.log('🏗️ Application de la structure IA avec contenu généré au preview...');
      try {
        // REMPLACER: utiliser applyAiStructureToContainer au lieu de WordPressService.applyStructure directement
        await applyAiStructureToContainer(wpContainer, structure, siteContext);
        console.log('✅ Structure IA avec contenu appliquée avec succès au preview');
      } catch (structureError) {
        console.warn('⚠️ Erreur application structure preview:', structureError.message);
        
        // Fallback: essayer sans génération de contenu
        try {
          console.log('🔄 Tentative avec structure originale...');
          await WordPressService.applyStructure(wpContainer, structure);
          console.log('✅ Structure originale appliquée (fallback)');
        } catch (fallbackError) {
          console.warn('⚠️ Erreur application structure fallback:', fallbackError.message);
        }
      }
    }

    // Générer les articles si demandés (uniquement pour les nouveaux conteneurs) - AVEC GESTION IA
    if (isNewContainer && numArticles > 0 && articleTopic) {
      console.log(`📝 Génération de ${numArticles} articles pour le preview...`);
      try {
        // Récupérer le modèle IA pour les articles
        const articleAiModel = await getAppropriateAiModel(userId, 'article', {
          siteName,
          topic: articleTopic,
          numArticles,
          context: 'preview'
        });

        await generateAndCreateArticles(
          wpContainer, 
          numArticles, 
          articleTopic, 
          language,
          userId,
          articleAiModel // CORRECTION: utiliser articleAiModel au lieu de req.aiModel
        );
        
        console.log(`✅ ${numArticles} articles générés pour le preview avec ${articleAiModel.name}`);
      } catch (articlesError) {
        console.warn('⚠️ Erreur génération articles preview:', articlesError.message);
        // Continuer même si la génération d'articles échoue
      }
    }

    // Nettoyer le cache WordPress
    try {
      await WordPressService.flushCache(wpContainer);
      console.log('✅ Cache WordPress nettoyé');
    } catch (cacheError) {
      console.warn('⚠️ Erreur nettoyage cache:', cacheError.message);
    }

    // Retourner l'URL de prévisualisation
    const previewUrl = `${BASE_URL}:${wpPort}`;
    console.log(`✅ Preview URL: ${previewUrl}`);
    
    return res.json({ 
      previewUrl,
      port: wpPort,
      details: {
        containerReused: !isNewContainer,
        structureApplied: shouldApplyStructure,
        articlesGenerated: !!(isNewContainer && numArticles > 0),
        contentGenerated: shouldApplyStructure, // AJOUT
        theme: selectedTheme,
        businessType: businessType || 'Général' // AJOUT
      }
    });

  } catch (err) {
    console.error("❌ Erreur création sandbox preview:", err);
    
    // Notifier l'échec du preview
    try {
      await notificationService.createNotification({
        userId: req.user.id,
        type: 'system_alert',
        title: 'Échec prévisualisation',
        message: `La prévisualisation du site "${req.body.siteName}" a échoué: ${err.message}`,
        data: {
          siteName: req.body.siteName,
          theme: selectedTheme,
          error: err.message,
          timestamp: new Date().toISOString()
        },
        priority: 'medium'
      });
    } catch (notificationError) {
      console.warn('⚠️ Erreur notification échec preview:', notificationError.message);
    }
    
    return res.status(500).json({ 
      message: "Erreur création sandbox preview",
      error: err.message 
    });
  }
};
// controllers/siteGenerationController.js - SIMPLIFICATION
export const generateStructure = async (req, res) => {
  try {
    const userId = req.user.id;
    const subscriptionPlan = req.subscriptionPlan;
    const aiModel = req.aiModel;
    const aiGenerationsCheck = req.aiGenerationsCheck;

    const {
      siteName,
      articleTopic,
      numArticles,
      language,
      businessType,
      targetAudience,
      stylePreference
    } = req.body;

    console.log('🚀 Début génération structure IA:', {
      siteName,
      businessType,
      language,
      model: `${aiModel.modelId}`
    });

    // Vérifier les limites (déjà fait par le middleware, mais double vérification)
    if (!aiGenerationsCheck.allowed) {
      return res.status(403).json({
        message: 'Limite de générations IA atteinte',
        code: 'AI_GENERATIONS_LIMIT_REACHED',
        upgradeRequired: true
      });
    }

    // Générer la structure avec le modèle IA spécifique
    const structure = await generateSiteStructure({
      siteName,
      articleTopic,
      numArticles,
      language,
      businessType,
      targetAudience,
      stylePreference,
      aiModel
    });

    console.log('✅ Structure IA générée avec succès');
    
    // Le tracking sera fait automatiquement par le middleware trackAiUsage
    
    return res.json({
      ...structure,
      aiModelInfo: {
        name: aiModel.name,
        provider: aiModel.provider,
        modelId: aiModel.modelId,
        isPremium: !aiModel.isDefault
      },
      subscriptionInfo: {
        plan: subscriptionPlan.name,
        usage: aiGenerationsCheck,
        modelTier: aiModel.isDefault ? 'standard' : 'premium'
      }
    });

  } catch (error) {
    console.error('❌ Erreur génération structure IA:', error.message);
    
    // Fallback garanti
    const fallbackStructure = generateFallbackStructure(
      req.body.siteName, 
      req.body.businessType, 
      req.body.language
    );
    
    return res.json(fallbackStructure);
  }
};

/**
 * Applique une structure IA à un site WordPress
 */
export const applyAiStructure = async (req, res) => {
  try {
    const { siteName, structure, selectedTheme } = req.body;
    
    if (!siteName || !structure) {
      return res.status(400).json({ message: "Données manquantes" });
    }

    const siteSlug = slugify(siteName, { lower: true, strict: true, trim: true });
    const wpContainer = `${siteSlug.toLowerCase()}_wp`;

    console.log('🔨 Application de la structure IA au site...');

    // Vérifier que le conteneur existe
    await WordPressService.ensureContainerExists(wpContainer);

    // Appliquer la structure
    const results = await WordPressService.applyStructure(wpContainer, structure);

    console.log('✅ Structure IA appliquée avec succès');
    
    return res.json({
      message: 'Structure appliquée avec succès',
      results,
      appliedPages: results.pages.filter(r => r.status === 'success').length,
      menuApplied: results.menu
    });

  } catch (error) {
    console.error('❌ Erreur application structure:', error);
    return res.status(500).json({
      message: 'Erreur lors de l\'application de la structure',
      error: error.message
    });
  }
};


/**
 * Récupère les pages d'un site
 */
export const getSitePages = async (req, res) => {
  const { siteSlug } = req.params;
  
  try {
    const wpContainer = `${siteSlug.toLowerCase()}_wp`;
    
    // Vérifier que le conteneur existe
    await WordPressService.ensureContainerExists(wpContainer);

    // Récupérer les pages
    const pages = await WordPressService.getPages(wpContainer);
    
    console.log(`📄 Pages récupérées pour ${siteSlug}:`, pages.length);
    return res.json(pages);
    
  } catch (error) {
    console.error("❌ Erreur récupération pages:", error);
    
    // Fallback: pages par défaut
    const fallbackPages = [
      { id: 1, title: "Accueil", slug: "accueil", url: "/" },
      { id: 2, title: "À propos", slug: "a-propos", url: "/a-propos" },
      { id: 3, title: "Services", slug: "services", url: "/services" },
      { id: 4, title: "Contact", slug: "contact", url: "/contact" }
    ];
    
    return res.json(fallbackPages);
  }
};

/**
 * Applique une structure complète à un site
 */
export const applyFullStructure = async (req, res) => {
  try {
    const { siteName, structure, selectedTheme } = req.body;
    
    if (!siteName || !structure) {
      return res.status(400).json({ message: "Données manquantes" });
    }

    const siteSlug = slugify(siteName, { lower: true, strict: true, trim: true });
    const wpContainer = `${siteSlug.toLowerCase()}_wp`;

    console.log('🏗️ Application de la structure complète au site...');

    // Vérifier que le conteneur existe
    await WordPressService.ensureContainerExists(wpContainer);

    // Appliquer la structure complète
    const results = await WordPressService.applyFullStructure(wpContainer, structure);

    console.log('✅ Structure IA appliquée avec succès');
    
    return res.json({
      message: 'Structure appliquée avec succès',
      results,
      appliedPages: results.pages.filter(r => r.status === 'success').length,
      menuApplied: results.menu
    });

  } catch (error) {
    console.error('❌ Erreur application structure:', error);
    return res.status(500).json({
      message: 'Erreur lors de l\'application de la structure',
      error: error.message
    });
  }
};

// Fonctions helper locales pour les structures par défaut
function generateFallbackStructure(siteName, businessType, language) {
  const pages = generateDefaultPages(businessType, language);
  return {
    pages: pages,
    menu: generateDefaultMenu(pages, language),
    themeSuggestions: ["astra", "oceanwp", "generatepress"]
  };
}

function generateDefaultPages(businessType, language) {
  const basePages = [
    { title: "Accueil", slug: "accueil" },
    { title: "À propos", slug: "a-propos" },
    { title: "Services", slug: "services" },
    { title: "Contact", slug: "contact" }
  ];

  if (businessType === "Restaurant") {
    basePages.splice(2, 0, { title: "Menu", slug: "menu" });
  } else if (businessType === "Boutique en ligne") {
    basePages.splice(2, 0, { title: "Boutique", slug: "boutique" });
  } else if (businessType === "Service professionnel") {
    basePages.splice(2, 0, { title: "Expertise", slug: "expertise" });
  }

  return basePages.map(page => ({
    ...page,
    content: {
      blocks: generateDefaultBlocks(page.title, businessType, language)
    }
  }));
}

function generateDefaultBlocks(pageTitle, businessType, language) {
  const blocks = [];
  
  if (pageTitle === "Accueil") {
    blocks.push(
      {
        type: "hero",
        content: `${businessType} - Excellence et Qualité`,
        attributes: {
          subtitle: "Bienvenue sur notre site",
          buttonText: language === 'fr_FR' ? "Découvrir" : "Discover",
          buttonLink: "#about"
        }
      },
      {
        type: "heading",
        content: language === 'fr_FR' ? "Pourquoi nous choisir ?" : "Why Choose Us?",
        attributes: { level: 2 }
      },
      {
        type: "features",
        content: language === 'fr_FR' ? "Nos avantages" : "Our Advantages",
        attributes: {
          items: language === 'fr_FR' ? [
            "Professionnalisme",
            "Qualité garantie", 
            "Service personnalisé"
          ] : [
            "Professionalism",
            "Guaranteed Quality",
            "Personalized Service"
          ]
        }
      }
    );
  } else if (pageTitle === "À propos" || pageTitle === "About") {
    blocks.push(
      {
        type: "heading",
        content: language === 'fr_FR' ? "Notre histoire" : "Our Story",
        attributes: { level: 1 }
      },
      {
        type: "paragraph",
        content: language === 'fr_FR' 
          ? `Découvrez notre passion pour ${businessType} et notre engagement envers l'excellence.`
          : `Discover our passion for ${businessType} and our commitment to excellence.`
      }
    );
  }
  
  // Bloc de contenu principal
  blocks.push({
    type: "paragraph",
    content: getDefaultContent(pageTitle, businessType, language)
  });

  return blocks;
}

function getDefaultContent(pageTitle, businessType, language) {
  const contentMap = {
    "Accueil": language === 'fr_FR' 
      ? `Bienvenue chez ${businessType}. Nous nous engageons à vous offrir des services de qualité adaptés à vos besoins. Découvrez notre expertise et notre passion.`
      : `Welcome to ${businessType}. We are committed to providing you with quality services tailored to your needs. Discover our expertise and passion.`,
    
    "À propos": language === 'fr_FR'
      ? `Notre entreprise se consacre à ${businessType} avec passion et professionnalisme. Forts de notre expérience, nous garantissons satisfaction et qualité.`
      : `Our company is dedicated to ${businessType} with passion and professionalism. With our experience, we guarantee satisfaction and quality.`,
    
    "Services": language === 'fr_FR'
      ? `Nous proposons une gamme complète de services professionnels adaptés à vos exigences. Chaque projet est unique et mérite notre attention totale.`
      : `We offer a complete range of professional services tailored to your requirements. Each project is unique and deserves our full attention.`,
    
    "Contact": language === 'fr_FR'
      ? `N'hésitez pas à nous contacter pour toute question ou devis. Notre équipe est à votre écoute et vous répondra dans les meilleurs délais.`
      : `Do not hesitate to contact us for any questions or quotes. Our team is listening and will respond to you as soon as possible.`
  };
  
  return contentMap[pageTitle] || (language === 'fr_FR' 
    ? "Contenu de la page en cours de rédaction." 
    : "Page content being written.");
}

function generateDefaultMenu(pages, language) {
  return pages.map(page => ({
    label: page.title,
    url: `/${page.slug}`,
    type: "page"
  }));
}