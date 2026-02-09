// middleware/subscriptionMiddleware.js - AJOUTS POUR LE TRACKING
import { UserSubscription, SubscriptionPlan, UserSite, UserUsage } from '../models/index.js';
import { PlanAiModel, AiModel } from '../models/index.js'; // NOUVEAU: Import des modèles IA
import { recordAiGenerationUsage } from '../services/aiModel.service.js'; // NOUVEAU: Service pour enregistrer l'usage IA

// NOUVEAU: Middleware pour enregistrer l'usage IA après la requête
export const trackAiUsage = async (req, res, next) => {
  // Sauvegarder la méthode send originale
  const originalSend = res.send;
  
  // Override de la méthode send pour tracker après l'envoi de la réponse
  res.send = function(data) {
    // Restaurer la méthode send originale
    res.send = originalSend;
    
    // Appeler la méthode send originale
    const result = originalSend.call(this, data);
    
    // Tracker l'usage IA si la requête a réussi
    if (res.statusCode >= 200 && res.statusCode < 300) {
      trackAiUsageIfApplicable(req, data).catch(error => {
        console.error('❌ Erreur tracking usage IA:', error);
      });
    }
    
    return result;
  };
  
  next();
};

/**
 * Track l'usage IA si applicable selon la requête
 */
async function trackAiUsageIfApplicable(req, responseData) {
  try {
    const userId = req.user?.id;
    const aiModel = req.aiModel;
    const generationType = req.generationType;
    
    if (!userId || !aiModel || !generationType) {
      return;
    }

    let usageCount = 0;
    let details = {
      generationType,
      aiModel: aiModel.name,
      provider: aiModel.provider,
      modelId: aiModel.modelId
    };

    // Déterminer le coût selon le type de génération
    switch (generationType) {
      case 'article':
        // Pour les articles, compter le nombre d'articles générés
        const numArticles = req.body.numArticles || 1;
        usageCount = numArticles;
        details.articlesGenerated = numArticles;
        details.topic = req.body.articleTopic;
        break;
        
      case 'site-structure':
        // Pour la structure, compter 1 génération
        usageCount = 1;
        details.businessType = req.body.businessType;
        details.pagesGenerated = responseData?.pages?.length || 0;
        break;
        
      case 'seo':
        usageCount = 1;
        details.keywords = req.body.seoKeywords;
        break;
        
      case 'content':
        usageCount = 1;
        details.contentType = req.body.contentType;
        break;
        
      case 'full-site':
        usageCount = responseData?.pages?.length || 1;
        details.pagesGenerated = responseData?.pages?.length || 0;
        break;
        
      default:
        usageCount = 1;
    }

    // Appliquer le coût du modèle
    const modelCost = aiModel.costPerGeneration || 1;
    const totalCost = usageCount * modelCost;

    // Enregistrer l'usage
    await recordAiGenerationUsage(userId, {
      count: totalCost,
      generationType,
      aiModel: aiModel.name,
      tokensUsed: estimateTokensForRequest(req, responseData),
      cost: totalCost,
      ...details
    });

    console.log(`📊 Usage IA tracké: ${totalCost} crédits pour ${generationType}`);
    
  } catch (error) {
    console.error('❌ Erreur tracking usage IA:', error);
  }
}

/**
 * Estime le nombre de tokens utilisés
 */
function estimateTokensForRequest(req, responseData) {
  const requestTokens = JSON.stringify(req.body).length / 4; // Estimation grossière
  const responseTokens = responseData ? JSON.stringify(responseData).length / 4 : 0;
  return Math.round(requestTokens + responseTokens);
}


