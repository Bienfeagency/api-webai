import { SubscriptionPlan } from '../models/subscriptionPlan.js';

export const seedSubscriptionPlans = async () => {
  const plans = [
    {
      name: 'Freemium',
      slug: 'freemium',
      description: 'Plan gratuit avec fonctionnalités de base',
      price: 0.00,
      currency: 'MGA',
      billingPeriod: 'monthly',
      features: [
        '3 thèmes basiques',
        '1 site web', 
        '10 générations IA',
        'Support email basique',
        'Export HTML/CSS'
      ],
      maxThemes: 3,
      maxSites: 1,
      aiGenerations: 25,
      supportLevel: 'basic',
      isActive: true,
      isPopular: false,
      sortOrder: 0
    },
    {
      name: 'Premium',
      slug: 'premium',
      description: 'Accès complet à tous les thèmes premium et fonctionnalités avancées',
      price: 99999.99,
      currency: 'MGA',
      billingPeriod: 'monthly',
      features: [
        '50+ thèmes premium',
        '10 sites web',
        'Générations IA illimitées',
        'Support prioritaire',
        'Modèles IA avancés',
        'Domaines personnalisés',
        'Analytics avancées'
      ],
      maxThemes: 50,
      maxSites: 10,
      aiGenerations: -1,
      supportLevel: 'priority',
      isActive: true,
      isPopular: true,
      sortOrder: 1
    },
    {
      name: 'Premium Annuel',
      slug: 'premium-yearly',
      description: 'Premium avec 2 mois gratuits - Meilleure offre',
      price: 999999.99,
      currency: 'MGA',
      billingPeriod: 'yearly',
      features: [
        '50+ thèmes premium',
        '10 sites web',
        'Générations IA illimitées',
        'Support prioritaire',
        'Modèles IA avancés',
        'Domaines personnalisés',
        'Analytics avancées',
        '2 mois gratuits'
      ],
      maxThemes: 50,
      maxSites: 10,
      aiGenerations: -1,
      supportLevel: 'priority',
      isActive: true,
      isPopular: false,
      sortOrder: 2
    }
  ];

  for (const planData of plans) {
    const [plan, created] = await SubscriptionPlan.findOrCreate({
      where: { slug: planData.slug },
      defaults: planData
    });
    
    if (created) {
      console.log(`✅ Plan ${planData.name} créé`);
    } else {
      console.log(`ℹ️ Plan ${planData.name} existe déjà`);
    }
  }

  console.log('✅ Tous les plans d\'abonnement sont prêts');
};