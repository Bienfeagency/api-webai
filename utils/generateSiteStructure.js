import { OPENROUTER_AI_API, OPENROUTER_AI_MODEL, OPENROUTER_AI_KEY, OPENROUTER_AI_MODELS } from '../config/ia.js';
import { getContextualThemeSuggestions, getHeroSubtitle, getCTAText, getBusinessFeatures, generateContextualBlocks, generateContextualMenu, getEnrichedContent } from '../helpers/structureHelpers.js';
import axios from 'axios';

const BASE_URL = process.env.NODE_ENV === 'production' ? process.env.BASE_URL_PRODUCTION : process.env.BASE_URL || 'http://localhost';

// Fonction pour convertir les strings de modèles en objets
function parseModelString(modelString) {
  if (typeof modelString === 'object' && modelString.provider && modelString.modelId) {
    return modelString; // Déjà un objet
  }
  
  if (typeof modelString === 'string') {
    const [provider, ...modelIdParts] = modelString.split('/');
    const modelId = modelIdParts.join('/');
    
    return {
      provider: provider || 'unknown',
      modelId: modelId || 'unknown',
      name: `${provider}/${modelId}`,
      isDefault: true
    };
  }
  
  // Fallback
  return {
    provider: 'openai',
    modelId: 'gpt-3.5-turbo',
    name: 'OpenAI GPT-3.5 Turbo',
    isDefault: true
  };
}

// Créer la chaîne de fallback avec des objets
function getModelFallbackChain() {
  const fallbackModels = [
    OPENROUTER_AI_MODELS.TOP_FREE[0], // Premier modèle gratuit
    ...OPENROUTER_AI_MODELS.TOP_FREE.slice(1).filter(m => m !== OPENROUTER_AI_MODELS.TOP_FREE[0])
  ];
  
  return fallbackModels.map(modelString => parseModelString(modelString));
}

// Chaîne de fallback corrigée
const MODEL_FALLBACK_CHAIN = [
  OPENROUTER_AI_MODELS.TOP_FREE[0],
  ...OPENROUTER_AI_MODELS.TOP_FREE.slice(1).filter(m => m !== OPENROUTER_AI_MODELS.TOP_FREE[0])
].map(modelString => parseModelString(modelString));

