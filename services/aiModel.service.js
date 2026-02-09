import { UserSubscription, SubscriptionPlan, PlanAiModel, AiModel, UserUsage } from '../models/index.js';

/**
 * Récupère le modèle IA approprié selon l'abonnement de l'utilisateur
 */
export async function getAiModelForUser(userId, generationType) {
  try {
    console.log(`🔍 Recherche modèle IA pour user:${userId}, type:${generationType}`);

    // Récupérer l'abonnement actif de l'utilisateur
    const userSubscription = await UserSubscription.findOne({
      where: { 
        userId, 
        status: 'active' 
      },
      include: [{
        model: SubscriptionPlan,
        as: 'plan',
        attributes: ['id', 'name', 'slug', 'aiGenerations']
      }]
    });

    if (!userSubscription) {
      console.log('❌ Utilisateur sans abonnement actif - utilisation du modèle par défaut');
      return getDefaultAiModel(generationType);
    }

    const plan = userSubscription.plan;
    console.log(`📋 Plan utilisateur: ${plan.name} (${plan.slug})`);

    // Récupérer la règle IA pour ce plan et ce type de génération
    const planAiRule = await PlanAiModel.findOne({
      where: {
        planId: plan.id,
        generationType
      },
      include: [{
        model: AiModel,
        as: 'AiModel',
        where: { isActive: true }
      }]
    });

    if (planAiRule && planAiRule.AiModel) {
      console.log(`✅ Modèle trouvé: ${planAiRule.AiModel.name} (${planAiRule.AiModel.provider})`);
      return planAiRule.AiModel;
    }

    // Fallback: modèle par défaut pour le plan
    console.log('⚠️ Aucune règle spécifique trouvée - utilisation du modèle par défaut');
    return getDefaultAiModel(generationType, plan.slug);

  } catch (error) {
    console.error('❌ Erreur récupération modèle IA:', error);
    return getDefaultAiModel(generationType);
  }
}

/**
 * Retourne le modèle par défaut selon le type d'abonnement
 */
function getDefaultAiModel(generationType, planSlug = 'freemium') {
  const defaultModels = {
    freemium: {
      'article': { 
        name: 'OpenAI GPT-3.5 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-3.5-turbo',
        isDefault: true,
        costPerGeneration: 1
      },
      'site-structure': { 
        name: 'OpenAI GPT-3.5 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-3.5-turbo',
        isDefault: true,
        costPerGeneration: 1
      },
      'seo': { 
        name: 'OpenAI GPT-3.5 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-3.5-turbo',
        isDefault: true,
        costPerGeneration: 1
      },
      'content': { 
        name: 'OpenAI GPT-3.5 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-3.5-turbo',
        isDefault: true,
        costPerGeneration: 1
      },
      'full-site': { 
        name: 'OpenAI GPT-3.5 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-3.5-turbo',
        isDefault: true,
        costPerGeneration: 1
      }
    },
    premium: {
      'article': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true,
        costPerGeneration: 2
      },
      'site-structure': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true,
        costPerGeneration: 2
      },
      'seo': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true,
        costPerGeneration: 2
      },
      'content': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true,
        costPerGeneration: 2
      },
      'full-site': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true,
        costPerGeneration: 2
      }
    },
    'premium-yearly': {
      'article': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true,
        costPerGeneration: 2
      },
      'site-structure': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true,
        costPerGeneration: 2
      },
      'seo': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true,
        costPerGeneration: 2
      },
      'content': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true,
        costPerGeneration: 2
      },
      'full-site': { 
        name: 'OpenAI GPT-4 Turbo', 
        provider: 'openai', 
        modelId: 'gpt-4-turbo',
        isDefault: true,
        costPerGeneration: 2
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
 * Vérifie si l'utilisateur a encore des générations IA disponibles
 */
export async function checkAiGenerationsLimit(userId) {
  try {
    const userSubscription = await UserSubscription.findOne({
      where: { 
        userId, 
        status: 'active' 
      },
      include: [{
        model: SubscriptionPlan,
        as: 'plan',
        attributes: ['id', 'name', 'slug', 'aiGenerations']
      }]
    });

    if (!userSubscription) {
      return { 
        allowed: false, 
        reason: 'no_subscription',
        message: 'Abonnement actif requis pour les générations IA'
      };
    }

    const plan = userSubscription.plan;
    
    // -1 = illimité
    if (plan.aiGenerations === -1) {
      return { 
        allowed: true, 
        remaining: 'unlimited',
        limit: 'unlimited',
        used: await getUserAiGenerationsCount(userId),
        plan: plan.name
      };
    }

    // Compter les générations IA utilisées
    const usedGenerations = await getUserAiGenerationsCount(userId);
    const remaining = plan.aiGenerations - usedGenerations;

    return {
      allowed: remaining > 0,
      remaining: remaining,
      limit: plan.aiGenerations,
      used: usedGenerations,
      plan: plan.name,
      reason: remaining <= 0 ? 'limit_reached' : 'available'
    };

  } catch (error) {
    console.error('❌ Erreur vérification limite générations:', error);
    return { 
      allowed: false, 
      reason: 'error',
      message: 'Erreur lors de la vérification des limites'
    };
  }
}

/**
 * Compte le nombre de générations IA utilisées par l'utilisateur
 */
export async function getUserAiGenerationsCount(userId) {
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

/**
 * Enregistre une utilisation de génération IA
 */
export async function recordAiGenerationUsage(userId, details = {}) {
  try {
    const usage = await UserUsage.create({
      userId,
      type: 'ai_generation',
      count: details.count || 1,
      details: {
        generationType: details.generationType || 'unknown',
        aiModel: details.aiModel || 'unknown',
        tokensUsed: details.tokensUsed || 0,
        cost: details.cost || 0,
        ...details
      }
    });

    console.log(`📊 Usage IA enregistré: user ${userId}, type: ${details.generationType}`);
    return usage;
  } catch (error) {
    console.error('❌ Erreur enregistrement usage IA:', error);
    throw error;
  }
}

/**
 * Récupère l'historique des utilisations IA d'un utilisateur
 */
export async function getUserAiUsageHistory(userId, limit = 50) {
  try {
    const usageHistory = await UserUsage.findAll({
      where: { 
        userId, 
        type: 'ai_generation' 
      },
      order: [['consumedAt', 'DESC']],
      limit: limit,
      attributes: ['id', 'count', 'details', 'consumedAt']
    });

    return usageHistory;
  } catch (error) {
    console.error('❌ Erreur récupération historique usage:', error);
    return [];
  }
}

