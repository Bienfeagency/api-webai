// controllers/adminStatsController.js
import { 
  User, 
  UserSite, 
  UserSubscription, 
  SubscriptionPlan, 
  UserUsage,
  PlanAiModel,
  AiModel,
  HistoricalStats
} from "../models/index.js";
import { Op, Sequelize } from "sequelize";
import HistoricalStatsService from "../services/historicalStats.service.js";

/**
 * 🎯 Statistiques principales du dashboard admin
 */
export const getAdminDashboardStats = async (req, res) => {
  try {
    // Récupérer les statistiques actuelles depuis le service
    const currentStats = await HistoricalStatsService.getCurrentStats();
    
    const [
      usersStats,
      sitesStats,
      aiUsageStats,
      systemHealthStats
    ] = await Promise.all([
      getUsersStatistics().catch(e => {
        console.error('Erreur usersStats:', e);
        return {};
      }),
      getSitesStatistics().catch(e => {
        console.error('Erreur sitesStats:', e);
        return {};
      }),
      getAiUsageStatistics().catch(e => {
        console.error('Erreur aiUsageStats:', e);
        return { totalGenerations: 0, usageByType: {}, recentActivity: [] };
      }),
      getSystemHealthStatistics().catch(e => {
        console.error('Erreur systemHealthStats:', e);
        return { avgCpuUsage: '0', avgMemoryUsage: '0', totalDiskUsage: '0', highUsageSites: 0, warningSites: 0, downSites: 0 };
      })
    ]);

    // Récupérer les statistiques d'abonnements
    const subscriptionsStats = await getSubscriptionsStatistics();
    
    // Récupérer les données de croissance historique
    const growthRates = await calculateGrowthRates(currentStats);

    res.json({
      success: true,
      data: {
        overview: {
          // Données actuelles
          totalUsers: currentStats.totalUsers,
          newUsersThisMonth: currentStats.newUsersThisMonth,
          activeSites: currentStats.activeSites,
          monthlyRevenue: currentStats.monthlyRevenue,
          totalRevenue: currentStats.totalRevenue,
          mrr: currentStats.mrr,
          dailyRevenue: currentStats.dailyRevenue,
          
          // Abonnements
          activeSubscriptions: subscriptionsStats.activeSubscriptions || 0,
          activePremiumSubscriptions: subscriptionsStats.activePremiumSubscriptions || 0,
          conversionRate: subscriptionsStats.conversionRate || 0,
          premiumConversionRate: subscriptionsStats.premiumConversionRate || 0,
          
          // Taux de croissance
          usersGrowth: growthRates.totalUsers,
          revenueGrowth: growthRates.monthlyRevenue,
          sitesGrowth: growthRates.activeSites,
          subscriptionsGrowth: growthRates.activeSubscriptions,
          premiumSubscriptionsGrowth: growthRates.premiumSubscriptions || 0,
          aiGenerationsGrowth: growthRates.aiGenerations
        },
        subscriptions: {
          premium: subscriptionsStats.premiumPlans || [],
          all: subscriptionsStats.plans || []
        },
        aiUsage: aiUsageStats,
        systemHealth: systemHealthStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Erreur getAdminDashboardStats:", error);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des statistiques",
      error: error.message 
    });
  }
};
/**
 * 📈 Statistiques détaillées des utilisateurs
 */
export const getUsersAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const [growthStats, userDistribution, recentUsers, historicalData] = await Promise.all([
      getUserGrowthStats(period),
      getUserDistributionStats(),
      getRecentUsers(10),
      HistoricalStatsService.generateChartData(period, ['users'])
    ]);

    res.json({
      success: true,
      data: {
        growth: growthStats,
        distribution: userDistribution,
        recent: recentUsers,
        historical: historicalData.users || []
      }
    });
  } catch (error) {
    console.error("Erreur getUsersAnalytics:", error);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des analytics utilisateurs" 
    });
  }
};

export const getFinancialAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const [revenueStats, plansDistribution, churnStats, trialStats, historicalRevenue, premiumStats] = await Promise.all([
      getRevenueStatistics(period),
      getPlansDistribution(),
      getChurnStatistics(),
      getTrialExpirationStats(),
      HistoricalStatsService.generateChartData(period, ['revenue', 'new_subscriptions']),
      getPremiumRevenueStats() // Nouvelle fonction
    ]);

    // Récupérer les statistiques financières actuelles
    const currentFinancialStats = await HistoricalStatsService.getCurrentStats();

    res.json({
      success: true,
      data: {
        current: {
          dailyRevenue: currentFinancialStats.dailyRevenue,
          monthlyRevenue: currentFinancialStats.monthlyRevenue,
          mrr: currentFinancialStats.mrr,
          totalRevenue: currentFinancialStats.totalRevenue,
          premiumRevenue: premiumStats.currentPremiumRevenue || 0,
          premiumPercentage: premiumStats.premiumRevenuePercentage || 0
        },
        history: {
          revenue: historicalRevenue.revenue || [],
          newSubscriptions: historicalRevenue.new_subscriptions || []
        },
        plans: plansDistribution,
        premium: premiumStats,
        churn: churnStats,
        trials: trialStats
      }
    });
  } catch (error) {
    console.error("Erreur getFinancialAnalytics:", error);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des analytics financiers" 
    });
  }
};

