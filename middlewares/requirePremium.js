// middleware/premiumMiddleware.js
import { ThemeService } from "../services/themeService.js";

export const requirePremium = async (req, res, next) => {
  try {
    const canAccessPremium = await ThemeService.canAccessPremium(req.user.id);
    
    if (!canAccessPremium) {
      return res.status(403).json({
        message: 'Fonctionnalité premium - Abonnement requis',
        upgrade_url: '/pricing',
        code: 'PREMIUM_REQUIRED'
      });
    }
    
    next();
  } catch (error) {
    console.error('Erreur vérification premium:', error);
    res.status(500).json({ message: 'Erreur de vérification d\'accès' });
  }
};