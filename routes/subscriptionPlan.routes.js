import express from 'express';
import { publicSubscriptionPlanController } from '../controllers/publicSubscriptionPlanController.js';
import { seedSubscriptionPlans } from '../seeders/seedSubscriptionPlans.js';

const router = express.Router();

// Routes publiques pour les plans
router.get('/subscription-plans', publicSubscriptionPlanController.getPlans);

router.post('/seed-subscription-plans', async (req, res) => {
  try {
    await seedSubscriptionPlans();
    res.status(200).json({ message: '✅ Seeder exécuté avec succès' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '❌ Erreur lors du seeding', error });
  }
});

export default router;