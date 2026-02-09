// controllers/admin/subscriptionPlanController.js
import { SubscriptionPlan } from '../models/subscriptionPlan.js';
import { UserSubscription } from '../models/userSubscription.js';
import { Op } from 'sequelize';

export const subscriptionPlanController = {
  // Récupérer tous les plans
  async getPlans(req, res) {
    try {
      const plans = await SubscriptionPlan.findAll({
        order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']]
      });
      
      res.json({ plans });
    } catch (error) {
      console.error('❌ Erreur récupération plans:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des plans',
        error: error.message 
      });
    }
  },

  // Récupérer un plan spécifique
  async getPlan(req, res) {
    try {
      const { id } = req.params;
      const plan = await SubscriptionPlan.findByPk(id);
      
      if (!plan) {
        return res.status(404).json({ message: 'Plan non trouvé' });
      }
      
      res.json({ plan });
    } catch (error) {
      console.error('❌ Erreur récupération plan:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération du plan',
        error: error.message 
      });
    }
  },

  // Créer un nouveau plan
  async createPlan(req, res) {
    try {
      const planData = req.body;
      
      // Validation des données
      if (!planData.name || !planData.slug || !planData.price) {
        return res.status(400).json({ 
          message: 'Le nom, le slug et le prix sont obligatoires' 
        });
      }

      // Vérifier si le slug existe déjà
      const existingPlan = await SubscriptionPlan.findOne({ 
        where: { slug: planData.slug } 
      });
      
      if (existingPlan) {
        return res.status(400).json({ 
          message: 'Un plan avec ce slug existe déjà' 
        });
      }

      const plan = await SubscriptionPlan.create(planData);
      
      res.status(201).json({ 
        plan,
        message: 'Plan créé avec succès'
      });
    } catch (error) {
      console.error('❌ Erreur création plan:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la création du plan',
        error: error.message 
      });
    }
  },

  // Mettre à jour un plan
  async updatePlan(req, res) {
    try {
      const { id } = req.params;
      const planData = req.body;
      
      const plan = await SubscriptionPlan.findByPk(id);
      if (!plan) {
        return res.status(404).json({ message: 'Plan non trouvé' });
      }

      // Vérifier si le slug existe déjà (pour un autre plan)
      if (planData.slug && planData.slug !== plan.slug) {
        const existingPlan = await SubscriptionPlan.findOne({ 
          where: { 
            slug: planData.slug,
            id: { [Op.ne]: id }
          } 
        });
        
        if (existingPlan) {
          return res.status(400).json({ 
            message: 'Un autre plan avec ce slug existe déjà' 
          });
        }
      }

      await plan.update(planData);
      
      res.json({ 
        plan,
        message: 'Plan modifié avec succès'
      });
    } catch (error) {
      console.error('❌ Erreur modification plan:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la modification du plan',
        error: error.message 
      });
    }
  },

  // Supprimer un plan
  async deletePlan(req, res) {
    try {
      const { id } = req.params;
      
      const plan = await SubscriptionPlan.findByPk(id);
      if (!plan) {
        return res.status(404).json({ message: 'Plan non trouvé' });
      }

      // Vérifier s'il y a des abonnements actifs
      const activeSubscriptions = await UserSubscription.count({
        where: { 
          planId: id,
          status: 'active'
        }
      });

      if (activeSubscriptions > 0) {
        return res.status(400).json({ 
          message: 'Impossible de supprimer un plan avec des abonnements actifs' 
        });
      }

      await plan.destroy();
      
      res.json({ 
        message: 'Plan supprimé avec succès'
      });
    } catch (error) {
      console.error('❌ Erreur suppression plan:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la suppression du plan',
        error: error.message 
      });
    }
  },

