// models/UserSubscription.js
import { DataTypes } from 'sequelize';
import sequelize from "../config/database.js";

const UserSubscription = sequelize.define('UserSubscription', {
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
  planId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'subscription_plans',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'canceled', 'expired', 'pending'),
    defaultValue: 'pending'
  },
  stripeSubscriptionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  currentPeriodStart: {
    type: DataTypes.DATE,
    allowNull: true
  },
  currentPeriodEnd: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelAtPeriodEnd: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'user_subscriptions',
  timestamps: true,
  defaultScope: {
    attributes: { exclude: ['createdAt', 'updatedAt'] }
  }
});

UserSubscription.associate = function(models) {
  UserSubscription.belongsTo(models.SubscriptionPlan, {
    foreignKey: 'planId',
    as: 'plan'
  });
  
  UserSubscription.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });
};

export { UserSubscription };
export default UserSubscription;