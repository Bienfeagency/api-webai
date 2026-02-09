// routes/siteRoutes.js - MODIFICATIONS COMPLÈTES
import express from 'express';
import { 
  generateSite, 
  generateStructure, 
  applyAiStructure, 
  applyFullStructure, 
  previewSite, 
  getSitePages 
} from '../controllers/siteController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { 
  checkSubscriptionLimits, 
  checkSiteLimit, 
  checkThemeAccess, 
  checkAIGenerations,
  getAiModelForRequest,
  checkPremiumModelAccess,
  trackAiUsage
} from '../middlewares/usageLimitsMiddleware.js';
import { getUserAiUsageHistory, checkAiGenerationsLimit } from '../services/aiModel.service.js';

const router = express.Router();

// Route pour générer un site complet
router.post('/generate-site', 
  authMiddleware, 
  checkSubscriptionLimits,
  checkSiteLimit,
  checkThemeAccess,
  getAiModelForRequest,        // NOUVEAU: Récupère le modèle IA
  checkPremiumModelAccess,     // NOUVEAU: Vérifie l'accès aux modèles premium
  checkAIGenerations,          // EXISTANT: Vérifie les limites
  trackAiUsage,                // NOUVEAU: Track l'usage après réponse
  generateSite
);

// Route pour prévisualiser un site
router.post("/preview/:selectedTheme", 
  authMiddleware, 
  checkSubscriptionLimits,
  checkThemeAccess,
  getAiModelForRequest,        // NOUVEAU: Pour les articles en preview
  checkPremiumModelAccess,     // NOUVEAU: Pour les modèles premium  
  checkAIGenerations,          // EXISTANT: Pour les générations IA
  trackAiUsage,                // NOUVEAU: Track l'usage
  previewSite
);

// Route pour générer une structure IA
router.post('/generate-structure', 
  authMiddleware, 
  checkSubscriptionLimits,
  getAiModelForRequest,        // NOUVEAU: Récupère le modèle IA
  checkPremiumModelAccess,     // NOUVEAU: Vérifie l'accès aux modèles premium
  checkAIGenerations,          // EXISTANT: Vérifie les limites
  trackAiUsage,                // NOUVEAU: Track l'usage après réponse
  generateStructure
);

// Route pour appliquer une structure IA (pas de génération IA)
router.post('/apply-structure', 
  authMiddleware, 
  checkSubscriptionLimits,
  applyAiStructure
);

// Route pour récupérer les pages d'un site (pas de génération IA)
router.get("/:siteSlug/pages", 
  authMiddleware, 
  getSitePages
);

// Route pour appliquer une structure complète (pas de génération IA)
router.post("/apply-full-structure", 
  authMiddleware, 
  checkSubscriptionLimits,
  applyFullStructure
);

// NOUVELLES ROUTES POUR LA GESTION IA

// Route pour vérifier les modèles IA disponibles
// routes/siteRoutes.js

// Route pour vérifier les modèles IA disponibles
router.get('/ai-models/available',
  authMiddleware,
  checkSubscriptionLimits,
  (req, res, next) => {
    // Ajouter un body minimal pour la détermination du type
    req.body = req.body || {};
    
    // Si un type de génération est spécifié dans les query params
    if (req.query.generationType) {
      req.body.generationType = req.query.generationType;
    }
    
    next();
  },
  getAiModelForRequest,
  (req, res) => {
    res.json({
      model: req.aiModel,
      generationType: req.generationType,
      usage: req.aiGenerationsCheck,
      plan: req.subscriptionPlan.name,
      canGenerate: req.aiGenerationsCheck ? req.aiGenerationsCheck.allowed : true
    });
  }
);

// Route pour consulter l'usage IA
router.get('/usage/ai',
  authMiddleware,
  checkSubscriptionLimits,
  async (req, res) => {
    try {      
      const userId = req.user.id;
      const usageHistory = await getUserAiUsageHistory(userId, 20);
      const limitCheck = await checkAiGenerationsLimit(userId);
      
      res.json({
        usage: limitCheck,
        history: usageHistory,
        currentPeriod: getCurrentPeriod()
      });
    } catch (error) {
      console.error('❌ Erreur récupération usage IA:', error);
      res.status(500).json({
        message: 'Erreur lors de la récupération de l\'usage IA'
      });
    }
  }
);

function getCurrentPeriod() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return {
    start: startOfMonth.toISOString(),
    end: endOfMonth.toISOString()
  };
}

export default router;