export const checkSubscriptionLimits = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const subscription = await UserSubscription.findOne({
      where: { 
        userId,
        status: 'active'
      },
      include: [{
        model: SubscriptionPlan,
        as: 'plan',
        attributes: ['id', 'name', 'slug', 'maxSites', 'maxThemes', 'aiGenerations']
      }]
    });

    if (!subscription) {
      return res.status(403).json({ 
        message: 'Abonnement non trouvé. Veuillez souscrire à un plan.' 
      });
    }

    req.userSubscription = subscription;
    req.subscriptionPlan = subscription.plan;
    next();
  } catch (error) {
    console.error('❌ Erreur vérification abonnement:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la vérification de votre abonnement' 
    });
  }
};

// NOUVEAU: Middleware pour récupérer le modèle IA selon l'abonnement
export const getAiModelForRequest = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const subscriptionPlan = req.subscriptionPlan;
    
    if (!subscriptionPlan) {
      return next();
    }

    // S'assurer que req.body existe
    req.body = req.body || {};
    
    // Déterminer le type de génération selon la route
    const generationType = determineGenerationType(req);
    
    // Récupérer le modèle IA approprié
    const aiModel = await getAiModelForSubscription(subscriptionPlan.id, generationType);
    
    req.aiModel = aiModel;
    req.generationType = generationType;
    
    console.log(`🎯 Modèle IA sélectionné: ${aiModel.name} (${generationType})`);
    next();
    
  } catch (error) {
    console.warn('⚠️ Erreur récupération modèle IA, utilisation du modèle par défaut:', error.message);
    
    // Fallback sécurisé
    req.body = req.body || {};
    req.aiModel = getDefaultAiModel();
    
    try {
      req.generationType = determineGenerationType(req);
    } catch (fallbackError) {
      console.warn('⚠️ Erreur détermination type génération fallback:', fallbackError.message);
      req.generationType = 'content'; // Valeur par défaut safe
    }
    
    next();
  }
};

// NOUVEAU: Vérification des limites IA améliorée
export const checkAIGenerations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const subscriptionPlan = req.subscriptionPlan;

    if (!subscriptionPlan) {
      return res.status(403).json({ 
        message: '❌ Abonnement non trouvé' 
      });
    }

    // Illimité - pas de vérification nécessaire
    if (subscriptionPlan.aiGenerations === -1) {
      req.aiGenerationsCheck = { allowed: true, remaining: 'unlimited' };
      return next();
    }

    // Compter les générations IA utilisées
    const generationsCount = await countUserAIGenerations(userId);
    
    // Estimer le coût de la requête actuelle
    const estimatedCost = estimateAICost(req);
    
    if ((generationsCount + estimatedCost) > subscriptionPlan.aiGenerations) {
      return res.status(403).json({
        message: `❌ Quota IA insuffisant. Il vous reste ${subscriptionPlan.aiGenerations - generationsCount} générations.`,
        limit: subscriptionPlan.aiGenerations,
        current: generationsCount,
        required: estimatedCost,
        upgradeRequired: true,
        code: 'AI_GENERATIONS_LIMIT_REACHED'
      });
    }

    req.aiGenerationsCheck = {
      allowed: true,
      remaining: subscriptionPlan.aiGenerations - generationsCount,
      limit: subscriptionPlan.aiGenerations,
      used: generationsCount,
      estimatedCost: estimatedCost
    };
    
    next();
  } catch (error) {
    console.error('❌ Erreur vérification générations IA:', error);
    res.status(500).json({ 
      message: '❌ Erreur lors de la vérification du quota IA' 
    });
  }
};

// NOUVEAU: Vérification de l'accès aux modèles premium
export const checkPremiumModelAccess = async (req, res, next) => {
  try {
    const subscriptionPlan = req.subscriptionPlan;
    const aiModel = req.aiModel;

    if (!subscriptionPlan || !aiModel) {
      return next();
    }

    // Définir quels modèles sont considérés comme premium
    const premiumModels = ['gpt-4', 'gpt-4-turbo', 'claude-3-opus', 'claude-3-sonnet'];
    const isPremiumModel = premiumModels.some(premiumModel => 
      aiModel.modelId.includes(premiumModel)
    );

    // Si l'utilisateur a le plan freemium et tente d'utiliser un modèle premium
    if (subscriptionPlan.slug === 'freemium' && isPremiumModel) {
      console.warn(`⚠️ Utilisateur freemium tente d'utiliser un modèle premium: ${aiModel.modelId}`);
      
      // Remplacer par un modèle freemium
      req.aiModel = getDefaultAiModel('freemium', req.generationType);
      
      console.log(`🔄 Remplacement par modèle freemium: ${req.aiModel.name}`);
    }

    next();
  } catch (error) {
    console.error('❌ Erreur vérification accès modèle premium:', error);
    next(); // Continuer même en cas d'erreur
  }
};