export async function generateSiteStructure(params) {
  const {
    siteName,
    articleTopic,
    numArticles,
    language,
    businessType,
    targetAudience,
    stylePreference,
    aiModel // Nouveau paramètre: modèle IA à utiliser
  } = params;

  console.log('🚀 Génération de structure IA...', { 
    model: aiModel ? `${aiModel.modelId}` : 'default',
    business: businessType,
    style: stylePreference
  });

  // Utiliser le modèle spécifié ou les fallbacks
  const modelsToTry = aiModel 
    ? [aiModel] 
    : MODEL_FALLBACK_CHAIN.slice(0, 3);

  console.log('🔍 Modèles à essayer:', modelsToTry.map(m => `${m.provider}/${m.modelId}`));

  let lastError = null;
  
  // Essayer les modèles dans l'ordre
  for (const currentModel of modelsToTry) {
    try {
      console.log(`🎯 Essai avec: ${currentModel.modelId}`);
      
      const result = await tryWithModel(currentModel, params);
      
      console.log(`✅ Succès avec ${currentModel.modelId}`);
      return result;
      
    } catch (error) {
      lastError = error;
      console.warn(`❌ Échec avec ${currentModel.modelId}:`, error.message);
      
      // Courte pause entre les essais
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
  
  // Fallback si tous les modèles échouent
  console.log('🔄 Utilisation du fallback contextualisé');
  return generateContextualFallback(
    siteName, businessType, language, targetAudience, stylePreference
  );
}

async function tryWithModel(model, params) {
  const {
    siteName,
    articleTopic,
    numArticles,
    language,
    businessType,
    targetAudience,
    stylePreference
  } = params;

  const prompt = buildOptimizedPrompt({
    siteName,
    businessType,
    targetAudience,
    stylePreference,
    language,
    articleTopic,
    numArticles
  });

  const response = await axios.post(
    OPENROUTER_AI_API,
    {
      model: `${model.provider}/${model.modelId}`,
      messages: [
        { 
          role: 'system', 
          content: getSystemPrompt(language) 
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 3500,
      temperature: 0.7,
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_AI_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': `${BASE_URL}:3000`,
        'X-Title': 'WordPress Site Generator',
      },
      timeout: 30000,
    }
  );

  // Vérification de la réponse
  if (!response.data?.choices?.[0]?.message?.content) {
    throw new Error('Réponse vide');
  }

  const aiContent = response.data.choices[0].message.content;
  
  if (!aiContent.trim()) {
    throw new Error('Contenu vide');
  }

  console.log(`📏 Réponse reçue: ${aiContent.length} caractères`);

  // Parsing du JSON
  return parseAIResponseSafely(aiContent, {
    siteName,
    businessType,
    language,
    targetAudience,
    stylePreference
  });
}

// Construction du prompt optimisé
function buildOptimizedPrompt(context) {
  const { siteName, businessType, targetAudience, stylePreference, language, articleTopic, numArticles } = context;
  
  const businessContext = getBusinessContext(businessType, language);
  const audienceContext = getAudienceContext(targetAudience, language);
  const styleContext = getStyleContext(stylePreference, language);

  return `
Tu es un expert en conception de sites WordPress. Crée une structure complète et professionnelle pour le site "${siteName}".

CONTEXTE BUSINESS:
${businessContext}

PUBLIC CIBLE:
${audienceContext}

STYLE SOUHAITÉ:
${styleContext}

INFORMATIONS TECHNIQUES:
- Langue: ${language}
- Articles à générer: ${numArticles} sur "${articleTopic}"
- CMS: WordPress
- Objectif: Site vitrine professionnel

STRUCTURE DÉTAILLÉE REQUISE:

1. PAGES (4-6 pages maximum):
   - Page d'accueil avec hero impactant
   - Page "À propos" qui inspire confiance
   - Page "Services/Produits" détaillée
   - Page "Contact" avec appel à l'action
   - Pages spécifiques au métier (ex: Menu pour restaurant, Portfolio pour artiste)

2. CONTENU DES PAGES:
   Chaque page doit contenir des blocs WordPress cohérents:
   - Hero: image bannière avec titre, sous-titre, bouton CTA
   - Heading: titres structurés (h1, h2, h3)
   - Paragraph: contenu rédactionnel professionnel
   - Features: liste d'avantages/points forts
   - CTA: boutons d'action stratégiques
   - Image: emplacements pour visuels

3. MENU DE NAVIGATION:
   - Structure logique et intuitive
   - Maximum 6 éléments principaux
   - Ordre: Accueil → Services → À propos → Contact

4. THÈMES SUGGÉRÉS:
   - 3 thèmes WordPress adaptés au style "${stylePreference}"
   - Responsive et modernes
   - Bonne compatibilité avec les pages générées

EXIGENCES CRITIQUES:
- Contenu 100% en ${language}
- Ton adapté à "${targetAudience}"
- Structure optimisée pour le référencement
- Appels à l'action clairs et visibles
- Contenu unique et non générique

FORMAT DE RÉPONSE:
Retourne UNIQUEMENT du JSON valide selon ce schéma:
{
  "pages": [
    {
      "title": "Titre de la page",
      "slug": "slug-url",
      "content": {
        "blocks": [
          {
            "type": "hero/heading/paragraph/features/cta/image",
            "content": "Contenu textuel",
            "attributes": { ... }
          }
        ]
      }
    }
  ],
  "menu": [
    {
      "label": "Nom du menu", 
      "url": "/slug",
      "type": "page"
    }
  ],
  "themeSuggestions": ["theme1", "theme2", "theme3"]
}

Génère du contenu SPECIFIQUE à "${businessType}" et PERSONNALISÉ pour "${siteName}".
`;
}

// Contextualisation par type de business
function getBusinessContext(businessType, language) {
  const contexts = {
    'Restaurant': {
      fr_FR: `Type: Restaurant/Café/Salon de thé
Pages recommandées: Accueil, Menu, À propos, Événements, Galerie, Contact
Contenu: Mettre en avant les spécialités culinaires, l'ambiance, les produits frais
Ton: Chaleureux, authentique, appétissant
CTAs: Voir le menu, Réserver une table, Commander en ligne`,
      en_US: `Type: Restaurant/Cafe/Tea Room
Recommended pages: Home, Menu, About, Events, Gallery, Contact  
Content: Highlight culinary specialties, atmosphere, fresh products
Tone: Warm, authentic, appetizing
CTAs: View menu, Book a table, Order online`
    },
    'Boutique en ligne': {
      fr_FR: `Type: E-commerce/Boutique en ligne
Pages recommandées: Accueil, Boutique, Promotions, À propos, Blog, Contact
Contenu: Présentation produits, avantages, garanties, livraison
Ton: Professionnel, rassurant, orienté vente
CTAs: Acheter maintenant, Voir les promotions, S'abonner à la newsletter`,
      en_US: `Type: E-commerce/Online Shop
Recommended pages: Home, Shop, Deals, About, Blog, Contact
Content: Product presentation, benefits, guarantees, delivery
Tone: Professional, reassuring, sales-oriented  
CTAs: Buy now, View deals, Subscribe to newsletter`
    },
    'Service professionnel': {
      fr_FR: `Type: Services professionnels (Consultant, Avocat, Architecte, etc.)
Pages recommandées: Accueil, Expertise, À propos, Témoignages, Blog, Contact
Contenu: Expertise, méthodologie, études de cas, certifications
Ton: Expert, crédible, rassurant
CTAs: Demander un devis, Prendre rendez-vous, Télécharger une ressource`,
      en_US: `Type: Professional Services (Consultant, Lawyer, Architect, etc.)
Recommended pages: Home, Expertise, About, Testimonials, Blog, Contact
Content: Expertise, methodology, case studies, certifications
Tone: Expert, credible, reassuring
CTAs: Request a quote, Book an appointment, Download resource`
    },
    'Artiste/Créatif': {
      fr_FR: `Type: Artiste/Designer/Photographe/Créatif
Pages recommandées: Accueil, Portfolio, À propos, Services, Blog, Contact
Contenu: Œuvres, style artistique, processus créatif, expositions
Ton: Inspirant, unique, émotionnel
CTAs: Voir le portfolio, Commander une œuvre, Suivre sur les réseaux`,
      en_US: `Type: Artist/Designer/Photographer/Creative
Recommended pages: Home, Portfolio, About, Services, Blog, Contact
Content: Works, artistic style, creative process, exhibitions
Tone: Inspiring, unique, emotional
CTAs: View portfolio, Commission work, Follow on social media`
    },
    'Association': {
      fr_FR: `Type: Association/Organisme à but non lucratif
Pages recommandées: Accueil, Mission, Actions, Actualités, Faire un don, Contact
Contenu: Cause défendue, impact, témoignages, rapports d'activité
Ton: Engagé, transparent, inspirant
CTAs: Faire un don, Devenir bénévole, Signer une pétition`,
      en_US: `Type: Association/Non-profit organization
Recommended pages: Home, Mission, Actions, News, Donate, Contact
Content: Cause defended, impact, testimonials, activity reports
Tone: Committed, transparent, inspiring
CTAs: Make a donation, Become a volunteer, Sign a petition`
    }
  };

  const defaultContext = {
    fr_FR: `Type: ${businessType}
Pages recommandées: Accueil, Services, À propos, Contact
Contenu: Présentation de l'activité, valeurs, avantages clients
Ton: Professionnel et engageant
CTAs: Nous contacter, En savoir plus`,
    en_US: `Type: ${businessType}
Recommended pages: Home, Services, About, Contact
Content: Business presentation, values, customer benefits
Tone: Professional and engaging  
CTAs: Contact us, Learn more`
  };

  return contexts[businessType]?.[language] || defaultContext[language];
}

// Contextualisation par public cible
function getAudienceContext(targetAudience, language) {
  const audiences = {
    'Particuliers': {
      fr_FR: 'Public: Particuliers - Ton chaleureux et accessible, focus sur les bénéfices concrets',
      en_US: 'Audience: Individuals - Warm and accessible tone, focus on concrete benefits'
    },
    'Professionnels': {
      fr_FR: 'Public: Professionnels - Ton expert et technique, focus sur le ROI et la performance',
      en_US: 'Audience: Professionals - Expert and technical tone, focus on ROI and performance'
    },
    'Jeunes': {
      fr_FR: 'Public: Jeunes adultes - Ton dynamique et moderne, focus sur l\'expérience et les tendances',
      en_US: 'Audience: Young adults - Dynamic and modern tone, focus on experience and trends'
    },
    'Seniors': {
      fr_FR: 'Public: Seniors - Ton rassurant et clair, focus sur la simplicité et la confiance',
      en_US: 'Audience: Seniors - Reassuring and clear tone, focus on simplicity and trust'
    }
  };

  return audiences[targetAudience]?.[language] || 
    (language === 'fr_FR' ? 'Public: Général - Ton professionnel et adapté à tous' : 'Audience: General - Professional tone suitable for all');
}

// Contextualisation par style
function getStyleContext(stylePreference, language) {
  const styles = {
    'Moderne': {
      fr_FR: 'Style: Moderne - Design épuré, typographie nette, couleurs sobres, beaucoup d\'espace',
      en_US: 'Style: Modern - Clean design, sharp typography, muted colors, lots of space'
    },
    'Classique': {
      fr_FR: 'Style: Classique - Design traditionnel, couleurs chaleureuses, structure conventionnelle',
      en_US: 'Style: Classic - Traditional design, warm colors, conventional structure'
    },
    'Créatif': {
      fr_FR: 'Style: Créatif - Design original, couleurs vives, typographie expressive, animations',
      en_US: 'Style: Creative - Original design, bright colors, expressive typography, animations'
    },
    'Minimaliste': {
      fr_FR: 'Style: Minimaliste - Design épuré au maximum, contenu essentiel, tons neutres',
      en_US: 'Style: Minimalist - Extremely clean design, essential content, neutral tones'
    },
    'Luxe': {
      fr_FR: 'Style: Luxe - Design élégant, couleurs profondes, typographie sophistiquée, beaucoup d\'espace blanc',
      en_US: 'Style: Luxury - Elegant design, deep colors, sophisticated typography, lots of white space'
    }
  };

  return styles[stylePreference]?.[language] || 
    (language === 'fr_FR' ? 'Style: Professionnel - Design équilibré et adapté à tous' : 'Style: Professional - Balanced design suitable for all');
}

// Prompt système amélioré
function getSystemPrompt(language) {
  const prompts = {
    fr_FR: `Tu es un expert en conception de sites WordPress avec 10 ans d'expérience.
RÔLE:
- Créateur de structures de sites optimisées pour WordPress
- Expert en expérience utilisateur et conversion
- Rédacteur de contenu professionnel et engageant

DIRECTIVES STRICTES:
1. Retourne TOUJOURS du JSON valide et parsable
2. Pas de texte avant ou après le JSON
3. Contenu 100% original et spécifique au contexte
4. Structure cohérente avec les bonnes pratiques WordPress
5. Optimisé pour le référencement et la conversion

COMPÉTENCES:
- Architecture de l'information
- Rédaction persuasive
- Design d'interface utilisateur
- Stratégie de contenu

FORMAT:
Uniquement du JSON valide selon le schéma demandé.`,
    en_US: `You are a WordPress website design expert with 10 years of experience.
ROLE:
- Creator of optimized WordPress site structures
- Expert in user experience and conversion
- Professional and engaging content writer

STRICT GUIDELINES:
1. ALWAYS return valid, parsable JSON
2. No text before or after the JSON
3. 100% original content specific to the context
4. Structure consistent with WordPress best practices
5. Optimized for SEO and conversion

SKILLS:
- Information architecture
- Persuasive writing
- User interface design
- Content strategy

FORMAT:
Only valid JSON according to the requested schema.`
  };

  return prompts[language] || prompts.en;
}

function cleanAndParseStructure(aiContent, context) {
  try {
    console.log('🔧 Nettoyage et parsing JSON...');

    // Nettoyage basique
    let cleanedContent = aiContent
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    // Le modèle Qwen génère du JSON propre, on peut parser directement
    let jsonString = cleanedContent;

    // Vérifier que c'est bien du JSON
    if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) {
      // Essayer d'extraire le JSON
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      } else {
        throw new Error('Format JSON non reconnu');
      }
    }

    console.log('📄 JSON à parser (début):', jsonString.substring(0, 150));

    const rawStructure = JSON.parse(jsonString);
    
    console.log('✅ JSON parsé avec succès');
    
    // Validation et enrichissement
    return validateAndEnrichStructure(rawStructure, context);
    
  } catch (parseError) {
    console.warn('❌ Erreur parsing JSON:', parseError.message);
    console.log('🔍 Contenu problématique:', aiContent.substring(0, 300));
    
    throw parseError;
  }
}

/**
 * Version alternative plus permissive de cleanAndParseStructure
 */
function cleanAndParseStructurePermissive(aiContent, context) {
  try {
    console.log('🔧 Tentative de parsing permissif...');

    // Essayer d'abord la méthode standard
    try {
      return cleanAndParseStructure(aiContent, context);
    } catch (firstError) {
      console.log('⚠️ Première méthode échouée, tentative de récupération...');
    }

    // Méthode de récupération: chercher des fragments JSON et les combiner
    const jsonFragments = extractJSONFragments(aiContent);
    
    if (jsonFragments.pages || jsonFragments.menu || jsonFragments.themeSuggestions) {
      console.log('🔧 Reconstruction à partir de fragments...');
      return validateAndEnrichStructure(jsonFragments, context);
    }

    throw new Error('Impossible de récupérer la structure JSON');

  } catch (error) {
    console.warn('❌ Échec du parsing permissif:', error.message);
    return generateContextualFallback(
      context.siteName, 
      context.businessType, 
      context.language,
      context.targetAudience,
      context.stylePreference
    );
  }
}

/**
 * Extrait des fragments JSON de la réponse
 */
function extractJSONFragments(content) {
  const fragments = {};

  // Chercher des pages
  const pagesMatch = content.match(/"pages"\s*:\s*(\[[^]]+\])/s);
  if (pagesMatch) {
    try {
      fragments.pages = JSON.parse(pagesMatch[1]);
      console.log('📄 Fragments pages trouvés');
    } catch (e) {
      console.warn('⚠️ Impossible de parser les pages fragments');
    }
  }

  // Chercher le menu
  const menuMatch = content.match(/"menu"\s*:\s*(\[[^]]+\])/s);
  if (menuMatch) {
    try {
      fragments.menu = JSON.parse(menuMatch[1]);
      console.log('📄 Fragments menu trouvés');
    } catch (e) {
      console.warn('⚠️ Impossible de parser le menu fragments');
    }
  }

  // Chercher les suggestions de thèmes
  const themesMatch = content.match(/"themeSuggestions"\s*:\s*(\[[^]]+\])/s);
  if (themesMatch) {
    try {
      fragments.themeSuggestions = JSON.parse(themesMatch[1]);
      console.log('📄 Fragments thèmes trouvés');
    } catch (e) {
      console.warn('⚠️ Impossible de parser les thèmes fragments');
    }
  }

  return fragments;
}

