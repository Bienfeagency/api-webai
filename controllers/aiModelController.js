// controllers/admin/aiModelController.js
import AiModel from "../models/aiModel.js";
import PlanAiModel from "../models/planAiModel.js";
import SubscriptionPlan from "../models/subscriptionPlan.js";
import { Op } from "sequelize";

export const aiModelController = {

  //---------------------------------------
  // 📌 Récupérer tous les modèles IA
  //---------------------------------------
  async getModels(req, res) {
    try {
      const models = await AiModel.findAll({
        order: [["createdAt", "DESC"]],
      });

      res.json({ models });
    } catch (error) {
      console.error("❌ Erreur récupération modèles IA:", error);
      res.status(500).json({
        message: "Erreur lors de la récupération des modèles IA",
        error: error.message,
      });
    }
  },

  //---------------------------------------
  // 📌 Récupérer un modèle IA spécifique
  //---------------------------------------
  async getModel(req, res) {
    try {
      const { id } = req.params;

      const model = await AiModel.findByPk(id);

      if (!model) {
        return res.status(404).json({ message: "Modèle IA non trouvé" });
      }

      res.json({ model });
    } catch (error) {
      console.error("❌ Erreur récupération modèle IA:", error);
      res.status(500).json({
        message: "Erreur lors de la récupération du modèle IA",
        error: error.message,
      });
    }
  },

  //---------------------------------------
  // 📌 Créer un nouveau modèle IA
  //---------------------------------------
  async createModel(req, res) {
    try {
      const data = req.body;

      if (!data.name || !data.modelId || !data.provider) {
        return res.status(400).json({
          message: "Les champs name, provider et modelId sont obligatoires",
        });
      }

      // Vérification doublon
      const exists = await AiModel.findOne({
        where: {
          modelId: data.modelId,
          provider: data.provider,
        },
      });

      if (exists) {
        return res.status(400).json({
          message: "Un modèle IA avec ce provider et modelId existe déjà",
        });
      }

      const model = await AiModel.create(data);

      res.status(201).json({
        model,
        message: "Modèle IA créé avec succès",
      });
    } catch (error) {
      console.error("❌ Erreur création modèle IA:", error);
      res.status(500).json({
        message: "Erreur lors de la création du modèle IA",
        error: error.message,
      });
    }
  },

  //---------------------------------------
  // 📌 Mettre à jour un modèle IA
  //---------------------------------------
  async updateModel(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;

      const model = await AiModel.findByPk(id);

      if (!model) {
        return res.status(404).json({ message: "Modèle IA non trouvé" });
      }

      // Vérifier doublon modelId/provider
      if (data.provider || data.modelId) {
        const exists = await AiModel.findOne({
          where: {
            provider: data.provider || model.provider,
            modelId: data.modelId || model.modelId,
            id: { [Op.ne]: id }
          }
        });

        if (exists) {
          return res.status(400).json({
            message: "Un autre modèle IA utilise déjà ce provider/modelId",
          });
        }
      }

      await model.update(data);

      res.json({
        model,
        message: "Modèle IA mis à jour avec succès",
      });
    } catch (error) {
      console.error("❌ Erreur modification modèle IA:", error);
      res.status(500).json({
        message: "Erreur lors de la modification du modèle IA",
        error: error.message,
      });
    }
  },

  //---------------------------------------
  // 📌 Supprimer un modèle IA
  //---------------------------------------
  async deleteModel(req, res) {
    try {
      const { id } = req.params;

      const model = await AiModel.findByPk(id);
      if (!model) {
        return res.status(404).json({ message: "Modèle IA non trouvé" });
      }

      // Vérifier s'il est utilisé dans les plans
      const used = await PlanAiModel.count({ where: { aiModelId: id } });

      if (used > 0) {
        return res.status(400).json({
          message: "Impossible de supprimer un modèle IA utilisé par des plans",
        });
      }

      await model.destroy();

      res.json({
        message: "Modèle IA supprimé avec succès",
      });
    } catch (error) {
      console.error("❌ Erreur suppression modèle IA:", error);
      res.status(500).json({
        message: "Erreur lors de la suppression du modèle IA",
        error: error.message,
      });
    }
  },

  // ==========================================================
  // 📌 RÈGLES IA PAR ABONNEMENT (PlanAiModel)
  // ==========================================================

  //---------------------------------------
  // 📌 Récupérer toutes les règles d’un plan
  //---------------------------------------
  async getPlanAiRules(req, res) {
    try {
      const { planId } = req.params;

      const rules = await PlanAiModel.findAll({
        where: { planId },
        include: [{ model: AiModel }],
        order: [["generationType", "ASC"]],
      });

      res.json({ rules });
    } catch (error) {
      console.error("❌ Erreur récupération règles IA du plan:", error);
      res.status(500).json({
        message: "Erreur lors de la récupération des règles IA",
        error: error.message,
      });
    }
  },

  //---------------------------------------
  // 📌 Ajouter une règle IA à un plan
  //---------------------------------------
  async addPlanAiRule(req, res) {
    try {
      const { planId } = req.params;
      const { aiModelId, generationType } = req.body;

      if (!aiModelId || !generationType) {
        return res.status(400).json({
          message: "aiModelId et generationType sont obligatoires",
        });
      }

      // Vérifier que le plan existe
      const plan = await SubscriptionPlan.findByPk(planId);
      if (!plan) {
        return res.status(404).json({ message: "Plan non trouvé" });
      }

      // Vérifier que le modèle IA existe
      const model = await AiModel.findByPk(aiModelId);
      if (!model) {
        return res.status(404).json({ message: "Modèle IA non trouvé" });
      }

      // Vérifier doublon
      const exists = await PlanAiModel.findOne({
        where: { planId, generationType }
      });

      if (exists) {
        return res.status(400).json({
          message: "Une règle existe déjà pour ce type de génération",
        });
      }

      const rule = await PlanAiModel.create({
        planId,
        aiModelId,
        generationType,
      });

      res.status(201).json({
        rule,
        message: "Règle IA ajoutée avec succès",
      });
    } catch (error) {
      console.error("❌ Erreur ajout règle IA:", error);
      res.status(500).json({
        message: "Erreur lors de l'ajout de la règle IA",
        error: error.message,
      });
    }
  },

  //---------------------------------------
  // 📌 Modifier une règle IA de plan
  //---------------------------------------
  async updatePlanAiRule(req, res) {
    try {
      const { ruleId } = req.params;
      const data = req.body;

      const rule = await PlanAiModel.findByPk(ruleId);

      if (!rule) {
        return res.status(404).json({ message: "Règle IA non trouvée" });
      }

      // Vérifier si on modifie generationType → éviter doublon
      if (data.generationType) {
        const exists = await PlanAiModel.findOne({
          where: {
            planId: rule.planId,
            generationType: data.generationType,
            id: { [Op.ne]: ruleId }
          }
        });

        if (exists) {
          return res.status(400).json({
            message: "Une autre règle existe déjà pour ce type de génération",
          });
        }
      }

      await rule.update(data);

      res.json({
        rule,
        message: "Règle IA mise à jour avec succès",
      });
    } catch (error) {
      console.error("❌ Erreur mise à jour règle IA:", error);
      res.status(500).json({
        message: "Erreur lors de la modification de la règle IA",
        error: error.message,
      });
    }
  },

  //---------------------------------------
  // 📌 Supprimer une règle IA
  //---------------------------------------
  async deletePlanAiRule(req, res) {
    try {
      const { ruleId } = req.params;

      const rule = await PlanAiModel.findByPk(ruleId);
      if (!rule) {
        return res.status(404).json({ message: "Règle IA non trouvée" });
      }

      await rule.destroy();

      res.json({
        message: "Règle IA supprimée avec succès",
      });
    } catch (error) {
      console.error("❌ Erreur suppression règle IA:", error);
      res.status(500).json({
        message: "Erreur lors de la suppression de la règle IA",
        error: error.message,
      });
    }
  }
};
