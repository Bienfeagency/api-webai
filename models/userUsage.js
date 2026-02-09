// models/UserUsage.js
import { DataTypes } from 'sequelize';
import sequelize from "../config/database.js";

export const UserUsage = sequelize.define('UserUsage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('site_creation', 'ai_generation', 'theme_usage'),
    allowNull: false
  },
  count: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  details: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  consumedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'user_usage',
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'type']
    }
  ]
});

// Association avec User
UserUsage.associate = function(models) {
  UserUsage.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });
};

export default UserUsage;