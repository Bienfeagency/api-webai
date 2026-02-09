// models/UserSite.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

export const UserSite = sequelize.define("UserSite", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "users",
      key: "id"
    }
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false
  },

  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },

  theme: {
    type: DataTypes.STRING,
    allowNull: false
  },

  status: {
    type: DataTypes.ENUM("active", "inactive", "deleted"),
    defaultValue: "active"
  },

  containerName: {
    type: DataTypes.STRING,
    allowNull: true
  },

  port: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  // 🔥 Monitoring & Health
  healthStatus: {
    type: DataTypes.ENUM("healthy", "warning", "down"),
    defaultValue: "healthy"
  },

  lastHealthCheck: {
    type: DataTypes.DATE,
    allowNull: true
  },

  failedChecksCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },

  // 🔒 Versions
  wordpressVersion: {
    type: DataTypes.STRING,
    allowNull: true
  },

  phpVersion: {
    type: DataTypes.STRING,
    allowNull: true
  },

  dbVersion: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // 📊 Usage stats
  cpuUsage: {
    type: DataTypes.FLOAT,
    allowNull: true
  },

  memoryUsageMB: {
    type: DataTypes.FLOAT,
    allowNull: true
  },

  diskUsageMB: { 
    type: DataTypes.FLOAT, 
    allowNull: true
  },

  // 🛠️ Déploiement et opérations
  lastDeploymentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },

  isUpdating: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }

}, {
  tableName: "user_sites",
  timestamps: true,
  indexes: [
    { fields: ["userId", "status"] }
  ]
});

// Relation
UserSite.associate = function(models) {
  UserSite.belongsTo(models.User, {
    foreignKey: "userId",
    as: "user"
  });
  
  UserSite.hasMany(models.Monitoring, {
    foreignKey: "siteId",
    as: "monitoringLogs"
  });
};



export default UserSite;