/**
 * Fonction wrapper avec logging détaillé
 */
function parseAIResponseSafely(aiContent, context) {
  console.log('🚨 === DÉBUT DEBUG PARSING ===');
  console.log('📏 Longueur réponse:', aiContent?.length);
  console.log('🔍 100 premiers caractères:', aiContent?.substring(0, 100));
  console.log('🔍 100 derniers caractères:', aiContent?.substring(aiContent.length - 100));
  
  try {
    const result = cleanAndParseStructure(aiContent, context);
    console.log('✅ === PARSING RÉUSSI ===');
    return result;
  } catch (error) {
    console.error('❌ === ÉCHEC PARSING ===');
    console.error('💬 Message erreur:', error.message);
    console.error('🔍 Stack:', error.stack);
    
    // Essayer la méthode permissive en dernier recours
    try {
      console.log('🔄 Tentative avec méthode permissive...');
      const fallbackResult = cleanAndParseStructurePermissive(aiContent, context);
      console.log('✅ Méthode permissive réussie');
      return fallbackResult;
    } catch (fallbackError) {
      console.error('❌ Méthode permissive également échouée');
      throw fallbackError;
    }
  }
}

// Validation et enrichissement de la structure
function validateAndEnrichStructure(structure, context) {
  const { siteName, businessType, language, targetAudience, stylePreference } = context;
  
  // Validation des pages
  if (!structure.pages || !Array.isArray(structure.pages) || structure.pages.length === 0) {
    structure.pages = generateContextualPages(businessType, language, siteName);
  }

  // Enrichissement des pages
  structure.pages = structure.pages.map((page, index) => ({
    title: page.title || getDefaultPageTitle(index, language),
    slug: page.slug || generateSlug(page.title || `page-${index + 1}`),
    content: validateAndEnrichBlocks(
      page.content?.blocks || [], 
      page.title, 
      { businessType, language, targetAudience, siteName }
    )
  }));

  // Validation du menu
  if (!structure.menu || !Array.isArray(structure.menu)) {
    structure.menu = generateContextualMenu(structure.pages, language, businessType); 
  }

  // Validation des thèmes
  if (!structure.themeSuggestions || !Array.isArray(structure.themeSuggestions)) {
    structure.themeSuggestions = getContextualThemeSuggestions(businessType, stylePreference);
  }

  return structure;
}