/**
 * Statistiques de revenus Premium
 */
async function getPremiumRevenueStats() {
  try {
    // Récupérer les plans Premium
    const premiumPlans = await SubscriptionPlan.findAll({
      where: { 
        slug: ['premium', 'premium-yearly']
      },
      attributes: ['id', 'name', 'slug', 'price', 'billingPeriod']
    });
    
    const premiumPlanIds = premiumPlans.map(plan => plan.id);
    
    // Récupérer les abonnements Premium actifs
    const premiumSubscriptions = await UserSubscription.findAll({
      where: { 
        status: 'active',
        planId: premiumPlanIds
      },
      attributes: ['id', 'planId'],
      include: [{
        model: SubscriptionPlan,
        as: 'plan',
        attributes: ['price', 'billingPeriod']
      }]
    });
    
    // Calculer les revenus Premium
    let monthlyPremiumRevenue = 0;
    let yearlyPremiumRevenue = 0;
    
    premiumSubscriptions.forEach(sub => {
      const price = parseFloat(sub.plan.price) || 0;
      
      if (sub.plan.billingPeriod === 'monthly') {
        monthlyPremiumRevenue += price;
      } else if (sub.plan.billingPeriod === 'yearly') {
        yearlyPremiumRevenue += price;
      }
    });
    
    const totalPremiumRevenue = monthlyPremiumRevenue + yearlyPremiumRevenue;
    
    // Calculer le pourcentage des revenus Premium par rapport au total
    const currentStats = await HistoricalStatsService.getCurrentStats();
    const totalRevenue = currentStats.monthlyRevenue || 0;
    const premiumRevenuePercentage = totalRevenue > 0 ? 
      (totalPremiumRevenue / totalRevenue * 100) : 0;
    
    return {
      totalPremiumSubscriptions: premiumSubscriptions.length,
      currentPremiumRevenue: parseFloat(totalPremiumRevenue.toFixed(2)),
      monthlyPremiumRevenue: parseFloat(monthlyPremiumRevenue.toFixed(2)),
      yearlyPremiumRevenue: parseFloat(yearlyPremiumRevenue.toFixed(2)),
      premiumRevenuePercentage: parseFloat(premiumRevenuePercentage.toFixed(1)),
      byPlan: premiumPlans.map(plan => {
        const count = premiumSubscriptions.filter(sub => sub.planId === plan.id).length;
        return {
          planId: plan.id,
          name: plan.name,
          slug: plan.slug,
          count,
          revenue: parseFloat((count * plan.price).toFixed(2))
        };
      })
    };
  } catch (error) {
    console.error('Erreur getPremiumRevenueStats:', error);
    return {
      totalPremiumSubscriptions: 0,
      currentPremiumRevenue: 0,
      monthlyPremiumRevenue: 0,
      yearlyPremiumRevenue: 0,
      premiumRevenuePercentage: 0,
      byPlan: []
    };
  }
}

/**
 * 📊 Statistiques détaillées des abonnements Premium
 */
export const getPremiumAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const [premiumStats, growthStats, historicalData, revenueStats] = await Promise.all([
      getPremiumSubscriptionsStats(),
      getPremiumGrowthStats(period),
      HistoricalStatsService.generateChartData(period, ['premium_subscriptions']),
      getPremiumRevenueStats()
    ]);

    res.json({
      success: true,
      data: {
        current: premiumStats,
        growth: growthStats,
        revenue: revenueStats,
        historical: historicalData.premium_subscriptions || [],
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Erreur getPremiumAnalytics:", error);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des analytics Premium",
      error: error.message 
    });
  }
};

/**
 * Statistiques détaillées des abonnements Premium
 */
async function getPremiumSubscriptionsStats() {
  try {
    // Récupérer les IDs des plans Premium
    const premiumPlans = await SubscriptionPlan.findAll({
      where: { 
        slug: ['premium', 'premium-yearly']
      },
      attributes: ['id', 'name', 'slug', 'price', 'billingPeriod']
    });
    
    const premiumPlanIds = premiumPlans.map(plan => plan.id);
    
    const [totalPremium, activePremium, canceledPremium] = await Promise.all([
      UserSubscription.count({ where: { planId: premiumPlanIds } }),
      UserSubscription.count({ 
        where: { 
          planId: premiumPlanIds,
          status: 'active' 
        }
      }),
      UserSubscription.count({ 
        where: { 
          planId: premiumPlanIds,
          status: 'canceled' 
        }
      })
    ]);
    
    const premiumChurnRate = activePremium > 0 ? 
      (canceledPremium / activePremium * 100).toFixed(1) : 0;
    
    return {
      totalPremiumSubscriptions: totalPremium,
      activePremiumSubscriptions: activePremium,
      canceledPremiumSubscriptions: canceledPremium,
      premiumChurnRate: parseFloat(premiumChurnRate),
      byPlan: await Promise.all(
        premiumPlans.map(async (plan) => {
          const count = await UserSubscription.count({
            where: {
              planId: plan.id,
              status: 'active'
            }
          });
          
          return {
            planId: plan.id,
            name: plan.name,
            slug: plan.slug,
            billingPeriod: plan.billingPeriod,
            price: plan.price,
            count,
            revenue: parseFloat((count * plan.price).toFixed(2))
          };
        })
      )
    };
  } catch (error) {
    console.error('Erreur getPremiumSubscriptionsStats:', error);
    return {
      totalPremiumSubscriptions: 0,
      activePremiumSubscriptions: 0,
      canceledPremiumSubscriptions: 0,
      premiumChurnRate: 0,
      byPlan: []
    };
  }
}

