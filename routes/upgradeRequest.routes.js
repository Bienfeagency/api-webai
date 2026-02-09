// routes/upgradeRequest.route.js
import express from 'express';
import { upgradeRequestController } from '../controllers/upgradeRequestController.js';
import { activationController } from '../controllers/activationController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = express.Router();

// Routes utilisateur pour les demandes d'upgrade
router.post('/user/upgrade-request', authMiddleware, upgradeRequestController.createRequest);
router.get('/user/upgrade-requests', authMiddleware, upgradeRequestController.getUserRequests);
router.get('/user/upgrade-request/status', authMiddleware, activationController.getActivationStatus);

// Route pour activer un code (utilisateur)
router.post('/user/activate-premium', authMiddleware, activationController.activateCode);

// Routes admin pour la gestion des demandes
router.get('/admin/upgrade-requests', requireAdmin, upgradeRequestController.getAllRequests);
router.patch('/admin/upgrade-requests/:requestId/approve', requireAdmin, upgradeRequestController.approveRequest);
router.patch('/admin/upgrade-requests/:requestId/reject', requireAdmin, upgradeRequestController.rejectRequest);

export default router;