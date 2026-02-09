import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import { generatePageContent } from '../utils/generatePageContent.js';
import { ContentTemplateService } from './contentTemplate.service.js';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const BASE_URL = isProduction ? process.env.BASE_URL_PRODUCTION : process.env.BASE_URL || 'http://localhost';

export class WordPressService {
/**
 * Convertit les blocs en_US contenu WordPress avec gestion d'erreurs robuste
 */
static convertBlocksToContent(blocks) {
  // ✅ CORRECTION: Validation d'entrée robuste
  if (!blocks || !Array.isArray(blocks)) {
    console.warn('⚠️ Blocs invalides, utilisation de blocs par défaut');
    blocks = [{
      type: 'paragraph',
      content: 'Contenu de la page',
      attributes: {}
    }];
  }

  if (blocks.length === 0) {
    console.warn('⚠️ Aucun bloc, utilisation de blocs par défaut');
    blocks = [{
      type: 'paragraph', 
      content: 'Contenu de la page',
      attributes: {}
    }];
  }

  console.log(`🔧 Conversion de ${blocks.length} blocs en_US contenu WordPress...`);
  
  let content = '';
  
  blocks.forEach((block, index) => {
    try {
      // ✅ CORRECTION: Validation de chaque bloc
      const safeBlock = {
        type: block.type || 'paragraph',
        content: block.content || '',
        attributes: block.attributes || {}
      };

      switch (safeBlock.type) {
        case 'hero':
          content += `<!-- wp:cover {"url":"","dimRatio":50,"align":"full"} -->
          <div class="wp-block-cover alignfull"><span aria-hidden="true" class="wp-block-cover__background has-background-dim"></span>
          <div class="wp-block-cover__inner-container"><!-- wp:heading {"level":1} -->
          <h1>${safeBlock.content}</h1>
          <!-- /wp:heading -->
          <!-- wp:paragraph -->
          <p>${safeBlock.attributes?.subtitle || ''}</p>
          <!-- /wp:paragraph --></div></div>
          <!-- /wp:cover -->`;
          break;
          
        case 'heading':
          const level = safeBlock.attributes?.level || 2;
          content += `<!-- wp:heading {"level":${level}} -->
          <h${level}>${safeBlock.content}</h${level}>
          <!-- /wp:heading -->`;
          break;
          
        case 'paragraph':
          content += `<!-- wp:paragraph -->
          <p>${safeBlock.content}</p>
          <!-- /wp:paragraph -->`;
          break;
          
        case 'features':
          const items = safeBlock.attributes?.items || [];
          const itemsHtml = Array.isArray(items) 
            ? items.map(item => `<li>${item}</li>`).join('')
            : `<li>${items}</li>`;
          content += `<!-- wp:list -->
          <ul>${itemsHtml}</ul>
          <!-- /wp:list -->`;
          break;
          
        case 'cta':
          content += `<!-- wp:buttons -->
          <div class="wp-block-buttons"><!-- wp:button -->
          <div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${safeBlock.attributes?.buttonLink || '#'}">${safeBlock.content}</a></div>
          <!-- /wp:button --></div>
          <!-- /wp:buttons -->`;
          break;
        
        case 'image':
          const imageUrl = safeBlock.attributes?.url || '';
          const imageAlt = safeBlock.attributes?.alt || safeBlock.content;
          const imageCaption = safeBlock.attributes?.caption || '';
          const alignment = safeBlock.attributes?.alignment || 'center';
          
          content += `<!-- wp:image {"align":"${alignment}"} -->
          <figure class="wp-block-image align${alignment}"><img src="${imageUrl}" alt="${imageAlt}"/>
          ${imageCaption ? `<figcaption>${imageCaption}</figcaption>` : ''}
          </figure>
          <!-- /wp:image -->`;
          break;
          
        case 'gallery':
          const images = safeBlock.attributes?.images || [];
          if (images.length > 0) {
            content += `<!-- wp:gallery {"linkTo":"none"} -->
            <figure class="wp-block-gallery has-nested-images columns-3 is-cropped">`;
            
            images.forEach(img => {
              content += `<!-- wp:image {"id":${img.id || 'null'},"sizeSlug":"large","linkDestination":"none"} -->
              <figure class="wp-block-image size-large"><img src="${img.url}" alt="${img.alt || ''}"/></figure>
              <!-- /wp:image -->`;
            });
            
            content += `</figure>
            <!-- /wp:gallery -->`;
          }
          break;
        default:
          content += `<!-- wp:paragraph -->
          <p>${safeBlock.content}</p>
          <!-- /wp:paragraph -->`;
      }
      
      console.log(`✅ Bloc ${index + 1} converti: ${safeBlock.type}`);
      
    } catch (blockError) {
      console.warn(`⚠️ Erreur conversion bloc ${index + 1}, utilisation du fallback:`, blockError.message);
      // Bloc de fallback
      content += `<!-- wp:paragraph -->
      <p>Contenu du bloc</p>
      <!-- /wp:paragraph -->`;
    }
  });
  
  console.log(`✅ Conversion terminée: ${content.length} caractères générés`);
  return content;
}

/**
 * Applique une structure complète au conteneur WordPress
 */
static async applyStructure(container, structure, siteContext = {}) {

  if (!siteContext.userId) {
    throw new Error('userId requis pour la génération de contenu IA');
  }

  console.log('🔨 Application de la structure au conteneur...');
  
  const results = {
    pages: [],
    menu: false
  };

  try {
    console.log(`📄 Création de ${structure.pages?.length || 0} pages avec contenu IA...`);
    
    if (!structure.pages || !Array.isArray(structure.pages)) {
      throw new Error('Structure de pages invalide');
    }

    for (const page of structure.pages) {
      try {
        console.log(`🔧 Création de la page: ${page.title}`);
          
        // GÉNÉRER LE CONTENU IA POUR CETTE PAGE
        let pageBlocks;
        if (Object.keys(siteContext).length > 0) {
          console.log(`🤖 Génération contenu IA pour: ${page.title}`);
          const enrichedContent = await this.generateEnrichedPageContent(page, siteContext);
          
          // ✅ CORRECTION: Validation EXTRA robuste
          pageBlocks = enrichedContent?.content?.blocks || enrichedContent?.blocks || page.content?.blocks || [];
          
          console.log(`🔍 DEBUG pageBlocks pour ${page.title}:`, {
            hasEnrichedContent: !!enrichedContent,
            hasContentBlocks: !!(enrichedContent?.content?.blocks),
            hasDirectBlocks: !!(enrichedContent?.blocks),
            hasPageBlocks: !!(page.content?.blocks),
            finalBlocksLength: pageBlocks.length,
            finalBlocks: pageBlocks.slice(0, 2) // Afficher les 2 premiers pour debug
          });
        } else {
          console.log(`📝 Utilisation contenu existant pour: ${page.title}`);
          pageBlocks = page.content?.blocks || [];
        }

        // ✅ CORRECTION: Validation FINALE obligatoire
        const validatedBlocks = this.validatePageBlocks(
          pageBlocks, 
          page.title, 
          siteContext.businessType || 'Général', 
          siteContext.language || 'fr_FR'
        );

        console.log(`📋 ${validatedBlocks.length} blocs validés pour ${page.title}`);
        
        // ✅ CORRECTION: Vérifier qu'on a au moins un bloc
        if (validatedBlocks.length === 0) {
          console.warn(`⚠️ Aucun bloc pour ${page.title}, création d'un bloc par défaut`);
          validatedBlocks.push({
            type: 'paragraph',
            content: `Bienvenue sur la page ${page.title}`,
            attributes: {}
          });
        }

        const pageContent = this.convertBlocksToContent(validatedBlocks);
        
        console.log(`📝 Création de la page WordPress: ${page.title}...`);
                
        const pageCreateCmd = `
          docker exec ${container} wp post create \
          --post_type=page \
          --post_title="${page.title}" \
          --post_name="${page.slug}" \
          --post_status=publish \
          --post_content="${pageContent.replace(/"/g, '\\"')}" \
          --allow-root
        `;
        
        const pageResult = await execAsync(pageCreateCmd);
        const pageIdMatch = pageResult.stdout.match(/Created post (\d+)/);
        
        if (pageIdMatch) {
          const pageId = pageIdMatch[1];
          results.pages.push({
            page: page.title,
            status: 'success',
            id: pageId,
            contentGenerated: Object.keys(siteContext).length > 0
          });
          console.log(`✅ Page créée avec succès: ${page.title} (ID: ${pageId})`);
        } else {
          throw new Error('ID de page non trouvé dans: ' + pageResult.stdout);
        }
      } catch (error) {
        console.error(`❌ Erreur création page ${page.title}:`, error.message);
        results.pages.push({
          page: page.title, 
          status: 'error',
          error: error.message
        });
      }
    }

    // 2. CONFIGURER LE MENU - AVEC GESTION D'ERREURS AMÉLIORÉE
    if (structure.menu && Array.isArray(structure.menu)) {
      try {
        // ✅ Attendre que les pages soient bien créées
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await this.setupMenu(container, structure.menu, structure.pages);
        results.menu = true;
        console.log('✅ Menu WordPress configuré');
      } catch (menuError) {
        console.warn('⚠ Erreur configuration menu:', menuError.message);
        results.menuError = menuError.message;
        
        // ✅ Fallback: essayer de créer un menu basique
        try {
          console.log('🔄 Tentative de création menu basique...');
          await this.setupBasicMenu(container, structure.pages);
          results.menu = true;
          console.log('✅ Menu basique créé');
        } catch (fallbackError) {
          console.warn('⚠️ Échec menu basique:', fallbackError.message);
        }
      }
    }

    // 3. NETTOYER LE CACHE
    await this.flushCache(container);

    return results;

  } catch (error) {
    console.error('❌ Erreur application structure:', error);
    throw error;
  }
}
/**
 * Génère du contenu enrichi par IA pour une page spécifique - VERSION CORRIGÉE
 */
static async generateEnrichedPageContent(page, siteContext = {}) {
  const { 
    siteName, 
    businessType, 
    language, 
    targetAudience, 
    stylePreference,
    userId // ⬅️ ID utilisateur obligatoire maintenant
  } = siteContext;
  
  if (!userId) {
    console.warn('⚠️ Aucun userId fourni, utilisation du fallback');
    return {
      title: page.title,
      slug: page.slug,
      content: {
        blocks: this.getFallbackBlocks(page.title, businessType, language, siteName)
      }
    };
  }
  
  try {
    console.log(`🤖 Génération contenu IA pour: ${page.title}`, {
      businessType,
      userId
    });

    const pageType = this.determinePageType(page.title, page.slug);
    
    const aiContent = await generatePageContent({
      pageTitle: page.title,
      pageType: pageType,
      businessType: businessType,
      language: language,
      targetAudience: targetAudience,
      siteName: siteName,
      stylePreference: stylePreference,
      userId: userId, // ⬅️ PASSER L'USER_ID
      generationType: 'content',
      existingBlocks: page.content?.blocks || []
    });

    console.log(`✅ ${aiContent.blocks?.length || 0} blocs générés pour ${page.title}`);
    
    return {
      title: page.title,
      slug: page.slug, 
      content: {
        blocks: aiContent.blocks || this.getFallbackBlocks(page.title, businessType, language, siteName)
      }
    };

  } catch (error) {
    console.warn(`⚠️ Erreur génération IA pour ${page.title}:`, error.message);
    
    // Fallback si l'IA échoue
    return {
      title: page.title,
      slug: page.slug,
      content: {
        blocks: this.getFallbackBlocks(page.title, businessType, language, siteName)
      }
    };
  }
}
  
