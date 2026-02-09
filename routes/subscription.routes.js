// routes/user/subscriptionRoutes.js
import express from 'express';
import { userSubscriptionController } from '../controllers/userSubscriptionController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Routes utilisateur pour les abonnements
router.get('', authMiddleware, userSubscriptionController.getSubscription);
router.get('/current', authMiddleware, userSubscriptionController.getCurrentSubscription);
router.get('/check-premium', authMiddleware, userSubscriptionController.checkPremiumAccess);
router.post('/user/subscribe', authMiddleware, userSubscriptionController.subscribe);
router.post('/cancel', authMiddleware, userSubscriptionController.cancelSubscription);

export default router;