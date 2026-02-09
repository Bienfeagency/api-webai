import User from "../models/user.js";
import bcrypt from "bcrypt";
import { SubscriptionPlan } from "../models/index.js";
import { UserSubscription } from "../models/index.js";

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "name", "email", "role", "isVerified", "googleId", "createdAt"],
      order: [["createdAt", "DESC"]],
    });
    res.json(users);
  } catch (error) {
    console.error("Erreur getAllUsers:", error);
    res.status(500).json({ message: "Erreur lors de la récupération des utilisateurs" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ["id", "name", "email", "role", "isVerified", "createdAt", "googleId"]
    });
    
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    
    res.json(user);
  } catch (error) {
    console.error("Erreur getUserById:", error);
    res.status(500).json({ message: "Erreur lors de la récupération de l'utilisateur" });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Validation des données
    if (!email || !name) {
      return res.status(400).json({ message: "L'email et le nom sont obligatoires" });
    }
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Un utilisateur avec cet email existe déjà" });
    }
    
    const userData = {
      name,
      email,
      role: role || "user",
      isVerified: true
    };
    
    // Hasher le mot de passe si fourni
    if (password) {
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(password, salt);
    }
    
    const user = await User.create(userData);

    
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
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 an pour freemium
            cancelAtPeriodEnd: false
        });
        console.log(`✅ Plan freemium assigné à l'utilisateur ${user.email}`);
        } else {
        console.error('❌ Plan freemium non trouvé dans la base de données');
        }
    } catch (subscriptionError) {
        console.error('❌ Erreur lors de l\'assignation du plan freemium:', subscriptionError);
    }
    
    
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error("Erreur createUser:", error);
    res.status(500).json({ message: "Erreur lors de la création de l'utilisateur" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { name, email, role, isVerified, password } = req.body;
    
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    
    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: "Un utilisateur avec cet email existe déjà" });
      }
    }
    
    // Préparer les données de mise à jour
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    
    // Mettre à jour le mot de passe si fourni
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    
    await user.update(updateData);
    
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error("Erreur updateUser:", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour de l'utilisateur" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    
    // Empêcher la suppression de son propre compte
    if (user.id === req.user.id) {
      return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte" });
    }
    
    await user.destroy();
    
    res.json({ message: "Utilisateur supprimé avec succès" });
  } catch (error) {
    console.error("Erreur deleteUser:", error);
    res.status(500).json({ message: "Erreur lors de la suppression de l'utilisateur" });
  }
};