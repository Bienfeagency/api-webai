// controllers/userController.js
import User from "../models/user.js";
import { Op } from "sequelize";

// ============================================================
// 🔹 RÉCUPÉRER LE PROFIL DE L'UTILISATEUR CONNECTÉ
// ============================================================
export const getProfile = async (req, res) => {
  try {
    console.log("Récupération profil pour user ID:", req.user.id);
    
    const user = await User.findByPk(req.user.id, {
      attributes: { 
        exclude: ['password', 'verificationToken', 'googleId'] 
      }
    });

    console.log("Utilisateur récupéré:", user ? `${user.name} (${user.email})` : 'Non trouvé');

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.json({ 
      user,
      message: "Profil récupéré avec succès"
    });
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({ 
      message: "Erreur serveur lors de la récupération du profil",
      error: error.message 
    });
  }
};

// ============================================================
// 🔹 METTRE À JOUR LE PROFIL
// ============================================================
export const updateProfile = async (req, res) => {
  try {
    const { name, email, profilePicture } = req.body;
    const userId = req.user.id;

    console.log("Mise à jour profil pour user ID:", userId, "Données:", { name, email, profilePicture: profilePicture ? 'base64 image' : 'null' });

    // Vérifier si l'utilisateur existe
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        where: {
          email,
          id: { [Op.ne]: userId }
        }
      });

      if (existingUser) {
        return res.status(400).json({ message: "Cet email est déjà utilisé" });
      }
    }

    // Préparer les données de mise à jour
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (profilePicture !== undefined) {
      // Si profilePicture est null, on supprime la photo
      // Si c'est une string base64, on la met à jour
      updateData.profilePicture = profilePicture;
    }

    console.log("Données de mise à jour:", updateData);

    // Mettre à jour l'utilisateur
    await user.update(updateData);

    // Récupérer l'utilisateur mis à jour sans les champs sensibles
    const updatedUser = await User.findByPk(userId, {
      attributes: { 
        exclude: ['password', 'verificationToken', 'googleId'] 
      }
    });

    console.log("Profil mis à jour avec succès pour:", updatedUser.email);

    res.json({ 
      user: updatedUser, 
      message: "Profil mis à jour avec succès" 
    });
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({ 
      message: "Erreur serveur lors de la mise à jour du profil",
      error: error.message 
    });
  }
};

// ============================================================
// 🔹 CHANGER LE MOT DE PASSE
// ============================================================
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    console.log("Changement mot de passe pour user ID:", userId);

    // Validation des champs requis
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "Tous les champs sont requis" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Les mots de passe ne correspondent pas" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères" });
    }

    // Récupérer l'utilisateur
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérifier l'ancien mot de passe
    const isCurrentPasswordValid = await user.validatePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Mot de passe actuel incorrect" });
    }

    // Vérifier que le nouveau mot de passe est différent de l'ancien
    const isSamePassword = await user.validatePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({ message: "Le nouveau mot de passe doit être différent de l'ancien" });
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    console.log("Mot de passe changé avec succès pour:", user.email);

    res.json({ 
      message: "Mot de passe changé avec succès" 
    });
  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({ 
      message: "Erreur serveur lors du changement de mot de passe",
      error: error.message 
    });
  }
};

