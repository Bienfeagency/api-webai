// controllers/admin/userSubscriptionController.js
import { UserSubscription } from '../models/userSubscription.js';
import { SubscriptionPlan } from '../models/subscriptionPlan.js';
import { User } from '../../models/User.js';

export const adminUserSubscriptionController = {
  // Récupérer tous les abonnements utilisateurs
  async getSubscriptions(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status 
      } = req.query;

      const where = {};
      if (status && status !== 'all') {
        where.status = status;
      }

      const offset = (page - 1) * limit;

      const { count, rows: subscriptions } = await UserSubscription.findAndCountAll({
        where,
        include: [
          {
            model: SubscriptionPlan,
            as: 'plan',
            attributes: ['id', 'name', 'slug', 'price', 'billingPeriod']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        subscriptions,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page)
      });
    } catch (error) {
      console.error('❌ Erreur récupération abonnements:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des abonnements',
        error: error.message 
      });
    }
  }
};