import axios from 'axios';
import { OPENROUTER_AI_API, OPENROUTER_AI_KEY } from '../config/ia.js';
import { getAiModelForUser, checkAiGenerationsLimit, recordAiGenerationUsage } from '../services/aiModel.service.js';
import { ImageGenerationService } from '../services/imageGeneration.service.js';
/**
 * Génère du contenu riche et cohérent pour une page spécifique
 */

const BASE_URL = process.env.NODE_ENV === 'production' ? process.env.BASE_URL_PRODUCTION : process.env.BASE_URL || 'http://localhost';

export async function generatePageContent(params) {
  const {
    pageTitle,
    pageType,
    businessType,
    language,
    targetAudience,
    siteName,
    stylePreference,
    userId, // ⬅️ ID utilisateur pour récupérer le modèle
    generationType = 'content',
    existingBlocks = []
  } = params;

  console.log(`🎯 Génération contenu pour: ${pageTitle} (${pageType})`);

  try {
    // ✅ VÉRIFIER LES LIMITES DE GÉNÉRATION
    const limitCheck = await checkAiGenerationsLimit(userId);
    if (!limitCheck.allowed) {
      throw new Error(`Limite de générations IA atteinte: ${limitCheck.message}`);
    }

    console.log(`📊 Limites: ${limitCheck.used}/${limitCheck.limit} générations utilisées`);

    // ✅ RÉCUPÉRER LE MODÈLE APPROPRIÉ
    const aiModel = await getAiModelForUser(userId, generationType);
    console.log(`🤖 Modèle sélectionné: ${aiModel.name} (${aiModel.modelId})`);

    const prompt = buildPageContentPrompt({
      pageTitle,
      pageType,
      businessType,
      language,
      targetAudience,
      siteName,
      stylePreference,
      existingBlocks
    });

    // ✅ ADAPTER LES PARAMÈTRES AU MODÈLE
    const maxTokens = calculateOptimalTokens(aiModel, generationType);
    console.log(`⚙️ Paramètres: ${maxTokens} tokens, température: 0.7`);

    const response = await axios.post(
      OPENROUTER_AI_API,
      {
        model: aiModel.modelId,
        messages: [
          { 
            role: 'system', 
            content: getContentSystemPrompt(language, pageType) 
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_AI_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': `${BASE_URL}:3000`,
          'X-Title': 'WordPress Content Generator',
        },
        timeout: 30000,
      }
    );

    const aiContent = response.data?.choices?.[0]?.message?.content;
    const tokensUsed = response.data?.usage?.total_tokens || 0;
    
    if (!aiContent) {
      throw new Error('Réponse vide du service IA');
    }
    let parsedContent = parsePageContentResponse(aiContent, pageTitle, pageType, businessType, siteName);

    // ✅ AJOUT: Générer et intégrer des images si nécessaire
    /*if (shouldGenerateImages(pageType)) {
      console.log('🎨 Génération images pour la page...');
      parsedContent = await enrichWithImages(parsedContent, {
        pageTitle,
        pageType,
        businessType,
        stylePreference,
        language,
        siteName
      });
    }*/

    // ✅ ENREGISTRER L'UTILISATION
    await recordAiGenerationUsage(userId, {
      generationType: generationType,
      aiModel: aiModel.modelId,
      tokensUsed: tokensUsed,
      cost: calculateCost(tokensUsed, aiModel.costPerGeneration),
      pageTitle: pageTitle,
      businessType: businessType
    });

    console.log(`✅ Génération réussie: ${tokensUsed} tokens utilisés`);

    return parsedContent

  } catch (error) {
    console.error('❌ Erreur génération contenu:', error.message);
    
    // Log détaillé pour les erreurs d'API
    if (error.response) {
      console.error('📊 Détails erreur API:', {
        status: error.response.status,
        data: error.response.data
      });
      
      // Gestion spécifique des erreurs de crédits
      if (error.response.status === 402) {
        throw new Error(`Modèle IA non disponible: crédits insuffisants pour ${generationType}`);
      }
    }
    
    throw error;
  }
}
/**
 * Enrichit le contenu avec des images générées
 */
async function enrichWithImages(content, context) {
  const { pageType, businessType, stylePreference, language, siteName } = context;
  
  try {
    const enhancedBlocks = [];
    
    for (const block of content.blocks) {
      enhancedBlocks.push(block);
      
      // Ajouter une image après les blocs hero ou heading importants
      if (block.type === 'hero' || (block.type === 'heading' && block.attributes?.level === 1)) {
        const imagePrompt = ImageGenerationService.generateImagePrompt(
          businessType, 
          pageType, 
          stylePreference, 
          language
        );
        
        console.log(`🎨 Génération image pour ${pageType}: ${imagePrompt}`);
        
        try {
          const imageUrl = await ImageGenerationService.generateImage(imagePrompt, {
            businessType,
            pageType,
            siteName
          });
          
          // Ajouter un bloc image après le hero/heading
          enhancedBlocks.push({
            type: 'image',
            content: `Image ${businessType} ${pageType}`,
            attributes: {
              url: imageUrl,
              alt: `Image ${businessType} - ${siteName}`,
              caption: getImageCaption(businessType, pageType, language),
              alignment: 'wide'
            }
          });
          
          console.log('✅ Image ajoutée au contenu');
          
        } catch (imageError) {
          console.warn('⚠️ Erreur génération image, continuation sans image:', imageError.message);
        }
      }
    }
    
    return {
      ...content,
      blocks: enhancedBlocks
    };
    
  } catch (error) {
    console.warn('❌ Erreur enrichissement images, retour contenu original:', error.message);
    return content;
  }
}

/**
 * Génère une légende d'image selon le contexte
 */
function getImageCaption(businessType, pageType, language) {
  const captions = {
    fr_FR: {
      restaurant: {
        homepage: 'Notre restaurant et son ambiance chaleureuse',
        about: 'Notre équipe de chefs passionnés',
        menu: 'Nos spécialités culinaires'
      },
      coiffeur: {
        homepage: 'Notre salon de coiffure moderne',
        about: 'Nos coiffeurs experts à votre service',
        services: 'Exemples de nos réalisations'
      }
    },
    en_US: {
      restaurant: {
        homepage: 'Our restaurant and its warm atmosphere',
        about: 'Our team of passionate chefs',
        menu: 'Our culinary specialties'
      }
    }
  };
  
  return captions[language]?.[businessType.toLowerCase()]?.[pageType] || 
        `${businessType} - ${pageType}`;
}
/**
 * Détermine si des images doivent être générées pour ce type de page
 */
function shouldGenerateImages(pageType) {
  const pagesWithImages = [
    'homepage', 'about', 'services', 'menu', 'portfolio', 
    'gallery', 'blog', 'actualites', 'realisations'
  ];
  return pagesWithImages.includes(pageType);
}
/**
 * Calcule le nombre optimal de tokens selon le modèle et le type
 */
function calculateOptimalTokens(aiModel, generationType) {
  const baseTokens = {
    'content': 1200,
    'article': 1500,
    'seo': 800,
    'site-structure': 1000,
    'full-site': 2000
  };

  let tokens = baseTokens[generationType] || 1000;
  
  // Ajuster selon le modèle
  if (aiModel.modelId.includes('gpt-4')) {
    tokens = Math.min(tokens, 4000); // GPT-4 peut gérer plus
  } else if (aiModel.modelId.includes('gpt-3.5')) {
    tokens = Math.min(tokens, 2000);
  } else {
    tokens = Math.min(tokens, 1500); // Modèles plus légers
  }
  
  return tokens;
}

/**
 * Calcule le coût estimé
 */
function calculateCost(tokensUsed, costPerGeneration) {
  // Estimation basique - à adapter selon votre pricing
  return costPerGeneration * (tokensUsed / 1000);
}
/**
 * Construit le prompt spécifique pour le contenu de page
 */
/**
 * Améliore le prompt pour un contenu plus spécifique
 */
function buildPageContentPrompt(context) {
  const { pageTitle, pageType, businessType, language, targetAudience, siteName, stylePreference } = context;

  const businessSpecificPrompt = getBusinessSpecificPrompt(businessType, pageType, language);
  const conversionElements = getConversionElements(pageType, language);
  const toneDescription = getToneDescription(targetAudience, stylePreference, language);

  return `
# 🎯 MISSION : CRÉATION DE CONTENU PREMIUM POUR ${siteName.toUpperCase()}

## 📋 INFORMATIONS CLÉS
- **ENTREPRISE** : ${siteName} - ${businessType}
- **PAGE** : "${pageTitle}" (Type: ${pageType})
- **PUBLIC** : ${targetAudience}
- **STYLE** : ${stylePreference}
- **LANGUE** : ${language}
- **TON** : ${toneDescription}

## 🏢 CONTEXTE MÉTIER DÉTAILLÉ
${businessSpecificPrompt}

## 🎨 STRUCTURE ET ÉLÉMENTS REQUIS
${conversionElements}

## 🖼️ DIRECTIVES IMAGES ET VISUELS
Intègre 2-3 blocs image stratégiques avec ces positions :
- **Image Hero** : Après le bloc hero pour illustrer l'ambiance
- **Image Section** : Après une section importante pour renforcer le message
- **Image Preuve sociale** : Avant le call-to-action final

## ✨ EXIGENCES DE QUALITÉ
1. **CONTENU 100% ORIGINAL** - Pas de phrases génériques
2. **MENTIONS NATURELLES** de "${siteName}" 2-3 fois dans le contenu
3. **DÉTAILS CONCRETS** sur les services, processus, avantages
4. **APPELS À L'ACTION STRATÉGIQUES** adaptés à ${pageType}
5. **VOCABULAIRE SPÉCIALISÉ** pour ${businessType}
6. **STRUCTURE ENGAGEANTE** avec variété de blocs

## 🎪 TYPES DE BLOCS AUTORISÉS
- **hero** : Titre principal + sous-titre + CTA
- **heading** : Titres structurants (h1-h3)
- **paragraph** : Contenu riche et informatif
- **features** : Liste à puces d'avantages
- **cta** : Boutons d'action stratégiques
- **image** : Visuels contextuels
- **testimonials** : Témoignages fictifs réalistes
- **contact** : Informations de contact

## 📝 EXEMPLES DE BLOCS POUR INSPIRATION

### Hero Accueil Restaurant :
{
  "type": "hero",
  "content": "Bienvenue chez ${siteName} - Une Expérience Culinaire Inoubliable",
  "attributes": {
    "subtitle": "Découvrez nos saveurs authentiques et notre passion pour la gastronomie",
    "buttonText": "Réserver une table",
    "buttonLink": "/contact"
  }
}

### Section avec image :
{
  "type": "heading",
  "content": "Nos Spécialités Maison",
  "attributes": { "level": 2 }
},
{
  "type": "image", 
  "content": "Notre chef préparant nos plats signatures",
  "attributes": {
    "url": "",
    "alt": "Chef ${siteName} préparant nos spécialités culinaires",
    "caption": "L'excellence au service de votre palais",
    "alignment": "wide"
  }
},
{
  "type": "paragraph",
  "content": "Chaque jour, notre chef ${siteName} et son équipe sélectionnent des produits frais pour créer des plats uniques qui racontent une histoire. Notre spécialité, le [détail spécifique], est préparée avec des ingrédients locaux et une passion authentique."
}

### Témoignages réalistes :
{
  "type": "testimonials",
  "content": "Ce que nos clients disent de ${siteName}",
  "attributes": {
    "items": [
      "Une expérience exceptionnelle ! Les plats étaient délicieux et le service impeccable. Je recommande ${siteName} les yeux fermés. - Marie D.",
      "Enfin un ${businessType.toLowerCase()} qui comprend nos attentes. Professionalisme et qualité au rendez-vous. - Pierre L."
    ]
  }
}

## 🚀 STRUCTURE IDÉALE PAR TYPE DE PAGE

### ${pageType === 'homepage' ? '⭐ PAGE ACCUEIL (6-8 blocs)' : ''}
${pageType === 'homepage' ? `
1. Hero percutant avec CTA principal
2. Section valeurs différenciantes
3. Image ambiance ${businessType.toLowerCase()}
4. Services phares avec avantages
5. Témoignages clients
6. CTA final fort
` : ''}

### ${pageType === 'about' ? '📖 PAGE À PROPOS (5-7 blocs)' : ''}
${pageType === 'about' ? `
1. Titre historique engageant
2. Notre histoire et valeurs
3. Image équipe/lieu
4. Expertise et certifications
5. Engagement qualité
6. CTA consultation
` : ''}

### ${pageType === 'services' ? '🛠️ PAGE SERVICES (6-9 blocs)' : ''}
${pageType === 'services' ? `
1. Titre services premium
2. Présentation expertise
3. Liste services détaillés
4. Image réalisation
5. Processus qualité
6. Avantages clients
7. CTA devis
` : ''}

## ⚠️ DIRECTIVES STRICTES

### ✅ À FAIRE :
- Contenu SPÉCIFIQUE à ${businessType} et ${siteName}
- Détails concrets et réalistes
- Structure variée et engageante
- Vocabulaire professionnel adapté
- Appels à l'action contextuels

### ❌ À ÉVITER :
- Phrases génériques type "Nous sommes les meilleurs"
- Contenu copié-collé
- Listes trop longues et monotones
- Jargon incompréhensible

## 📄 FORMAT DE RÉPONSE EXACT

Retourne UNIQUEMENT du JSON valide avec cette structure :

{
  "blocks": [
    {
      "type": "hero/heading/paragraph/features/cta/image/testimonials",
      "content": "Contenu textuel riche, spécifique et engageant",
      "attributes": {
        // Attributs selon le type de bloc
        "subtitle": "...",
        "buttonText": "...", 
        "buttonLink": "...",
        "level": 2,
        "items": ["...", "..."],
        "url": "",
        "alt": "...",
        "caption": "...",
        "alignment": "wide"
      }
    }
  ]
}

## 🎯 OBJECTIF FINAL

Crée un contenu qui donne VRAIMENT envie de :
- Contacter ${siteName} immédiatement
- Faire confiance à leur expertise ${businessType}
- Recommander à son réseau
- Revenir pour d'autres services

Le contenu doit refléter l'excellence et le professionnalisme de ${siteName} !
`;
}

/**
 * Description du ton selon le public et style
 */
function getToneDescription(targetAudience, stylePreference, language) {
  const tones = {
    'Particuliers': {
      fr_FR: 'chaleureux, amical et accessible',
      en_US: 'warm, friendly and accessible'
    },
    'Professionnels': {
      fr_FR: 'expert, professionnel et technique', 
      en_US: 'expert, professional and technical'
    },
    'Jeunes': {
      fr_FR: 'dynamique, moderne et énergique',
      en_US: 'dynamic, modern and energetic'
    }
  };

  const tone = tones[targetAudience]?.[language] || 
    (language === 'fr_FR' ? 'professionnel et engageant' : 'professional and engaging');

  return tone;
}

/**
 * Prompt spécifique selon le type d'entreprise
 */
function getBusinessSpecificPrompt(businessType, pageType, language) {
  const prompts = {
    'restaurant': {
      fr_FR: `RESTAURANT ${pageType.toUpperCase()}:
- Décrire l'ambiance, les spécialités culinaires
- Mentionner les produits frais, les influences gastronomiques
- Parler de l'expérience client unique
- Horaires d'ouverture, localisation si contact
- Événements spéciaux, menus saisonniers`,
      en_US: `RESTAURANT ${pageType.toUpperCase()}:
- Describe atmosphere, culinary specialties  
- Mention fresh products, gastronomic influences
- Talk about unique customer experience
- Opening hours, location if contact
- Special events, seasonal menus`
    },
    'coiffeur': {
      fr_FR: `SALON DE COIFFURE ${pageType.toUpperCase()}:
- Expertise des coiffeurs, formations suivies
- Produits de qualité utilisés (marques)
- Services spécifiques (coupe, couleur, soins)
- Ambiance du salon, accueil client
- Tendances actuelles suivies`,
      en_US: `HAIR SALON ${pageType.toUpperCase()}:
- Hairdresser expertise, training completed
- Quality products used (brands)
- Specific services (cut, color, treatments)
- Salon atmosphere, customer welcome
- Current trends followed`
    },
    'plombier': {
      fr_FR: `PLOMBERIE ${pageType.toUpperCase()}:
- Urgence dépannage 24h/24 si besoin
- Zones d'intervention (villes/quartiers)
- Types d'interventions (fuites, installations, rénovation)
- Garanties offertes, certifications
- Matériaux utilisés, respect des normes`,
      en_US: `PLUMBING ${pageType.toUpperCase()}:
- Emergency repair 24/7 if needed
- Intervention areas (cities/districts)
- Types of interventions (leaks, installations, renovation)
- Guarantees offered, certifications
- Materials used, compliance with standards`
    }
  };

  return prompts[businessType]?.[language] || 
    (language === 'fr_FR' ? 
      `Entreprise ${businessType} - Décrire les services spécifiques, l'expertise et les avantages clients` :
      `${businessType} business - Describe specific services, expertise and customer benefits`);
}

/**
 * Éléments de conversion par type de page
 */
function getConversionElements(pageType, language) {
  const elements = {
    homepage: {
      fr_FR: `- Hero avec accroche forte et CTA principal
- Section valeurs/avantages différenciants
- Preuves sociales (avis clients si possible)
- CTA secondaires stratégiques`,
      en_US: `- Hero with strong hook and main CTA
- Values/differentiating advantages section
- Social proof (customer reviews if possible)
- Strategic secondary CTAs`
    },
    services: {
      fr_FR: `- Détail clair de chaque service
- Avantages clients pour chaque service
- Processus de travail étape par étape
- CTA de contact par service`,
      en_US: `- Clear detail of each service
- Customer benefits for each service
- Step-by-step work process
- Contact CTA per service`
    },
    contact: {
      fr_FR: `- Formulaire de contact visible
- Multiple moyens de contact (téléphone, email, adresse)
- Horaires de disponibilité
- Temps de réponse garanti`,
      en_US: `- Visible contact form
- Multiple contact methods (phone, email, address)
- Availability hours
- Guaranteed response time`
    }
  };

  return elements[pageType]?.[language] || '';
}

/**
 * Contextualisation par type de page
 */
function getPageSpecificContext(pageType, businessType, language) {
  const contexts = {
    homepage: {
      fr_FR: `Page d'accueil - Doit capturer l'attention immédiatement, présenter ${businessType} de façon mémorable, mettre en_US avant les avantages principaux et guider vers l'action.`,
      en_US: `Homepage - Must capture attention immediately, present ${businessType} memorably, highlight key benefits and guide to action.`
    },
    about: {
      fr_FR: `Page À propos - Doit raconter l'histoire de ${businessType}, établir la confiance, présenter l'équipe/les valeurs et démontrer l'expertise.`,
      en_US: `About page - Should tell the story of ${businessType}, build trust, present team/values and demonstrate expertise.`
    },
    services: {
      fr_FR: `Page Services - Doit détailler clairement chaque service de ${businessType}, expliquer les bénéfices clients et inclure des appels à l'action forts.`,
      en_US: `Services page - Should clearly detail each ${businessType} service, explain customer benefits and include strong calls to action.`
    },
    contact: {
      fr_FR: `Page Contact - Doit rassurer sur la facilité de contact, fournir tous les moyens de communication et encourager la prise de contact.`,
      en_US: `Contact page - Should reassure about easy contact, provide all communication methods and encourage reaching out.`
    },
    menu: {
      fr_FR: `Page Menu - Doit mettre en_US appétit, présenter les spécialités de ${businessType} de façon attractive et faciliter la commande/réservation.`,
      en_US: `Menu page - Should whet appetite, present ${businessType} specialties attractively and facilitate ordering/booking.`
    }
  };

  return contexts[pageType]?.[language] || 
    (language === 'fr_FR' ? `Page ${pageType} - Contenu informatif et engageant pour ${businessType}` : 
    `${pageType} page - Informative and engaging content for ${businessType}`);
}

/**
 * Guidelines de ton selon le public et style
 */
function getToneGuidelines(targetAudience, stylePreference, language) {
  const tones = {
    'Particuliers': {
      fr_FR: 'Ton chaleureux, amical et accessible. Utiliser un langage simple et bienveillant.',
      en_US: 'Warm, friendly and accessible tone. Use simple and caring language.'
    },
    'Professionnels': {
      fr_FR: 'Ton expert, professionnel et technique. Mettre en_US avant la valeur et le ROI.',
      en_US: 'Expert, professional and technical tone. Highlight value and ROI.'
    },
    'Jeunes': {
      fr_FR: 'Ton dynamique, moderne et énergique. Utiliser un langage actuel et percutant.',
      en_US: 'Dynamic, modern and energetic tone. Use current and impactful language.'
    }
  };

  const tone = tones[targetAudience]?.[language] || 
    (language === 'fr_FR' ? 'Ton professionnel et engageant' : 'Professional and engaging tone');

  const styles = {
    'Moderne': {
      fr_FR: 'Style épuré, phrases concises, mise en_US avant des points clés.',
      en_US: 'Clean style, concise sentences, highlight key points.'
    },
    'Luxe': {
      fr_FR: 'Style élégant, vocabulaire sophistiqué, mise en_US valeur de l exclusivité.',
      en_US: 'Elegant style, sophisticated vocabulary, highlight exclusivity.'
    },
    'Créatif': {
      fr_FR: 'Style original, expressions imagées, approche narrative.',
      en_US: 'Original style, imaginative expressions, narrative approach.'
    }
  };

  const style = styles[stylePreference]?.[language] || '';

  return `${tone} ${style}`;
}

/**
 * Prompt système pour la génération de contenu
 */
function getContentSystemPrompt(language, pageType) {
  const prompts = {
    fr_FR: `Tu es un rédacteur web expert spécialisé dans la création de contenu engageant et persuasif.
    
RÔLE:
- Créateur de contenu original et spécifique
- Expert en_US copywriting et marketing digital
- Spécialiste de l'expérience utilisateur

COMPÉTENCES:
- Rédaction persuasive et engageante
- Optimisation pour la conversion
- Architecture de l'information
- Storytelling brandé

DIRECTIVES STRICTES:
1. Retourne UNIQUEMENT du JSON valide
2. Pas de texte avant/après le JSON
3. Contenu 100% original et non générique
4. Structure cohérente avec le type de page: ${pageType}
5. Appels à l'action clairs et visibles

Le contenu doit être IMMÉDIATEMENT UTILISABLE dans un site WordPress.`,
    
    en_US: `You are an expert web writer specialized in creating engaging and persuasive content.
    
ROLE:
- Creator of original and specific content
- Expert in copywriting and digital marketing
- User experience specialist

SKILLS:
- Persuasive and engaging writing
- Conversion optimization
- Information architecture
- Branded storytelling

STRICT GUIDELINES:
1. Return ONLY valid JSON
2. No text before/after JSON
3. 100% original and non-generic content
4. Structure consistent with page type: ${pageType}
5. Clear and visible calls to action

Content must be IMMEDIATELY USABLE in a WordPress site.`
  };

  return prompts[language] || prompts.en_US;
}

/**
 * Parse la réponse de l'IA pour le contenu de page
 */
/**
 * Parse la réponse de l'IA pour le contenu de page - VERSION ROBUSTE
 */
function parsePageContentResponse(aiContent, pageTitle, pageType) {
  try {
    console.log('🔧 [DEBUG] Début parsing réponse IA...');
    
    // Nettoyer la réponse plus agressivement
    let cleanedContent = aiContent
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .replace(/^[^{[]*/, '') // Supprimer tout avant le premier { ou [
      .replace(/[^}\]]*$/, '') // Supprimer tout après le dernier } ou ]
      .trim();

    console.log('🔧 [DEBUG] Contenu nettoyé (premieres 300 chars):', cleanedContent.substring(0, 300));

    let parsedContent;
    
    // Essayer de parser comme JSON
    try {
      parsedContent = JSON.parse(cleanedContent);
      console.log('✅ [DEBUG] JSON parsé directement');
    } catch (parseError) {
      console.log('🔄 [DEBUG] Premier parsing échoué, tentative de récupération...');
      
      // Essayer de trouver du JSON dans le texte
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/) || cleanedContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          parsedContent = JSON.parse(jsonMatch[0]);
          console.log('✅ [DEBUG] JSON récupéré avec regex');
        } catch (secondError) {
          console.log('❌ [DEBUG] Échec récupération JSON');
          throw new Error('Impossible de parser le JSON: ' + secondError.message);
        }
      } else {
        throw new Error('Aucun JSON trouvé dans la réponse');
      }
    }

    // Validation de la structure
    if (!parsedContent.blocks && !Array.isArray(parsedContent.blocks)) {
      // Peut-être que la réponse est directement un tableau de blocs
      if (Array.isArray(parsedContent)) {
        console.log('🔧 [DEBUG] Structure ajustée: tableau direct de blocs');
        parsedContent = { blocks: parsedContent };
      } else if (parsedContent.content && Array.isArray(parsedContent.content)) {
        console.log('🔧 [DEBUG] Structure ajustée: content -> blocks');
        parsedContent = { blocks: parsedContent.content };
      } else {
        throw new Error('Structure de blocs invalide dans la réponse');
      }
    }

    // Valider chaque bloc
    const validBlocks = parsedContent.blocks.filter(block => 
      block && typeof block === 'object' && block.content && typeof block.content === 'string'
    );

    if (validBlocks.length === 0) {
      throw new Error('Aucun bloc valide trouvé');
    }

    console.log(`✅ [DEBUG] ${validBlocks.length} blocs validés pour ${pageTitle}`);
    
    return {
      blocks: validBlocks
    };

  } catch (error) {
    console.error('❌ [DEBUG] Erreur parsing contenu:', error.message);
    console.error('❌ [DEBUG] Contenu qui a échoué:', aiContent.substring(0, 500));
    return getFallbackContent(pageTitle, pageType);
  }
}

