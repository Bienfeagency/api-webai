import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateArticles } from '../utils/generateArticle.js';
import WordPressService from '../services/wordpress.service.js';
import { setupDockerEnvironment, setupWordPressPluginsAndTheme } from '../helpers/wordpressHelpers.js';
import slugify from 'slugify';
import { generatePageContent } from '../utils/generatePageContent.js';

import { getAiModelForUser } from '../services/aiModel.service.js';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.BASE_URL_PRODUCTION 
  : process.env.BASE_URL || 'http://localhost:3000';

/**
 * Prépare un conteneur existant pour la réutilisation
 */
export async function prepareExistingContainer(wpContainer) {
  try {
    const inspectResult = await execAsync(`docker inspect ${wpContainer}`);
    const containerInfo = JSON.parse(inspectResult.stdout)[0];
    
    if (!containerInfo.State.Running) {
      console.log('🔄 Conteneur arrêté, redémarrage...');
      await execAsync(`docker start ${wpContainer}`);
    }
    
    console.log('⏳ Vérification que WordPress est accessible...');
    await WordPressService.waitForWordPress(wpContainer);
    
    await execAsync(`docker exec ${wpContainer} wp core is-installed --allow-root`);
    
    const portInfo = await execAsync(`docker port ${wpContainer}`);
    const portMatch = portInfo.stdout.match(/80\/tcp -> 0.0.0.0:(\d+)/);
    if (!portMatch) {
      throw new Error('Impossible de déterminer le port du conteneur');
    }
    
    const currentPort = parseInt(portMatch[1]);
    const SITE_URL = `${BASE_URL}:${currentPort}`;
    
    console.log('✅ Conteneur de preview prêt pour la génération finale');
    return { ready: true, port: currentPort, SITE_URL };
    
  } catch (error) {
    console.error('❌ Le conteneur de preview n\'est pas utilisable:', error.message);
    return { ready: false, error: error.message };
  }
}

/**
 * Configure le site final
 */
export async function configureFinalSite(wpContainer, siteUrl, adminEmail, adminPassword) {
  console.log('⏳ Configuration du site final...');
  
  await execAsync(`docker exec ${wpContainer} wp option update home "${siteUrl}" --allow-root`);
  await execAsync(`docker exec ${wpContainer} wp option update siteurl "${siteUrl}" --allow-root`);
  await execAsync(`docker exec ${wpContainer} wp user update 1 --user_pass="${adminPassword}" --user_email="${adminEmail}" --display_name="Administrator" --allow-root`);
  
  console.log('✅ Configuration WordPress mise à jour');
}

/**
 * Vérifie et applique les modifications du sandbox
 */
export async function checkAndApplySandbox(siteSlug, wpContainer, selectedTheme) {
  const SANDBOX_PATH = '/app/sandbox/' + siteSlug;
  
  try {
    await fs.access(SANDBOX_PATH);
    const files = await fs.readdir(SANDBOX_PATH);
    
    if (files.length > 0) {
      console.log('🎨 Application des modifications de l\'éditeur...');
      await applySavedModifications(wpContainer, SANDBOX_PATH, selectedTheme, siteSlug);
      return true;
    }
  } catch (error) {
    console.warn('❌ Erreur vérification sandbox:', error.message);
  }
  
  return false;
}

/**
 * Applique une structure IA enrichie avec contenu généré - VERSION DEBUG
 */
export async function applyAiStructureToContainer(wpContainer, structure, siteContext = {}) {
  console.log('🔍 [DEBUG applyAiStructureToContainer]', {
    wpContainer,
    pagesCount: structure.pages?.length,
    siteContextKeys: Object.keys(siteContext),
    hasUserId: !!siteContext.userId,
    userId: siteContext.userId,
    businessType: siteContext.businessType,
    siteName: siteContext.siteName
  });

  try {
    // Vérifier que le contexte est complet
    if (!siteContext.userId) {
      console.warn('⚠️ [DEBUG] ATTENTION: userId manquant dans siteContext!');
      console.log('🔍 [DEBUG] Contenu complet de siteContext:', siteContext);
    } else {
      console.log('✅ [DEBUG] userId présent:', siteContext.userId);
    }

    // Appliquer la structure avec le contexte
    const results = await WordPressService.applyStructure(wpContainer, structure, siteContext);
    
    console.log('✅ Structure IA appliquée avec succès');
    return results;
    
  } catch (structureError) {
    console.error('❌ [DEBUG] Erreur application structure IA:', structureError.message);
    console.error('❌ [DEBUG] Stack:', structureError.stack);
    throw structureError;
  }
}

