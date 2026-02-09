import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import { 
  getProfile, 
  updateProfile, 
  changePassword, 
  uploadProfilePicture,
  deleteProfilePicture,
  getAccountStats,
  checkEmailAvailability
} from "../controllers/userController.js";
import { getUserUsageStats } from '../utils/usageCounters.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/usage-stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getUserUsageStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur récupération stats usage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});
// Routes pour la gestion du profil
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/change-password", changePassword);
router.put("/profile/picture", uploadProfilePicture);
router.delete("/profile/picture", deleteProfilePicture);
router.get("/stats", getAccountStats);
router.get("/check-email", checkEmailAvailability);

export default router;