// ============================================================
// 🔹 UPLOAD/MODIFIER LA PHOTO DE PROFIL
// ============================================================
export const uploadProfilePicture = async (req, res) => {
  try {
    const { profilePicture } = req.body;
    const userId = req.user.id;

    console.log("Upload photo de profil pour user ID:", userId);

    if (!profilePicture) {
      return res.status(400).json({ message: "Image requise" });
    }

    // Valider que c'est bien une image base64
    if (!profilePicture.startsWith('data:image/')) {
      return res.status(400).json({ message: "Format d'image invalide. Utilisez une image base64." });
    }

    // Vérifier la taille de l'image (max 5MB en base64)
    const base64Size = Buffer.from(profilePicture.split(',')[1] || '', 'base64').length;
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (base64Size > maxSize) {
      return res.status(400).json({ message: "L'image ne doit pas dépasser 5MB" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Mettre à jour la photo de profil
    await user.update({ profilePicture });

    // Récupérer l'utilisateur mis à jour
    const updatedUser = await User.findByPk(userId, {
      attributes: { 
        exclude: ['password', 'verificationToken', 'googleId'] 
      }
    });

    console.log("Photo de profil mise à jour pour:", updatedUser.email);

    res.json({ 
      user: updatedUser, 
      message: "Photo de profil mise à jour avec succès" 
    });
  } catch (error) {
    console.error('Erreur upload photo de profil:', error);
    res.status(500).json({ 
      message: "Erreur serveur lors de l'upload de la photo",
      error: error.message 
    });
  }
};

// ============================================================
// 🔹 SUPPRIMER LA PHOTO DE PROFIL
// ============================================================
export const deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("Suppression photo de profil pour user ID:", userId);

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérifier si l'utilisateur a déjà une photo de profil
    if (!user.profilePicture) {
      return res.status(400).json({ message: "Aucune photo de profil à supprimer" });
    }

    // Supprimer la photo de profil
    await user.update({ profilePicture: null });

    // Récupérer l'utilisateur mis à jour
    const updatedUser = await User.findByPk(userId, {
      attributes: { 
        exclude: ['password', 'verificationToken', 'googleId'] 
      }
    });

    console.log("Photo de profil supprimée pour:", updatedUser.email);

    res.json({ 
      user: updatedUser,
      message: "Photo de profil supprimée avec succès" 
    });
  } catch (error) {
    console.error('Erreur suppression photo de profil:', error);
    res.status(500).json({ 
      message: "Erreur serveur lors de la suppression de la photo",
      error: error.message 
    });
  }
};

// ============================================================
// 🔹 RÉCUPÉRER LES STATISTIQUES DU COMPTE
// ============================================================
export const getAccountStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: { 
        exclude: ['password', 'verificationToken', 'googleId'] 
      },
      include: [
        {
          association: 'sites',
          attributes: ['id', 'name', 'status', 'createdAt']
        },
        {
          association: 'subscriptions',
          attributes: ['id', 'status', 'currentPeriodStart', 'currentPeriodEnd'],
          where: { status: 'active' },
          required: false
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const stats = {
      totalSites: user.sites ? user.sites.length : 0,
      activeSites: user.sites ? user.sites.filter(site => site.status === 'active').length : 0,
      hasActiveSubscription: user.subscriptions && user.subscriptions.length > 0,
      accountCreated: user.createdAt,
      isVerified: user.isVerified
    };

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      },
      stats,
      message: "Statistiques récupérées avec succès"
    });
  } catch (error) {
    console.error('Erreur récupération statistiques:', error);
    res.status(500).json({ 
      message: "Erreur serveur lors de la récupération des statistiques",
      error: error.message 
    });
  }
};

// ============================================================
// 🔹 VERIFIER LA DISPONIBILITÉ D'UN EMAIL
// ============================================================
export const checkEmailAvailability = async (req, res) => {
  try {
    const { email } = req.query;
    const userId = req.user.id;

    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }

    const existingUser = await User.findOne({
      where: {
        email,
        id: { [Op.ne]: userId }
      }
    });

    res.json({
      available: !existingUser,
      message: existingUser ? "Email déjà utilisé" : "Email disponible"
    });
  } catch (error) {
    console.error('Erreur vérification email:', error);
    res.status(500).json({ 
      message: "Erreur serveur lors de la vérification de l'email",
      error: error.message 
    });
  }
};

export default {
  getProfile,
  updateProfile,
  changePassword,
  uploadProfilePicture,
  deleteProfilePicture,
  getAccountStats,
  checkEmailAvailability
};