// models/Notification.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Notification = sequelize.define("Notification", {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  userId: { 
    type: DataTypes.INTEGER, 
    allowNull: true, // null pour les notifications globales/admin
    references: {
      model: 'users',
      key: 'id'
    }
  },
  type: { 
    type: DataTypes.ENUM(
      'site_created',
      'upgrade_request',
      'subscription_activated',
      'subscription_canceled',
      'site_health_alert',
      'system_alert',
      'user_registered'
    ),
    allowNull: false
  },
  title: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  message: { 
    type: DataTypes.TEXT, 
    allowNull: false 
  },
  data: { 
    type: DataTypes.JSON, 
    defaultValue: {} 
  },
  priority: { 
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  isRead: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false 
  },
  readAt: { 
    type: DataTypes.DATE, 
    allowNull: true 
  },
  expiresAt: { 
    type: DataTypes.DATE, 
    allowNull: true 
  }
}, {
  tableName: "notifications",
  timestamps: true,
  indexes: [
    { fields: ['userId', 'isRead'] },
    { fields: ['type'] },
    { fields: ['createdAt'] }
  ]
});

// Associations
Notification.associate = function(models) {
  Notification.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });
};

export default Notification;