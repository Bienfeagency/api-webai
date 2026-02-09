// models/Theme.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Theme = sequelize.define("Theme", {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  name: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  slug: { 
    type: DataTypes.STRING, 
    unique: true, 
    allowNull: false 
  },
  description: { 
    type: DataTypes.TEXT 
  },
  category: { 
    type: DataTypes.STRING 
  },
  version: { 
    type: DataTypes.STRING, 
    defaultValue: "1.0.0" 
  },
  
  isPremium: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false 
  },
  premiumTier: { 
    type: DataTypes.ENUM('basic', 'pro', 'enterprise'),
    defaultValue: 'basic'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  
  // Métriques
  downloadUrl: { 
    type: DataTypes.STRING 
  },
  previewImage: { 
    type: DataTypes.STRING 
  },
  demoUrl: { 
    type: DataTypes.STRING 
  },
  
  // Statistiques
  downloadCount: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  usageCount: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  rating: { 
    type: DataTypes.DECIMAL(3, 1), 
    defaultValue: 0.0 
  },
  reviewCount: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  
  // Métadonnées
  features: { 
    type: DataTypes.JSON, 
    defaultValue: [] 
  },
  compatibility: { 
    type: DataTypes.JSON, 
    defaultValue: {} 
  },
  requirements: { 
    type: DataTypes.JSON, 
    defaultValue: {} 
  },
  popular: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  
  // Gestion admin
  isActive: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true 
  },
  isFeatured: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false 
  },
  sortOrder: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  
  lastUpdated: { 
    type: DataTypes.DATE 
  },
  releaseDate: { 
    type: DataTypes.DATE 
  }
}, {
  tableName: "themes",
  timestamps: true,
  indexes: [
    {
      fields: ['isPremium']
    },
    {
      fields: ['category']
    },
    {
      fields: ['isFeatured']
    },
    {
      fields: ['rating']
    }
  ]
});

export default Theme;