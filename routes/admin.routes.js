// routes/adminRoutes.js
import { Router } from "express";
import User from "../models/user.js";
import { Op } from "sequelize";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

// ============================================================
// 🔹 ROUTES PROFIL ADMINISTRATEUR
// ============================================================

// Récupérer le profil de l'admin connecté
router.get("/profile", requireAdmin, async (req, res) => {
  try {
    console.log("Récupération profil admin pour ID:", req.user.id);
    
    const admin = await User.findByPk(req.user.id, {
      attributes: { 
        exclude: ['password', 'verificationToken', 'googleId'] 
      }
    });

    console.log("Admin récupéré:", admin ? `${admin.name} (${admin.email})` : 'Non trouvé');

    if (!admin) {
      return res.status(404).json({ message: "Administrateur non trouvé" });
    }

    // Vérifier que c'est bien un admin
    if (admin.role !== 'admin') {
      return res.status(403).json({ message: "Accès réservé aux administrateurs" });
    }

    res.json({ 
      admin,
      message: "Profil administrateur récupéré avec succès"
    });
  } catch (error) {
    console.error('Erreur récupération profil admin:', error);
    res.status(500).json({ 
      message: "Erreur serveur lors de la récupération du profil administrateur",
      error: error.message 
    });
  }
});

// Mettre à jour le profil admin
router.put("/profile", requireAdmin, async (req, res) => {
  try {
    const { name, email, profilePicture } = req.body;
    const adminId = req.user.id;

    console.log("Mise à jour profil admin pour ID:", adminId, "Données:", { name, email, profilePicture: profilePicture ? 'base64 image' : 'null' });

    // Vérifier si l'admin existe
    const admin = await User.findByPk(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Administrateur non trouvé" });
    }

    // Vérifier que c'est bien un admin
    if (admin.role !== 'admin') {
      return res.status(403).json({ message: "Accès réservé aux administrateurs" });
    }

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email && email !== admin.email) {
      const existingUser = await User.findOne({
        where: {
          email,
          id: { [Op.ne]: adminId }
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
      updateData.profilePicture = profilePicture;
    }

    console.log("Données de mise à jour admin:", updateData);

    // Mettre à jour l'admin
    await admin.update(updateData);

    // Récupérer l'admin mis à jour sans les champs sensibles
    const updatedAdmin = await User.findByPk(adminId, {
      attributes: { 
        exclude: ['password', 'verificationToken', 'googleId'] 
      }
    });

    console.log("Profil admin mis à jour avec succès pour:", updatedAdmin.email);

    res.json({ 
      admin: updatedAdmin, 
      message: "Profil administrateur mis à jour avec succès" 
    });
  } catch (error) {
    console.error('Erreur mise à jour profil admin:', error);
    res.status(500).json({ 
      message: "Erreur serveur lors de la mise à jour du profil administrateur",
      error: error.message 
    });
  }
});

// Changer le mot de passe admin
router.put("/change-password", requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const adminId = req.user.id;

    console.log("Changement mot de passe admin pour ID:", adminId);

    // Validation des champs requis
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "Tous les champs sont requis" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Les mots de passe ne correspondent pas" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères" });
    }

    // Récupérer l'admin
    const admin = await User.findByPk(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Administrateur non trouvé" });
    }

    // Vérifier que c'est bien un admin
    if (admin.role !== 'admin') {
      return res.status(403).json({ message: "Accès réservé aux administrateurs" });
    }

    // Vérifier l'ancien mot de passe
    const isCurrentPasswordValid = await admin.validatePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Mot de passe actuel incorrect" });
    }

    // Vérifier que le nouveau mot de passe est différent de l'ancien
    const isSamePassword = await admin.validatePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({ message: "Le nouveau mot de passe doit être différent de l'ancien" });
    }

    // Mettre à jour le mot de passe
    admin.password = newPassword;
    await admin.save();

    console.log("Mot de passe admin changé avec succès pour:", admin.email);

    res.json({ 
      message: "Mot de passe administrateur changé avec succès" 
    });
  } catch (error) {
    console.error('Erreur changement mot de passe admin:', error);
    res.status(500).json({ 
      message: "Erreur serveur lors du changement de mot de passe administrateur",
      error: error.message 
    });
  }
});

// Upload/Modifier la photo de profil admin
router.put("/profile/picture", requireAdmin, async (req, res) => {
  try {
    const { profilePicture } = req.body;
    const adminId = req.user.id;

    console.log("Upload photo de profil admin pour ID:", adminId);

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

    const admin = await User.findByPk(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Administrateur non trouvé" });
    }

    // Vérifier que c'est bien un admin
    if (admin.role !== 'admin') {
      return res.status(403).json({ message: "Accès réservé aux administrateurs" });
    }

    // Mettre à jour la photo de profil
    await admin.update({ profilePicture });

    // Récupérer l'admin mis à jour
    const updatedAdmin = await User.findByPk(adminId, {
      attributes: { 
        exclude: ['password', 'verificationToken', 'googleId'] 
      }
    });

    console.log("Photo de profil admin mise à jour pour:", updatedAdmin.email);

    res.json({ 
      admin: updatedAdmin, 
      message: "Photo de profil administrateur mise à jour avec succès" 
    });
  } catch (error) {
    console.error('Erreur upload photo de profil admin:', error);
    res.status(500).json({ 
      message: "Erreur serveur lors de l'upload de la photo administrateur",
      error: error.message 
    });
  }
});

// Supprimer la photo de profil admin
router.delete("/profile/picture", requireAdmin, async (req, res) => {
  try {
    const adminId = req.user.id;

    console.log("Suppression photo de profil admin pour ID:", adminId);

    const admin = await User.findByPk(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Administrateur non trouvé" });
    }

    // Vérifier que c'est bien un admin
    if (admin.role !== 'admin') {
      return res.status(403).json({ message: "Accès réservé aux administrateurs" });
    }

    // Vérifier si l'admin a déjà une photo de profil
    if (!admin.profilePicture) {
      return res.status(400).json({ message: "Aucune photo de profil à supprimer" });
    }

    // Supprimer la photo de profil
    await admin.update({ profilePicture: null });

    // Récupérer l'admin mis à jour
    const updatedAdmin = await User.findByPk(adminId, {
      attributes: { 
        exclude: ['password', 'verificationToken', 'googleId'] 
      }
    });

    console.log("Photo de profil admin supprimée pour:", updatedAdmin.email);

    res.json({ 
      admin: updatedAdmin,
      message: "Photo de profil administrateur supprimée avec succès" 
    });
  } catch (error) {
    console.error('Erreur suppression photo de profil admin:', error);
    res.status(500).json({ 
      message: "Erreur serveur lors de la suppression de la photo administrateur",
      error: error.message 
    });
  }
});

export default router;