// 🔥 FONCTIONS HELPERS POUR LA GESTION IA

/**
 * Récupère le modèle IA selon l'abonnement et le type de génération
 */
async function getAiModelForSubscription(planId, generationType) {
  try {
    // Chercher une règle spécifique pour ce plan et type de génération
    const planAiRule = await PlanAiModel.findOne({
      where: {
        planId,
        generationType
      },
      include: [{
        model: AiModel,
        as: 'AiModel',
        where: { isActive: true }
      }]
    });

    if (planAiRule && planAiRule.AiModel) {
      return planAiRule.AiModel;
    }

    // Fallback: modèle par défaut selon le plan
    return getDefaultAiModelByPlan(planId, generationType);
    
  } catch (error) {
    console.error('❌ Erreur récupération modèle IA:', error);
    return getDefaultAiModel();
  }
}

/**
 * Retourne le modèle par défaut selon le plan
 */
async function getDefaultAiModelByPlan(planId, generationType) {
  try {
    // Récupérer le plan pour connaître son slug
    const plan = await SubscriptionPlan.findByPk(planId);
    if (!plan) {
      return getDefaultAiModel();
    }

    return getDefaultAiModel(plan.slug, generationType);
  } catch (error) {
    return getDefaultAiModel();
  }
}

/**
 * Modèles par défaut selon le plan
 */
function getDefaultAiModel(planSlug = 'freemium', generationType = 'site-structure') {
  const defaultModels = {
    freemium: {
      'article': { 
        name: 'OpenAI GPT-3.5 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-3.5-turbo',
        isDefault: true 
      },
      'site-structure': { 
        name: 'OpenAI GPT-3.5 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-3.5-turbo',
        isDefault: true 
      },
      'seo': { 
        name: 'OpenAI GPT-3.5 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-3.5-turbo',
        isDefault: true 
      },
      'content': { 
        name: 'OpenAI GPT-3.5 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-3.5-turbo',
        isDefault: true 
      },
      'full-site': { 
        name: 'OpenAI GPT-3.5 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-3.5-turbo',
        isDefault: true 
      }
    },
    premium: {
      'article': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true 
      },
      'site-structure': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true 
      },
      'seo': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true 
      },
      'content': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true 
      },
      'full-site': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true 
      }
    },
    'premium-yearly': {
      'article': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true 
      },
      'site-structure': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true 
      },
      'seo': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true 
      },
      'content': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true 
      },
      'full-site': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true 
      }
    }
  };

  const modelConfig = defaultModels[planSlug]?.[generationType] || defaultModels.freemium[generationType];
  
  return {
    id: 0, // ID fictif pour les modèles par défaut
    ...modelConfig
  };
}

/**
 * Détermine le type de génération selon la requête
 */

