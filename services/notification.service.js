// services/notificationService.js - CORRECTION
import Notification from '../models/notification.js';
import User from '../models/user.js';
import { emitNotification } from '../socket/socketManager.js';

class NotificationService {
  // Créer une notification et l'envoyer en temps réel
  async createNotification(notificationData) {
    try {
      const notification = await Notification.create(notificationData);
      
      // Émettre la notification en temps réel UNIQUEMENT au destinataire
      if (notification.userId) {
        // Notification utilisateur spécifique
        emitNotification('new_notification', notification, notification.userId);
      } else {
        // Notification globale (pour les admins uniquement)
        emitNotification('admin_notification', notification, 'admin');
      }
      
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Récupérer les notifications d'un utilisateur spécifique
  async getUserNotifications(userId, limit = 50, offset = 0) {
    return await Notification.findAndCountAll({
      where: { 
        userId: userId // FILTRE IMPORTANT: uniquement les notifications de l'utilisateur
      },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }]
    });
  }

  // Récupérer les notifications non lues d'un utilisateur spécifique
  async getUnreadNotifications(userId) {
    return await Notification.findAll({
      where: { 
        userId: userId, // FILTRE IMPORTANT
        isRead: false 
      },
      order: [['createdAt', 'DESC']],
      limit: 20
    });
  }

  // Notifier un nouveau site créé (pour les admins uniquement)
  async notifySiteCreated(siteData) {
    try {
      const adminUsers = await User.findAll({ 
        where: { role: 'admin' },
        attributes: ['id']
      });

      const notificationPromises = adminUsers.map(admin => 
        this.createNotification({
          userId: admin.id, // Notification pour chaque admin
          type: 'site_created',
          title: 'Nouveau site créé',
          message: `L'utilisateur ${siteData.userName} a créé un nouveau site: ${siteData.siteName}`,
          data: {
            siteId: siteData.siteId,
            userId: siteData.userId,
            siteName: siteData.siteName,
            userName: siteData.userName,
            siteUrl: siteData.siteUrl,
            adminUrl: siteData.adminUrl
          },
          priority: 'medium'
        })
      );

      await Promise.all(notificationPromises);
      console.log(`📢 Notifications site créé envoyées à ${adminUsers.length} admins`);
    } catch (error) {
      console.error('Erreur notification site créé:', error);
    }
  }

  // Notifier une demande d'upgrade (pour les admins uniquement)
  async notifyUpgradeRequest(requestData) {
    try {
      const adminUsers = await User.findAll({ 
        where: { role: 'admin' },
        attributes: ['id']
      });

      const notificationPromises = adminUsers.map(admin => 
        this.createNotification({
          userId: admin.id, // Notification pour chaque admin
          type: 'upgrade_request',
          title: 'Nouvelle demande d\'upgrade',
          message: `L'utilisateur ${requestData.userName} demande un upgrade vers ${requestData.planName}`,
          data: {
            requestId: requestData.requestId,
            userId: requestData.userId,
            userName: requestData.userName,
            planName: requestData.planName,
            userMessage: requestData.userMessage
          },
          priority: 'high'
        })
      );

      await Promise.all(notificationPromises);
      console.log(`📢 Notifications upgrade envoyées à ${adminUsers.length} admins`);
    } catch (error) {
      console.error('Erreur notification upgrade:', error);
    }
  }

  // Notifier l'utilisateur de la création de son site
  async notifyUserSiteCreated(userId, siteData) {
    try {
      await this.createNotification({
        userId: userId, // Notification uniquement pour cet utilisateur
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
      
      console.log(`📢 Notification site créé envoyée à l'utilisateur ${userId}`);
    } catch (error) {
      console.error('Erreur notification utilisateur site créé:', error);
    }
  }

  // Marquer une notification comme lue (avec vérification de propriété)
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      where: { 
        id: notificationId, 
        userId: userId // VÉRIFICATION IMPORTANTE: l'utilisateur possède cette notification
      }
    });

    if (notification) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
      
      // Émettre la mise à jour uniquement au propriétaire
      emitNotification('notification_read', notification, userId);
      
      return notification;
    }
    
    throw new Error('Notification not found or access denied');
  }

  // Récupérer les notifications globales (pour les admins)
  async getGlobalNotifications(limit = 50, offset = 0) {
    return await Notification.findAndCountAll({
      where: { 
        userId: null // Notifications globales (sans userId)
      },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }]
    });
  }

    // Notifier un problème de santé de site
  async notifySiteHealthAlert(siteData) {
    const notification = await this.createNotification({
      userId: siteData.userId,
      type: 'site_health_alert',
      title: 'Alerte santé du site',
      message: `Votre site "${siteData.siteName}" rencontre des problèmes (Statut: ${siteData.healthStatus})`,
      data: {
        siteId: siteData.siteId,
        sitePort: siteData.sitePort,
        siteName: siteData.siteName,
        healthStatus: siteData.healthStatus,
        failedChecks: siteData.failedChecks
      },
      priority: 'high'
    });

    // Notifier aussi les admins
    const adminUsers = await User.findAll({ 
      where: { role: 'admin' },
      attributes: ['id']
    });

    const adminNotifications = adminUsers.map(admin =>
      this.createNotification({
        userId: admin.id,
        type: 'site_health_alert',
        title: 'Alerte santé de site',
        message: `Le site "${siteData.siteName}" de l'utilisateur ${siteData.userName} rencontre des problèmes`,
        data: {
          siteId: siteData.siteId,
          userId: siteData.userId,
          siteName: siteData.siteName,
          userName: siteData.userName,
          healthStatus: siteData.healthStatus
        },
        priority: 'medium'
      })
    );

    await Promise.all(adminNotifications);
    return notification;
  }
}

export default new NotificationService();