  /**
   * Détermine le type de page pour une génération de contenu plus précise
   */
  static determinePageType(pageTitle, pageSlug) {
    const title = pageTitle.toLowerCase();
    const slug = pageSlug.toLowerCase();

    if (title.includes('accueil') || title.includes('home') || slug.includes('accueil') || slug.includes('home')) {
      return 'homepage';
    }
    if (title.includes('à propos') || title.includes('about') || slug.includes('a-propos') || slug.includes('about')) {
      return 'about';
    }
    if (title.includes('service') || slug.includes('service')) {
      return 'services';
    }
    if (title.includes('contact') || slug.includes('contact')) {
      return 'contact';
    }
    if (title.includes('menu') || slug.includes('menu')) {
      return 'menu';
    }
    if (title.includes('portfolio') || title.includes('galerie') || slug.includes('portfolio') || slug.includes('galerie')) {
      return 'portfolio';
    }
    if (title.includes('blog') || title.includes('actualité') || slug.includes('blog') || slug.includes('actualite')) {
      return 'blog';
    }
    
    return 'generic';
  }

  
  /**
   * Blocs de fallback si l'IA échoue
   */
  static getFallbackBlocks(pageTitle, businessType, language) {
    const pageType = this.determinePageType(pageTitle, '');
    
    const fallbackContent = {
      fr_FR: {
        homepage: [
          {
            type: 'hero',
            content: `Bienvenue chez ${businessType}`,
            attributes: {
              subtitle: `Découvrez l'excellence de nos services ${businessType.toLowerCase()}`,
              buttonText: 'Nous contacter',
              buttonLink: '/contact'
            }
          },
          {
            type: 'heading',
            content: 'Nos engagements',
            attributes: { level: 2 }
          },
          {
            type: 'paragraph',
            content: `Notre entreprise ${businessType} s'engage à vous offrir des services de qualité, adaptés à vos besoins spécifiques.`
          }
        ],
        about: [
          {
            type: 'heading',
            content: `À propos de notre ${businessType}`,
            attributes: { level: 1 }
          },
          {
            type: 'paragraph',
            content: `Forte de son expérience, notre entreprise ${businessType} a su se bâtir une réputation d'excellence grâce à son savoir-faire unique et son engagement envers la satisfaction client.`
          }
        ],
        services: [
          {
            type: 'heading',
            content: 'Nos services professionnels',
            attributes: { level: 1 }
          },
          {
            type: 'paragraph',
            content: `Découvrez notre gamme complète de services ${businessType.toLowerCase()} conçus pour répondre à toutes vos attentes.`
          }
        ]
      },
      en_US: {
        homepage: [
          {
            type: 'hero',
            content: `Welcome to ${businessType}`,
            attributes: {
              subtitle: `Discover the excellence of our ${businessType.toLowerCase()} services`,
              buttonText: 'Contact Us',
              buttonLink: '/contact'
            }
          },
          {
            type: 'heading',
            content: 'Our Commitments',
            attributes: { level: 2 }
          },
          {
            type: 'paragraph',
            content: `Our ${businessType} company is committed to providing you with quality services tailored to your specific needs.`
          }
        ],
        about: [
          {
            type: 'heading',
            content: `About Our ${businessType}`,
            attributes: { level: 1 }
          },
          {
            type: 'paragraph',
            content: `With our experience, our ${businessType} company has built a reputation for excellence through our unique expertise and commitment to customer satisfaction.`
          }
        ],
        services: [
          {
            type: 'heading',
            content: 'Our Professional Services',
            attributes: { level: 1 }
          },
          {
            type: 'paragraph',
            content: `Discover our complete range of ${businessType.toLowerCase()} services designed to meet all your expectations.`
          }
        ]
      }
    };

    return fallbackContent[language]?.[pageType] || [
      {
        type: 'heading',
        content: pageTitle,
        attributes: { level: 1 }
      },
      {
        type: 'paragraph',
        content: language === 'fr_FR' 
          ? `Contenu de la page ${pageTitle}.`
          : `Content for ${pageTitle} page.`
      }
    ];
  }
  /**
   * Configure la page d'accueil
   */
  static async setupHomepage(container, pages) {
    const homePage = pages.find(p => 
      p.slug === 'accueil' || p.title === 'Accueil' || 
      p.slug === 'home' || p.title === 'Home'
    );
    
    if (homePage) {
      try {
        await execAsync(`docker exec ${container} wp option update show_on_front page --allow-root`);
        
        const homeSlug = homePage.slug;
        const homeIdCmd = `docker exec ${container} wp post list --post_type=page --name=${homeSlug} --field=ID --format=ids --allow-root`;
        const homeId = (await execAsync(homeIdCmd)).stdout.trim();
        
        if (homeId) {
          await execAsync(`docker exec ${container} wp option update page_on_front ${homeId} --allow-root`);
          console.log(`✅ Page d'accueil configurée: ${homePage.title} (ID: ${homeId})`);
        }
      } catch (error) {
        console.warn('⚠ Impossible de configurer la page d\'accueil:', error.message);
      }
    }
  }

/**
 * Configure le menu WordPress de manière robuste
 */

static async setupMenu(container, menu, pages) {
  try {
    console.log('🔧 Configuration du menu WordPress...');

    // 1. Vérifier les emplacements de menu disponibles
    console.log('📋 Vérification des emplacements de menu...');
    const locations = await this.getMenuLocations(container);
    console.log('📍 Emplacements disponibles:', locations);

    // ✅ CORRECTION: Choisir un emplacement qui existe
    const targetLocation = this.findValidMenuLocation(locations);
    console.log(`🎯 Utilisation de l'emplacement: ${targetLocation}`);

    // ... reste du code menu inchangé ...

    // 4. Assigner le menu à l'emplacement - AVEC GESTION D'ERREUR
    console.log(`📍 Assignation du menu à l'emplacement: ${targetLocation}`);
    try {
      await execAsync(`docker exec ${container} wp menu location assign "${menuName}" ${targetLocation} --allow-root`);
      console.log(`✅ Menu assigné à ${targetLocation}`);
    } catch (assignError) {
      console.warn(`⚠️ Impossible d'assigner à ${targetLocation}, essai avec d'autres emplacements...`);
      
      // Essayer d'autres emplacements
      const otherLocations = locations.filter(loc => loc !== targetLocation);
      let assigned = false;
      
      for (const location of otherLocations) {
        try {
          await execAsync(`docker exec ${container} wp menu location assign "${menuName}" ${location} --allow-root`);
          console.log(`✅ Menu assigné à ${location} (fallback)`);
          assigned = true;
          break;
        } catch (e) {
          // Continuer avec le prochain emplacement
        }
      }
      
      if (!assigned) {
        console.warn('⚠️ Impossible d\'assigner le menu à aucun emplacement, menu créé mais non assigné');
      }
    }

    console.log('✅ Menu WordPress configuré avec succès');
    
  } catch (error) {
    console.warn('⚠️ Erreur configuration menu WordPress:', error.message);
    throw error;
  }
}

/**
 * Trouve un emplacement de menu valide
 */
static findValidMenuLocation(locations) {
  // Priorité des emplacements
  const preferredLocations = ['primary', 'header', 'main-menu', 'top', 'main'];
  
  for (const preferred of preferredLocations) {
    if (locations.includes(preferred)) {
      return preferred;
    }
  }
  
  // Si aucun préféré n'est disponible, prendre le premier
  return locations[0] || 'primary'; // Fallback ultime
}

/**
 * Récupère les emplacements de menu disponibles avec fallback
 */
static async getMenuLocations(container) {
  try {
    const locationsResult = await execAsync(`docker exec ${container} wp menu location list --format=json --allow-root`);
    const locations = JSON.parse(locationsResult.stdout);
    
    const availableLocations = locations
      .filter(loc => loc.assigned === 0) // Prendre les emplacements non assignés
      .map(loc => loc.location)
      .filter(loc => loc); // Filtrer les valeurs nulles

    console.log('📍 Emplacements disponibles:', availableLocations);
    
    // ✅ Si aucun emplacement disponible, créer un emplacement par défaut
    if (availableLocations.length === 0) {
      console.log('🔧 Aucun emplacement disponible, utilisation des emplacements par défaut');
      return ['primary', 'header', 'main-menu', 'top'];
    }
    
    return availableLocations;
      
  } catch (error) {
    console.warn('⚠️ Impossible de récupérer les emplacements, utilisation des valeurs par défaut');
    // Emplacements courants dans WordPress
    return ['primary', 'header', 'main-menu', 'top'];
  }
}

/**
 * Ajoute les pages par défaut au menu
 */
static async addDefaultPagesToMenu(container, menuName, pages) {
  try {
    for (const page of pages.slice(0, 5)) { // Maximum 5 pages
      try {
        const pageIdCmd = `docker exec ${container} wp post list --post_type=page --name=${page.slug} --field=ID --format=ids --allow-root`;
        const pageId = (await execAsync(pageIdCmd)).stdout.trim();
        
        if (pageId) {
          await execAsync(`docker exec ${container} wp menu item add-post "${menuName}" ${pageId} --allow-root`);
          console.log(`✅ Page par défaut ajoutée: ${page.title}`);
        }
      } catch (pageError) {
        console.warn(`⚠️ Erreur ajout page ${page.title}:`, pageError.message);
      }
    }
  } catch (error) {
    console.warn('⚠️ Erreur ajout pages par défaut:', error.message);
  }
}

/**
 * Configuration basique du menu (fallback)
 */
static async setupBasicMenu(container, pages) {
  try {
    // Créer simplement le menu sans assignation d'emplacement
    await execAsync(`docker exec ${container} wp menu create "Menu Principal" --allow-root`);
    
    // Ajouter quelques pages principales
    const mainPages = pages.filter(page => 
      ['accueil', 'home', 'à propos', 'about', 'services', 'contact'].includes(page.slug.toLowerCase())
    );
    
    for (const page of mainPages.slice(0, 4)) {
      try {
        const pageIdCmd = `docker exec ${container} wp post list --post_type=page --name=${page.slug} --field=ID --format=ids --allow-root`;
        const pageId = (await execAsync(pageIdCmd)).stdout.trim();
        
        if (pageId) {
          await execAsync(`docker exec ${container} wp menu item add-post "Menu Principal" ${pageId} --allow-root`);
        }
      } catch (error) {
        // Ignorer les erreurs individuelles
      }
    }
    
    console.log('✅ Configuration basique du menu terminée');
  } catch (error) {
    throw new Error(`Configuration basique échouée: ${error.message}`);
  }
}

