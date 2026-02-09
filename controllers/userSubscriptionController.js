// controllers/admin/userSubscriptionController.js
import { UserSubscription, SubscriptionPlan } from '../models/index.js';
import User from '../models/user.js';
import { Op } from 'sequelize';
import { countUserSites, countUserAIGenerations } from '../utils/usageCounters.js';

export const userSubscriptionController = {

  // Récupérer l'abonnement actuel de l'utilisateur connecté
// 🔥 Version améliorée : getCurrentSubscription
async getCurrentSubscription(req, res) {
  try {
    const userId = req.user.id;

    // Récupérer l'abonnement actif
    const subscription = await UserSubscription.findOne({
      where: { 
        userId,
        status: 'active'
      },
      include: [{
        model: SubscriptionPlan,
        as: 'plan',
        attributes: [
          'id', 'name', 'slug', 'description', 'price',
          'billingPeriod', 'features', 'maxThemes',
          'maxSites', 'aiGenerations', 'supportLevel'
        ]
      }],
      order: [['createdAt', 'DESC']]
    });

    if (!subscription) {
      return res.status(404).json({
        message: 'Aucun abonnement actif trouvé',
        hasActiveSubscription: false
      });
    }

    // 🔥 Calculs d’usage
    const sitesCount = await countUserSites(userId);
    const aiGenerationsCount = await countUserAIGenerations(userId);

    // 🔥 Calcul des remaining
    const remainingSites =
      subscription.plan.maxSites === -1
        ? "illimité"
        : Math.max(0, subscription.plan.maxSites - sitesCount);

    const remainingAIGenerations =
      subscription.plan.aiGenerations === -1
        ? "illimité"
        : Math.max(0, subscription.plan.aiGenerations - aiGenerationsCount);

    // 🔥 Réponse unifiée pour le frontend
    res.json({
      hasActiveSubscription: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
      },
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        slug: subscription.plan.slug,
        description: subscription.plan.description,
        price: subscription.plan.price,
        billingPeriod: subscription.plan.billingPeriod,
        features: subscription.plan.features,
        maxThemes: subscription.plan.maxThemes,
        maxSites: subscription.plan.maxSites,
        aiGenerations: subscription.plan.aiGenerations,
        supportLevel: subscription.plan.supportLevel
      },
      usage: {
        sites: {
          current: sitesCount,
          limit: subscription.plan.maxSites,
          remaining: remainingSites
        },
        themes: {
          limit: subscription.plan.maxThemes // Tu pourras compter les thèmes actifs si besoin
        },
        aiGenerations: {
          current: aiGenerationsCount,
          limit: subscription.plan.aiGenerations,
          remaining: remainingAIGenerations
        }
      },
      canUpgrade: subscription.plan.slug === 'freemium'
    });

  } catch (error) {
    console.error('❌ Erreur récupération abonnement actuel:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération de votre abonnement',
      error: error.message
    });
  }
},


  // Récupérer tous les abonnements utilisateurs
  async getSubscriptions(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status,
        search 
      } = req.query;

      const where = {};
      if (status && status !== 'all') {
        where.status = status;
      }

      const userWhere = {};
      if (search) {
        userWhere[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } }
        ];
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
            attributes: ['id', 'name', 'email'],
            where: userWhere
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
  },

  async subscribe(req, res) {
    try {
      const userId = req.user.id;
      const { planId } = req.body;

      // Vérifier si le plan existe
      const plan = await SubscriptionPlan.findByPk(planId);
      if (!plan) {
        return res.status(404).json({ message: 'Plan non trouvé' });
      }

      // Vérifier si l'utilisateur a déjà un abonnement actif
      const existingSubscription = await UserSubscription.findOne({
        where: { 
          userId,
          status: 'active'
        }
      });

      if (existingSubscription) {
        return res.status(400).json({ 
          message: 'Vous avez déjà un abonnement actif' 
        });
      }

      // Créer l'abonnement
      const subscription = await UserSubscription.create({
        userId,
        planId,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 jours
      });

      // Charger les données du plan
      await subscription.reload({
        include: [{
          model: SubscriptionPlan,
          as: 'plan'
        }]
      });

      res.status(201).json({
        subscription,
        message: 'Abonnement créé avec succès'
      });
    } catch (error) {
      console.error('❌ Erreur souscription:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la souscription',
        error: error.message 
      });
    }
  },

  async checkPremiumAccess(req, res) {
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
          attributes: ['id', 'name', 'maxThemes', 'maxSites']
        }]
      });

      const canAccessPremium = !!subscription;

      res.json({ 
        canAccessPremium,
        subscription: canAccessPremium ? subscription : null
      });
    } catch (error) {
      console.error('❌ Erreur vérification accès premium:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la vérification de l\'accès premium',
        error: error.message 
      });
    }
  },

  // Récupérer un abonnement spécifique
  async getSubscription(req, res) {
    try {
      const { id } = req.params;

      const subscription = await UserSubscription.findByPk(id, {
        include: [
          {
            model: SubscriptionPlan,
            as: 'plan',
            attributes: { exclude: ['createdAt', 'updatedAt'] }
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'createdAt']
          }
        ]
      });

      if (!subscription) {
        return res.status(404).json({ message: 'Abonnement non trouvé' });
      }

      res.json({ subscription });
    } catch (error) {
      console.error('❌ Erreur récupération abonnement:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération de l\'abonnement',
        error: error.message 
      });
    }
  },

  // Mettre à jour un abonnement
  async updateSubscription(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const subscription = await UserSubscription.findByPk(id);
      if (!subscription) {
        return res.status(404).json({ message: 'Abonnement non trouvé' });
      }

      // Champs autorisés pour la mise à jour
      const allowedFields = ['status', 'currentPeriodStart', 'currentPeriodEnd', 'cancelAtPeriodEnd'];
      const filteredData = {};
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      await subscription.update(filteredData);

      // Recharger avec les relations
      await subscription.reload({
        include: [
          {
            model: SubscriptionPlan,
            as: 'plan'
          },
          {
            model: User,
            as: 'user'
          }
        ]
      });

      res.json({
        subscription,
        message: 'Abonnement mis à jour avec succès'
      });
    } catch (error) {
      console.error('❌ Erreur mise à jour abonnement:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la mise à jour de l\'abonnement',
        error: error.message 
      });
    }
  },

  // Supprimer un abonnement
  async deleteSubscription(req, res) {
    try {
      const { id } = req.params;

      const subscription = await UserSubscription.findByPk(id);
      if (!subscription) {
        return res.status(404).json({ message: 'Abonnement non trouvé' });
      }

      await subscription.destroy();

      res.json({ 
        message: 'Abonnement supprimé avec succès'
      });
    } catch (error) {
      console.error('❌ Erreur suppression abonnement:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la suppression de l\'abonnement',
        error: error.message 
      });
    }
  },

  // Créer un abonnement manuellement (pour les tests/admin)
  async createSubscription(req, res) {
    try {
      const { userId, planId, status = 'active' } = req.body;

      // Vérifier si l'utilisateur existe
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      // Vérifier si le plan existe
      const plan = await SubscriptionPlan.findByPk(planId);
      if (!plan) {
        return res.status(404).json({ message: 'Plan non trouvé' });
      }

      // Vérifier si l'utilisateur a déjà un abonnement actif
      const existingSubscription = await UserSubscription.findOne({
        where: { 
          userId,
          status: 'active'
        }
      });

      if (existingSubscription) {
        return res.status(400).json({ 
          message: 'L\'utilisateur a déjà un abonnement actif' 
        });
      }

      // Calculer les dates de période
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date();
      if (plan.billingPeriod === 'monthly') {
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      } else {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      }

      const subscription = await UserSubscription.create({
        userId,
        planId,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false
      });

      // Charger les données associées
      await subscription.reload({
        include: [
          {
            model: SubscriptionPlan,
            as: 'plan'
          },
          {
            model: User,
            as: 'user'
          }
        ]
      });

      res.status(201).json({
        subscription,
        message: 'Abonnement créé avec succès'
      });
    } catch (error) {
      console.error('❌ Erreur création abonnement:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la création de l\'abonnement',
        error: error.message 
      });
    }
  },

  // Récupérer les statistiques des abonnements
  async getSubscriptionStats(req, res) {
    try {
      // Nombre total d'abonnements
      const totalSubscriptions = await UserSubscription.count();

      // Abonnements par statut
      const statusCounts = await UserSubscription.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      // Abonnements par plan
      const planCounts = await UserSubscription.findAll({
        include: [{
          model: SubscriptionPlan,
          as: 'plan',
          attributes: ['name']
        }],
        attributes: [
          'planId',
          [sequelize.fn('COUNT', sequelize.col('UserSubscription.id')), 'count']
        ],
        group: ['planId', 'plan.name'],
        raw: true
      });

      // Revenu mensuel estimé
      const monthlyRevenue = await UserSubscription.findAll({
        where: { status: 'active' },
        include: [{
          model: SubscriptionPlan,
          as: 'plan',
          attributes: ['price', 'billingPeriod']
        }],
        attributes: [
          [sequelize.fn('SUM', 
            sequelize.literal(`CASE 
              WHEN "plan"."billingPeriod" = 'monthly' THEN "plan"."price"
              ELSE "plan"."price" / 12
            END`)
          ), 'revenue']
        ],
        raw: true
      });

      res.json({
        totalSubscriptions,
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = parseInt(item.count);
          return acc;
        }, {}),
        byPlan: planCounts.map(item => ({
          planName: item['plan.name'],
          count: parseInt(item.count)
        })),
        estimatedMonthlyRevenue: parseFloat(monthlyRevenue[0]?.revenue || 0)
      });
    } catch (error) {
      console.error('❌ Erreur récupération statistiques abonnements:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message 
      });
    }
  },

  async cancelSubscription(req, res) {
    try {
      const userId = req.user.id;

      const subscription = await UserSubscription.findOne({
        where: { 
          userId,
          status: 'active'
        }
      });

      if (!subscription) {
        return res.status(404).json({ 
          message: 'Aucun abonnement actif trouvé' 
        });
      }

      await subscription.update({
        status: 'canceled',
        cancelAtPeriodEnd: true
      });

      res.json({ 
        message: 'Abonnement annulé avec succès' 
      });
    } catch (error) {
      console.error('❌ Erreur annulation abonnement:', error);
      res.status(500).json({ 
        message: 'Erreur lors de l\'annulation de l\'abonnement',
        error: error.message 
      });
    }
  }
};