/**
 * Détermine le type de page pour une génération de contenu plus précise
 */
function determinePageType(pageTitle, pageSlug) {
  const title = pageTitle.toLowerCase();
  const slug = pageSlug.toLowerCase();

  // Pages principales
  if (title.includes('accueil') || title.includes('home') || slug.includes('accueil') || slug.includes('home')) {
    return 'homepage';
  }
  if (title.includes('à propos') || title.includes('about') || title.includes('a propos') || slug.includes('a-propos') || slug.includes('about')) {
    return 'about';
  }
  if (title.includes('service') || slug.includes('service')) {
    return 'services';
  }
  if (title.includes('contact') || slug.includes('contact')) {
    return 'contact';
  }
  
  // Pages spécifiques aux business
  if (title.includes('menu') || slug.includes('menu')) {
    return 'menu';
  }
  if (title.includes('portfolio') || title.includes('galerie') || title.includes('gallery') || slug.includes('portfolio') || slug.includes('galerie')) {
    return 'portfolio';
  }
  if (title.includes('blog') || title.includes('actualité') || title.includes('news') || slug.includes('blog') || slug.includes('actualite')) {
    return 'blog';
  }
  if (title.includes('boutique') || title.includes('shop') || title.includes('store') || slug.includes('boutique') || slug.includes('shop')) {
    return 'shop';
  }
  if (title.includes('produit') || title.includes('product') || slug.includes('produit') || slug.includes('product')) {
    return 'products';
  }
  if (title.includes('tarif') || title.includes('price') || title.includes('pricing') || slug.includes('tarif') || slug.includes('price')) {
    return 'pricing';
  }
  if (title.includes('équipe') || title.includes('team') || slug.includes('equipe') || slug.includes('team')) {
    return 'team';
  }
  if (title.includes('témoignage') || title.includes('testimonial') || title.includes('avis') || slug.includes('temoignage') || slug.includes('testimonial')) {
    return 'testimonials';
  }
  
  return 'generic';
}

/**
 * Version simplifiée pour la rétrocompatibilité
 */
export async function applyAiStructureToContainerLegacy(wpContainer, structure) {
  console.log('🏗️ Application de la structure IA (mode legacy)...');
  try {
    const results = await WordPressService.applyStructure(wpContainer, structure);
    console.log('✅ Structure IA appliquée avec succès');
    return results;
  } catch (structureError) {
    console.warn('⚠️ Erreur application structure IA:', structureError.message);
    throw structureError;
  }
}
/**
 * Génère et crée les articles avec gestion des modèles IA - VERSION MODIFIÉE
 */
export async function generateAndCreateArticles(
  wpContainer, 
  numArticles, 
  articleTopic, 
  language, 
  userId = null,        // NOUVEAU: ID utilisateur pour récupérer le modèle
  aiModel = null        // NOUVEAU: Modèle IA spécifique (optionnel)
) {
  console.log(`📝 Génération de ${numArticles} articles sur "${articleTopic}"...`);
  
  try {
    let generatedArticles;
    
    // Déterminer le modèle IA à utiliser
    const modelToUse = await determineAiModelForArticles(userId, aiModel, {
      numArticles,
      articleTopic,
      language
    });

    // Générer les articles avec le modèle approprié
    generatedArticles = await generateArticles({
      numArticles,
      topic: articleTopic,
      language,
      aiModel: modelToUse,     // NOUVEAU: Passage du modèle
      userId                   // NOUVEAU: ID utilisateur pour le tracking
    });

    // Créer les articles dans WordPress
    await createArticlesInWordPress(wpContainer, generatedArticles);
    
    console.log(`✅ ${generatedArticles.length} articles créés avec ${modelToUse.name}`);

  } catch (genError) {
    console.error('❌ Erreur génération articles:', genError.message);
    
    // Fallback avec modèle basique
    await createFallbackArticles(wpContainer, numArticles, articleTopic, language);
  }
}

/**
 * Détermine le modèle IA à utiliser pour la génération d'articles
 */
