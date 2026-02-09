import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const HistoricalStats = sequelize.define("HistoricalStats", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  period: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
    allowNull: false
  },
  metricType: {
    type: DataTypes.ENUM('users', 'sites', 'revenue', 'ai_generations', 'subscriptions','new_subscriptions', 'premium_subscriptions'),
    allowNull: false
  },
  value: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  details: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: "historical_stats",
  timestamps: true,
  indexes: [
    { fields: ["date", "metricType"] },
    { fields: ["period"] }
  ]
});

export default HistoricalStats;