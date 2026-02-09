// config/ia.js - VERSION OPTIMISÉE
import dotenv from 'dotenv';
dotenv.config();

export const OPENROUTER_AI_API = 'https://openrouter.ai/api/v1/chat/completions';

export const OPENROUTER_AI_MODELS = {
  // 🆓 MODÈLES 100% GRATUITS (sans quota)
  TOP_FREE: [
    'meta-llama/llama-3.1-8b-instruct',        // Rapide et fiable
    'google/gemini-flash-1.5',              // Stable et gratuit
    'mistralai/mistral-7b-instruct',           // Bon pour le français
  ],
  
  // 💰 MODÈLES AVEC QUOTA (meilleure qualité)
  PREMIUM: [
    'qwen/qwen-2.5-72b-instruct',              // Excellente qualité
    'microsoft/wizardlm-2-8x22b',              //Très puissant
    'anthropic/claude-3-5-sonnet',             // Claude dernière version
    'openai/gpt-4o',                           // GPT-4 optimisé
  ],
  
  // 🚀 POUR LA RAPIDITÉ
  FAST: [
    'meta-llama/llama-3.1-8b-instruct',
    'google/gemini-flash-1.5',
  ],
  
  // 🧠 POUR LA QUALITÉ
  QUALITY: [
    'qwen/qwen-2.5-72b-instruct',
    'anthropic/claude-3-5-sonnet',
    'openai/gpt-4o',
  ]
};

// Modèle par défaut - utiliser un modèle gratuit pour éviter les 402
export const OPENROUTER_AI_MODEL = 'meta-llama/llama-3.1-8b-instruct';

export const OPENROUTER_AI_KEY = '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';

console.log('🎯 Configuration IA optimisée - Modèles gratuits prioritaires');