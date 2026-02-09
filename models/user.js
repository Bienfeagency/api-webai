import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import bcrypt from "bcrypt";

const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  googleId: { type: DataTypes.STRING, unique: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  name: { type: DataTypes.STRING },
  password: { type: DataTypes.STRING },
  profilePicture: { type: DataTypes.TEXT, allowNull: true }, // Stockage base64
  role: { type: DataTypes.ENUM("user", "admin"), defaultValue: "user" },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  verificationToken: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: "users",
  timestamps: true,
});

User.beforeCreate(async (user) => {
  if (user.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('password') && user.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

User.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

User.associate = function(models) {
  User.hasMany(models.UserSubscription, {
    foreignKey: 'userId',
    as: 'subscriptions'
  });
  User.hasMany(models.UserSite, {
    foreignKey: 'userId',
    as: 'sites'
  });
  User.hasMany(models.UserUsage, {
    foreignKey: 'userId',
    as: 'usage'
  });
};

export default User;