// Enrichissement des blocs avec contenu contextuel
function validateAndEnrichBlocks(blocks, pageTitle, context) {
  if (!blocks || blocks.length === 0) {
    return generateContextualBlocks(pageTitle, context);
  }

  // CORRECTION: Utiliser le contexte passé en paramètre
  const { businessType, language, siteName } = context;

  return blocks.map(block => ({
    type: validateBlockType(block.type),
    content: block.content || getEnrichedContent(pageTitle, businessType, language, siteName),
    attributes: enrichBlockAttributes(block.attributes || {}, block.type, context)
  }));
}

// Validation du type de bloc
function validateBlockType(blockType) {
  const validTypes = ['hero', 'heading', 'paragraph', 'features', 'cta', 'image', 'gallery', 'testimonials'];
  return validTypes.includes(blockType) ? blockType : 'paragraph';
}

// Enrichissement des attributs de bloc
function enrichBlockAttributes(attributes, blockType, context) {
  const { businessType, language, targetAudience, siteName } = context;

  switch (blockType) {
    case 'hero':
      return {
        subtitle: attributes.subtitle || getHeroSubtitle(businessType, language),
        buttonText: attributes.buttonText || getCTAText('primary', language),
        buttonLink: attributes.buttonLink || '/contact',
        ...attributes
      };
    
    case 'features':
      return {
        items: attributes.items || getBusinessFeatures(businessType, language),
        ...attributes
      };
    
    case 'cta':
      return {
        buttonText: attributes.buttonText || getCTAText('secondary', language),
        buttonLink: attributes.buttonLink || '/contact',
        ...attributes
      };
    
    default:
      return attributes;
  }
}

