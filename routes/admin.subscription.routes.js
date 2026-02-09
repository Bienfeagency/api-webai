// routes/admin/subscriptionRoutes.js
import express from 'express';
import { subscriptionPlanController } from '../controllers/subscriptionPlanController.js';
import { userSubscriptionController } from '../controllers/userSubscriptionController.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

const router = express.Router();

// Routes pour les plans d'abonnement
router.get('/subscription-plans', requireAdmin, subscriptionPlanController.getPlans);
router.get('/subscription-plans/:id', requireAdmin, subscriptionPlanController.getPlan);
router.post('/subscription-plans', requireAdmin, subscriptionPlanController.createPlan);
router.put('/subscription-plans/:id', requireAdmin, subscriptionPlanController.updatePlan);
router.delete('/subscription-plans/:id', requireAdmin, subscriptionPlanController.deletePlan);
router.get('/subscriptions-plans/stats', subscriptionPlanController.getStats);

// Routes pour les abonnements utilisateurs
router.get('/user-subscriptions', requireAdmin, userSubscriptionController.getSubscriptions);
router.get('/user-subscriptions/:id', requireAdmin, userSubscriptionController.getSubscription);
router.post('/user-subscriptions', requireAdmin, userSubscriptionController.createSubscription);
router.put('/user-subscriptions/:id', requireAdmin, userSubscriptionController.updateSubscription);
router.delete('/user-subscriptions/:id', requireAdmin, userSubscriptionController.deleteSubscription);
router.get('/user-subscriptions/stats/overview', requireAdmin, userSubscriptionController.getSubscriptionStats);

export default router;