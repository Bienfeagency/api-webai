// index.js
import express, { json } from "express";
import { createServer } from 'http'; // NOUVEAU: Import pour créer le serveur HTTP
import { initializeSocket } from './socket/socketManager.js';
import monitorSiteHealth from './middlewares/siteHealthMonitor.js';

import session from "express-session";
import passport from "./config/passport.js"; 
import authRoutes from "./routes/auth.routes.js";
import siteRoutes from "./routes/site.routes.js";
import themeRoutes from "./routes/theme.routes.js";
import adminUserRoutes from "./routes/admin.user.routes.js";
import adminThemeRoutes from "./routes/admin.theme.routes.js";
import adminSubscriptionRoutes from './routes/admin.subscription.routes.js';
import publicSubscriptionRoutes from './routes/subscription.routes.js';
import publicSubscriptionPlanRoutes from './routes/subscriptionPlan.routes.js';
import userRoutes from "./routes/user.routes.js";
import userSubscriptionRoutes from "./routes/subscription.routes.js";
import wordpressProxyRoutes from "./routes/wpProxy.routes.js";
import userSitesRoutes from "./routes/userSites.routes.js";
import monitoringRoutes from "./routes/monitoring.routes.js";
import aiModelsRoutes from "./routes/admin.aiModel.routes.js";
import upgradeRequestRoutes from "./routes/upgradeRequest.routes.js";
import adminStatsRoutes from "./routes/admin.stats.routes.js";
import adminRoutes from "./routes/admin.routes.js";

// NOUVEAU: Import des routes de notifications
import adminNotificationRoutes from "./routes/admin.notification.routes.js";
import userNotificationRoutes from "./routes/user.notifications.routes.js";

import "./cron/monitorSites.js";
import "./cron/historicalStats.js";
import emailService from './services/email.service.js';

import cookieParser from "cookie-parser";
import sequelize from "./config/database.js";
import './models/index.js';
import cors from "cors";
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();

// NOUVEAU: Création du serveur HTTP pour Socket.io
const server = createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware JSON + cookies
app.use(json({limit: '50mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  req.appInstance = app;
  next();
});

// CORS pour autoriser le frontend à accéder au backend
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL_PRODUCTION,
      process.env.FRONTEND_URL
    ],
    credentials: true,
  })
);

// Sessions pour Passport
app.use(
  session({
    secret: process.env.JWT_SECRET || "secret123",
    resave: false,
    saveUninitialized: false,
  })
);

// Middleware Passport
app.use(passport.initialize());
app.use(passport.session());

// NOUVEAU: Initialisation de Socket.io
initializeSocket(server);

// Middleware de monitoring de santé des sites
app.use(monitorSiteHealth);

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    message: 'OK',
    services: {
      database: 'connected',
      socket: 'active',
      notifications: 'enabled'
    }
  });
});

app.use('/api/wp-proxy', wordpressProxyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sites", siteRoutes);
app.use("/api/themes", themeRoutes);
app.use("/sandbox", express.static(path.join(__dirname, "sandbox")));
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/themes", adminThemeRoutes);
app.use('/api/admin', adminSubscriptionRoutes);
app.use('/api', publicSubscriptionRoutes);
app.use('/api', publicSubscriptionPlanRoutes);
app.use('/api/user', userRoutes);
app.use('/api/user/subscription', userSubscriptionRoutes);
app.use('/api', userSitesRoutes);
app.use('/api', monitoringRoutes);
app.use('/api/admin', aiModelsRoutes);
app.use('/api', upgradeRequestRoutes);
app.use('/api/admin/stats', adminStatsRoutes);
app.use("/api/user/notifications", userNotificationRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);
app.use("/api/admin", adminRoutes);


// Route test
app.get("/", (req, res) => {
  res.json({ 
    message: "Server is running 🚀",
    features: {
      realtime_notifications: true,
      socket_io: true,
      site_monitoring: true
    }
  });
});

const waitForDatabase = async (maxAttempts = 10, delay = 5000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔧 Tentative de connexion ${attempt}/${maxAttempts} à PostgreSQL...`);
      await sequelize.authenticate();
      console.log('✅ Connexion à PostgreSQL établie avec succès!');
      return true;
    } catch (error) {
      console.log(`⏳ PostgreSQL n'est pas encore prêt (tentative ${attempt}/${maxAttempts})...`);
      
      if (attempt === maxAttempts) {
        console.error('❌ Impossible de se connecter à PostgreSQL après toutes les tentatives');
        throw error;
      }
      
      console.log(`🕐 Attente de ${delay/1000} secondes avant la prochaine tentative...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Synchroniser la base avec gestion d'erreur améliorée
async function startServer() {
  try {
    // NE PAS démarrer la base de données en mode test
    if (process.env.NODE_ENV === 'test') {
      console.log('🧪 Mode test - Skip database connection');
      return app;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Mode développement');
    }

    if (process.env.NODE_ENV === 'production') {
      console.log('🚀 Mode production');
    }
    
    console.log('🚀 Démarrage de l\'application...');
    await waitForDatabase(12, 5000);

    // Synchroniser les modèles
    await sequelize.sync({ alter: true });
    console.log("✅ Database synchronized");

    // Vérifier que les associations sont bien chargées
    const { User, SubscriptionPlan, UserSubscription, Notification } = await import('./models/index.js');
    console.log("🔍 Associations chargées:");
    console.log("- User:", Object.keys(User.associations));
    console.log("- SubscriptionPlan:", Object.keys(SubscriptionPlan.associations));
    console.log("- UserSubscription:", Object.keys(UserSubscription.associations));
    console.log("- Notification:", Object.keys(Notification.associations));

    // Démarrage du serveur - MODIFIÉ: utiliser server au lieu de app
    const PORT = process.env.BACKEND_PORT || 5000;
    const BASE_URL = process.env.BASE_URL || 'http://localhost';
    const BASE_URL_PRODUCTION = process.env.BASE_URL_PRODUCTION || 'http://178.128.179.43';
    server.listen(PORT, () => {
      if(process.env.NODE_ENV === 'development') {
        console.log(`🚀 Server running on ${BASE_URL}:${PORT}`);
      } else {
        console.log(`🚀 Server running on ${BASE_URL_PRODUCTION}:${PORT}`);
      }
      console.log(`📡 Socket.io ready for realtime notifications`);
      console.log(`🔔 Notification system enabled`);
    });

  } catch (error) {
    console.error("❌ Erreur lors du démarrage:", error);
    process.exit(1);
  }
}

// Démarrer le serveur seulement si PAS en mode test
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;