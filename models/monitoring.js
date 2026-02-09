import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

export const Monitoring = sequelize.define("Monitoring", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  siteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "user_sites",
      key: "id"
    }
  },

  status: {
    type: DataTypes.ENUM("healthy", "warning", "down"),
    allowNull: false
  },

  responseTime: { type: DataTypes.INTEGER },

  cpuUsage: { type: DataTypes.FLOAT },
  memoryUsageMB: { type: DataTypes.FLOAT },
  diskUsageMB: { type: DataTypes.FLOAT },

  wpVersion: { type: DataTypes.STRING },
  phpVersion: { type: DataTypes.STRING },
  dbVersion: { type: DataTypes.STRING },

  checkedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }

}, {
  tableName: "monitoring",
  timestamps: false
});

Monitoring.associate = function(models) {
    Monitoring.belongsTo(models.UserSite, {
    foreignKey: "siteId",
    as: "site"
    });
}




export default Monitoring;
