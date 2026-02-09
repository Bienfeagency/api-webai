import { Router } from "express";
import passportPkg from "passport";
const passport = passportPkg;
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { SubscriptionPlan } from "../models/subscriptionPlan.js";
import { UserSubscription } from "../models/userSubscription.js";
import crypto from "crypto";
import EmailService from "../services/email.service.js";

const router = Router();
const { sign, verify } = jwt;

const frontendUrl = process.env.NODE_ENV === "development" 
  ? process.env.FRONTEND_URL 
  : process.env.FRONTEND_URL_PRODUCTION;


// ============================================================
// 🔹 AUTH GOOGLE
// ============================================================

// Step 1: Redirect to Google
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Step 2: Google callback 
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

        // 🔥 AUTO-ASSIGNER LE PLAN FREEMIUM pour Google Auth
    try {
      const existingSubscription = await UserSubscription.findOne({
        where: { 
          userId: req.user.id, 
          status: 'active' 
        }
      });

      if (!existingSubscription) {
        const freemiumPlan = await SubscriptionPlan.findOne({ 
          where: { 
            slug: 'freemium',
            isActive: true 
          } 
        });

        if (freemiumPlan) {
          await UserSubscription.create({
            userId: req.user.id,
            planId: freemiumPlan.id,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            cancelAtPeriodEnd: false
          });
          console.log(`✅ Plan freemium assigné à l'utilisateur Google ${req.user.email}`);
        }
      }
    } catch (subscriptionError) {
      console.error('❌ Erreur assignation freemium Google:', subscriptionError);
    }

    const token = sign(
      { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: false,
      secure: false,
      //secure: process.env.NODE_ENV === "production",
      //sameSite: "none",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${frontendUrl}/`);
  }
);

// ============================================================
// 🔹 AUTH CLASSIQUE (email / mot de passe)
// ============================================================

// 👉 Inscription
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Les mots de passe ne correspondent pas" });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "Cet email est déjà utilisé" });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      name,
      email,
      password,
      role: role || "user",
      verificationToken,
      isVerified: false,
    });

    // 🔥 AUTO-ASSIGNER LE PLAN FREEMIUM
    try {
      const freemiumPlan = await SubscriptionPlan.findOne({ 
        where: { 
          slug: 'freemium',
          isActive: true 
        } 
      });

      if (freemiumPlan) {
        await UserSubscription.create({
          userId: user.id,
          planId: freemiumPlan.id,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false
        });
        console.log(`✅ Plan freemium assigné à l'utilisateur ${user.email}`);
      }
    } catch (subscriptionError) {
      console.error('❌ Erreur lors de l\'assignation du plan freemium:', subscriptionError);
    }

    // 📧 ENVOI DE L'EMAIL DE VÉRIFICATION (Backend)
    const emailSent = await EmailService.sendVerificationEmail(
      user.email,
      user.name,
      verificationToken
    );

    if (emailSent) {
      res.json({
        message: "Utilisateur créé. Email de vérification envoyé.",
        email: user.email,
        name: user.name,
      });
    } else {
      res.status(500).json({
        message: "Utilisateur créé mais l'email n'a pas pu être envoyé. Veuillez contacter le support.",
        email: user.email,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de l'inscription" });
  }
});

// 👉 Vérification email
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    const user = await User.findOne({ where: { verificationToken: token } });

    if (!user) {
      return res.status(400).send("Token invalide ou expiré");
    }

    user.isVerified = true;
    user.verificationToken = null;
    await user.save();

    res.send("Email vérifié ! Vous pouvez maintenant vous connecter.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur lors de la vérification de l'email");
  }
});


// 👉 Connexion
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ where: { email } });
    if (!user || !user.password)
      return res.status(401).json({ message: "Invalid credentials" });

    /*if (!user.isVerified) {
      return res.status(401).json({ message: "Veuillez vérifier votre email avant de vous connecter" });
    }*/

    const isValid = await user.validatePassword(password);
    if (!isValid)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: false,
      secure: false,
      //secure: process.env.NODE_ENV === "production",
      //sameSite: "none",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ message: "Login successful", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// 👉 Connexion ADMIN
router.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email et mot de passe requis" });

    const user = await User.findOne({ where: { email } });

    if (!user || !user.password)
      return res.status(401).json({ message: "Identifiants invalides" });

    /*if (!user.isVerified) {
      return res.status(401).json({ message: "Veuillez vérifier votre email avant de vous connecter" });
    }*/

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Accès refusé. Ce compte n'est pas administrateur." });
    }

    const isValid = await user.validatePassword(password);
    if (!isValid)
      return res.status(401).json({ message: "Identifiants invalides" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("admin_token", token, {
      httpOnly: false,
      secure: false,
      //secure: process.env.NODE_ENV === "production",
      //sameSite: "none",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Connexion administrateur réussie",
      token,
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur lors de la connexion admin" });
  }
});

router.post("/admin-logout", (req, res) => {
  res.clearCookie("admin_token", {
      httpOnly: true,
      secure: false,
      //secure: process.env.NODE_ENV === "production",
      //sameSite: "none",
      sameSite: "lax",
  });
  res.json({ message: "Admin logged out" });
});


// ============================================================
// 🔹 ME / LOGOUT
// ============================================================

router.get("/me", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const decoded = verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "email", "name", "role", "isVerified", "profilePicture", "createdAt", "updatedAt"],
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", {
      httpOnly: true,
      secure: false,
      //secure: process.env.NODE_ENV === "production",
      //sameSite: "none",
      sameSite: "lax",
  });
  res.json({ message: "Logged out" });
});

router.get("/admin/me", async (req, res) => {
  try {
    const token = req.cookies.admin_token;
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    res.json(user);
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});


export default router;
