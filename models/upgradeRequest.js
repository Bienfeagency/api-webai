// models/UpgradeRequest.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const UpgradeRequest = sequelize.define("UpgradeRequest", {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  userId: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  requestedPlanId: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    references: {
      model: 'subscription_plans',
      key: 'id'
    }
  },
  status: { 
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
    defaultValue: 'pending'
  },
  userMessage: { 
    type: DataTypes.TEXT 
  },
  adminNotes: { 
    type: DataTypes.TEXT 
  },
  approvedBy: { 
    type: DataTypes.INTEGER, // Admin user ID
    allowNull: true
  },
  activationCodeId: {
    type: DataTypes.INTEGER, // Lien vers le code généré
    allowNull: true
  },
  expiresAt: { 
    type: DataTypes.DATE // Date d'expiration de l'approbation
  }
}, {
  tableName: "upgrade_requests",
  timestamps: true
});

// Associations
UpgradeRequest.associate = function(models) {
  UpgradeRequest.belongsTo(models.SubscriptionPlan, {
    foreignKey: 'requestedPlanId',
    as: 'requestedPlan'
  });
  
  UpgradeRequest.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });
  
  UpgradeRequest.belongsTo(models.ActivationCode, {
    foreignKey: 'activationCodeId',
    as: 'activationCode'
  });
};

export default UpgradeRequest;