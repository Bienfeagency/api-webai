// controllers/upgradeRequestController.js (version avec notifications)
import { UpgradeRequest, ActivationCode, SubscriptionPlan, User } from '../models/index.js';
import emailService from '../services/email.service.js';
import notificationService from '../services/notification.service.js'; // NOUVEAU
import { Op } from 'sequelize';
import sequelize from "../config/database.js";

export const upgradeRequestController = {

  // 📥 Utilisateur: Faire une demande
  async createRequest(req, res) {
    try {
      const userId = req.user.id;
      const { requestedPlanId, message } = req.body;

      const plan = await SubscriptionPlan.findByPk(requestedPlanId);
      if (!plan) {
        return res.status(404).json({ message: 'Plan non trouvé' });
      }

      // Vérifier si une demande est déjà en attente
      const existingRequest = await UpgradeRequest.findOne({
        where: { 
          userId, 
          status: 'pending' 
        }
      });

      if (existingRequest) {
        return res.status(400).json({ 
          message: 'Vous avez déjà une demande en attente' 
        });
      }

      // Créer la demande
      const upgradeRequest = await UpgradeRequest.create({
        userId,
        requestedPlanId,
        userMessage: message,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      // Charger les données pour la réponse
      await upgradeRequest.reload({
        include: [
          {
            model: SubscriptionPlan,
            as: 'requestedPlan',
            attributes: ['id', 'name', 'slug', 'price', 'features']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email']
          }
        ]
      });

      // 🔔 NOUVEAU: Notification pour les admins
      await notificationService.notifyUpgradeRequest({
        requestId: upgradeRequest.id,
        userId: upgradeRequest.user.id,
        userName: upgradeRequest.user.name,
        userEmail: upgradeRequest.user.email,
        planName: upgradeRequest.requestedPlan.name,
        planPrice: upgradeRequest.requestedPlan.price,
        userMessage: upgradeRequest.userMessage
      });

      // 🔔 NOUVEAU: Notification pour l'utilisateur
      await notificationService.createNotification({
        userId: upgradeRequest.user.id,
        type: 'upgrade_request',
        title: 'Demande d\'upgrade envoyée',
        message: `Votre demande d'upgrade vers ${upgradeRequest.requestedPlan.name} a été envoyée avec succès. Notre équipe va la traiter sous 24h.`,
        data: {
          requestId: upgradeRequest.id,
          planName: upgradeRequest.requestedPlan.name,
          status: 'pending'
        },
        priority: 'medium'
      });

      console.log(`📋 Nouvelle demande ${plan.name} de ${upgradeRequest.user.email}`);

      res.status(201).json({
        message: 'Demande envoyée avec succès! Notre équipe va la traiter sous 24h.',
        request: {
          id: upgradeRequest.id,
          status: upgradeRequest.status,
          plan: upgradeRequest.requestedPlan.name,
          createdAt: upgradeRequest.createdAt
        }
      });

    } catch (error) {
      console.error('❌ Erreur création demande:', error);
      
      // 🔔 NOUVEAU: Notification d'erreur
      try {
        await notificationService.createNotification({
          userId: req.user.id,
          type: 'system_alert',
          title: 'Erreur demande d\'upgrade',
          message: `Votre demande d'upgrade a échoué: ${error.message}`,
          data: {
            error: error.message,
            timestamp: new Date().toISOString()
          },
          priority: 'high'
        });
      } catch (notificationError) {
        console.warn('⚠️ Erreur notification échec:', notificationError.message);
      }
      
      res.status(500).json({ 
        message: 'Erreur lors de la création de la demande',
        error: error.message 
      });
    }
  },

  // 👑 Admin: Approuver une demande (AVEC EMAILJS ET NOTIFICATIONS)
  async approveRequest(req, res) {
    try {
      const { requestId } = req.params;
      const adminId = req.user.id;
      const { durationDays = 30, adminNotes } = req.body;

      // Récupérer la demande avec toutes les infos
      const upgradeRequest = await UpgradeRequest.findByPk(requestId, {
        include: [
          {
            model: SubscriptionPlan,
            as: 'requestedPlan'
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email']
          }
        ]
      });

      if (!upgradeRequest) {
        return res.status(404).json({ message: 'Demande non trouvée' });
      }

      if (upgradeRequest.status !== 'pending') {
        return res.status(400).json({ message: 'Cette demande a déjà été traitée' });
      }

      // Générer un code d'activation unique
      const activationCode = `PREMIUM-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

      // Créer le code d'activation
      const codeRecord = await ActivationCode.create({
        code: activationCode,
        planId: upgradeRequest.requestedPlanId,
        upgradeRequestId: upgradeRequest.id,
        durationDays,
        maxUses: 1,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: adminId
      });

      // Mettre à jour la demande
      await upgradeRequest.update({
        status: 'approved',
        adminNotes,
        approvedBy: adminId,
        activationCodeId: codeRecord.id
      });

      // 🔄 Recharger l'upgradeRequest avec TOUTES les associations
      await upgradeRequest.reload({
        include: [
          {
            model: SubscriptionPlan,
            as: 'requestedPlan'
          },
          {
            model: User,
            as: 'user'
          },
          {
            model: ActivationCode,
            as: 'activationCode'
          }
        ]
      });

      // 📧 ENVOI AVEC EMAILJS
      const emailSent = await emailService.sendActivationCode(
        upgradeRequest.user.email,
        upgradeRequest.user.name,
        activationCode,
        upgradeRequest.requestedPlan.name,
        durationDays
      );

      // 🔔 NOUVEAU: Notification pour l'utilisateur
      await notificationService.createNotification({
        userId: upgradeRequest.user.id,
        type: 'subscription_activated',
        title: 'Demande d\'upgrade approuvée !',
        message: `Votre demande d'upgrade vers ${upgradeRequest.requestedPlan.name} a été approuvée. ${emailSent ? 'Un email avec votre code d\'activation vous a été envoyé.' : 'Contactez le support pour obtenir votre code d\'activation.'}`,
        data: {
          requestId: upgradeRequest.id,
          planName: upgradeRequest.requestedPlan.name,
          activationCode: emailSent ? null : activationCode, // Ne pas exposer le code si email envoyé
          emailSent: emailSent,
          adminNotes: adminNotes
        },
        priority: 'high'
      });

      // 🔔 NOUVEAU: Notification pour les autres admins
      await notificationService.createNotification({
        userId: null, // Notification globale admin
        type: 'upgrade_request',
        title: 'Demande d\'upgrade approuvée',
        message: `L'admin ${req.user.name} a approuvé la demande d'upgrade de ${upgradeRequest.user.name} vers ${upgradeRequest.requestedPlan.name}`,
        data: {
          requestId: upgradeRequest.id,
          userId: upgradeRequest.user.id,
          userName: upgradeRequest.user.name,
          adminName: req.user.name,
          planName: upgradeRequest.requestedPlan.name,
          emailSent: emailSent
        },
        priority: 'medium'
      });

      // Préparer la réponse
      const response = {
        message: 'Demande approuvée avec succès',
        request: {
          id: upgradeRequest.id,
          status: upgradeRequest.status,
          user: upgradeRequest.user.name,
          plan: upgradeRequest.requestedPlan.name,
          emailSent: emailSent
        }
      };

      // Si l'email a échoué, inclure le code dans la réponse
      if (!emailSent) {
        response.activationCode = activationCode;
        response.warning = 'L\'email n\'a pas pu être envoyé. Veuillez communiquer ce code manuellement.';
        
        // 🔔 NOUVEAU: Notification d'erreur email pour les admins
        await notificationService.createNotification({
          userId: null, // Notification globale admin
          type: 'system_alert',
          title: 'Échec envoi email d\'activation',
          message: `L'email d'activation n'a pas pu être envoyé à ${upgradeRequest.user.email} pour la demande ${upgradeRequest.id}. Code à communiquer manuellement: ${activationCode}`,
          data: {
            requestId: upgradeRequest.id,
            userEmail: upgradeRequest.user.email,
            activationCode: activationCode,
            error: 'Email service unavailable'
          },
          priority: 'high'
        });
      }

      res.json(response);

    } catch (error) {
      const { requestId } = req.params;
      console.error('❌ Erreur approbation demande:', error);
      
      // 🔔 NOUVEAU: Notification d'erreur pour les admins
      try {
        await notificationService.createNotification({
          userId: null,
          type: 'system_alert',
          title: 'Erreur approbation demande d\'upgrade',
          message: `L'approbation de la demande ${requestId} a échoué: ${error.message}`,
          data: {
            requestId: requestId,
            adminId: req.user.id,
            error: error.message,
            timestamp: new Date().toISOString()
          },
          priority: 'urgent'
        });
      } catch (notificationError) {
        console.warn('⚠️ Erreur notification échec approbation:', notificationError.message);
      }
      
      res.status(500).json({ 
        message: 'Erreur lors de l\'approbation de la demande',
        error: error.message 
      });
    }
  },

  // 👤 Utilisateur: Voir ses demandes
  async getUserRequests(req, res) {
    try {
      const userId = req.user.id;

      const requests = await UpgradeRequest.findAll({
        where: { userId },
        include: [{
          model: SubscriptionPlan,
          as: 'requestedPlan',
          attributes: ['id', 'name', 'slug', 'price', 'features']
        }],
        order: [['createdAt', 'DESC']]
      });

      res.json({ 
        requests: requests.map(req => ({
          id: req.id,
          status: req.status,
          plan: req.requestedPlan,
          userMessage: req.userMessage,
          adminNotes: req.adminNotes,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt
        }))
      });
    } catch (error) {
      console.error('❌ Erreur récupération demandes:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des demandes',
        error: error.message 
      });
    }
  },

  // 👑 Admin: Lister toutes les demandes
  async getAllRequests(req, res) {
    try {
      const { page = 1, limit = 20, status = 'pending' } = req.query;

      const where = {};
      if (status !== 'all') {
        where.status = status;
      }

      const offset = (page - 1) * limit;

      const { count, rows: requests } = await UpgradeRequest.findAndCountAll({
        where,
        include: [
          {
            model: SubscriptionPlan,
            as: 'requestedPlan',
            attributes: ['id', 'name', 'slug', 'price']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'createdAt']
          },
          {
            model: ActivationCode,
            as: 'activationCode',
            attributes: ['id', 'code', 'usedCount', 'expiresAt']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Statistiques pour le dashboard admin
      const stats = await UpgradeRequest.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      res.json({
        requests,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        stats: stats.reduce((acc, stat) => {
          acc[stat.status] = parseInt(stat.count);
          return acc;
        }, {})
      });
    } catch (error) {
      console.error('❌ Erreur récupération demandes admin:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des demandes',
        error: error.message 
      });
    }
  },

  // 👑 Admin: Rejeter une demande
  async rejectRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { adminNotes } = req.body;

      const upgradeRequest = await UpgradeRequest.findByPk(requestId, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }]
      });

      if (!upgradeRequest) {
        return res.status(404).json({ message: 'Demande non trouvée' });
      }

      await upgradeRequest.update({
        status: 'rejected',
        adminNotes,
        approvedBy: req.user.id
      });

      // 🔔 NOUVEAU: Notification pour l'utilisateur
      await notificationService.createNotification({
        userId: upgradeRequest.user.id,
        type: 'subscription_canceled',
        title: 'Demande d\'upgrade rejetée',
        message: `Votre demande d'upgrade a été rejetée. ${adminNotes ? `Raison: ${adminNotes}` : 'Contactez le support pour plus d\'informations.'}`,
        data: {
          requestId: upgradeRequest.id,
          adminNotes: adminNotes,
          rejectedBy: req.user.name
        },
        priority: 'high'
      });

      // 🔔 NOUVEAU: Notification pour les autres admins
      await notificationService.createNotification({
        userId: null, // Notification globale admin
        type: 'upgrade_request',
        title: 'Demande d\'upgrade rejetée',
        message: `L'admin ${req.user.name} a rejeté la demande d'upgrade de ${upgradeRequest.user.name}`,
        data: {
          requestId: upgradeRequest.id,
          userId: upgradeRequest.user.id,
          userName: upgradeRequest.user.name,
          adminName: req.user.name,
          adminNotes: adminNotes
        },
        priority: 'medium'
      });

      console.log(`❌ Demande ${requestId} rejetée pour ${upgradeRequest.user.email}`);

      res.json({
        message: 'Demande rejetée avec succès',
        request: upgradeRequest
      });

    } catch (error) {
      console.error('❌ Erreur rejet demande:', error);
      
      // 🔔 NOUVEAU: Notification d'erreur
      try {
        await notificationService.createNotification({
          userId: null,
          type: 'system_alert',
          title: 'Erreur rejet demande d\'upgrade',
          message: `Le rejet de la demande ${requestId} a échoué: ${error.message}`,
          data: {
            requestId: requestId,
            adminId: req.user.id,
            error: error.message
          },
          priority: 'urgent'
        });
      } catch (notificationError) {
        console.warn('⚠️ Erreur notification échec rejet:', notificationError.message);
      }
      
      res.status(500).json({ 
        message: 'Erreur lors du rejet de la demande',
        error: error.message 
      });
    }
  },

  // 👑 Admin: Marquer une demande comme complétée
  async completeRequest(req, res) {
    try {
      const { requestId } = req.params;

      const upgradeRequest = await UpgradeRequest.findByPk(requestId, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }]
      });

      if (!upgradeRequest) {
        return res.status(404).json({ message: 'Demande non trouvée' });
      }

      if (upgradeRequest.status !== 'approved') {
        return res.status(400).json({ message: 'Seules les demandes approuvées peuvent être marquées comme complétées' });
      }

      await upgradeRequest.update({
        status: 'completed'
      });

      // 🔔 NOUVEAU: Notification pour l'utilisateur
      await notificationService.createNotification({
        userId: upgradeRequest.user.id,
        type: 'subscription_activated',
        title: 'Upgrade complété ! 🎉',
        message: `Votre upgrade a été complété avec succès. Profitez de votre nouvel abonnement ${upgradeRequest.requestedPlan?.name || 'Premium'} !`,
        data: {
          requestId: upgradeRequest.id,
          planName: upgradeRequest.requestedPlan?.name,
          completedAt: new Date().toISOString()
        },
        priority: 'medium'
      });

      res.json({
        message: 'Demande marquée comme complétée',
        request: upgradeRequest
      });

    } catch (error) {
      console.error('❌ Erreur complétion demande:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la complétion de la demande',
        error: error.message 
      });
    }
  }
};