async function determineAiModelForArticles(userId, providedAiModel, context) {
  // Si un modèle est fourni explicitement, l'utiliser
  if (providedAiModel) {
    console.log(`🎯 Utilisation du modèle fourni: ${providedAiModel.name}`);
    return providedAiModel;
  }

  // Si un userId est fourni, récupérer le modèle selon l'abonnement
  if (userId) {
    try {
      const userAiModel = await getAiModelForUser(userId, 'article');
      console.log(`🎯 Modèle utilisateur sélectionné: ${userAiModel.name}`);
      return userAiModel;
    } catch (error) {
      console.warn('⚠️ Erreur récupération modèle utilisateur, utilisation du modèle par défaut:', error.message);
    }
  }

  // Fallback vers un modèle par défaut
  const defaultModel = {
    id: 0,
    name: 'OpenAI GPT-3.5 Turbo',
    provider: 'openai',
    modelId: 'gpt-3.5-turbo',
    isDefault: true
  };
  
  console.log(`🔄 Utilisation du modèle par défaut: ${defaultModel.name}`);
  return defaultModel;
}

/**
 * Crée les articles dans WordPress - REFACTORISÉ
 */
async function createArticlesInWordPress(wpContainer, articles) {
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    
    try {
      console.log(`📄 Création de l'article: "${article.title}"`);
      
      const createResult = await execAsync(`
        docker exec ${wpContainer} wp post create \
          --post_type=post \
          --post_title="${escapeShellArg(article.title)}" \
          --post_status=publish \
          --post_content="${escapeShellArg(article.content)}" \
          --comment_status=open \
          --allow-root
      `);
      
      console.log(`✅ Article créé: ${createResult.stdout}`);
      
      // Mettre à jour l'excerpt si disponible
      if (article.excerpt) {
        await updatePostExcerpt(wpContainer, createResult.stdout, article.excerpt);
      }
      
    } catch (postError) {
      console.warn(`⚠️ Erreur création article ${i + 1}:`, postError.message);
      await createBasicArticle(wpContainer, article.title || `Article #${i + 1}`);
    }
  }
}

/**
 * Met à jour l'excerpt d'un article
 */
async function updatePostExcerpt(wpContainer, createResult, excerpt) {
  try {
    const postIdMatch = createResult.match(/Created post (\d+)/);
    if (postIdMatch) {
      await execAsync(`
        docker exec ${wpContainer} wp post update ${postIdMatch[1]} \
          --post_excerpt="${escapeShellArg(excerpt)}" \
          --allow-root
      `);
    }
  } catch (excerptError) {
    console.warn('⚠️ Erreur mise à jour excerpt:', excerptError.message);
  }
}

/**
 * Crée un article basique de fallback
 */
async function createBasicArticle(wpContainer, title) {
  try {
    await execAsync(`
      docker exec ${wpContainer} wp post create \
        --post_type=post \
        --post_title="${escapeShellArg(title)}" \
        --post_status=publish \
        --post_content="Contenu de l'article ${title}" \
        --allow-root
    `);
    console.log(`✅ Article basique créé: ${title}`);
  } catch (error) {
    console.warn(`❌ Échec création article basique ${title}:`, error.message);
  }
}

/**
 * Échappe les arguments pour la ligne de commande
 */
function escapeShellArg(arg) {
  if (!arg) return '';
  return arg.replace(/'/g, "'\\''").replace(/"/g, '\\"');
}

/**
 * Crée des articles de fallback
 */
export async function createFallbackArticles(wpContainer, numArticles, articleTopic, language) {
  console.log('🔄 Création d\'articles basiques...');
  for (let i = 1; i <= numArticles; i++) {
    const postTitle = language === 'fr_FR' 
      ? `${articleTopic} #${i}`
      : `${articleTopic} #${i}`;
    
    await createBasicArticle(wpContainer, postTitle);
  }
}

/**
 * Sauvegarde la configuration du site
 */
export async function saveSiteConfig(siteSlug, config) {
  try {
    const SITE_PATH = path.resolve(__dirname, '../../sites', siteSlug);
    await fs.mkdir(SITE_PATH, { recursive: true });
    
    const configPath = path.join(SITE_PATH, 'site-config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Configuration du site sauvegardée');
  } catch (error) {
    console.warn('⚠️ Erreur sauvegarde configuration:', error.message);
  }
}

/**
 * Nettoie les anciennes pages personnalisées
 */
export async function cleanupCustomHomePages(container) {
  try {
    console.log('🧹 Nettoyage des anciennes pages "Accueil Personnalisé"...');
    
    const customHomePages = await execAsync(`
      docker exec ${container} wp post list \
        --post_type=page \
        --post_status=any \
        --name="accueil-personnalise" \
        --field=ID \
        --format=ids \
        --allow-root
    `);

    const pageIds = customHomePages.stdout.trim();
    
    if (pageIds) {
      const ids = pageIds.split('\n').filter(id => id.trim());
      for (const id of ids) {
        await execAsync(`docker exec ${container} wp post delete ${id} --force --allow-root`);
        console.log(`🗑️ Page "Accueil Personnalisé" supprimée (ID: ${id})`);
      }
    }
    
    const currentHomePageId = await execAsync(`
      docker exec ${container} wp option get page_on_front --allow-root
    `).catch(() => '');

    if (currentHomePageId.stdout && pageIds.includes(currentHomePageId.stdout.trim())) {
      await execAsync(`docker exec ${container} wp option update show_on_front posts --allow-root`);
      console.log('✅ Page d\'accueil réinitialisée');
    }
    
  } catch (error) {
    console.warn('⚠ Erreur lors du nettoyage des pages personnalisées:', error.message);
  }
}

