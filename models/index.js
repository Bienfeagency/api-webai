// models/index.js
import sequelize from '../config/database.js';

// Import des modèles dans l'ordre correct
import User from './user.js';
import SubscriptionPlan from './subscriptionPlan.js';
import UserSubscription from './userSubscription.js';
// Importez les autres modèles si nécessaire
import UserSite from './userSite.js';
import UserUsage from './userUsage.js';
import Theme from './theme.js';
import SystemLog from './systemLog.js';
import Subscription from './subscription.js';
import Monitoring from './monitoring.js';
import PlanAiModel from './planAiModel.js';
import AiModel from './aiModel.js';
import UpgradeRequest from './upgradeRequest.js';
import ActivationCode from './activationCode.js';
import Notification from './notification.js';
import HistoricalStats from './historicalStats.js';

// Définition des associations entre les modèles

const models = {
    User,
    SubscriptionPlan,
    UserSubscription,
    Subscription,
    UserSite,
    UserUsage,
    Theme,
    SystemLog,
    Monitoring,
    PlanAiModel,
    AiModel,
    UpgradeRequest,
    ActivationCode,
    Notification,
    HistoricalStats
};

// Configuration des associations
Object.keys(models).forEach(modelName => {
  if (typeof models[modelName].associate === 'function') {
    models[modelName].associate(models);
  }
});

export { sequelize, User, SubscriptionPlan, UserSubscription, Subscription, UserSite, UserUsage, Theme, SystemLog, Monitoring, PlanAiModel, AiModel, UpgradeRequest, ActivationCode, Notification, HistoricalStats };
export default models;