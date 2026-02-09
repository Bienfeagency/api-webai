// seeders/seedAiModels.js
import AiModel from '../models/aiModel.js';

export const seedAiModels = async () => {
  const models = [
    // --- 🟩 MODÈLES GRATUITS (OpenRouterAI) ---
    {
      name: "OpenAI: GPT-4o-mini",
      provider: "openrouter",
      modelId: "openai/gpt-4o-mini",
      isActive: true
    },
    {
      name: "Google: Gemini 2.5 Flash Lite",
      provider: "openrouter",
      modelId: "google/gemini-2.5-flash-lite",
      isActive: true
    },

    // --- 🟦 MODÈLES PAYANTS (OpenRouterAI) ---
    {
      name: "OpenAI: ChatGPT-4o",
      provider: "openrouter",
      modelId: "openai/chatgpt-4o-latest",
      isActive: true
    },
    {
      name: "OpenAI: GPT-3.5 Turbo",
      provider: "openrouter",
      modelId: "openai/gpt-3.5-turbo",
      isActive: true
    },
  ];

  for (const modelData of models) {
    const [model, created] = await AiModel.findOrCreate({
      where: { modelId: modelData.modelId },
      defaults: modelData
    });

    if (created) {
      console.log(`✅ Modèle IA "${modelData.name}" créé`);
    } else {
      console.log(`ℹ️ Modèle IA "${modelData.name}" existe déjà`);
    }
  }

  console.log("✅ Tous les modèles d'IA OpenRouterAI sont prêts");
};
