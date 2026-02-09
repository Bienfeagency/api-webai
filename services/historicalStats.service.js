// services/historicalStatsService.js
import HistoricalStats from "../models/historicalStats.js";
import { User, UserSite, UserSubscription, UserUsage, SubscriptionPlan } from "../models/index.js";
import { Op, Sequelize } from "sequelize";

class HistoricalStatsService {
  
  /**
   * Collecte les données quotidiennes (version simplifiée)
   */
  async collectDailyStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Vérifier si les données du jour existent déjà
      const existingStats = await HistoricalStats.findOne({
        where: {
          date: today,
          period: 'daily'
        }
      });
      
      if (existingStats) {
        console.log('📊 Données du jour déjà collectées');
        return;
      }
      
      const [totalUsers, activeSites, dailyRevenue, aiGenerations, newSubscriptionsToday] = await Promise.all([
        User.count(),
        UserSite.count({ where: { status: 'active' } }),
        this.calculateDailyRevenue(today, tomorrow), // Passer la date d'aujourd'hui
        UserUsage.count({
          where: {
            type: 'ai_generation',
            consumedAt: {
              [Op.gte]: today,
              [Op.lt]: tomorrow
            }
          }
        }),
        this.countNewSubscriptionsToday(today, tomorrow)
      ]);

      // Sauvegarder les données
      await Promise.all([
        this.saveHistoricalData(today, 'daily', 'users', totalUsers),
        this.saveHistoricalData(today, 'daily', 'sites', activeSites),
        this.saveHistoricalData(today, 'daily', 'revenue', dailyRevenue),
        this.saveHistoricalData(today, 'daily', 'ai_generations', aiGenerations),
        this.saveHistoricalData(today, 'daily', 'new_subscriptions', newSubscriptionsToday)
      ]);

      console.log('✅ Données historiques quotidiennes collectées');
    } catch (error) {
      console.error('❌ Erreur collecte données quotidiennes:', error);
    }
  }

    /**
   * Compte les nouveaux abonnements aujourd'hui
   */
  async countNewSubscriptionsToday(startDate, endDate) {
    return await UserSubscription.count({
      where: {
        status: 'active',
        createdAt: {
          [Op.gte]: startDate,
          [Op.lt]: endDate
        }
      }
    });
  }

   /**
   * Calcule le MRR (Monthly Recurring Revenue) - Revenu mensuel récurrent
   * C'est plus précis que de simplement diviser le revenu annuel par 12
   */
  async calculateMRR() {
    const activeSubscriptions = await UserSubscription.findAll({
      where: { 
        status: 'active',
        // Exclure les abonnements annuels qui ont déjà été comptés comme paiement unique
      },
      include: [{
        model: SubscriptionPlan,
        as: 'plan',
        attributes: ['price', 'billingPeriod', 'name']
      }],
      raw: true,
      nest: true
    });

    let mrr = 0;
    
    activeSubscriptions.forEach(sub => {
      if (sub.plan && sub.plan.price) {
        const price = parseFloat(sub.plan.price);
        
        switch (sub.plan.billingPeriod) {
          case 'monthly':
            mrr += price;
            break;
          case 'yearly':
            // Pour le MRR, on divise le prix annuel par 12
            mrr += price / 12;
            break;
          case 'quarterly':
            mrr += price / 3;
            break;
          case 'weekly':
            mrr += price * 4.33; // Approx. 4.33 semaines par mois
            break;
          default:
            mrr += price; // Par défaut, considérer comme mensuel
        }
      }
    });

    return Math.round(mrr);
  }

  /**
   * Calcule le revenu quotidien
   */
  async calculateDailyRevenue(startDate, endDate) {
    try {
      const newSubscriptionsToday = await UserSubscription.findAll({
        where: {
          status: 'active',
          createdAt: {
            [Op.gte]: startDate,
            [Op.lt]: endDate
          }
        },
        include: [{
          model: SubscriptionPlan,
          as: 'plan',
          attributes: ['price', 'billingPeriod']
        }],
        raw: true,
        nest: true
      });

      let dailyRevenue = 0;
      newSubscriptionsToday.forEach(sub => {
        if (sub.plan && sub.plan.price) {
          const price = parseFloat(sub.plan.price);
          dailyRevenue += price;
        }
      });

      return parseFloat(dailyRevenue.toFixed(2));
      
    } catch (error) {
      console.error('Erreur calculateDailyRevenue:', error);
      return 0;
    }
  }

  /**
   * Sauvegarde les données historiques
   */
  async saveHistoricalData(date, period, metricType, value) {
    return await HistoricalStats.create({
      date,
      period,
      metricType,
      value,
      details: { collectedAt: new Date() }
    });
  }


  /**
   * Récupère les données historiques pour un graphique
   */
  async getHistoricalData(period = '30d', metricTypes = ['users', 'sites', 'revenue']) {
    const endDate = new Date();
    let startDate = new Date();
    let periodType = 'daily';

    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        periodType = 'weekly';
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    try {
      const historicalData = await HistoricalStats.findAll({
        where: {
          date: {
            [Op.between]: [startDate, endDate]
          },
          period: periodType,
          metricType: {
            [Op.in]: metricTypes
          }
        },
        order: [['date', 'ASC']],
        raw: true
      });

      // Si aucune donnée historique, retourner un objet vide
      if (historicalData.length === 0) {
        const emptyData = {};
        metricTypes.forEach(type => {
          emptyData[type] = [];
        });
        return emptyData;
      }

      // Organiser les données par type de métrique
      const organizedData = {};
      metricTypes.forEach(type => {
        organizedData[type] = historicalData
          .filter(item => item.metricType === type)
          .map(item => ({
            date: item.date,
            value: item.value
          }));
      });

      return organizedData;
    } catch (error) {
      console.error('Erreur getHistoricalData:', error);
      const emptyData = {};
      metricTypes.forEach(type => {
        emptyData[type] = [];
      });
      return emptyData;
    }
  }
  /**
   * Génère des données agrégées pour les périodes manquantes
   */
  async generateAggregatedData(period, metricTypes) {
    const data = await this.getHistoricalData(period, metricTypes);
    
    // Si pas assez de données, retourner des zéros au lieu de fausses données
    if (Object.values(data).some(arr => arr.length === 0)) {
        return await this.generateZeroData(period, metricTypes);
    }

    return data;
    }

  /**
   * Génère des données de fallback basées sur les statistiques actuelles
   */
    async generateZeroData(period, metricTypes) {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    
    const zeroData = {};
    
    metricTypes.forEach(type => {
        zeroData[type] = Array.from({ length: days }, (_, i) => {
        return {
            date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000),
            value: 0
        };
        });
    });

    return zeroData;
    }
  /**
   * Récupère les statistiques actuelles
   */
  async getCurrentStats() {
    const [totalUsers, newUsersThisMonth, activeSites, financialStats] = await Promise.all([
      User.count(),
      User.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      UserSite.count({ where: { status: 'active' } }),
      this.updateFinancialStats()
    ]);

    return {
      totalUsers,
      newUsersThisMonth,
      activeSites,
      dailyRevenue: financialStats.dailyRevenue,
      mrr: financialStats.mrr,
      monthlyRevenue: financialStats.monthlyRevenue,
      totalRevenue: financialStats.totalRevenue
    };
  }
