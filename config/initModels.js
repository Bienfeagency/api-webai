// config/initModels.js
import models from '../models/index.js';

export async function initializeModels() {
  try {
    // Test de connexion à la base de données
    await models.sequelize.authenticate();
    console.log('✅ Connexion à la base de données établie');

    // Synchroniser les modèles (attention en production)
    if (process.env.NODE_ENV !== 'production') {
      await models.sequelize.sync({ alter: true });
      console.log('✅ Modèles synchronisés avec la base de données');
    }

    // Vérification des associations
    console.log('🔍 Vérification des associations:');
    console.log('User associations:', Object.keys(models.User.associations));
    console.log('SubscriptionPlan associations:', Object.keys(models.SubscriptionPlan.associations));
    console.log('UserSubscription associations:', Object.keys(models.UserSubscription.associations));

    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des modèles:', error);
    throw error;
  }
}