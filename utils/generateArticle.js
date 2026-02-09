// utils/generateArticle.js - MODIFICATIONS COMPLÈTES
import axios from 'axios';
import { OPENROUTER_AI_API, OPENROUTER_AI_KEY } from '../config/ia.js';
import { checkAiGenerationsLimit } from '../services/aiModel.service.js';

function cleanArticleContent(content) {
  if (!content) return '';

  return content
    // Normaliser les sauts de ligne
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

    // Supprimer les backslashes isolés AVANT guillemets
    .replace(/\\(?=["'])/g, '')

    // Nettoyer les espaces excessifs
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


/**
 * Génère des articles avec gestion des modèles IA selon l'abonnement
 */
export async function generateArticles(params) {
  const {
    numArticles,
    topic,
    language,
    siteName,
    userId,
    aiModel // NOUVEAU: Modèle IA spécifique (optionnel)
  } = params;

  console.log('📝 Début génération articles:', {
    numArticles,
    topic,
    language,
    userId,
    model: aiModel ? `${aiModel.provider}/${aiModel.modelId}` : 'défaut'
  });

  const articles = [];

  // Déterminer le modèle à utiliser
  const modelToUse = await determineArticleAiModel(aiModel, userId);
  
  console.log(`🎯 Utilisation du modèle: ${modelToUse.name} (${modelToUse.modelId})`);

  try {
  // Vérifier les limites avant de générer (sécurité supplémentaire)
  if (userId) {
    const limitCheck = await checkAiGenerationsLimit(userId);
    
    if (!limitCheck.allowed) {
      throw new Error(`Limite de générations IA atteinte. Restant: ${limitCheck.remaining}/${limitCheck.limit}`);
    }
  }

    // Prompt optimisé pour un format cohérent
    const promptBase = (theme, lang, articleNum) => `
  Crée un article de blog ${lang === 'fr_FR' ? 'en_US français' : 'in English'} sur le thème : "${theme}".

  EXIGENCES STRICTES:
  - TITRE UNIQUEMENT sur la première ligne (sans #, sans **, sans formatage markdown)
  - Contenu à partir de la deuxième ligne
  - Structure: introduction, 2-3 paragraphes de développement, conclusion
  - Style professionnel et engageant
  - Longueur: 300-500 mots
  - Thème spécifique: ${theme} ${articleNum > 1 ? `(variation ${articleNum})` : ''}

  FORMAT EXACT:
  [Titre simple et accrocheur]
  [Ligne vide]
  [Contenu de l'article avec des paragraphes séparés par des lignes vides]
  `;

    for (let i = 0; i < numArticles; i++) {
      const prompt = promptBase(topic, language, i + 1);

      try {
        console.log(`📝 Génération de l'article ${i + 1}/${numArticles} avec ${modelToUse.name}...`);
        
        const response = await axios.post(
          OPENROUTER_AI_API,
          {
            model: `${modelToUse.modelId}`, // NOUVEAU: Modèle dynamique
            messages: [
              { 
                role: 'system', 
                content: getSystemPrompt(language, modelToUse) // NOUVEAU: Prompt système adapté
              },
              { role: 'user', content: prompt },
            ],
            max_tokens: getMaxTokensForModel(modelToUse), // NOUVEAU: Tokens adaptés
            temperature: getTemperatureForModel(modelToUse), // NOUVEAU: Température adaptée
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENROUTER_AI_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: getTimeoutForModel(modelToUse), // NOUVEAU: Timeout adapté
          }
        );

        let content = response.data.choices[0].message.content;
        
        console.log(`📋 Réponse brute (début):`, content.substring(0, 150) + '...');

        content = cleanArticleContent(content);

        // Nettoyage et extraction améliorés
        const { title, body } = extractTitleAndBody(content, topic, i + 1, language);
        
        console.log(`✅ Article ${i + 1} - Titre: "${title}"`);
        console.log(`📝 Extrait: "${body.substring(0, 80)}..."`);

        articles.push({ 
          title: title, 
          content: body,
          excerpt: generateExcerpt(body, language),
          status: 'publish',
          comment_status: 'open',
          aiModel: modelToUse.name // NOUVEAU: Tracking du modèle utilisé
        });

        // Pause progressive adaptée au modèle
        const delay = getDelayForModel(modelToUse, i);
        if (i < numArticles - 1) {
          console.log(`⏳ Attente de ${delay}ms avant le prochain article...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (err) {
        console.error(`❌ Erreur génération article ${i + 1} avec ${modelToUse.name}:`, err.response?.data || err.message);
        
        // Essayer avec un modèle de fallback si possible
        if (i === 0 && !modelToUse.isDefault) {
          console.log('🔄 Tentative avec modèle de fallback...');
          try {
            const fallbackModel = getDefaultAiModel();
            const fallbackArticle = await generateSingleArticleWithModel(fallbackModel, prompt, topic, i + 1, language);
            articles.push(fallbackArticle);
            continue;
          } catch (fallbackError) {
            console.error('❌ Échec également avec le modèle de fallback');
          }
        }
        
        // Article de secours amélioré
        const fallbackArticle = createFallbackArticle(topic, i + 1, language, modelToUse);
        articles.push(fallbackArticle);
        
        // Pause plus longue en_US cas d'erreur
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(`🎉 ${articles.length}/${numArticles} articles générés avec ${modelToUse.name}`);
    // Enregistrer l'usage pour les articles générés
    if (userId && articles.length > 0) {
      try {
        const { recordAiGenerationUsage } = await import('../services/aiModel.service.js');
        await recordAiGenerationUsage(userId, {
          count: articles.length * (modelToUse.costPerGeneration || 1),
          generationType: 'article',
          aiModel: modelToUse.name,
          articlesGenerated: articles.length,
          topic: topic,
          tokensUsed: estimateTokensForArticles(articles)
        });
      } catch (trackingError) {
        console.warn('⚠️ Erreur tracking usage articles:', trackingError.message);
      }
    }
    
    return articles;

  } catch (error) {
    console.error('❌ Erreur génération articles:', error);
    throw error;
  }
}

function estimateTokensForArticles(articles) {
  return articles.reduce((total, article) => {
    return total + (article.content?.length || 0) / 4;
  }, 0);
}

/**
 * Détermine le modèle IA à utiliser pour les articles
 */
async function determineArticleAiModel(providedAiModel, userId) {
  // Si un modèle est fourni explicitement, l'utiliser
  if (providedAiModel) {
    return providedAiModel;
  }

  // Si un userId est fourni, essayer de récupérer le modèle selon l'abonnement
  if (userId) {
    try {
      // NOUVEAU: Import dynamique pour éviter les dépendances circulaires
      const { getAiModelForUser } = await import('../services/aiModelService.js');
      const userAiModel = await getAiModelForUser(userId, 'article');
      console.log(`🎯 Modèle utilisateur sélectionné: ${userAiModel.name}`);
      return userAiModel;
    } catch (error) {
      console.warn('⚠️ Erreur récupération modèle utilisateur:', error.message);
    }
  }

  // Fallback vers un modèle par défaut
  return getDefaultAiModel();
}

/**
 * Retourne le modèle IA par défaut
 */
function getDefaultAiModel() {
  return {
    id: 0,
    name: 'OpenAI GPT-3.5 Turbo',
    provider: 'openai',
    modelId: 'gpt-3.5-turbo',
    isDefault: true
  };
}

/**
 * Génère un seul article avec un modèle spécifique (pour les retry)
 */
async function generateSingleArticleWithModel(aiModel, prompt, topic, index, language) {
  const response = await axios.post(
    OPENROUTER_AI_API,
    {
      model: `${aiModel.provider}/${aiModel.modelId}`,
      messages: [
        { 
          role: 'system', 
          content: getSystemPrompt(language, aiModel)
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: getMaxTokensForModel(aiModel),
      temperature: getTemperatureForModel(aiModel),
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_AI_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: getTimeoutForModel(aiModel),
    }
  );

  let content = response.data.choices[0].message.content;
  content = cleanArticleContent(content);
  
  const { title, body } = extractTitleAndBody(content, topic, index, language);
  
  return {
    title: title, 
    content: body,
    excerpt: generateExcerpt(body, language),
    status: 'publish',
    comment_status: 'open',
    aiModel: aiModel.name
  };
}

/**
 * Retourne le prompt système adapté au modèle
 */
function getSystemPrompt(language, aiModel) {
  const basePrompt = `Tu es un rédacteur professionnel spécialisé dans la création de contenu pour blogs. 
  Retourne TOUJOURS le titre sur la première ligne (sans aucun formatage markdown).
  Le contenu doit commencer à partir de la troisième ligne.
  Utilise un style clair, professionnel et engageant.`;
  
  // Adaptations selon le modèle
  if (aiModel.modelId.includes('gpt-4')) {
    return `${basePrompt} Sois particulièrement créatif et approfondi dans ton analyse.`;
  } else if (aiModel.modelId.includes('claude-3')) {
    return `${basePrompt} Fais preuve de réflexion approfondie et de structure logique.`;
  }
  
  return basePrompt;
}

/**
 * Retourne le nombre max de tokens selon le modèle
 */
function getMaxTokensForModel(aiModel) {
  if (aiModel.modelId.includes('gpt-4')) {
    return 2000; // Plus de tokens pour GPT-4
  } else if (aiModel.modelId.includes('claude-3')) {
    return 2500; // Claude peut gérer plus de tokens
  }
  return 1500; // Défaut pour GPT-3.5
}

/**
 * Retourne la température selon le modèle
 */
function getTemperatureForModel(aiModel) {
  if (aiModel.modelId.includes('gpt-4')) {
    return 0.7; // Un peu plus créatif pour GPT-4
  } else if (aiModel.modelId.includes('claude-3')) {
    return 0.8; // Claude peut être plus créatif
  }
  return 0.8; // Défaut
}

/**
 * Retourne le timeout selon le modèle
 */
function getTimeoutForModel(aiModel) {
  if (aiModel.modelId.includes('gpt-4') || aiModel.modelId.includes('claude-3')) {
    return 60000; // Timeout plus long pour les modèles plus lents
  }
  return 45000; // Défaut
}

/**
 * Retourne le délai entre les requêtes selon le modèle
 */
function getDelayForModel(aiModel, articleIndex) {
  let baseDelay;
  
  if (aiModel.modelId.includes('gpt-4') || aiModel.modelId.includes('claude-3')) {
    baseDelay = 2000; // Modèles plus lents, besoin de plus de temps
  } else {
    baseDelay = 1000; // Modèles rapides
  }
  
  return baseDelay + (articleIndex * 500); // Progressive delay
}

// FONCTIONS EXISTANTES (conservées avec améliorations)

function extractTitleAndBody(content, topic, index, language) {
  const lines = content.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let title, body;

  if (lines.length === 0) {
    title = getDefaultTitle(topic, index, language);
    body = getDefaultContent(topic, language);
  } else if (lines.length === 1) {
    title = lines[0].substring(0, 200);
    body = getDefaultContent(topic, language);
  } else {
    title = lines[0].substring(0, 200);
    const bodyStartIndex = lines[1].length === 0 ? 2 : 1;
    body = lines.slice(bodyStartIndex).join('\n\n').trim();
    
    if (!body || body.length < 50) {
      body = getDefaultContent(topic, language);
    }
  }

  title = cleanArticleContent(title);
  body = cleanArticleContent(body);

  return { title, body };
}

function generateExcerpt(content, language) {
  const sentences = content.split(/[.!?]+/);
  const firstSentence = sentences[0]?.trim() || content.substring(0, 150);
  
  return firstSentence.length > 150 
    ? firstSentence.substring(0, 147) + '...'
    : firstSentence;
}

// Articles de secours par langue avec information du modèle
function createFallbackArticle(topic, index, language, aiModel) {
  const titles = {
    fr_FR: [
      `Les avantages de ${topic}`,
      `Guide complet sur ${topic}`,
      `${topic} : Tout ce que vous devez savoir`,
      `Comment maîtriser ${topic}`,
      `Les tendances actuelles de ${topic}`
    ],
    en_US: [
      `The Benefits of ${topic}`,
      `Complete Guide to ${topic}`,
      `${topic}: Everything You Need to Know`,
      `How to Master ${topic}`,
      `Current Trends in ${topic}`
    ]
  };

  const contents = {
    fr_FR: `Cet article explore en_US détail le thème de ${topic}. Nous aborderons les aspects fondamentaux ainsi que les applications pratiques. Vous découvrirez comment ${topic} peut transformer votre approche et quels sont les meilleures pratiques à adopter. Que vous soyez débutant ou expert, ce contenu vous apportera des insights précieux.`,
    en_US: `This article provides an in-depth exploration of ${topic}. We will cover the fundamental aspects as well as practical applications. You will discover how ${topic} can transform your approach and what are the best practices to adopt. Whether you are a beginner or an expert, this content will bring you valuable insights.`
  };

  const lang = language === 'fr_FR' ? 'fr_FR' : 'en_US';
  const titleIndex = Math.min(index - 1, titles[lang].length - 1);
  
  return {
    title: titles[lang][titleIndex] || getDefaultTitle(topic, index, language),
    content: contents[lang],
    excerpt: generateExcerpt(contents[lang], language),
    status: 'publish',
    comment_status: 'open',
    aiModel: aiModel ? `Fallback (${aiModel.name})` : 'Fallback System'
  };
}

function getDefaultTitle(topic, index, language) {
  return language === 'fr_FR' 
    ? `Article ${index} sur ${topic}`
    : `Article ${index} about ${topic}`;
}

function getDefaultContent(topic, language) {
  return language === 'fr_FR'
    ? `Contenu généré par IA.`
    : `Content generated by AI.`;
}