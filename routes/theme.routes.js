// routes/themeRoutes.js - Mise à jour
import express from "express";
import { ThemeService } from "../services/theme.service.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

// Route publique pour les thèmes (avec gestion premium)
router.get('/', authMiddleware, async (req, res) => {
  const {
    search = '',
    page = 1,
    perPage = 12,
    category = '',
    sortBy = 'downloadCount'
  } = req.query;

  try {
    const options = {
      page: parseInt(page),
      limit: parseInt(perPage),
      search,
      category,
      isPremium: false, // Par défaut, seulement freemium
      sortBy
    };

    // Vérifier l'accès premium
    const canAccessPremium = await ThemeService.canAccessPremium(req.user.id);
    
    if (canAccessPremium) {
      // Si premium, on retire le filtre isPremium
      delete options.isPremium;
    }

    const result = await ThemeService.getThemes(options);
    
    res.json({
      ...result,
      userCanAccessPremium: canAccessPremium
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération thèmes:', error);
    
    // Fallback
    const fallback = await ThemeService.getThemes({
      page: 1,
      limit: 12,
      isPremium: false
    });
    
    res.json({
      ...fallback,
      userCanAccessPremium: false,
      isFallback: true
    });
  }
});

// Route spécifique pour les thèmes premium
router.get('/premium', authMiddleware, async (req, res) => {
  try {
    // Vérifier l'accès premium
    const canAccessPremium = await ThemeService.canAccessPremium(req.user.id);
    
    if (!canAccessPremium) {
      return res.status(403).json({ 
        message: 'Accès réservé aux abonnés premium',
        upgrade_url: '/pricing',
        code: 'PREMIUM_REQUIRED'
      });
    }

    const {
      search = '',
      page = 1,
      perPage = 12,
      category = '',
      sortBy = 'downloadCount'
    } = req.query;

    const result = await ThemeService.getThemes({
      page: parseInt(page),
      limit: parseInt(perPage),
      search,
      category,
      isPremium: true,
      sortBy
    });

    res.json({
      ...result,
      isPremium: true
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération thèmes premium:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des thèmes premium',
      code: 'SERVER_ERROR'
    });
  }
});

// Route pour récupérer un thème spécifique
router.get('/:slug', authMiddleware, async (req, res) => {
  try {
    const theme = await Theme.findOne({ where: { slug: req.params.slug } });
    
    if (!theme) {
      return res.status(404).json({ message: 'Thème non trouvé' });
    }

    // Vérifier l'accès si thème premium
    if (theme.isPremium) {
      const canAccessPremium = await ThemeService.canAccessPremium(req.user.id);
      if (!canAccessPremium) {
        return res.status(403).json({ 
          message: 'Thème premium - Abonnement requis',
          upgrade_url: '/pricing',
          code: 'PREMIUM_THEME'
        });
      }
    }

    res.json(theme);
    
  } catch (error) {
    console.error('❌ Erreur récupération thème:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;