/**
 * Croissance des abonnements Premium
 */
async function getPremiumGrowthStats(period) {
  try {
    const historicalData = await HistoricalStatsService.getHistoricalData(period, ['premium_subscriptions']);
    const premiumData = historicalData.premium_subscriptions || [];
    
    if (premiumData.length < 2) {
      return {
        period,
        growth: 0,
        dataPoints: premiumData.length
      };
    }

    const firstValue = premiumData[0]?.value || 0;
    const lastValue = premiumData[premiumData.length - 1]?.value || 0;
    
    const growthRate = firstValue > 0 ? 
      ((lastValue - firstValue) / firstValue * 100).toFixed(1) : 100;

    return {
      period,
      growth: parseFloat(growthRate),
      startValue: firstValue,
      endValue: lastValue,
      dataPoints: premiumData.length
    };
  } catch (error) {
    console.error('Erreur getPremiumGrowthStats:', error);
    return {
      period,
      growth: 0,
      startValue: 0,
      endValue: 0,
      dataPoints: 0
    };
  }
}

/**
 * 🖥️ Statistiques techniques et performance
 */
export const getTechnicalAnalytics = async (req, res) => {
  try {
    const [sitesPerformance, resourceUsage, wordpressStats, alertStats, historicalSites] = await Promise.all([
      getSitesPerformanceStats(),
      getResourceUsageStats(),
      getWordPressStatistics(),
      getAlertStatistics(),
      HistoricalStatsService.generateChartData('30d', ['sites'])
    ]);

    res.json({
      success: true,
      data: {
        performance: sitesPerformance,
        resources: resourceUsage,
        wordpress: wordpressStats,
        alerts: alertStats,
        siteGrowth: historicalSites.sites || []
      }
    });
  } catch (error) {
    console.error("Erreur getTechnicalAnalytics:", error);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des analytics techniques" 
    });
  }
};

/**
 * 🚀 Récupère les données de performance détaillées des sites
 */
export const getSitesPerformanceData = async (req, res) => {
  try {
    const { limit = 50, healthStatus, sortBy = 'cpuUsage', sortOrder = 'DESC' } = req.query;
    
    const whereClause = { status: 'active' };
    
    // Filtre par statut de santé si spécifié
    if (healthStatus && healthStatus !== 'all') {
      whereClause.healthStatus = healthStatus;
    }

    const sites = await UserSite.findAll({
      where: whereClause,
      attributes: [
        'id',
        'name',
        'slug',
        'containerName',
        'healthStatus',
        'cpuUsage',
        'memoryUsageMB',
        'diskUsageMB',
        'wordpressVersion',
        'phpVersion',
        'lastHealthCheck',
        'lastDeploymentAt',
        'isUpdating',
        'failedChecksCount',
        'port'
      ],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit)
    });

    // Formater les données pour le frontend
    const performanceData = sites.map(site => ({
      id: site.id,
      name: site.name,
      slug: site.slug,
      containerName: site.containerName,
      user: site.user ? {
        id: site.user.id,
        name: site.user.name,
        email: site.user.email
      } : null,
      health: site.healthStatus,
      cpu: site.cpuUsage || 0,
      memory: site.memoryUsageMB || 0,
      disk: site.diskUsageMB || 0,
      wordpressVersion: site.wordpressVersion || 'Unknown',
      phpVersion: site.phpVersion || 'Unknown',
      lastHealthCheck: site.lastHealthCheck,
      lastDeployment: site.lastDeploymentAt,
      isUpdating: site.isUpdating,
      failedChecksCount: site.failedChecksCount,
      port: site.port
    }));

    // Calculer les statistiques globales
    const stats = {
      totalSites: sites.length,
      healthySites: sites.filter(s => s.healthStatus === 'healthy').length,
      warningSites: sites.filter(s => s.healthStatus === 'warning').length,
      downSites: sites.filter(s => s.healthStatus === 'down').length,
      avgCpu: sites.reduce((sum, site) => sum + (site.cpuUsage || 0), 0) / sites.length || 0,
      avgMemory: sites.reduce((sum, site) => sum + (site.memoryUsageMB || 0), 0) / sites.length || 0,
      totalMemory: sites.reduce((sum, site) => sum + (site.memoryUsageMB || 0), 0),
      totalDisk: sites.reduce((sum, site) => sum + (site.diskUsageMB || 0), 0)
    };

    res.json({
      success: true,
      data: {
        sites: performanceData,
        statistics: stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Erreur getSitesPerformanceData:", error);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des données de performance" 
    });
  }
};

// ============================================================================
// FONCTIONS HELPER POUR LES STATISTIQUES
// ============================================================================

/**
 * Statistiques des utilisateurs
 */
