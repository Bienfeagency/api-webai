// services/subscriptionService.js
import { UserSubscription } from '../models/userSubscription.js';
import { SubscriptionPlan } from '../models/subscriptionPlan.js';

export class SubscriptionService {
  // Vérifier si l'utilisateur peut accéder aux thèmes premium
  static async canAccessPremium(userId) {
    try {
      const subscription = await UserSubscription.findOne({
        where: { 
          userId,
          status: 'active'
        },
        include: [{
          model: SubscriptionPlan,
          as: 'plan',
          where: { isActive: true }
        }]
      });

      return !!subscription;
    } catch (error) {
      console.error('❌ Erreur vérification accès premium:', error);
      return false;
    }
  }

  // Vérifier les limites d'utilisation
  static async checkUsageLimits(userId, resourceType) {
    const subscription = await UserSubscription.findOne({
      where: { 
        userId,
        status: 'active'
      },
      include: [{
        model: SubscriptionPlan,
        as: 'plan'
      }]
    });

    if (!subscription) {
      return { allowed: false, reason: 'No active subscription' };
    }

    const plan = subscription.plan;
    
    switch (resourceType) {
      case 'themes':
        // Implémenter la logique de comptage des thèmes utilisés
        const usedThemes = 0; // À implémenter
        return { 
          allowed: usedThemes < plan.maxThemes,
          remaining: plan.maxThemes - usedThemes
        };
      
      case 'sites':
        // Implémenter la logique de comptage des sites créés
        const usedSites = 0; // À implémenter
        return { 
          allowed: usedSites < plan.maxSites,
          remaining: plan.maxSites - usedSites
        };
      
      case 'aiGenerations':
        // Implémenter la logique de comptage des générations IA
        const usedGenerations = 0; // À implémenter
        return { 
          allowed: usedGenerations < plan.aiGenerations,
          remaining: plan.aiGenerations - usedGenerations
        };
      
      default:
        return { allowed: false, reason: 'Unknown resource type' };
    }
  }
}