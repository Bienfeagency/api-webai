// models/PlanAiModel.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const PlanAiModel = sequelize.define("PlanAiModel", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  planId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: "subscription_plans", key: "id" }
  },

  aiModelId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: "ai_models", key: "id" }
  },

  generationType: {
    type: DataTypes.ENUM("article", "site-structure", "seo", "content", "full-site"),
    allowNull: false
  }
}, {
  tableName: "plan_ai_models",
  timestamps: true
});

PlanAiModel.associate = function(models) {
  PlanAiModel.belongsTo(models.SubscriptionPlan, { foreignKey: "planId" });
  PlanAiModel.belongsTo(models.AiModel, { foreignKey: "aiModelId" });
};


export default PlanAiModel;