async function getUsersStatistics() {
  try {
    const [totalUsers, newUsersThisMonth, verifiedUsers, googleUsers] = await Promise.all([
      User.count(),
      User.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      User.count({ where: { isVerified: true } }),
      User.count({ where: { googleId: { [Op.ne]: null } } })
    ]);

    const verificationRate = totalUsers > 0 ? 
      (verifiedUsers / totalUsers * 100).toFixed(1) : 0;

    return {
      totalUsers,
      newUsersThisMonth,
      verifiedUsers,
      googleUsers,
      verificationRate: parseFloat(verificationRate)
    };
  } catch (error) {
    console.error('Erreur getUsersStatistics:', error);
    return {
      totalUsers: 0,
      newUsersThisMonth: 0,
      verifiedUsers: 0,
      googleUsers: 0,
      verificationRate: 0
    };
  }
}

/**
 * Statistiques des abonnements (incluant Premium)
 */
async function getSubscriptionsStatistics() {
  try {
    const [totalSubscriptions, activeSubscriptions] = await Promise.all([
      UserSubscription.count(),
      UserSubscription.count({ where: { status: 'active' } })
    ]);
    
    // Récupérer les IDs des plans Premium
    const premiumPlans = await SubscriptionPlan.findAll({
      where: { 
        slug: ['premium', 'premium-yearly']
      },
      attributes: ['id', 'name', 'slug', 'price']
    });
    
    const premiumPlanIds = premiumPlans.map(plan => plan.id);
    
    // Compter les souscriptions Premium actives
    const activePremiumSubscriptions = await UserSubscription.count({ 
      where: { 
        status: 'active',
        planId: premiumPlanIds
      }
    });
    
    const conversionRate = totalSubscriptions > 0 ? 
      (activeSubscriptions / totalSubscriptions * 100).toFixed(1) : 0;
    
    const premiumConversionRate = activeSubscriptions > 0 ? 
      (activePremiumSubscriptions / activeSubscriptions * 100).toFixed(1) : 0;

    // Récupérer la distribution des plans
    const plansDistribution = await getPlansDistribution();
    
    // Récupérer la distribution spécifique Premium
    const premiumDistribution = plansDistribution.filter(plan => 
      ['premium', 'premium-yearly'].includes(plan.slug)
    );

    return {
      // Tous plans
      totalSubscriptions,
      activeSubscriptions,
      conversionRate: parseFloat(conversionRate),
      
      // Premium uniquement
      activePremiumSubscriptions,
      premiumConversionRate: parseFloat(premiumConversionRate),
      premiumPercentage: activeSubscriptions > 0 ? 
        parseFloat((activePremiumSubscriptions / activeSubscriptions * 100).toFixed(1)) : 0,
      
      // Distributions
      plans: plansDistribution,
      premiumPlans: premiumDistribution
    };
  } catch (error) {
    console.error('Erreur getSubscriptionsStatistics:', error);
    return {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      activePremiumSubscriptions: 0,
      conversionRate: 0,
      premiumConversionRate: 0,
      premiumPercentage: 0,
      plans: [],
      premiumPlans: []
    };
  }
}

/**
 * Statistiques des sites
 */
