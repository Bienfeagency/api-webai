// scripts/assignFreemiumToExistingUsers.js
import { User } from '../models/user.js';
import { SubscriptionPlan } from '../models/subscriptionPlan.js';
import { UserSubscription } from '../models/userSubscription.js';

export const assignFreemiumToExistingUsers = async () => {
  try {
    const freemiumPlan = await SubscriptionPlan.findOne({ 
      where: { slug: 'freemium' } 
    });

    if (!freemiumPlan) {
      console.error('❌ Plan freemium non trouvé');
      return;
    }

    // Trouver les utilisateurs sans abonnement actif
    const users = await User.findAll({
      attributes: ['id', 'email'],
      include: [{
        model: UserSubscription,
        as: 'subscriptions',
        required: false,
        where: { status: 'active' }
      }],
      where: {
        '$subscriptions.id$': null
      }
    });

    console.log(`📊 ${users.length} utilisateurs sans abonnement actif trouvés`);

    for (const user of users) {
      await UserSubscription.create({
        userId: user.id,
        planId: freemiumPlan.id,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false
      });
      console.log(`✅ Freemium assigné à ${user.email}`);
    }

    console.log(`🎉 Plan freemium assigné à ${users.length} utilisateurs existants`);
  } catch (error) {
    console.error('❌ Erreur lors de l\'assignation du freemium:', error);
  }
};