async getStats(req, res) {
  try {
    const totalPlans = await SubscriptionPlan.count();
    const activePlans = await SubscriptionPlan.count({ 
      where: { isActive: true } 
    });

    // Récupérer d'abord les IDs des plans Premium (mensuel et annuel)
    const premiumPlans = await SubscriptionPlan.findAll({
      where: { 
        slug: ['premium', 'premium-yearly'] // Filtrer par les slugs Premium
      },
      attributes: ['id', 'slug', 'name']
    });

    const premiumPlanIds = premiumPlans.map(plan => plan.id);

    // Récupérer seulement les souscriptions actives avec plan Premium
    const activeSubscriptions = await UserSubscription.findAll({
      where: { 
        status: 'active',
        planId: premiumPlanIds // Filtrer par plans Premium seulement
      },
      attributes: ['id', 'planId']
    });

    // Récupérer les plans correspondants (devraient tous être Premium)
    const planIds = [...new Set(activeSubscriptions.map(sub => sub.planId).filter(Boolean))];
    
    const plans = await SubscriptionPlan.findAll({
      where: { id: planIds },
      attributes: ['id', 'name', 'slug', 'price', 'billingPeriod']
    });

    // Créer un map pour un accès rapide aux plans
    const plansMap = new Map();
    plans.forEach(plan => {
      plansMap.set(plan.id, plan);
    });

    let monthlyRevenue = 0;
    let yearlyRevenue = 0;
    const planStats = {};
    let validSubscriptions = 0;
    let subscriptionsWithoutPlan = 0;

    // Séparer les stats par type de plan Premium
    const premiumMonthlySubscriptions = [];
    const premiumYearlySubscriptions = [];

    activeSubscriptions.forEach(sub => {
      const plan = plansMap.get(sub.planId);
      
      if (!plan) {
        subscriptionsWithoutPlan++;
        return;
      }

      validSubscriptions++;
      const revenue = parseFloat(plan.price) || 0;
      
      if (plan.billingPeriod === 'monthly') {
        monthlyRevenue += revenue;
        premiumMonthlySubscriptions.push(sub.id);
      } else {
        yearlyRevenue += revenue;
        premiumYearlySubscriptions.push(sub.id);
      }

      // Utiliser le slug comme clé pour mieux différencier les plans
      const planKey = plan.slug || plan.name;
      if (!planStats[planKey]) {
        planStats[planKey] = { 
          count: 0, 
          revenue: 0,
          name: plan.name,
          slug: plan.slug
        };
      }
      planStats[planKey].count += 1;
      planStats[planKey].revenue += revenue;
    });

    const byPlan = Object.entries(planStats).map(([planKey, stats]) => ({
      planKey,
      planName: stats.name,
      slug: stats.slug,
      count: stats.count,
      revenue: parseFloat(stats.revenue.toFixed(2))
    }));

    res.json({
      totalSubscriptions: activeSubscriptions.length,
      activeSubscriptions: validSubscriptions,
      subscriptionsWithoutPlan,
      premiumStats: {
        monthly: {
          count: premiumMonthlySubscriptions.length,
          revenue: parseFloat(monthlyRevenue.toFixed(2)),
          subscriptions: premiumMonthlySubscriptions
        },
        yearly: {
          count: premiumYearlySubscriptions.length,
          revenue: parseFloat(yearlyRevenue.toFixed(2)),
          subscriptions: premiumYearlySubscriptions
        },
        total: {
          count: validSubscriptions,
          revenue: parseFloat((monthlyRevenue + yearlyRevenue).toFixed(2))
        }
      },
      revenue: {
        monthly: parseFloat(monthlyRevenue.toFixed(2)),
        yearly: parseFloat(yearlyRevenue.toFixed(2)),
        total: parseFloat((monthlyRevenue + yearlyRevenue).toFixed(2))
      },
      byPlan,
      totalPlans,
      activePlans,
      // Informations sur les plans Premium identifiés
      premiumPlansIdentified: premiumPlans.map(plan => ({
        id: plan.id,
        name: plan.name,
        slug: plan.slug
      }))
    });
  } catch (error) {
    console.error('❌ Erreur récupération statistiques:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message 
    });
  }
}
};