async function getSitesStatistics() {
  try {
    const [totalSites, activeSites, updatingSites] = await Promise.all([
      UserSite.count(),
      UserSite.count({ where: { status: 'active' } }),
      UserSite.count({ where: { isUpdating: true } })
    ]);

    // Récupérer les stats de santé
    const healthStats = await UserSite.findAll({
      attributes: [
        'healthStatus',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: { status: 'active' },
      group: ['healthStatus'],
      raw: true
    });

    const healthStatus = healthStats.reduce((acc, stat) => {
      acc[stat.healthStatus] = parseInt(stat.count);
      return acc;
    }, {});

    const availabilityRate = totalSites > 0 ? 
      (activeSites / totalSites * 100).toFixed(1) : 0;

    return {
      totalSites,
      activeSites,
      updatingSites,
      healthStatus,
      availabilityRate: parseFloat(availabilityRate)
    };
  } catch (error) {
    console.error('Erreur getSitesStatistics:', error);
    return {
      totalSites: 0,
      activeSites: 0,
      updatingSites: 0,
      healthStatus: {},
      availabilityRate: 0
    };
  }
}

/**
 * Statistiques d'utilisation IA - CORRIGÉ
 */
async function getAiUsageStatistics() {
  try {
    // D'abord, vérifier quelles valeurs d'enum existent réellement
    const validTypes = ['ai_generation', 'site_creation', 'theme_usage'];
    
    const [totalGenerations, usageByType, recentAiActivity] = await Promise.all([
      UserUsage.count({
        where: { 
          type: { 
            [Op.in]: validTypes 
          } 
        }
      }),
      UserUsage.findAll({
        attributes: [
          'type',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        where: { 
          type: { 
            [Op.in]: validTypes 
          } 
        },
        group: ['type'],
        raw: true
      }),
      UserUsage.findAll({
        where: { 
          type: validTypes[0]
        },
        order: [['consumedAt', 'DESC']],
        limit: 10,
        include: [{
          model: User,
          as: 'user',
          attributes: ['name', 'email']
        }]
      })
    ]);

    const usageByTypeObj = usageByType.reduce((acc, item) => {
      acc[item.type] = parseInt(item.count);
      return acc;
    }, {});

    return {
      totalGenerations,
      usageByType: usageByTypeObj,
      recentActivity: recentAiActivity
    };
  } catch (error) {
    console.error('Erreur getAiUsageStatistics:', error);
    return {
      totalGenerations: 0,
      usageByType: {},
      recentActivity: []
    };
  }
}

/**
 * Santé du système
 */
async function getSystemHealthStatistics() {
  try {
    const resourceStats = await UserSite.findOne({
      attributes: [
        [Sequelize.fn('AVG', Sequelize.col('cpuUsage')), 'avgCpu'],
        [Sequelize.fn('AVG', Sequelize.col('memoryUsageMB')), 'avgMemory'],
        [Sequelize.fn('SUM', Sequelize.col('diskUsageMB')), 'totalDisk']
      ],
      where: { status: 'active' },
      raw: true
    });

    const [highUsageSites, warningSites, downSites] = await Promise.all([
      UserSite.count({
        where: {
          status: 'active',
          [Op.or]: [
            { cpuUsage: { [Op.gt]: 80 } },
            { memoryUsageMB: { [Op.gt]: 512 } }
          ]
        }
      }),
      UserSite.count({ 
        where: { 
          status: 'active',
          healthStatus: 'warning' 
        } 
      }),
      UserSite.count({ 
        where: { 
          status: 'active',
          healthStatus: 'down' 
        } 
      })
    ]);

    return {
      avgCpuUsage: parseFloat(resourceStats?.avgCpu || 0).toFixed(1),
      avgMemoryUsage: parseFloat(resourceStats?.avgMemory || 0).toFixed(1),
      totalDiskUsage: parseFloat(resourceStats?.totalDisk || 0).toFixed(1),
      highUsageSites,
      warningSites,
      downSites
    };
  } catch (error) {
    console.error('Erreur getSystemHealthStatistics:', error);
    return {
      avgCpuUsage: '0',
      avgMemoryUsage: '0',
      totalDiskUsage: '0',
      highUsageSites: 0,
      warningSites: 0,
      downSites: 0
    };
  }
}

/**
 * Distribution des plans
 */
async function getPlansDistribution() {
  try {
    const plans = await SubscriptionPlan.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'slug', 'price'],
      raw: true
    });

    const distributionWithCounts = await Promise.all(
      plans.map(async (plan) => {
        const userCount = await UserSubscription.count({
          where: { 
            planId: plan.id,
            status: 'active'
          }
        });
        
        return {
          plan: plan.name,
          slug: plan.slug,
          users: userCount,
          price: parseFloat(plan.price)
        };
      })
    );

    return distributionWithCounts.filter(item => item.users > 0);
  } catch (error) {
    console.error('Erreur getPlansDistribution:', error);
    return [];
  }
}

/**
 * Statistiques de revenus
 */
async function getRevenueStatistics(period) {
  try {
    const currentStats = await HistoricalStatsService.getCurrentStats();
    
    return {
      daily: currentStats.dailyRevenue,
      monthly: currentStats.monthlyRevenue,
      mrr: currentStats.mrr,
      total: currentStats.totalRevenue
    };
  } catch (error) {
    console.error('Erreur getRevenueStatistics:', error);
    return {
      daily: 0,
      monthly: 0,
      mrr: 0,
      total: 0
    };
  }
}

/**
 * Statistiques de désabonnement
 */
async function getChurnStatistics() {
  try {
    const [canceledSubscriptions, totalSubscriptions, activeSubscriptions] = await Promise.all([
      UserSubscription.count({ where: { status: 'canceled' } }),
      UserSubscription.count(),
      UserSubscription.count({ where: { status: 'active' } })
    ]);
    
    const churnRate = activeSubscriptions > 0 ? 
      (canceledSubscriptions / activeSubscriptions * 100).toFixed(1) : 0;

    return {
      canceledSubscriptions,
      activeSubscriptions,
      totalSubscriptions,
      churnRate: parseFloat(churnRate)
    };
  } catch (error) {
    console.error('Erreur getChurnStatistics:', error);
    return {
      canceledSubscriptions: 0,
      activeSubscriptions: 0,
      totalSubscriptions: 0,
      churnRate: 0
    };
  }
}

/**
 * Essais expirant bientôt
 */
async function getTrialExpirationStats() {
  try {
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const expiringTrials = await UserSubscription.count({
      where: {
        status: 'active',
        currentPeriodEnd: {
          [Op.lte]: weekFromNow,
          [Op.gte]: new Date()
        }
      }
    });

    return {
      expiringThisWeek: expiringTrials
    };
  } catch (error) {
    console.error('Erreur getTrialExpirationStats:', error);
    return {
      expiringThisWeek: 0
    };
  }
}

/**
 * Croissance des utilisateurs
 */
async function getUserGrowthStats(period) {
  try {
    const historicalData = await HistoricalStatsService.getHistoricalData(period, ['users']);
    const usersData = historicalData.users || [];
    
    if (usersData.length < 2) {
      return {
        period,
        growth: 0,
        dataPoints: usersData.length
      };
    }

    const firstValue = usersData[0]?.value || 0;
    const lastValue = usersData[usersData.length - 1]?.value || 0;
    
    const growthRate = firstValue > 0 ? 
      ((lastValue - firstValue) / firstValue * 100).toFixed(1) : 100;

    return {
      period,
      growth: parseFloat(growthRate),
      startValue: firstValue,
      endValue: lastValue,
      dataPoints: usersData.length
    };
  } catch (error) {
    console.error('Erreur getUserGrowthStats:', error);
    return {
      period,
      growth: 0,
      startValue: 0,
      endValue: 0,
      dataPoints: 0
    };
  }
}

