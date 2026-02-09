// routes/admin/aiModelRoutes.js
import express from "express";
import { aiModelController } from "../controllers/aiModelController.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = express.Router();

/* -----------------------------------------
   📌 ROUTES : Modèles IA
------------------------------------------ */
router.get("/ai-models", requireAdmin, aiModelController.getModels);
router.get("/ai-models/:id", requireAdmin, aiModelController.getModel);
router.post("/ai-models", requireAdmin, aiModelController.createModel);
router.put("/ai-models/:id", requireAdmin, aiModelController.updateModel);
router.delete("/ai-models/:id", requireAdmin, aiModelController.deleteModel);

/* -----------------------------------------
   📌 ROUTES : Règles IA par plan
------------------------------------------ */

// Récupérer toutes les règles IA d’un plan
router.get(
  "/subscription-plans/:planId/ai-rules",
  requireAdmin,
  aiModelController.getPlanAiRules
);

// Ajouter une règle IA à un plan
router.post(
  "/subscription-plans/:planId/ai-rules",
  requireAdmin,
  aiModelController.addPlanAiRule
);

// Modifier une règle IA
router.put(
  "/subscription-plans/ai-rules/:ruleId",
  requireAdmin,
  aiModelController.updatePlanAiRule
);

// Supprimer une règle IA
router.delete(
  "/subscription-plans/ai-rules/:ruleId",
  requireAdmin,
  aiModelController.deletePlanAiRule
);

export default router;
