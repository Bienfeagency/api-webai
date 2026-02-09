// routes/admin/notificationRoutes.js
import express from 'express';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import notificationService from '../services/notification.service.js';
import Notification from '../models/notification.js';
import { Op } from 'sequelize';

const router = express.Router();

// 🔹 Middleware admin uniquement
router.use(requireAdmin);

// 🔹 Routes ADMIN - leurs notifications + vue admin
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    console.log('👑 ADMIN Notifications - Admin:', req.user.id);

    // Notifications personnelles de l'admin
    const notifications = await notificationService.getUserNotifications(
      req.user.id,
      parseInt(limit),
      offset
    );

    res.json({
      success: true,
      data: notifications,
      userType: 'admin'
    });
  } catch (error) {
    console.error('❌ Erreur récupération notifications admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications'
    });
  }
});

// Marquer toutes les notifications comme lues
router.patch('/read-all', async (req, res) => {
  try {
    const unreadNotifications = await notificationService.getUnreadNotifications(req.user.id);
    
    for (const notification of unreadNotifications) {
      await notificationService.markAsRead(notification.id, req.user.id);
    }

    res.json({
      success: true,
      message: 'Toutes les notifications ont été marquées comme lues',
      count: unreadNotifications.length
    });
  } catch (error) {
    console.error('❌ Erreur marquage toutes notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage de toutes les notifications'
    });
  }
});

// 🔹 Vue admin complète (toutes les notifications)
router.get('/all', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    console.log('👑 ADMIN Vue complète - Admin:', req.user.id);

    const notifications = await Notification.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'role']
      }]
    });

    res.json({
      success: true,
      data: notifications,
      userType: 'admin',
      isAdminView: true
    });
  } catch (error) {
    console.error('❌ Erreur récupération vue admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications'
    });
  }
});

// 🔹 Statistiques admin
router.get('/stats', async (req, res) => {
  try {
    const totalNotifications = await Notification.count();
    const unreadNotifications = await Notification.count({ where: { isRead: false } });
    
    const notificationsByType = await Notification.findAll({
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['type'],
      raw: true
    });

    res.json({
      success: true,
      data: {
        total: totalNotifications,
        unread: unreadNotifications,
        byType: notificationsByType
      }
    });
  } catch (error) {
    console.error('❌ Erreur statistiques admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// Supprimer une notification
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification non trouvée'
      });
    }

    await notification.destroy();

    res.json({
      success: true,
      message: 'Notification supprimée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur suppression notification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la notification'
    });
  }
});

export default router;