/**
 * Distribution des utilisateurs
 */
async function getUserDistributionStats() {
  try {
    const [byRole, byVerification] = await Promise.all([
      User.findAll({
        attributes: [
          'role',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        group: ['role'],
        raw: true
      }),
      User.findAll({
        attributes: [
          'isVerified',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        group: ['isVerified'],
        raw: true
      })
    ]);

    return {
      byRole: byRole.reduce((acc, item) => {
        acc[item.role] = parseInt(item.count);
        return acc;
      }, {}),
      byVerification: byVerification.reduce((acc, item) => {
        const key = item.isVerified ? 'verified' : 'unverified';
        acc[key] = parseInt(item.count);
        return acc;
      }, {})
    };
  } catch (error) {
    console.error('Erreur getUserDistributionStats:', error);
    return {
      byRole: {},
      byVerification: {}
    };
  }
}

/**
 * Utilisateurs récents
 */
async function getRecentUsers(limit = 10) {
  try {
    return await User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'isVerified', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit
    });
  } catch (error) {
    console.error('Erreur getRecentUsers:', error);
    return [];
  }
}

/**
 * Performance des sites
 */
async function getSitesPerformanceStats() {
  try {
    const activeSites = await UserSite.count({ where: { status: 'active' } });
    const healthySites = await UserSite.count({ where: { status: 'active', healthStatus: 'healthy' } });
    
    return {
      avgResponseTime: 0, // À implémenter
      errorRate: activeSites > 0 ? ((activeSites - healthySites) / activeSites * 100).toFixed(1) : 0,
      deploymentSuccessRate: 95 // Exemple
    };
  } catch (error) {
    console.error('Erreur getSitesPerformanceStats:', error);
    return {
      avgResponseTime: 0,
      errorRate: 0,
      deploymentSuccessRate: 0
    };
  }
}

/**
 * Utilisation des ressources
 */
async function getResourceUsageStats() {
  try {
    const resourceStats = await UserSite.findOne({
      attributes: [
        [Sequelize.fn('SUM', Sequelize.col('cpuUsage')), 'totalCpu'],
        [Sequelize.fn('SUM', Sequelize.col('memoryUsageMB')), 'totalMemory'],
        [Sequelize.fn('SUM', Sequelize.col('diskUsageMB')), 'totalDisk'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'siteCount']
      ],
      where: { status: 'active' },
      raw: true
    });

    const totalSites = resourceStats?.siteCount || 1;
    
    return {
      totalCpuCores: totalSites * 1,
      totalMemoryGB: totalSites * 1,
      totalDiskGB: totalSites * 10,
      usedCpuPercentage: parseFloat(((resourceStats?.totalCpu || 0) / totalSites).toFixed(1)),
      usedMemoryPercentage: parseFloat(((resourceStats?.totalMemory || 0) / (totalSites * 1024) * 100).toFixed(1)),
      usedDiskPercentage: parseFloat(((resourceStats?.totalDisk || 0) / (totalSites * 10240) * 100).toFixed(1))
    };
  } catch (error) {
    console.error('Erreur getResourceUsageStats:', error);
    return {
      totalCpuCores: 0,
      totalMemoryGB: 0,
      totalDiskGB: 0,
      usedCpuPercentage: 0,
      usedMemoryPercentage: 0,
      usedDiskPercentage: 0
    };
  }
}

/**
 * Statistiques WordPress
 */
async function getWordPressStatistics() {
  try {
    const wpVersions = await UserSite.findAll({
      attributes: [
        'wordpressVersion',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: { 
        status: 'active',
        wordpressVersion: { [Op.ne]: null }
      },
      group: ['wordpressVersion'],
      raw: true
    });

    const phpVersions = await UserSite.findAll({
      attributes: [
        'phpVersion',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: { 
        status: 'active',
        phpVersion: { [Op.ne]: null }
      },
      group: ['phpVersion'],
      raw: true
    });

    const popularThemes = await UserSite.findAll({
      attributes: [
        'theme',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: { status: 'active' },
      group: ['theme'],
      order: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'DESC']],
      limit: 10,
      raw: true
    });

    return {
      versions: wpVersions.reduce((acc, item) => {
        acc[item.wordpressVersion] = parseInt(item.count);
        return acc;
      }, {}),
      phpVersions: phpVersions.reduce((acc, item) => {
        acc[item.phpVersion] = parseInt(item.count);
        return acc;
      }, {}),
      popularThemes: popularThemes.reduce((acc, item) => {
        acc[item.theme] = parseInt(item.count);
        return acc;
      }, {})
    };
  } catch (error) {
    console.error('Erreur getWordPressStatistics:', error);
    return {
      versions: {},
      phpVersions: {},
      popularThemes: {}
    };
  }
}

/**
 * Statistiques d'alerte
 */
async function getAlertStatistics() {
  try {
    const [critical, warning, info] = await Promise.all([
      UserSite.count({ where: { healthStatus: 'down' } }),
      UserSite.count({ where: { healthStatus: 'warning' } }),
      UserSite.count({ where: { isUpdating: true } })
    ]);

    return {
      critical,
      warning,
      info
    };
  } catch (error) {
    console.error('Erreur getAlertStatistics:', error);
    return {
      critical: 0,
      warning: 0,
      info: 0
    };
  }
}

/**
 * 📈 Récupère les données formatées pour les graphiques de croissance
 */
export const getGrowthChartData = async (req, res) => {
  try {
    const { period = '30d', metrics = 'users,sites,revenue' } = req.query;
    const metricTypes = metrics.split(',');
    
    const historicalData = await HistoricalStatsService.generateAggregatedData(period, metricTypes);
    
    // Formater les données pour le frontend
    const formattedData = formatHistoricalDataForChart(historicalData, period, metricTypes);
    
    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error("Erreur getGrowthChartData:", error);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des données de croissance",
      data: getZeroChartData(period, metrics.split(',')) // Retourner des zéros en cas d'erreur
    });
  }
};

