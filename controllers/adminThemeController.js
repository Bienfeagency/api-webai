// controllers/admin/adminThemesController.js
import Theme from "../models/theme.js";
import { ThemeService } from "../services/theme.service.js";
import SystemLog from "../models/systemLog.js";
import { Op } from "sequelize";

export const getAllThemes = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "",
      category = "",
      isPremium = "",
      isFeatured = "",
      sortBy = "downloadCount",
      sortOrder = "DESC"
    } = req.query;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      category,
      isPremium: isPremium !== "" ? isPremium === "true" : null,
      isFeatured: isFeatured !== "" ? isFeatured === "true" : null,
      sortBy,
      sortOrder
    };
    
    const result = await ThemeService.getThemes(options);
    
    res.json(result);
    
  } catch (error) {
    console.error("Erreur récupération thèmes:", error);
    res.status(500).json({ message: "Erreur lors de la récupération des thèmes" });
  }
};

export const getThemeById = async (req, res) => {
  try {
    const theme = await Theme.findByPk(req.params.id);
    
    if (!theme) {
      return res.status(404).json({ message: "Thème non trouvé" });
    }
    
    res.json(theme);
    
  } catch (error) {
    console.error("Erreur récupération thème:", error);
    res.status(500).json({ message: "Erreur lors de la récupération du thème" });
  }
};

export const createTheme = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      category,
      version = "1.0.0",
      isPremium = false,
      premiumTier = "basic",
      price = 0,
      downloadUrl,
      previewImage,
      demoUrl,
      features = [],
      compatibility = {},
      requirements = {},
      isFeatured = false,
      sortOrder = 0
    } = req.body;
    
    // Validation
    if (!name || !slug) {
      return res.status(400).json({ message: "Le nom et le slug sont obligatoires" });
    }
    
    // Vérifier si le slug existe déjà
    const existingTheme = await Theme.findOne({ where: { slug } });
    if (existingTheme) {
      return res.status(400).json({ message: "Un thème avec ce slug existe déjà" });
    }
    
    const theme = await Theme.create({
      name,
      slug,
      description,
      category,
      version,
      isPremium,
      premiumTier,
      price,
      downloadUrl,
      previewImage,
      demoUrl,
      features,
      compatibility,
      requirements,
      isFeatured,
      sortOrder,
      releaseDate: new Date(),
      lastUpdated: new Date()
    });
    
    // Logger l'action
    await SystemLog.create({
      level: 'info',
      module: 'themes',
      action: 'create',
      message: `Thème créé: ${name}`,
      userId: req.user.id,
      metadata: { themeId: theme.id, isPremium }
    });
    
    res.status(201).json({ 
      message: "Thème créé avec succès", 
      theme 
    });
    
  } catch (error) {
    console.error("Erreur création thème:", error);
    res.status(500).json({ message: "Erreur lors de la création du thème" });
  }
};

export const updateTheme = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const theme = await Theme.findByPk(id);
    if (!theme) {
      return res.status(404).json({ message: "Thème non trouvé" });
    }
    
    // Mettre à jour la date de modification
    updateData.lastUpdated = new Date();
    
    await theme.update(updateData);
    
    // Logger l'action
    await SystemLog.create({
      level: 'info',
      module: 'themes',
      action: 'update',
      message: `Thème mis à jour: ${theme.name}`,
      userId: req.user.id,
      metadata: { themeId: theme.id, updatedFields: Object.keys(updateData) }
    });
    
    res.json({ 
      message: "Thème mis à jour avec succès", 
      theme 
    });
    
  } catch (error) {
    console.error("Erreur mise à jour thème:", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour du thème" });
  }
};

export const toggleThemeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { field } = req.body; // 'isActive' ou 'isFeatured'
    
    const theme = await Theme.findByPk(id);
    if (!theme) {
      return res.status(404).json({ message: "Thème non trouvé" });
    }
    
    const validFields = ['isActive', 'isFeatured'];
    if (!validFields.includes(field)) {
      return res.status(400).json({ message: "Champ invalide" });
    }
    
    const newValue = !theme[field];
    await theme.update({ 
      [field]: newValue,
      lastUpdated: new Date()
    });
    
    // Logger l'action
    await SystemLog.create({
      level: 'info',
      module: 'themes',
      action: 'toggle-status',
      message: `Statut ${field} modifié pour: ${theme.name}`,
      userId: req.user.id,
      metadata: { themeId: theme.id, field, newValue }
    });
    
    res.json({ 
      message: `Thème ${newValue ? 'activé' : 'désactivé'} avec succès`,
      theme 
    });
    
  } catch (error) {
    console.error("Erreur changement statut thème:", error);
    res.status(500).json({ message: "Erreur lors du changement de statut du thème" });
  }
};

export const deleteTheme = async (req, res) => {
  try {
    const { id } = req.params;
    
    const theme = await Theme.findByPk(id);
    if (!theme) {
      return res.status(404).json({ message: "Thème non trouvé" });
    }
    
    const themeName = theme.name;
    await theme.destroy();
    
    // Logger l'action
    await SystemLog.create({
      level: 'warning',
      module: 'themes',
      action: 'delete',
      message: `Thème supprimé: ${themeName}`,
      userId: req.user.id,
      metadata: { themeId: id }
    });
    
    res.json({ message: "Thème supprimé avec succès" });
    
  } catch (error) {
    console.error("Erreur suppression thème:", error);
    res.status(500).json({ message: "Erreur lors de la suppression du thème" });
  }
};

export const getThemeStats = async (req, res) => {
  try {
    const stats = await ThemeService.getThemeStats();
    res.json(stats);
    
  } catch (error) {
    console.error("Erreur stats thèmes:", error);
    res.status(500).json({ message: "Erreur lors de la récupération des statistiques" });
  }
};

export const initializeThemes = async (req, res) => {
  try {
    await ThemeService.initializeDefaultThemes();
    
    // Logger l'action
    await SystemLog.create({
      level: 'info',
      module: 'themes',
      action: 'initialize',
      message: 'Thèmes par défaut initialisés',
      userId: req.user.id
    });
    
    res.json({ message: "Thèmes par défaut initialisés avec succès" });
    
  } catch (error) {
    console.error("Erreur initialisation thèmes:", error);
    res.status(500).json({ message: "Erreur lors de l'initialisation des thèmes" });
  }
};