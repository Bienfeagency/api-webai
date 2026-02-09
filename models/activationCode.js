// models/ActivationCode.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ActivationCode = sequelize.define("ActivationCode", {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  code: { 
    type: DataTypes.STRING, 
    unique: true, 
    allowNull: false 
  },
  planId: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    references: {
      model: 'subscription_plans',
      key: 'id'
    }
  },
  upgradeRequestId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'upgrade_requests',
      key: 'id'
    }
  },
  durationDays: { 
    type: DataTypes.INTEGER, 
    defaultValue: 30 
  },
  maxUses: { 
    type: DataTypes.INTEGER, 
    defaultValue: 1 
  },
  usedCount: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true 
  },
  expiresAt: { 
    type: DataTypes.DATE 
  },
  createdBy: { 
    type: DataTypes.INTEGER, // Admin user ID
    allowNull: true 
  }
}, {
  tableName: "activation_codes",
  timestamps: true
});

// Associations
ActivationCode.associate = function(models) {
  ActivationCode.belongsTo(models.SubscriptionPlan, {
    foreignKey: 'planId',
    as: 'plan'
  });
  
  ActivationCode.belongsTo(models.UpgradeRequest, {
    foreignKey: 'upgradeRequestId',
    as: 'upgradeRequest'
  });
};
export default ActivationCode;