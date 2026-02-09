// services/themeService.js
import Theme from "../models/theme.js";
import Subscription from "../models/subscription.js";
import { Op } from 'sequelize';
import UserSubscription from "../models/userSubscription.js";
import SubscriptionPlan from "../models/subscriptionPlan.js";

export class ThemeService {
  
  // Récupérer les thèmes avec filtres
  static async getThemes(options = {}) {
    const {
      page = 1,
      limit = 12,
      search = '',
      category = '',
      isPremium = null,
      isFeatured = null,
      sortBy = 'downloadCount',
      sortOrder = 'DESC'
    } = options;
    
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    
    // Filtres
    if (search) {
      whereClause.name = { [Op.like]: `%${search}%` };
    }
    
    if (category) {
      whereClause.category = category;
    }
    
    if (isPremium !== null) {
      whereClause.isPremium = isPremium;
    }
    
    if (isFeatured !== null) {
      whereClause.isFeatured = isFeatured;
    }
    
    const { count, rows: themes } = await Theme.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    return {
      themes,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    };
  }
  
// services/ThemeService.js

static async canAccessPremium(userId) {
  try {
    const subscription = await UserSubscription.findOne({
      where: {
        userId,
        status: 'active'
      },
      include: [{
        model: SubscriptionPlan,
        as: 'plan',
        attributes: ['id', 'name', 'slug', 'maxThemes']
      }]
    });
    
    const hasPremiumAccess = !!subscription && 
                            subscription.plan && 
                            subscription.plan.slug !== 'free' && 
                            subscription.plan.slug !== 'freemium';
    
    console.log('🔍 Vérification accès premium:', {
      userId,
      hasSubscription: !!subscription,
      planSlug: subscription?.plan?.slug,
      hasPremiumAccess
    });
    
    return hasPremiumAccess;
  } catch (error) {
    console.error('❌ Erreur vérification accès premium:', error);
    return false;
  }
}
  
  // Récupérer les thèmes accessibles pour un utilisateur
  static async getUserThemes(userId, options = {}) {
    const canAccessPremium = await this.canAccessPremium(userId);
    
    // Si l'utilisateur n'a pas accès au premium, filtrer
    if (!canAccessPremium) {
      options.isPremium = false;
    }
    
    return await this.getThemes(options);
  }
  
  // Incrémenter le compteur d'utilisation
  static async incrementUsage(themeSlug) {
    try {
      await Theme.increment('usageCount', {
        where: { slug: themeSlug }
      });
    } catch (error) {
      console.error('Erreur incrémentation usage thème:', error);
    }
  }
  
  // Récupérer les statistiques des thèmes
  static async getThemeStats() {
    const stats = await Theme.findAll({
      attributes: [
        'category',
        [Theme.sequelize.fn('COUNT', 'id'), 'count'],
        [Theme.sequelize.fn('SUM', Theme.sequelize.col('usageCount')), 'totalUsage']
      ],
      group: ['category']
    });
    
    const totalThemes = await Theme.count();
    const premiumThemes = await Theme.count({ where: { isPremium: true } });
    const featuredThemes = await Theme.count({ where: { isFeatured: true } });
    
    // Thèmes les plus populaires
    const popularThemes = await Theme.findAll({
      attributes: ['name', 'usageCount', 'downloadCount'],
      order: [['usageCount', 'DESC']],
      limit: 5
    });
    
    return {
      totalThemes,
      premiumThemes,
      featuredThemes,
      byCategory: stats.map(stat => ({
        category: stat.category,
        count: stat.get('count'),
        usage: parseInt(stat.get('totalUsage') || 0)
      })),
      popularThemes: popularThemes.map(theme => ({
        name: theme.name,
        usageCount: theme.usageCount,
        downloadCount: theme.downloadCount
      }))
    };
  }
  
  // Initialiser les thèmes par défaut
  static async initializeDefaultThemes() {
    const defaultThemes = [
      // Thèmes freemium
      {
        name: 'Astra',
        slug: 'astra',
        description: 'Thème rapide et personnalisable, parfait pour un site vitrine ou corporate.',
        category: 'Multi-usage',
        isPremium: false,
        isFeatured: true,
        downloadUrl: 'https://downloads.wordpress.org/theme/astra.latest-stable.zip',
        previewImage: 'https://i0.wp.com/themes.svn.wordpress.org/astra/4.11.15/screenshot.jpg',
        features: ['Rapide', 'SEO Friendly', 'Compatible Elementor', 'Responsive'],
        compatibility: { 'wordpress': '5.0+', 'php': '7.0+' },
        sortOrder: 1
      },
      {
        name: 'OceanWP',
        slug: 'oceanwp', 
        description: 'Thème polyvalent, responsive et professionnel pour entreprises.',
        category: 'Business',
        isPremium: false,
        isFeatured: true,
        downloadUrl: 'https://downloads.wordpress.org/theme/oceanwp.latest-stable.zip',
        previewImage: 'https://i0.wp.com/themes.svn.wordpress.org/oceanwp/4.0.9/screenshot.png?w=post-thumbnail&strip=all',
        features: ['eCommerce', 'Multi-usage', 'Extensions'],
        compatibility: { 'wordpress': '5.0+', 'php': '7.0+' },
        sortOrder: 2
      },
      {
        name: 'GeneratePress',
        slug: 'generatepress',
        description: 'Léger et rapide, parfait pour les sites vitrines performants.',
        category: 'Performance',
        isPremium: false,
        isFeatured: true,
        downloadUrl: 'https://downloads.wordpress.org/theme/generatepress.latest-stable.zip',
        previewImage: 'https://i0.wp.com/themes.svn.wordpress.org/generatepress/3.6.0/screenshot.png',
        features: ['Léger', 'Accessible', 'SEO Optimisé'],
        compatibility: { 'wordpress': '5.0+', 'php': '7.0+' },
        sortOrder: 3
      },
      
      // Thèmes premium (exemples)
      {
        name: 'Divi',
        slug: 'divi',
        description: 'Constructeur visuel avancé avec templates illimités.',
        category: 'Premium',
        isPremium: true,
        premiumTier: 'pro',
        price: 89.00,
        isFeatured: true,
        features: ['Constructeur Visuel', 'Templates Illimités', 'eCommerce'],
        previewImage: 'https://wpformation.com/wp-content/uploads/2020/11/guide-utilisation-divi.jpg',
        compatibility: { 'wordpress': '5.0+', 'php': '7.0+' },
        sortOrder: 10
      },
      {
        name: 'Avada',
        slug: 'avada',
        description: 'Thème best-seller avec Fusion Builder.',
        category: 'Premium', 
        isPremium: true,
        premiumTier: 'pro',
        price: 60.00,
        isFeatured: true,
        features: ['Fusion Builder', 'Options Avancées', 'Performance'],
        previewImage: 'https://colorlib.com/wp/wp-content/uploads/sites/2/avada-theme-examples.jpg',
        compatibility: { 'wordpress': '5.0+', 'php': '7.0+' },
        sortOrder: 11
      }
    ];
    
    for (const themeData of defaultThemes) {
      const existingTheme = await Theme.findOne({ where: { slug: themeData.slug } });
      
      if (!existingTheme) {
        await Theme.create({
          ...themeData,
          releaseDate: new Date(),
          lastUpdated: new Date()
        });
        console.log(`✅ Thème créé: ${themeData.name}`);
      }
    }
  }
}