// Fonction temporaire - à implémenter si nécessaire
export async function applySavedModifications(wpContainer, sandboxPath, selectedTheme, siteSlug) {
  console.log('🔧 Application des modifications sauvegardées...');
  // Implémentation à compléter selon les besoins
}

/**
 * Crée un nouveau site from scratch (sans preview)
 */
export async function createNewSiteContainer({ siteSlug, siteName, selectedTheme, adminEmail, adminPassword, language }) {
  const networkName = `${siteSlug}_network`;
  const dbContainer = `${siteSlug}_db`;
  const wpContainer = `${siteSlug}_wp`;
  const sandboxDir = `/app/sandbox/${siteSlug}`;

  console.log('🏗️ Création d\'un nouveau site from scratch...');

  try {
    // Créer le dossier sandbox
    await fs.mkdir(sandboxDir, { recursive: true });

    // Setup Docker environment
    const wpPort = await setupDockerEnvironment({
      siteSlug,
      networkName,
      dbContainer,
      wpContainer,
      dbName: `${siteSlug}_db`,
      dbUser: 'root',
      dbPass: 'root',
      sandboxDir,
      siteName,
      language
    });

    // Configurer WordPress avec les vrais identifiants admin
    await configureNewWordPressSite(wpContainer, siteName, adminEmail, adminPassword, language, wpPort);

    // Installer et activer le thème
    await setupWordPressPluginsAndTheme(wpContainer, dbContainer, selectedTheme);

    const SITE_URL = `${BASE_URL}:${wpPort}`;
    
    console.log('✅ Nouveau site créé avec succès');
    
    return {
      ready: true,
      port: wpPort,
      SITE_URL
    };

  } catch (error) {
    console.error('❌ Erreur création nouveau site:', error);
    throw error;
  }
}

/**
 * Configure un nouveau site WordPress avec les vrais identifiants
 */
export async function configureNewWordPressSite(wpContainer, siteName, adminEmail, adminPassword, language, wpPort) {
  const siteUrl = `${BASE_URL}:${wpPort}`;
  const siteSlug = slugify(siteName, { lower: true, strict: true, trim: true });
  
  
  console.log('🔨 Configuration WordPress avec identifiants réels...');

  // Attendre que WordPress soit prêt
  await WordPressService.waitForWordPress(wpContainer);

  // Créer la configuration WordPress
  await execAsync(`
    docker exec ${wpContainer} wp config create \
      --dbname=${siteSlug}_db \
      --dbuser=root \
      --dbpass=root \
      --dbhost=${siteSlug}_db \
      --locale=${language} \
      --force \
      --allow-root
  `);

  // Installer WordPress avec les vrais identifiants
  await execAsync(`
    docker exec ${wpContainer} wp core install \
      --url="${siteUrl}" \
      --title="${siteName}" \
      --admin_user="${adminEmail.split('@')[0]}" \
      --admin_password="${adminPassword}" \
      --admin_email="${adminEmail}" \
      --locale=${language} \
      --allow-root
  `);

  // Configurer les permaliens
  await execAsync(`docker exec ${wpContainer} wp rewrite structure '/%postname%/' --allow-root`);

  console.log('✅ WordPress configuré avec identifiants réels');
}

/**
 * Met à jour les identifiants admin seulement
 */
export async function updateAdminCredentials(wpContainer, adminEmail, adminPassword) {
  console.log('🔧 Mise à jour des identifiants admin...');
  
  try {
    await execAsync(`docker exec ${wpContainer} wp user update 1 --user_email="${adminEmail}" --display_name="Administrator" --allow-root`);
    
    if (adminPassword) {
      await execAsync(`docker exec ${wpContainer} wp user update 1 --user_pass="${adminPassword}" --allow-root`);
    }
    
    console.log('✅ Identifiants admin mis à jour');
  } catch (error) {
    console.warn('⚠ Erreur mise à jour identifiants:', error.message);
  }
}