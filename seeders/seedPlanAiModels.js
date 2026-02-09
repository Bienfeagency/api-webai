// seeders/seedPlanAiModels.js - VERSION CORRIGÉE
import PlanAiModel from "../models/planAiModel.js";
import AiModel from "../models/aiModel.js";
import SubscriptionPlan from "../models/subscriptionPlan.js";

export const seedPlanAiModels = async () => {

  const config = [
    {
      planSlug: "freemium",
      allowedModels: [
        { modelId: "openai/gpt-4o-mini", generationTypes: ["article", "content", "seo"] },
        { modelId: "google/gemini-2.5-flash-lite", generationTypes: ["article", "content", "seo"] },
      ]
    },
    {
      planSlug: "premium",
      allowedModels: [
        { modelId: "openai/chatgpt-4o-latest", generationTypes: ["article", "seo", "content", "site-structure", "full-site"] },
        { modelId: "openai/gpt-3.5-turbo", generationTypes: ["article", "content", "seo"] }
      ]
    },
    {
      planSlug: "premium-yearly",
      allowedModels: [
        { modelId: "openai/chatgpt-4o-latest", generationTypes: ["article", "seo", "content", "site-structure", "full-site"] },
        { modelId: "openai/gpt-3.5-turbo", generationTypes: ["article", "content", "seo"] }
      ]
    }
  ];

  for (const entry of config) {
    const plan = await SubscriptionPlan.findOne({ where: { slug: entry.planSlug } });

    if (!plan) {
      console.warn(`❌ Plan "${entry.planSlug}" introuvable, ignoré`);
      continue;
    }

    for (const modelConfig of entry.allowedModels) {
      const model = await AiModel.findOne({ where: { modelId: modelConfig.modelId } });

      if (!model) {
        console.warn(`❌ Modèle IA "${modelConfig.modelId}" introuvable, ignoré`);
        continue;
      }

      for (const type of modelConfig.generationTypes) {
        const [link, created] = await PlanAiModel.findOrCreate({
          where: {
            planId: plan.id,
            aiModelId: model.id,
            generationType: type
          }
        });

        if (created) {
          console.log(`✅ ${model.modelId} lié à ${entry.planSlug} pour "${type}"`);
        } else {
          console.log(`ℹ️ Déjà lié : ${model.modelId} ↔ ${entry.planSlug} (${type})`);
        }
      }
    }
  }

  console.log("✅ Associations plan ↔ modèles IA mises à jour");
};