  /**
   * Nettoie le cache WordPress
   */
  static async flushCache(container) {
    try {
      await execAsync(`docker exec ${container} wp cache flush --allow-root`);
      await execAsync(`docker exec ${container} wp rewrite flush --allow-root`);
      console.log('✅ Cache et réécritures nettoyés');
    } catch (error) {
      console.warn('⚠ Erreur nettoyage cache:', error.message);
    }
  }

  /**
   * Trouve un port disponible
   */
  static getAvailablePort() {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      
      server.listen(0, () => {
        const port = server.address().port;
        server.close(() => {
          resolve(port);
        });
      });
    });
  }

  /**
   * Attend que WordPress soit prêt
   */
  static async waitForWordPress(container, maxRetries = 30) {
    let retries = maxRetries;
    while (retries > 0) {
      try {
        await execAsync(`docker exec ${container} curl -f http://localhost:80/wp-admin/install.php --silent --max-time 10 --retry 2 --retry-delay 1`);
        console.log("✅ WordPress est démarré");
        return;
      } catch (error) {
        retries--;
        if (retries > 0) {
          console.log(`⏳ Attente WordPress... (${retries} tentatives restantes)`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw new Error("WordPress not ready after multiple attempts");
        }
      }
    }
  }

  /**
   * Attend que MySQL soit prêt
   */
  static async waitForMySQL(container, dbUser, dbPass, maxRetries = 30) {
    let retries = maxRetries;
    while (retries > 0) {
      try {
        await execAsync(`docker exec ${container} mysqladmin ping -h127.0.0.1 -u${dbUser} -p${dbPass} --silent`);
        console.log("✅ MySQL est prêt");
        return;
      } catch (error) {
        retries--;
        console.log(`⏳ Attente MySQL... (${retries} tentatives restantes)`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    throw new Error("MySQL container not ready after multiple attempts");
  }

/**
 * Validation robuste des blocs de page
 */
static validatePageBlocks(blocks, pageTitle, businessType = 'Général', language = 'fr_FR') {
  console.log(`🔍 Validation des blocs pour: ${pageTitle}`, {
    businessType,
    language
  });

  // Si blocks n'est pas un tableau, en_US générer de nouveaux
  if (!blocks || !Array.isArray(blocks)) {
    console.warn(`⚠️ Blocs invalides pour ${pageTitle}, génération de blocs par défaut`);
    return this.generateDefaultBlocks(pageTitle, businessType, language);
  }

  // Si le tableau est vide, générer des blocs par défaut
  if (blocks.length === 0) {
    console.warn(`⚠️ Blocs vides pour ${pageTitle}, génération de blocs par défaut`);
    return this.generateDefaultBlocks(pageTitle, businessType, language);
  }

  // Valider et nettoyer chaque bloc
  const validatedBlocks = blocks.map((block, index) => {
    try {
      // S'assurer que le bloc a une structure valide
      const validatedBlock = {
        type: validateBlockType(block.type),
        content: block.content || this.getDefaultBlockContent(block.type, pageTitle, businessType, language),
        attributes: block.attributes || {}
      };

      // Nettoyer les attributs selon le type de bloc
      validatedBlock.attributes = this.cleanBlockAttributes(validatedBlock.attributes, validatedBlock.type);

      console.log(`✅ Bloc ${index + 1} validé:`, validatedBlock.type);
      return validatedBlock;

    } catch (blockError) {
      console.warn(`⚠️ Erreur validation bloc ${index + 1}, utilisation du fallback:`, blockError.message);
      
      // Bloc de fallback
      return {
        type: 'paragraph',
        content: language === 'fr_FR' ? `Contenu de la page ${pageTitle}` : `Content for ${pageTitle} page`,
        attributes: {}
      };
    }
  });

  console.log(`✅ ${validatedBlocks.length} blocs validés pour ${pageTitle}`);
  return validatedBlocks;
}


    /**
     * Génère des blocs par défaut pour une page
     */
    static generateDefaultBlocks(pageTitle, businessType, language) {
    console.log(`🔧 Génération blocs par défaut pour: ${pageTitle}`);
    
    const blocks = [];

    // Bloc titre principal
    blocks.push({
        type: 'heading',
        content: pageTitle,
        attributes: { level: 1 }
    });

    // Contenu par défaut selon la page
    let defaultContent = '';
    
    switch (pageTitle.toLowerCase()) {
        case 'accueil':
        case 'home':
        defaultContent = language === 'fr_FR' 
            ? `Bienvenue sur notre site ${businessType}. Découvrez nos services et notre expertise.`
            : `Welcome to our ${businessType} website. Discover our services and expertise.`;
        break;
        case 'à propos':
        case 'about':
        defaultContent = language === 'fr_FR'
            ? `Apprenez-en_US plus sur notre entreprise et notre passion pour ${businessType}.`
            : `Learn more about our company and our passion for ${businessType}.`;
        break;
        case 'services':
        defaultContent = language === 'fr_FR'
            ? `Découvrez notre gamme complète de services professionnels.`
            : `Discover our complete range of professional services.`;
        break;
        default:
        defaultContent = language === 'fr_FR'
            ? `Contenu de la page ${pageTitle}.`
            : `Content for ${pageTitle} page.`;
    }

    blocks.push({
        type: 'paragraph',
        content: defaultContent,
        attributes: {}
    });

    return blocks;
    }

    /**
     * Nettoie les attributs des blocs
     */
    static cleanBlockAttributes(attributes, blockType) {
    const cleaned = { ...attributes };

    // Nettoyer selon le type de bloc
    switch (blockType) {
        case 'hero':
        // Garder seulement les attributs essentiels pour hero
        const allowedHeroAttrs = ['subtitle', 'buttonText', 'buttonLink', 'image'];
        Object.keys(cleaned).forEach(key => {
            if (!allowedHeroAttrs.includes(key)) {
            delete cleaned[key];
            }
        });
        break;
        
        case 'features':
        // S'assurer que items est un tableau
        if (cleaned.items && !Array.isArray(cleaned.items)) {
            cleaned.items = [cleaned.items];
        }
        break;
        
        case 'heading':
        // S'assurer que level est valide
        if (cleaned.level && (cleaned.level < 1 || cleaned.level > 6)) {
            cleaned.level = 2;
        }
        break;
    }

    return cleaned;
    }


    static async ensureContainerExists(containerName) {
      try {
        console.log(`🔍 Vérification du conteneur: ${containerName}`);
        const result = await execAsync(`docker inspect ${containerName}`);
        const containerInfo = JSON.parse(result.stdout || result);
        
        if (containerInfo.length === 0) {
          throw new Error('Aucun conteneur trouvé');
        }
        
        const containerState = containerInfo[0].State.Status;
        console.log(`📦 État du conteneur ${containerName}: ${containerState}`);
        
        // Accepter les conteneurs même s'ils sont arrêtés
        if (containerState === 'exited') {
          console.log(`⚠️ Conteneur ${containerName} existe mais est arrêté, redémarrage...`);
          // Optionnel : redémarrer automatiquement le conteneur
          await execAsync(`docker start ${containerName}`);
          console.log(`✅ Conteneur ${containerName} redémarré`);
        }
        
        return true;
        
      } catch (error) {
        // Vérifier si l'erreur vient de l'inexistence du conteneur
        if (error.message.includes('No such object') || 
            error.message.includes('No such container') ||
            error.stderr?.includes('No such object') ||
            error.message.includes('Aucun conteneur trouvé')) {
          throw new Error(`Le conteneur ${containerName} n'existe pas`);
        }
        
        // Autre erreur
        console.error(`Erreur inattendue:`, error);
        throw new Error(`Erreur de vérification du conteneur ${containerName}: ${error.message}`);
      }
    }

    static async ensureContainerRunning(containerName) {
      try {
        const result = await execAsync(`docker inspect ${containerName}`);
        const containerInfo = JSON.parse(result.stdout || result);
        const containerState = containerInfo[0].State.Status;
        
        if (containerState !== 'running') {
          console.log(`🔄 Redémarrage du conteneur ${containerName}...`);
          await execAsync(`docker start ${containerName}`);
          // Attendre selon le type de conteneur
          const waitTime = containerName.includes('db') ? 5000 : 3000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          console.log(`✅ Conteneur ${containerName} démarré`);
        }
        return true;
      } catch (error) {
        console.error(`❌ Erreur avec le conteneur ${containerName}:`, error.message);
        return false;
      }
    }

    /**
     * Récupère les pages d'un site
     */
    static async getPages(containerName) {
      const pagesResult = await execAsync(`
        docker exec ${containerName} wp post list --post_type=page --post_status=publish --fields=ID,post_title,post_name --format=json --allow-root
      `);
      
      const pages = JSON.parse(pagesResult.stdout);
      return pages.map((page) => ({
        id: page.ID,
        title: page.post_title,
        slug: page.post_name,
        url: `/${page.post_name}`
      }));
    }

    /**
     * Vide le cache WordPress
     */
    static async flushCache(containerName) {
      await execAsync(`docker exec ${containerName} wp cache flush --allow-root`);
      await execAsync(`docker exec ${containerName} wp rewrite flush --allow-root`);
    }
}

function validateBlockType(blockType) {
  const validTypes = ['hero', 'heading', 'paragraph', 'features', 'cta', 'image', 'gallery', 'testimonials'];
  return validTypes.includes(blockType) ? blockType : 'paragraph';
}

export default WordPressService;