/**
 * Formate les données historiques pour les graphiques
 */
function formatHistoricalDataForChart(historicalData, period, metricTypes) {
  const dataPoints = getDataPointCount(period);
  
  // S'assurer que toutes les métriques ont des données
  const maxLength = Math.max(...metricTypes.map(type => historicalData[type]?.length || 0));
  
  const labels = generateLabels(period, maxLength || dataPoints);
  
  const datasets = {};
  
  metricTypes.forEach(type => {
    if (historicalData[type] && historicalData[type].length > 0) {
      datasets[type] = historicalData[type].map(item => item.value);
    } else {
      datasets[type] = Array(maxLength || dataPoints).fill(0);
    }
  });
  
  return {
    labels,
    datasets
  };
}

/**
 * Génère les labels pour l'axe X
 */
function generateLabels(period, dataLength) {
  const dataPoints = getDataPointCount(period);
  const actualLength = Math.min(dataLength, dataPoints);
  
  switch (period) {
    case '7d':
      return Array.from({ length: actualLength }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (actualLength - 1 - i));
        return formatDateLabel(date, 'daily');
      });
    case '30d':
      if (actualLength <= 7) {
        return Array.from({ length: actualLength }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (actualLength - 1 - i));
          return formatDateLabel(date, 'daily');
        });
      } else {
        return Array.from({ length: actualLength }, (_, i) => {
          const weekNum = Math.floor(i / 7) + 1;
          return `Sem ${weekNum}`;
        });
      }
    case '90d':
      return Array.from({ length: actualLength }, (_, i) => {
        const monthNum = Math.floor(i / 4) + 1;
        return `M${monthNum}`;
      });
    default:
      return Array.from({ length: actualLength }, (_, i) => `Point ${i + 1}`);
  }
}

/**
 * Formate une date pour l'affichage
 */
function formatDateLabel(date, period) {
  if (period === 'daily') {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

/**
 * Retourne le nombre de points de données selon la période
 */
function getDataPointCount(period) {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 12;
    default: return 30;
  }
}

/**
 * Données à 0 pour les cas d'erreur
 */
function getZeroChartData(period, metricTypes) {
  const dataPoints = getDataPointCount(period);
  const datasets = {};
  
  metricTypes.forEach(type => {
    datasets[type] = Array(dataPoints).fill(0);
  });
  
  return {
    labels: Array.from({ length: dataPoints }, (_, i) => {
      if (period === '7d') return `J-${dataPoints - 1 - i}`;
      if (period === '30d') return `J${i + 1}`;
      return `S${i + 1}`;
    }),
    datasets
  };
}

/**
 * 📈 Récupère les métriques avec taux de croissance
 */
export const getMetricsWithGrowth = async (req, res) => {
  try {
    const currentStats = await HistoricalStatsService.getCurrentStats();
    const growthRates = await calculateGrowthRates(currentStats);

    res.json({
      success: true,
      data: {
        metrics: {
          totalUsers: currentStats.totalUsers,
          activeSites: currentStats.activeSites,
          monthlyRevenue: currentStats.monthlyRevenue,
          mrr: currentStats.mrr,
          dailyRevenue: currentStats.dailyRevenue
        },
        growthRates
      }
    });
  } catch (error) {
    console.error("Erreur getMetricsWithGrowth:", error);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des métriques avec croissance"
    });
  }
};

/**
 * Calcule les taux de croissance
 */
async function calculateGrowthRates(currentStats) {
  const growthRates = {
    totalUsers: 0,
    activeSites: 0,
    monthlyRevenue: 0,
    activeSubscriptions: 0,
    aiGenerations: 0
  };

  try {
    // Calculer la croissance des utilisateurs
    const userGrowth = await calculateMetricGrowth('users', currentStats.totalUsers);
    growthRates.totalUsers = userGrowth;

    // Calculer la croissance des sites
    const siteGrowth = await calculateMetricGrowth('sites', currentStats.activeSites);
    growthRates.activeSites = siteGrowth;

    // Calculer la croissance des revenus
    const revenueGrowth = await calculateMetricGrowth('revenue', currentStats.monthlyRevenue);
    growthRates.monthlyRevenue = revenueGrowth;

    // Calculer la croissance des abonnements
    growthRates.activeSubscriptions = await calculateSubscriptionGrowth();

    // Calculer la croissance des générations IA
    growthRates.aiGenerations = await calculateAIGrowth();
    // Calculer la croissance des abonnements Premium
    growthRates.premiumSubscriptions = await calculatePremiumSubscriptionGrowth();
  } catch (error) {
    console.error('Erreur calcul croissance:', error);
  }

  return growthRates;
}

