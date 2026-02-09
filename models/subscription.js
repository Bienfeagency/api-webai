// models/Subscription.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Subscription = sequelize.define("Subscription", {
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
  plan: { 
    type: DataTypes.ENUM('free', 'starter', 'pro', 'enterprise'),
    defaultValue: 'free'
  },
  status: { 
    type: DataTypes.ENUM('active', 'canceled', 'expired', 'pending'),
    defaultValue: 'active'
  },
  
  // Période d'abonnement
  startDate: { 
    type: DataTypes.DATE, 
    allowNull: false 
  },
  endDate: { 
    type: DataTypes.DATE 
  },
  trialEndsAt: { 
    type: DataTypes.DATE 
  },
  
  // Limites d'usage
  maxSites: { 
    type: DataTypes.INTEGER, 
    defaultValue: 1 
  },
  maxArticles: { 
    type: DataTypes.INTEGER, 
    defaultValue: 10 
  },
  aiCredits: { 
    type: DataTypes.INTEGER, 
    defaultValue: 100 
  },
  premiumThemes: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false 
  },
  advancedAI: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false 
  },
  
  // Paiement
  stripeSubscriptionId: { 
    type: DataTypes.STRING 
  },
  stripeCustomerId: { 
    type: DataTypes.STRING 
  },
  priceId: { 
    type: DataTypes.STRING 
  },
  
  // Métadonnées
  metadata: { 
    type: DataTypes.JSON, 
    defaultValue: {} 
  }
}, {
  tableName: "subscriptions",
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['plan']
    }
  ]
});

export default Subscription;