// services/imageGenerationService.js
import axios from 'axios';
import { OPENROUTER_AI_API, OPENROUTER_AI_KEY } from '../config/ia.js';
import { getAiModelForUser } from './aiModel.service.js';

export class ImageGenerationService {
  /**
   * Génère une image avec IA selon le contexte
   */
  static async generateImage(prompt, context = {}) {
    try {
      console.log('🎨 Génération image IA:', { prompt: prompt.substring(0, 100) + '...' });

      // Utiliser un modèle de génération d'images (ex: DALL-E, Stable Diffusion via OpenRouter)
      const response = await axios.post(
        OPENROUTER_AI_API,
        {
          model: 'black-forest-labs/flux-schnell', // Modèle image rapide
          prompt: prompt,
          width: 1024,
          height: 768,
          steps: 4 // Rapide pour la génération de sites
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_AI_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      // OpenRouter retourne généralement une URL d'image
      const imageUrl = response.data?.data?.[0]?.url;
      
      if (!imageUrl) {
        throw new Error('Aucune URL d\'image retournée');
      }

      console.log('✅ Image générée:', imageUrl);
      return imageUrl;

    } catch (error) {
      console.warn('❌ Erreur génération image, utilisation image de placeholder:', error.message);
      return this.getPlaceholderImage(context);
    }
  }

  /**
   * Génère un prompt d'image selon le contexte métier
   */
  static generateImagePrompt(businessType, pageType, stylePreference, language = 'fr_FR') {
    const styleMap = {
        'Moderne': 'style moderne, design épuré, couleurs vives',
        'Luxe': 'style luxueux, élégant, premium, doré',
        'Créatif': 'style créatif, artistique, unique, coloré',
        'Classique': 'style classique, traditionnel, professionnel'
    };

    const businessPrompts = {
        'Restaurant': {
        homepage: 'restaurant élégant, table dressée, ambiance chaleureuse, nourriture appétissante',
        about: 'équipe de cuisine professionnelle, produits frais, cuisine moderne',
        menu: 'plats gastronomiques, présentation élégante, ingrédients frais',
        gallery: 'collection de plats signature, présentation artistique, détail culinaire',
        contact: 'restaurant accueillant, façade moderne, ambiance conviviale'
        },
        'Coiffeur': {
        homepage: 'salon de coiffure moderne, espace design, miroirs lumineux',
        about: 'coiffeurs professionnels au travail, techniques de coupe',
        services: 'coiffures élégantes, coloration professionnelle, soins capillaires',
        gallery: 'portfolio coiffures avant-après, transformations réussies, styles variés',
        contact: 'salon accueillant, réception moderne'
        },
        'Plombier': {
        homepage: 'plombier professionnel, outils de qualité, intervention technique',
        about: 'équipe plomberie expérimentée, travaux de rénovation',
        services: 'installation sanitaire, réparation fuite, équipement moderne',
        gallery: 'portfolio réalisations plomberie, installations propres, travaux finis',
        contact: 'technicien souriant, véhicule professionnel'
        }
    };

  const style = styleMap[stylePreference] || 'style professionnel';
  const businessPrompt = businessPrompts[businessType]?.[pageType] || 'image professionnelle et engageante';

  return `${businessPrompt}, ${style}, haute qualité, réaliste, professionnel, ${language === 'fr_FR' ? 'contexte français' : 'french context'}`;  }

  /**
   * Retourne une image de placeholder selon le contexte
   */
  static getPlaceholderImage(context = {}) {
    const { businessType, pageType } = context;
    
    // Placeholders thématiques par défaut
    const placeholders = {
      'Restaurant': {
        homepage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1024&h=768&fit=crop',
        about: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1024&h=768&fit=crop',
        menu: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1024&h=768&fit=crop'
      },
      'Coiffeur': {
        homepage: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1024&h=768&fit=crop',
        about: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1e1?w=1024&h=768&fit=crop',
        services: 'https://images.unsplash.com/photo-1621605815958-4154d6d60c5a?w=1024&h=768&fit=crop'
      },
      'default': 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1024&h=768&fit=crop'
    };

    return placeholders[businessType]?.[pageType] || placeholders.default;
  }

  /**
   * Télécharge et sauvegarde une image localement
   */
  static async downloadAndSaveImage(imageUrl, filename) {
    try {
      const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream'
      });

      // Créer le dossier images si nécessaire
      const imagesDir = path.join(process.cwd(), 'public', 'images', 'generated');
      await fs.mkdir(imagesDir, { recursive: true });

      const filePath = path.join(imagesDir, filename);
      const writer = fs.createWriteStream(filePath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(`/images/generated/${filename}`));
        writer.on('error', reject);
      });

    } catch (error) {
      console.warn('❌ Erreur téléchargement image:', error.message);
      return imageUrl; // Retourner l'URL originale en fallback
    }
  }
}