/**
 * Calcule la croissance des abonnements Premium
 */
async function calculatePremiumSubscriptionGrowth() {
  try {
    // Récupérer les IDs des plans Premium
    const premiumPlans = await SubscriptionPlan.findAll({
      where: { 
        slug: ['premium', 'premium-yearly']
      },
      attributes: ['id']
    });
    const premiumPlanIds = premiumPlans.map(plan => plan.id);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [currentPremiumSubscriptions, previousPremiumSubscriptions] = await Promise.all([
      // Abonnements Premium actifs actuels
      UserSubscription.count({ 
        where: { 
          status: 'active',
          planId: premiumPlanIds
        }
      }),
      // Abonnements Premium actifs créés il y a plus de 30 jours
      UserSubscription.count({
        where: {
          status: 'active',
          planId: premiumPlanIds,
          createdAt: {
            [Op.lt]: thirtyDaysAgo
          }
        }
      })
    ]);

    if (previousPremiumSubscriptions === 0) {
      return currentPremiumSubscriptions > 0 ? 100 : 0;
    }

    return ((currentPremiumSubscriptions - previousPremiumSubscriptions) / previousPremiumSubscriptions) * 100;
  } catch (error) {
    console.error('Erreur calcul croissance abonnements Premium:', error);
    return 0;
  }
}

/**
 * Calcule la croissance d'une métrique spécifique
 */
async function calculateMetricGrowth(metricType, currentValue) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Récupérer la valeur d'il y a 30 jours depuis les données historiques
    const historicalStats = await HistoricalStats.findOne({
      where: {
        metricType,
        date: {
          [Op.gte]: thirtyDaysAgo,
          [Op.lt]: new Date(thirtyDaysAgo.getTime() + 24 * 60 * 60 * 1000)
        }
      },
      order: [['date', 'DESC']],
      raw: true
    });

    const previousValue = historicalStats?.value || 0;

    if (previousValue === 0) {
      return currentValue > 0 ? 100 : 0;
    }

    return ((currentValue - previousValue) / previousValue) * 100;
  } catch (error) {
    console.error(`Erreur calcul croissance ${metricType}:`, error);
    return 0;
  }
}

/**
 * Calcule la croissance des abonnements
 */
async function calculateSubscriptionGrowth() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [currentSubscriptions, previousSubscriptions] = await Promise.all([
      UserSubscription.count({ where: { status: 'active' } }),
      UserSubscription.count({
        where: {
          status: 'active',
          createdAt: {
            [Op.lt]: thirtyDaysAgo
          }
        }
      })
    ]);

    if (previousSubscriptions === 0) {
      return currentSubscriptions > 0 ? 100 : 0;
    }

    return ((currentSubscriptions - previousSubscriptions) / previousSubscriptions) * 100;
  } catch (error) {
    console.error('Erreur calcul croissance abonnements:', error);
    return 0;
  }
}

/**
 * Calcule la croissance des générations IA
 */
async function calculateAIGrowth() {
  try {
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const previousMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const previousMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0);

    const [currentMonthAI, previousMonthAI] = await Promise.all([
      UserUsage.count({
        where: {
          type: { [Op.in]: ['ai_generation', 'site_creation'] },
          consumedAt: {
            [Op.gte]: currentMonthStart
          }
        }
      }),
      UserUsage.count({
        where: {
          type: { [Op.in]: ['ai_generation', 'site_creation'] },
          consumedAt: {
            [Op.between]: [previousMonthStart, previousMonthEnd]
          }
        }
      })
    ]);

    if (previousMonthAI === 0) {
      return currentMonthAI > 0 ? 100 : 0;
    }

    return ((currentMonthAI - previousMonthAI) / previousMonthAI) * 100;
  } catch (error) {
    console.error('Erreur calcul croissance IA:', error);
    return 0;
  }
}
/**
 * 📈 Récupère les données historiques pour les graphiques
 */
export const getHistoricalData = async (req, res) => {
  try {
    const { period = '30d', metrics = 'users,sites,revenue' } = req.query;
    
    const metricTypes = metrics.split(',');
    const historicalData = await HistoricalStatsService.generateAggregatedData(period, metricTypes);

    // Formater les données pour le frontend
    const formattedData = {
      labels: generateLabels(period, historicalData[metricTypes[0]]?.length || 0),
      datasets: {}
    };

    metricTypes.forEach(type => {
      formattedData.datasets[type] = historicalData[type]?.map(item => item.value) || [];
    });

    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error("Erreur getHistoricalData:", error);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la récupération des données historiques" 
    });
  }
};


// Export des fonctions principales
export {
  getUsersStatistics,
  getSubscriptionsStatistics,
  getSitesStatistics,
  getAiUsageStatistics,
  getSystemHealthStatistics,
};