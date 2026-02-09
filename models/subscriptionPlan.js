// models/SubscriptionPlan.js
import { DataTypes } from 'sequelize';
import sequelize from "../config/database.js";

const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'MGA'
  },
  billingPeriod: {
    type: DataTypes.ENUM('monthly', 'yearly'),
    allowNull: false,
    defaultValue: 'monthly'
  },
  features: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  maxThemes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  maxSites: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  aiGenerations: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10
  },
  supportLevel: {
    type: DataTypes.ENUM('basic', 'priority', 'dedicated'),
    defaultValue: 'basic'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isPopular: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'subscription_plans',
  timestamps: true,
  defaultScope: {
    attributes: { exclude: ['createdAt', 'updatedAt'] }
  }
});

SubscriptionPlan.associate = function(models) {
  SubscriptionPlan.hasMany(models.UserSubscription, {
    foreignKey: 'planId',
    as: 'userSubscriptions'
  });

  SubscriptionPlan.hasMany(models.PlanAiModel, {
    foreignKey: "planId",
    as: "aiRules"
  });
};

export { SubscriptionPlan };
export default SubscriptionPlan;