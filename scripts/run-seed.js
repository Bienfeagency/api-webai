import { seedSubscriptionPlans } from '../seeders/seedSubscriptionPlans.js';
import { seedAiModels } from '../seeders/seedAiModels.js';
import { seedPlanAiModels } from '../seeders/seedPlanAiModels.js';

async function runSeed() {
  try {
    console.log('🌱 Starting seed...');
    await seedSubscriptionPlans();
    await seedAiModels();
    await seedPlanAiModels();
    console.log('✅ Seed completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

runSeed();