function determineGenerationType(req) {
  const { method, route, body, originalUrl, path } = req;
  
  // Utiliser originalUrl ou path pour les routes sans body
  const requestPath = path || originalUrl || '';
  const safeBody = body || {};
  const safeRoute = route || {};
  
  console.log('🔍 Détermination type génération:', {
    path: requestPath,
    method,
    hasBody: !!body,
    bodyKeys: body ? Object.keys(body) : 'no body'
  });

  // Génération de structure de site - Vérifier le chemin ET le body
  if (requestPath.includes('/generate-structure') || safeBody.businessType) {
    return 'site-structure';
  }
  
  // Génération d'articles
  if (safeBody.numArticles && safeBody.articleTopic) {
    return 'article';
  }
  
  // Optimisation SEO
  if (requestPath.includes('seo') || safeBody.seoKeywords) {
    return 'seo';
  }
  
  // Génération de contenu général
  if (safeBody.contentType || safeBody.prompt) {
    return 'content';
  }
  
  // Génération de site complet
  if (safeBody.structure && safeBody.structure.pages && safeBody.structure.pages.length > 0) {
    return 'full-site';
  }
  
  // Déduction basée sur la route pour les requêtes sans body
  if (requestPath.includes('/generate-structure')) {
    return 'site-structure';
  }
  
  if (requestPath.includes('/preview')) {
    return 'content'; // ou 'site-structure' selon votre logique
  }
  
  if (requestPath.includes('/generate-site')) {
    return 'full-site';
  }
  
  // Par défaut pour les routes d'info (comme /ai-models/available)
  return 'content';
}
// FONCTIONS EXISTANTES (conservées)

export const checkSiteLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const userSitesCount = await countUserSites(userId);
    const subscriptionPlan = req.subscriptionPlan;

    if (!subscriptionPlan) {
      return res.status(403).json({ 
        message: 'Abonnement non trouvé' 
      });
    }

    if (userSitesCount >= subscriptionPlan.maxSites) {
      return res.status(403).json({
        message: `Limite de sites atteinte. Maximum: ${subscriptionPlan.maxSites}`,
        limit: subscriptionPlan.maxSites,
        current: userSitesCount,
        upgradeRequired: true
      });
    }

    req.remainingSites = subscriptionPlan.maxSites - userSitesCount;
    next();
  } catch (error) {
    console.error('❌ Erreur vérification limite sites:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la vérification des limites' 
    });
  }
};

export const checkThemeAccess = async (req, res, next) => {
  try {
    const { selectedTheme } = req.body;
    const subscriptionPlan = req.subscriptionPlan;

    if (!subscriptionPlan) {
      return res.status(403).json({ 
        message: 'Abonnement non trouvé' 
      });
    }

    const premiumThemes = ['premium-theme-1', 'premium-theme-2', 'oceanwp-pro', 'astra-pro'];
    const isPremiumTheme = premiumThemes.includes(selectedTheme);

    if (subscriptionPlan.slug === 'freemium' && isPremiumTheme) {
      return res.status(403).json({
        message: 'Thème premium non accessible avec votre abonnement actuel',
        upgradeRequired: true,
        currentPlan: 'freemium',
        requiredPlan: 'premium'
      });
    }

    next();
  } catch (error) {
    console.error('❌ Erreur vérification accès thème:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la vérification des accès' 
    });
  }
};

// FONCTIONS HELPERS EXISTANTES

async function countUserSites(userId) {
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
}

async function countUserAIGenerations(userId) {
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
}

function estimateAICost(req) {
  const { body, route } = req;
  
  // Génération de structure IA
  if (route.path === '/generate-structure' || body.businessType) {
    return 1;
  }
  
  // Génération d'articles
  if (body.numArticles && body.articleTopic) {
    return body.numArticles;
  }
  
  // Application de structure avec pages
  if (body.structure && body.structure.pages) {
    return body.structure.pages.length;
  }
  
  // Génération de site avec structure
  if (body.structure && body.structure.pages && body.structure.pages.length > 0) {
    return body.structure.pages.length;
  }
  
  return 1;
}

export const checkSiteOwnership = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { siteSlug } = req.params;

    const userSite = await UserSite.findOne({
      where: { 
        userId,
        slug: siteSlug,
        status: 'active'
      }
    });

    if (!userSite) {
      return res.status(404).json({ 
        message: 'Site non trouvé ou accès non autorisé' 
      });
    }

    req.userSite = userSite;
    next();
  } catch (error) {
    console.error('❌ Erreur vérification propriété site:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la vérification du site' 
    });
  }
};