import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const isLocalDatabase = process.env.DB_HOST === 'db' || 
                       process.env.DB_HOST === '127.0.0.1' || 
                       process.env.DB_HOST === 'db';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST || "db",
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
    protocol: "postgres",
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    
    dialectOptions: {
      ssl: isProduction && !isLocalDatabase ? {
        require: true,
        rejectUnauthorized: false,
      } : false
    },
    
    // Configuration du pool de connexions
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    
    // Configuration de reconnexion
    retry: {
      max: 3,
      match: [
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ConnectionError/,
        /SequelizeConnectionError/
      ]
    }
  }
);

export default sequelize;