/**
 * Contenu de fallback en_US cas d'erreur
 */
function getFallbackContent(pageTitle, pageType) {
  const fallbacks = {
    homepage: {
      blocks: [
        {
          type: 'hero',
          content: `Bienvenue sur notre site`,
          attributes: {
            subtitle: 'Découvrez nos services exceptionnels',
            buttonText: 'En savoir plus',
            buttonLink: '/services'
          }
        },
        {
          type: 'heading',
          content: 'Votre partenaire de confiance',
          attributes: { level: 2 }
        },
        {
          type: 'paragraph',
          content: 'Nous nous engageons à vous offrir la meilleure qualité de service et une expérience client exceptionnelle.'
        }
      ]
    },
    about: {
      blocks: [
        {
          type: 'heading',
          content: 'Notre histoire',
          attributes: { level: 1 }
        },
        {
          type: 'paragraph',
          content: 'Forte de nombreuses années d expérience, notre entreprise a su se bâtir une réputation solide grâce à son engagement envers l excellence et la satisfaction client.'
        }
      ]
    }
  };

  return fallbacks[pageType] || {
    blocks: [
      {
        type: 'heading',
        content: pageTitle,
        attributes: { level: 1 }
      },
      {
        type: 'paragraph',
        content: `Découvrez notre page ${pageTitle} et toutes les informations dont vous avez besoin.`
      }
    ]
  };
}

export default generatePageContent;