/**
   * Calcule le revenu du mois en cours (paiements reçus ce mois-ci)
   */
  async calculateMonthlyRevenue() {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const startOfNextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    
    try {
      // OPTION 2: Basé sur les abonnements créés ce mois-ci
      const monthlySubscriptions = await UserSubscription.findAll({
        where: {
          status: 'active',
          createdAt: {
            [Op.gte]: startOfMonth,
            [Op.lt]: startOfNextMonth
          }
        },
        include: [{
          model: SubscriptionPlan,
          as: 'plan',
          attributes: ['price']
        }],
        raw: true,
        nest: true
      });

      let monthlyRevenue = 0;
      monthlySubscriptions.forEach(sub => {
        if (sub.plan && sub.plan.price) {
          monthlyRevenue += parseFloat(sub.plan.price);
        }
      });

      return parseFloat(monthlyRevenue.toFixed(2));
      
    } catch (error) {
      console.error('Erreur calculateMonthlyRevenue:', error);
      return 0;
    }
  }

    /**
   * Calcule le revenu total depuis toujours
   */
  async calculateTotalRevenue() {
    try {
      // Fallback: Somme de tous les abonnements
      const allSubscriptions = await UserSubscription.findAll({
        where: {
          status: 'active'
        },
        include: [{
          model: SubscriptionPlan,
          as: 'plan',
          attributes: ['price']
        }],
        raw: true,
        nest: true
      });

      let totalRevenue = 0;
      allSubscriptions.forEach(sub => {
        if (sub.plan && sub.plan.price) {
          totalRevenue += parseFloat(sub.plan.price);
        }
      });

      return parseFloat(totalRevenue.toFixed(2));
      
    } catch (error) {
      console.error('Erreur calculateTotalRevenue:', error);
      return 0;
    }
  }

    /**
   * Met à jour les statistiques financières
   */
  async updateFinancialStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [dailyRevenue, mrr, monthlyRevenue, totalRevenue] = await Promise.all([
      this.calculateDailyRevenue(today, new Date(today.getTime() + 24 * 60 * 60 * 1000)),
      this.calculateMRR(),
      this.calculateMonthlyRevenue(),
      this.calculateTotalRevenue()
    ]);

    return {
      dailyRevenue,
      mrr,
      monthlyRevenue,
      totalRevenue
    };
  }

  async generateChartData(period, metricTypes = ['users', 'sites', 'revenue']) {
    try {
      const historicalData = await this.getHistoricalData(period, metricTypes);
      
      // Vérifier si on a des données réelles
      const hasRealData = Object.values(historicalData).some(data => data.length > 0);
      
      if (!hasRealData) {
        return this.generateZeroChartData(period, metricTypes);
      }
      
      return historicalData;
    } catch (error) {
      console.error('Erreur generateChartData:', error);
      return this.generateZeroChartData(period, metricTypes);
    }
  }

  /**
   * Génère des données à 0 pour les graphiques
   */
  generateZeroChartData(period, metricTypes) {
    const days = this.getDataPointCount(period);
    
    const zeroData = {};
    metricTypes.forEach(type => {
      zeroData[type] = Array.from({ length: days }, (_, i) => {
        return {
          date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000),
          value: 0
        };
      });
    });
    
    return zeroData;
  }

   /**
   * Retourne le nombre de points de données selon la période
   */
  getDataPointCount(period) {
    switch (period) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 12;
      default: return 30;
    }
  }
}

export default new HistoricalStatsService();