// Fallback contextualisé amélioré
function generateContextualFallback(siteName, businessType, language, targetAudience, stylePreference) {
  const pages = generateContextualPages(businessType, language, siteName);
  
  return {
    pages: pages.map(page => ({
      ...page,
      content: {
        blocks: generateContextualBlocks(page.title, { businessType, language, targetAudience, siteName })
      }
    })),
    menu: generateContextualMenu(pages, language),
    themeSuggestions: getContextualThemeSuggestions(businessType, stylePreference)
  };
}

// Génération de pages contextualisées
function generateContextualPages(businessType, language, siteName) {
  const pageTemplates = {
    'Restaurant': [
      { title: language === 'fr_FR' ? "Accueil" : "Home", slug: language === 'fr_FR' ? "accueil" : "home" },
      { title: language === 'fr_FR' ? "Notre Menu" : "Our Menu", slug: "menu" },
      { title: language === 'fr_FR' ? "Notre Histoire" : "Our Story", slug: language === 'fr_FR' ? "notre-histoire" : "our-story" },
      { title: language === 'fr_FR' ? "Réservation" : "Reservation", slug: "reservation" },
      { title: language === 'fr_FR' ? "Contact" : "Contact", slug: "contact" }
    ],
    'Boutique en ligne': [
      { title: language === 'fr_FR' ? "Accueil" : "Home", slug: language === 'fr_FR' ? "accueil" : "home" },
      { title: language === 'fr_FR' ? "Boutique" : "Shop", slug: language === 'fr_FR' ? "boutique" : "shop" },
      { title: language === 'fr_FR' ? "Promotions" : "Deals", slug: language === 'fr_FR' ? "promotions" : "deals" },
      { title: language === 'fr_FR' ? "À propos" : "About", slug: language === 'fr_FR' ? "a-propos" : "about" },
      { title: language === 'fr_FR' ? "Contact" : "Contact", slug: "contact" }
    ],
    'Service professionnel': [
      { title: language === 'fr_FR' ? "Accueil" : "Home", slug: language === 'fr_FR' ? "accueil" : "home" },
      { title: language === 'fr_FR' ? "Expertise" : "Expertise", slug: "expertise" },
      { title: language === 'fr_FR' ? "Méthodologie" : "Methodology", slug: language === 'fr_FR' ? "methodologie" : "methodology" },
      { title: language === 'fr_FR' ? "Témoignages" : "Testimonials", slug: language === 'fr_FR' ? "temoignages" : "testimonials" },
      { title: language === 'fr_FR' ? "Contact" : "Contact", slug: "contact" }
    ]
  };

  const defaultPages = [
    { title: language === 'fr_FR' ? "Accueil" : "Home", slug: language === 'fr_FR' ? "accueil" : "home" },
    { title: language === 'fr_FR' ? "Services" : "Services", slug: "services" },
    { title: language === 'fr_FR' ? "À propos" : "About", slug: language === 'fr_FR' ? "a-propos" : "about" },
    { title: language === 'fr_FR' ? "Contact" : "Contact", slug: "contact" }
  ];

  return pageTemplates[businessType] || defaultPages;
}

// Fonctions helper existantes conservées mais améliorées...
function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function getDefaultPageTitle(index, language) {
  const titles = {
    fr_FR: ['Accueil', 'Services', 'À propos', 'Contact'],
    en_US: ['Home', 'Services', 'About', 'Contact']
  };
  return titles[language]?.[index] || `Page ${index + 1}`;
}