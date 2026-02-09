import Theme from '../models/theme.js';
import { ThemeMetricsService } from '../services/themeMetricsService.js';
import { updateUsageCounters } from '../utils/usageCounters.js';

/**
 * Met à jour les métriques du thème
 */
export async function updateThemeMetrics(selectedTheme) {
  try {
    console.log(`📊 Mise à jour métriques thème preview: ${selectedTheme}`);
    
    let themeId = selectedTheme;
    if (isNaN(selectedTheme)) {
      const theme = await Theme.findOne({ where: { slug: selectedTheme } });
      if (theme) {
        themeId = theme.id;
      }
    }
    
    if (themeId && !isNaN(themeId)) {
      await ThemeMetricsService.incrementUsage(themeId);
      console.log(`✅ Métriques preview mises à jour pour thème ID: ${themeId}`);
    }
  } catch (metricsError) {
    console.warn('⚠️ Erreur métriques thème preview:', metricsError.message);
  }
}

/**
 * Met à jour les métriques du thème et l'usage
 */
export async function updateThemeMetricsAndUsage(selectedTheme, userId, usageData) {
  try {
    console.log(`📊 Mise à jour des métriques pour le thème: ${selectedTheme}`);
    
    let themeId = selectedTheme;
    if (isNaN(selectedTheme)) {
      const theme = await Theme.findOne({ where: { slug: selectedTheme } });
      if (theme) {
        themeId = theme.id;
        console.log(`🔍 Thème trouvé: ${theme.name} (ID: ${themeId})`);
      } else {
        console.warn(`⚠️ Thème non trouvé avec le slug: ${selectedTheme}`);
        return;
      }
    }
    
    if (themeId && !isNaN(themeId)) {
      await ThemeMetricsService.incrementUsage(themeId);
      await ThemeMetricsService.updateLastUsed(themeId);
      console.log(`✅ Métriques mises à jour pour le thème ID: ${themeId}`);
    }
  } catch (metricsError) {
    console.warn('⚠️ Erreur mise à jour métriques thème:', metricsError.message);
  }

  // Mise à jour des compteurs d'usage
  try {
    await updateUsageCounters(userId, usageData);
  } catch (usageError) {
    console.warn('⚠️ Erreur mise à jour compteurs:', usageError.message);
  }
}

/**
 * Valide les données de génération de site avec gestion des conteneurs manquants
 */
export function validateSiteGenerationData(userSubscription, subscriptionPlan, siteName, adminEmail, adminPassword, numArticles) {
  if (!userSubscription) {
    throw new Error('Abonnement non trouvé. Veuillez souscrire à un plan.');
  }

  if(subscriptionPlan.aiGenerations !== -1) {
    if (numArticles > subscriptionPlan.aiGenerations) {
      throw new Error('Trop d\'articles demandés');
    }
  }

  if (!siteName || !adminEmail || !adminPassword) {
    throw new Error('Champs obligatoires manquants');
  }

  // Validation email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(adminEmail)) {
    throw new Error('Email administrateur invalide');
  }

  // Validation mot de passe
  if (adminPassword.length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caractères');
  }
}