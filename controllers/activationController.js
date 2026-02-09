// controllers/activationController.js
import { ActivationCode, UserSubscription, UpgradeRequest, SubscriptionPlan } from '../models/index.js';
import { Op } from 'sequelize';
import sequelize from "../config/database.js";
import User from '../models/user.js';

export const activationController = {

  // 🔑 Activer un code premium
  async activateCode(req, res) {
    try {
      const userId = req.user.id;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ 
          message: 'Le code d\'activation est requis' 
        });
      }

      // ✅ D'ABORD vérifier le code d'activation
      const activationCode = await ActivationCode.findOne({
        where: { 
          code: code.trim().toUpperCase(),
          isActive: true,
          expiresAt: { [Op.gt]: new Date() },
          usedCount: { [Op.lt]: sequelize.col('maxUses') }
        },
        include: [
          {
            model: UpgradeRequest,
            as: 'upgradeRequest',
            include: [{
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'email']
            }]
          },
          {
            model: SubscriptionPlan,
            as: 'plan',
            attributes: ['id', 'name', 'slug', 'features']
          }
        ]
      });

      if (!activationCode) {
        return res.status(404).json({ 
          message: 'Code invalide, expiré ou déjà utilisé' 
        });
      }

      // ✅ ENSUITE vérifier que l'utilisateur est le destinataire
      if (activationCode.upgradeRequest.userId !== userId) {
        return res.status(403).json({ 
          message: 'Ce code ne vous est pas destiné' 
        });
      }

      // ✅ Vérifier si l'utilisateur a déjà un abonnement actif pour CE PLAN
      const existingSubscription = await UserSubscription.findOne({
        where: { 
          userId,
          planId: activationCode.planId, // Vérifier seulement pour le même plan
          status: 'active'
        }
      });

      if (existingSubscription) {
        return res.status(400).json({ 
          message: `Vous avez déjà un abonnement actif pour le plan ${activationCode.plan.name}` 
        });
      }

      // ✅ Désactiver les anciens abonnements (optionnel - si vous voulez un seul abonnement actif)
      await UserSubscription.update(
        { status: 'canceled' },
        { 
          where: { 
            userId,
            status: 'active'
          } 
        }
      );

      // Calculer les dates
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + activationCode.durationDays);

      // Créer le nouvel abonnement
      const subscription = await UserSubscription.create({
        userId,
        planId: activationCode.planId,
        status: 'active',
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false
      });

      // Mettre à jour le compteur d'utilisation du code
      await activationCode.update({
        usedCount: activationCode.usedCount + 1
      });

      // Marquer la demande comme complétée
      await UpgradeRequest.update(
        { status: 'completed' },
        { where: { id: activationCode.upgradeRequestId } }
      );

      // Charger les données complètes
      await subscription.reload({
        include: [{
          model: SubscriptionPlan,
          as: 'plan',
          attributes: ['id', 'name', 'slug', 'description', 'features', 'maxSites', 'maxThemes', 'aiGenerations']
        }]
      });

      res.json({
        success: true,
        message: 'Abonnement premium activé avec succès!',
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          plan: subscription.plan
        },
        featuresUnlocked: activationCode.plan.features,
        expiresAt: currentPeriodEnd
      });

    } catch (error) {
      console.error('❌ Erreur activation code:', error);
      res.status(500).json({ 
        message: 'Erreur lors de l\'activation du code premium',
        error: error.message 
      });
    }
  },

  // Vérifier l'état d'une demande d'upgrade
  async getActivationStatus(req, res) {
    try {
      const userId = req.user.id;

      const pendingRequest = await UpgradeRequest.findOne({
        where: { 
          userId,
          status: ['pending', 'approved']
        },
        include: [
          {
            model: SubscriptionPlan,
            as: 'requestedPlan',
            attributes: ['id', 'name', 'slug', 'price', 'features']
          },
          {
            model: ActivationCode,
            as: 'activationCode',
            attributes: ['id', 'code', 'usedCount', 'expiresAt', 'isActive']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Vérifier aussi si l'utilisateur a déjà un abonnement actif
      const activeSubscription = await UserSubscription.findOne({
        where: { 
          userId,
          status: 'active'
        },
        include: [{
          model: SubscriptionPlan,
          as: 'plan',
          attributes: ['id', 'name', 'slug', 'features']
        }]
      });

      res.json({
        hasPendingRequest: !!pendingRequest,
        hasActiveSubscription: !!activeSubscription,
        request: pendingRequest ? {
          id: pendingRequest.id,
          status: pendingRequest.status,
          plan: pendingRequest.requestedPlan,
          userMessage: pendingRequest.userMessage,
          adminNotes: pendingRequest.adminNotes,
          createdAt: pendingRequest.createdAt,
          activationCode: pendingRequest.activationCode
        } : null,
        activeSubscription: activeSubscription ? {
          id: activeSubscription.id,
          status: activeSubscription.status,
          plan: activeSubscription.plan,
          currentPeriodEnd: activeSubscription.currentPeriodEnd
        } : null
      });
    } catch (error) {
      console.error('❌ Erreur vérification statut activation:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la vérification du statut',
        error: error.message 
      });
    }
  }
};