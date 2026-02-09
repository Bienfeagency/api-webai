// services/contentTemplateService.js
export class ContentTemplateService {
  // Bibliothèque de templates éprouvés
  static templates = {
    'restaurant-homepage': {
      name: 'Restaurant - Page d\'accueil',
      businessType: 'restaurant',
      pageType: 'homepage',
      blocks: [
        {
          type: 'hero',
          content: 'Une Expérience Gastronomique Inoubliable',
          attributes: {
            subtitle: 'Des saveurs authentiques, des produits frais, une ambiance unique',
            buttonText: 'Découvrir notre carte',
            buttonLink: '/menu'
          }
        },
        {
          type: 'heading',
          content: 'Bienvenue dans Notre Univers Culinaire',
          attributes: { level: 2 }
        },
        {
          type: 'paragraph',
          content: 'Notre chef passionné et son équipe vous accueillent pour partager leur amour de la cuisine authentique. Chaque plat est une histoire, chaque saveur une émotion.'
        },
        {
          type: 'features',
          content: 'Pourquoi Nos Clients Nous Choisissent',
          attributes: {
            items: [
              'Produits frais et locaux sélectionnés avec soin',
              'Carte créative renouvelée aux rythmes des saisons',
              'Ambiance chaleureuse et service personnalisé',
              'Terrasse agréable et cadre convivial'
            ]
          }
        },
        {
          type: 'cta',
          content: 'Réserver une Table',
          attributes: {
            buttonLink: '/contact'
          }
        }
      ]
    },

    'restaurant-about': {
      name: 'Restaurant - À propos',
      businessType: 'restaurant', 
      pageType: 'about',
      blocks: [
        {
          type: 'heading',
          content: 'Notre Histoire, Notre Passion',
          attributes: { level: 1 }
        },
        {
          type: 'paragraph',
          content: 'Depuis notre ouverture, nous cultivons l\'excellence et l\'authenticité. Notre restaurant est bien plus qu\'un simple lieu de restauration : c\'est un lieu de partage et de découverte.'
        },
        {
          type: 'heading',
          content: 'Notre Philosophie',
          attributes: { level: 2 }
        },
        {
          type: 'paragraph', 
          content: 'Nous croyons en une cuisine respectueuse des produits et des producteurs. Chaque ingrédient est choisi pour sa qualité et son histoire.'
        }
      ]
    },

    // COIFFEUR
    'coiffeur-homepage': {
      name: 'Coiffeur - Page d\'accueil',
      businessType: 'coiffeur',
      pageType: 'homepage', 
      blocks: [
        {
          type: 'hero',
          content: 'Votre Beauté, Notre Expertise',
          attributes: {
            subtitle: 'Coiffure, couleur et soins sur mesure',
            buttonText: 'Prendre rendez-vous',
            buttonLink: '/contact'
          }
        }
      ]
    }
  };
  /**
   * Trouve le template le plus adapté
   */
  static findBestTemplate(businessType, pageType, stylePreference) {
    const templateKey = `${businessType.toLowerCase()}-${pageType}`;
    
    if (this.templates[templateKey]) {
      console.log(`🎨 Template trouvé: ${templateKey}`);
      return this.templates[templateKey];
    }

    // Fallback par type de page
    const fallbackTemplates = {
      'homepage': this.templates['restaurant-homepage'], // Template générique
      'about': this.templates['restaurant-about']
    };

    return fallbackTemplates[pageType] || null;
  }

  /**
   * Personnalise un template avec le contexte
   */
  static customizeTemplate(template, siteName, businessType, language) {
    const customizedBlocks = template.blocks.map(block => {
      let customizedContent = block.content;
      
      // Personnalisation simple
      if (block.content.includes('Une Expérience Culinaire')) {
        customizedContent = `Bienvenue chez ${siteName} - Une Expérience Culinaire Unique`;
      }
      
      return {
        ...block,
        content: customizedContent
      };
    });

    return {
      ...template,
      blocks: customizedBlocks
    };
  }

  /**
   * Utilise le template comme base pour l'IA
   */
  static async generateFromTemplate(context, existingBlocks = []) {
    const { pageTitle, pageType, businessType, siteName, stylePreference, language } = context;
    
    const template = this.findBestTemplate(businessType, pageType, stylePreference);
    
    if (!template) {
      console.log('ℹ️ Aucun template trouvé, génération standard');
      return null;
    }

    const customizedTemplate = this.customizeTemplate(template, siteName, businessType, language);
    
    console.log(`🎨 Génération avec template: ${template.name}`);
    
    // Utiliser le template comme base pour l'IA
    const enhancedContext = {
      ...context,
      existingBlocks: customizedTemplate.blocks,
      instructions: `Utilisez cette structure comme base et enrichissez-la avec du contenu spécifique pour ${siteName}`
    };

    return enhancedContext;
  }
}

export default ContentTemplateService;