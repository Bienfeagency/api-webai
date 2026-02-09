// services/themeMetricsService.js
import Theme from '../models/theme.js';

export class ThemeMetricsService {
  
  // 🔥 INCRÉMENTER LE COMPTEUR D'UTILISATION
  static async incrementUsage(themeId) {
    try {
      const theme = await Theme.findByPk(themeId);
      if (!theme) {
        throw new Error('Thème non trouvé');
      }
      
      await theme.increment('usageCount');
      console.log(`✅ UsageCount incrémenté pour le thème ${theme.name}`);
      
      return await Theme.findByPk(themeId); // Retourne le thème mis à jour
    } catch (error) {
      console.error('❌ Erreur incrémentation usageCount:', error);
      throw error;
    }
  }

  // 🔥 INCRÉMENTER LE COMPTEUR DE TÉLÉCHARGEMENTS
  static async incrementDownload(themeId) {
    try {
      const theme = await Theme.findByPk(themeId);
      if (!theme) {
        throw new Error('Thème non trouvé');
      }
      
      await theme.increment('downloadCount');
      console.log(`✅ DownloadCount incrémenté pour le thème ${theme.name}`);
      
      return await Theme.findByPk(themeId);
    } catch (error) {
      console.error('❌ Erreur incrémentation downloadCount:', error);
      throw error;
    }
  }

  // 🔥 METTRE À JOUR LA NOTE MOYENNE
  static async updateRating(themeId, newRating) {
    try {
      const theme = await Theme.findByPk(themeId);
      if (!theme) {
        throw new Error('Thème non trouvé');
      }

      const currentRating = theme.rating;
      const currentReviewCount = theme.reviewCount;
      
      // Calculer la nouvelle moyenne
      const totalRating = (currentRating * currentReviewCount) + newRating;
      const newReviewCount = currentReviewCount + 1;
      const newAverageRating = totalRating / newReviewCount;

      await theme.update({
        rating: parseFloat(newAverageRating.toFixed(1)),
        reviewCount: newReviewCount
      });

      console.log(`✅ Rating mis à jour pour ${theme.name}: ${newAverageRating.toFixed(1)}/5`);
      
      return await Theme.findByPk(themeId);
    } catch (error) {
      console.error('❌ Erreur mise à jour rating:', error);
      throw error;
    }
  }

  // 🔥 METTRE À JOUR LA DATE DE DERNIÈRE UTILISATION
  static async updateLastUsed(themeId) {
    try {
      const theme = await Theme.findByPk(themeId);
      if (!theme) {
        throw new Error('Thème non trouvé');
      }
      
      await theme.update({
        lastUpdated: new Date()
      });
      
      console.log(`✅ LastUpdated mis à jour pour ${theme.name}`);
      
      return theme;
    } catch (error) {
      console.error('❌ Erreur mise à jour lastUpdated:', error);
      throw error;
    }
  }

  // 🔥 RÉINITIALISER LES STATISTIQUES (admin)
  static async resetStats(themeId) {
    try {
      const theme = await Theme.findByPk(themeId);
      if (!theme) {
        throw new Error('Thème non trouvé');
      }
      
      await theme.update({
        usageCount: 0,
        downloadCount: 0,
        rating: 0.0,
        reviewCount: 0
      });
      
      console.log(`✅ Statistiques réinitialisées pour ${theme.name}`);
      
      return theme;
    } catch (error) {
      console.error('❌ Erreur réinitialisation stats:', error);
      throw error;
    }
  }

  // 🔥 OBTENIR LES STATISTIQUES D'UN THÈME
  static async getThemeStats(themeId) {
    try {
      const theme = await Theme.findByPk(themeId, {
        attributes: [
          'id', 'name', 'slug',
          'usageCount', 'downloadCount', 'rating', 'reviewCount',
          'lastUpdated', 'releaseDate'
        ]
      });
      
      if (!theme) {
        throw new Error('Thème non trouvé');
      }
      
      return {
        id: theme.id,
        name: theme.name,
        slug: theme.slug,
        usageCount: theme.usageCount,
        downloadCount: theme.downloadCount,
        rating: theme.rating,
        reviewCount: theme.reviewCount,
        lastUpdated: theme.lastUpdated,
        releaseDate: theme.releaseDate
      };
    } catch (error) {
      console.error('❌ Erreur récupération stats thème:', error);
      throw error;
    }
  }

  // 🔥 OBTENIR LES THÈMES LES PLUS POPULAIRES
  static async getPopularThemes(limit = 10) {
    try {
      return await Theme.findAll({
        where: { isActive: true },
        order: [
          ['usageCount', 'DESC'],
          ['downloadCount', 'DESC'],
          ['rating', 'DESC']
        ],
        limit: limit,
        attributes: [
          'id', 'name', 'slug', 'previewImage',
          'usageCount', 'downloadCount', 'rating', 'reviewCount',
          'isPremium', 'price'
        ]
      });
    } catch (error) {
      console.error('❌ Erreur récupération thèmes populaires:', error);
      throw error;
    }
  }
}