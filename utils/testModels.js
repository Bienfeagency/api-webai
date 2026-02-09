// utils/testModels.js
import { OPENROUTER_AI_API, OPENROUTER_AI_KEY } from '../config/ia.js';
import axios from 'axios';

const BASE_URL = process.env.NODE_ENV === 'production' ? process.env.BASE_URL_PRODUCTION : process.env.BASE_URL || 'http://localhost';

async function testModelAvailability() {
  console.log('🧪 TEST DES MODÈLES OPENROUTER');
  console.log('===============================\n');

  const testModels = [
    'meta-llama/llama-3.1-8b-instruct',
    'qwen/qwen-2.5-72b-instruct',
    'google/gemini-flash-1.5',
    'mistralai/mistral-7b-instruct',
    'anthropic/claude-3-5-sonnet',
    'openai/gpt-4o'
  ];

  for (const model of testModels) {
    try {
      process.stdout.write(`🔍 Test de ${model}... `);
      
      const response = await axios.post(
        OPENROUTER_AI_API,
        {
          model: model,
          messages: [{ role: 'user', content: 'Reponds uniquement par "TEST_OK"' }],
          max_tokens: 10,
          temperature: 0.1,
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_AI_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': `${BASE_URL}:3000`,
            'X-Title': 'Model Test',
          },
          timeout: 10000,
        }
      );

      const answer = response.data.choices[0].message.content.trim();
      console.log(`✅ DISPONIBLE ("${answer}")`);
      
    } catch (error) {
      if (error.response?.status === 402) {
        console.log(`💰 QUOTA REQUIS (402)`);
      } else if (error.response?.status === 404) {
        console.log(`❌ INTROUVABLE (404)`);
      } else if (error.response?.status === 429) {
        console.log(`🚦 RATE LIMIT (429)`);
      } else if (error.code === 'ECONNABORTED') {
        console.log(`⏰ TIMEOUT`);
      } else {
        console.log(`⚠️ ERREUR: ${error.response?.status || error.message}`);
      }
    }
    
    // Petite pause
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  console.log('\n🎯 TEST TERMINÉ');
}

// Exécution directe
testModelAvailability().catch(error => {
  console.error('💥 ERREUR CRITIQUE:', error.message);
});