// controllers/public/subscriptionPlanController.js
import { SubscriptionPlan } from '../models/subscriptionPlan.js';

export const publicSubscriptionPlanController = {
  // Récupérer les plans publics (actifs seulement)
  async getPlans(req, res) {
    try {
      const plans = await SubscriptionPlan.findAll({
        where: { isActive: true },
        order: [['sortOrder', 'ASC'], ['price', 'ASC']],
        attributes: { 
          exclude: ['createdAt', 'updatedAt'] 
        }
      });
      
      res.json({ plans });
    } catch (error) {
      console.error('❌ Erreur récupération plans publics:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des plans',
        error: error.message 
      });
    }
  }
};