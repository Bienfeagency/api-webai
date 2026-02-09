// models/AiModel.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const AiModel = sequelize.define("AiModel", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  name: { type: DataTypes.STRING, allowNull: false },     // Nom lisible
  provider: { type: DataTypes.STRING, allowNull: false }, // openai, claude, local, etc.
  modelId: { type: DataTypes.STRING, allowNull: false },  // "gpt-4.1", "gpt-5", ...
  
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: "ai_models",
  timestamps: true
});

AiModel.associate = function(models) {
  AiModel.hasMany(models.PlanAiModel, {
    foreignKey: "aiModelId",
    as: "planConnections"
  });
};


export default AiModel;
