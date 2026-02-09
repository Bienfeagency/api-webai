import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const SystemLog = sequelize.define("SystemLog", {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  level: { 
    type: DataTypes.ENUM("info", "warning", "error", "debug"),
    defaultValue: "info"
  },
  module: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  action: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  message: { 
    type: DataTypes.TEXT, 
    allowNull: false 
  },
  userId: { 
    type: DataTypes.INTEGER, 
    allowNull: true 
  },
  ipAddress: { 
    type: DataTypes.STRING 
  },
  userAgent: { 
    type: DataTypes.TEXT 
  },
  metadata: { 
    type: DataTypes.JSON 
  }
}, {
  tableName: "system_logs",
  timestamps: true,
  indexes: [
    {
      fields: ['level']
    },
    {
      fields: ['module']
    },
    {
      fields: ['createdAt']
    }
  ]
});

export default SystemLog;