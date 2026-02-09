import { generateSiteStructure } from '../utils/generateSiteStructure.js';
import { updateUsageCounters } from '../utils/usageCounters.js';

/**
 * Génère une structure de site avec l'IA avec fallback
 */
export async function generateAiStructureWithFallback(userId, subscriptionPlan, data) {
  const {
    siteName,
    articleTopic,
    numArticles,
    language,
    businessType,
    targetAudience,
    stylePreference
  } = data;

  console.log('🚀 Début génération structure IA côté serveur:', {
    siteName,
    businessType,
    language
  });

  // Mettre à jour les compteurs d'usage
  await updateUsageCounters(userId, {
    structurePages: 1,
    siteName
  });

  try {
    // Utiliser la fonction avec OpenRouter
    const structure = await generateSiteStructure({
      siteName,
      articleTopic,
      numArticles,
      language,
      businessType,
      targetAudience,
      stylePreference
    });

    console.log('✅ Structure IA générée avec succès côté serveur');
    return {
      ...structure,
      subscriptionInfo: {
        plan: subscriptionPlan.name,
      }
    };

  } catch (error) {
    console.error('❌ Erreur génération structure IA côté serveur:', error.message);
    
    // Fallback garanti
    return generateFallbackStructure(siteName, businessType, language);
  }
}



/**
 * Génère les pages par défaut selon le type de business
 */
export function generateDefaultPages(businessType, language) {
  const isFR = language === 'fr_FR';

  const basePages = [
    { title: isFR ? "Accueil" : "Home", slug: isFR ? "accueil" : "home" },
    { title: isFR ? "À propos" : "About", slug: isFR ? "a-propos" : "about" },
    { title: isFR ? "Services" : "Services", slug: "services" },
    { title: isFR ? "Contact" : "Contact", slug: "contact" }
  ];

  const businessPagesMap = {
    "Restaurant": [
      { title: isFR ? "Menu" : "Menu", slug: "menu" },
      { title: isFR ? "Réservations" : "Reservations", slug: isFR ? "reservations" : "reservations" }
    ],

    "Boutique en ligne": [
      { title: isFR ? "Boutique" : "Shop", slug: isFR ? "boutique" : "shop" },
      { title: isFR ? "Panier" : "Cart", slug: isFR ? "panier" : "cart" }
    ],

    "Service professionnel": [
      { title: isFR ? "Expertise" : "Expertise", slug: "expertise" }
    ],

    "Artiste/Créatif": [
      { title: isFR ? "Galerie" : "Gallery", slug: isFR ? "galerie" : "gallery" }
    ],

    "Association": [
      { title: isFR ? "Nos actions" : "Our Actions", slug: isFR ? "nos-actions" : "our-actions" },
      { title: isFR ? "Faire un don" : "Donate", slug: isFR ? "don" : "donate" }
    ],

    "Immobilier": [
      { title: isFR ? "Biens" : "Properties", slug: isFR ? "biens" : "properties" }
    ],

    "Santé/Bien-être": [
      { title: isFR ? "Prestations" : "Treatments", slug: isFR ? "prestations" : "treatments" }
    ],

    "Éducation": [
      { title: isFR ? "Formations" : "Courses", slug: isFR ? "formations" : "courses" }
    ],

    "Sport/Loisirs": [
      { title: isFR ? "Activités" : "Activities", slug: isFR ? "activites" : "activities" }
    ],

    "Blog personnel": [
      { title: isFR ? "Blog" : "Blog", slug: "blog" }
    ],

    "Portfolio": [
      { title: isFR ? "Projets" : "Projects", slug: isFR ? "projets" : "projects" }
    ],

    "Consultant": [
      { title: isFR ? "Méthodologie" : "Methodology", slug: isFR ? "methodologie" : "methodology" }
    ],

    "Agence": [
      { title: isFR ? "Équipe" : "Team", slug: isFR ? "equipe" : "team" },
      { title: isFR ? "Réalisations" : "Case Studies", slug: isFR ? "realisations" : "case-studies" }
    ],

    "Événementiel": [
      { title: isFR ? "Événements" : "Events", slug: isFR ? "evenements" : "events" }
    ],

    "Hôtellerie/Tourisme": [
      { title: isFR ? "Chambres" : "Rooms", slug: isFR ? "chambres" : "rooms" },
      { title: isFR ? "Réservations" : "Bookings", slug: isFR ? "reservations" : "bookings" }
    ],

    "Alimentation/Boissons": [
      { title: isFR ? "Produits" : "Products", slug: isFR ? "produits" : "products" }
    ],

    "Mode/Beauté": [
      { title: isFR ? "Collections" : "Collections", slug: "collections" }
    ],

    "Finance": [
      { title: isFR ? "Solutions" : "Solutions", slug: isFR ? "solutions" : "solutions" }
    ],

    "Technologie": [
      { title: isFR ? "Produits" : "Products", slug: isFR ? "produits" : "products" },
      { title: isFR ? "Fonctionnalités" : "Features", slug: isFR ? "fonctionnalites" : "features" }
    ]
  };

  // Insertion après "À propos"
  if (businessPagesMap[businessType]) {
    basePages.splice(2, 0, ...businessPagesMap[businessType]);
  }

  return basePages.map(page => ({
    ...page,
    content: {
      blocks: generateDefaultBlocks(page.title, businessType, language)
    }
  }));
}


/**
 * Génère les blocs de contenu par défaut pour une page
 */
export function generateDefaultBlocks(pageTitle, businessType, language) {
  const blocks = [];
  
  // Hero section pour la page d'accueil
  if (pageTitle === "Accueil" || pageTitle === "Home") {
    blocks.push(
      {
        type: "hero",
        content: language === 'fr_FR' ? `${businessType} - Excellence et Qualité` : `${businessType} - Excellence and Quality`,
        attributes: {
          subtitle: language === 'fr_FR' ? "Bienvenue sur notre site" : "Welcome to our website",
          buttonText: language === 'fr_FR' ? "Découvrir" : "Discover",
          buttonLink: "#about"
        }
      },
      {
        type: "heading",
        content: language === 'fr_FR' ? "Pourquoi nous choisir ?" : "Why Choose Us?",
        attributes: { level: 2 }
      },
      {
        type: "features",
        content: language === 'fr_FR' ? "Nos avantages" : "Our Advantages",
        attributes: {
          items: language === 'fr_FR' ? [
            "Professionnalisme",
            "Qualité garantie", 
            "Service personnalisé"
          ] : [
            "Professionalism",
            "Guaranteed Quality",
            "Personalized Service"
          ]
        }
      }
    );
  } else if (pageTitle === "À propos" || pageTitle === "About") {
    blocks.push(
      {
        type: "heading",
        content: language === 'fr_FR' ? "Notre histoire" : "Our Story",
        attributes: { level: 1 }
      },
      {
        type: "paragraph",
        content: language === 'fr_FR' 
          ? `Découvrez notre passion pour ${businessType} et notre engagement envers l'excellence.`
          : `Discover our passion for ${businessType} and our commitment to excellence.`
      }
    );
  } else {
    // Titre pour les autres pages
    blocks.push({
      type: "heading",
      content: pageTitle,
      attributes: { level: 1 }
    });
  }
  
  // Bloc de contenu principal
  blocks.push({
    type: "paragraph",
    content: getDefaultContent(pageTitle, businessType, language)
  });

  return blocks;
}

/**
 * Retourne le contenu par défaut selon la page et la langue
 */
export function getDefaultContent(pageTitle, businessType, language) {
  const contentMap = {
    "Accueil": language === 'fr_FR' 
      ? `Bienvenue chez ${businessType}. Nous nous engageons à vous offrir des services de qualité adaptés à vos besoins. Découvrez notre expertise et notre passion.`
      : `Welcome to ${businessType}. We are committed to providing you with quality services tailored to your needs. Discover our expertise and passion.`,
    
    "Home": language === 'fr_FR' 
      ? `Bienvenue chez ${businessType}. Nous nous engageons à vous offrir des services de qualité adaptés à vos besoins. Découvrez notre expertise et notre passion.`
      : `Welcome to ${businessType}. We are committed to providing you with quality services tailored to your needs. Discover our expertise and passion.`,
    
    "À propos": language === 'fr_FR'
      ? `Notre entreprise se consacre à ${businessType} avec passion et professionnalisme. Forts de notre expérience, nous garantissons satisfaction et qualité.`
      : `Our company is dedicated to ${businessType} with passion and professionalism. With our experience, we guarantee satisfaction and quality.`,
    
    "About": language === 'fr_FR'
      ? `Notre entreprise se consacre à ${businessType} avec passion et professionnalisme. Forts de notre expérience, nous garantissons satisfaction et qualité.`
      : `Our company is dedicated to ${businessType} with passion and professionalism. With our experience, we guarantee satisfaction and quality.`,
    
    "Services": language === 'fr_FR'
      ? `Nous proposons une gamme complète de services professionnels adaptés à vos exigences. Chaque projet est unique et mérite notre attention totale.`
      : `We offer a complete range of professional services tailored to your requirements. Each project is unique and deserves our full attention.`,
    
    "Menu": language === 'fr_FR'
      ? `Découvrez notre carte élaborée avec soin. Des produits frais et de qualité pour une expérience culinaire exceptionnelle.`
      : `Discover our carefully crafted menu. Fresh, quality products for an exceptional culinary experience.`,
    
    "Boutique": language === 'fr_FR'
      ? `Parcourez notre sélection de produits soigneusement choisis. Qualité, style et satisfaction garantis.`
      : `Browse our selection of carefully chosen products. Quality, style and guaranteed satisfaction.`,
    
    "Shop": language === 'fr_FR'
      ? `Parcourez notre sélection de produits soigneusement choisis. Qualité, style et satisfaction garantis.`
      : `Browse our selection of carefully chosen products. Quality, style and guaranteed satisfaction.`,
    
    "Expertise": language === 'fr_FR'
      ? `Notre expertise sectorielle nous permet de vous offrir des solutions innovantes et efficaces pour répondre à vos défis.`
      : `Our sector expertise allows us to offer you innovative and effective solutions to meet your challenges.`,
    
    "Contact": language === 'fr_FR'
      ? `N'hésitez pas à nous contacter pour toute question ou devis. Notre équipe est à votre écoute et vous répondra dans les meilleurs délais.`
      : `Do not hesitate to contact us for any questions or quotes. Our team is listening and will respond to you as soon as possible.`
  };
  
  return contentMap[pageTitle] || (language === 'fr_FR' 
    ? "Contenu de la page en_US cours de rédaction." 
    : "Page content being written.");
}

/**
 * Génère le menu par défaut
 */
export function generateDefaultMenu(pages, language) {
  return pages.map(page => ({
    label: page.title,
    url: `/${page.slug}`,
    type: "page"
  }));
}

/**
 * Valide les données de génération de structure
 */
export function validateStructureData(data) {
  const { siteName, businessType, language } = data;
  
  if (!siteName) {
    throw new Error('Le nom du site est obligatoire');
  }
  
  if (!businessType) {
    throw new Error('Le type de business est obligatoire');
  }
  
  if (!language) {
    throw new Error('La langue est obligatoire');
  }
  
  return true;
}

export function generateContextualBlocks(pageTitle, context) {
  const { businessType, language, targetAudience, siteName } = context;
  
  const blockTemplates = {
    'Restaurant': getRestaurantBlocks(pageTitle, language, siteName),
    'Boutique en_US ligne': getEcommerceBlocks(pageTitle, language, siteName),
    'Service professionnel': getServiceBlocks(pageTitle, language, siteName),
    'default': getDefaultBlocks(pageTitle, language, siteName)
  };

  return blockTemplates[businessType] || blockTemplates.default;
}

/**
 * Blocs spécifiques pour les restaurants
 */
function getRestaurantBlocks(pageTitle, language, siteName) {
  const blocks = [];

  if (pageTitle === "Accueil" || pageTitle === "Home") {
    blocks.push(
      {
        type: "hero",
        content: language === 'fr_FR' ? `Bienvenue au ${siteName}` : `Welcome to ${siteName}`,
        attributes: {
          subtitle: language === 'fr_FR' ? "Une expérience culinaire exceptionnelle" : "An exceptional culinary experience",
          buttonText: language === 'fr_FR' ? "Découvrir notre menu" : "Discover our menu",
          buttonLink: "/menu"
        }
      },
      {
        type: "heading",
        content: language === 'fr_FR' ? "Nos spécialités maison" : "Our House Specialties",
        attributes: { level: 2 }
      },
      {
        type: "features",
        content: language === 'fr_FR' ? "Ce qui fait notre différence" : "What Makes Us Different",
        attributes: {
          items: language === 'fr_FR' ? [
            "Produits frais et locaux",
            "Cuisine créative et authentique",
            "Ambiance chaleureuse et conviviale",
            "Service attentionné et professionnel"
          ] : [
            "Fresh and local products",
            "Creative and authentic cuisine", 
            "Warm and friendly atmosphere",
            "Attentive and professional service"
          ]
        }
      }
    );
  }

  // Ajouter d'autres blocs selon les pages...
  
  return blocks.length > 0 ? blocks : getDefaultBlocks(pageTitle, language, siteName);
}

/**
 * Suggestions de thèmes contextualisées
 */
export function getContextualThemeSuggestions(businessType, stylePreference) {
  const themeMatrix = {
    'Restaurant': {
      'Moderne': ['restaurant', 'foodie', 'astra'],
      'Classique': ['bakery', 'cuisine', 'oceanwp'],
      'Créatif': ['foodpicky', 'neve', 'generatepress'],
      'Luxe': ['gourmet', 'hestia', 'astra']
    },
    'Boutique en_US ligne': {
      'Moderne': ['storefront', 'flatsome', 'astra'],
      'Classique': ['shop-isle', 'oceanwp', 'neve'],
      'Créatif': ['merchandiser', 'generatepress', 'hestia'],
      'Minimaliste': ['shopay', 'astra', 'neve']
    },
    'Service professionnel': {
      'Moderne': ['astra', 'generatepress', 'neve'],
      'Classique': ['oceanwp', 'hestia', 'customizr'],
      'Luxe': ['divi', 'astra', 'generatepress'],
      'Minimaliste': ['neve', 'generatepress', 'astra']
    }
  };

  return themeMatrix[businessType]?.[stylePreference] || 
         themeMatrix[businessType]?.['Moderne'] || 
         ['astra', 'oceanwp', 'generatepress'];
}

/**
 * Retourne les caractéristiques business selon le type d'activité
 */
export function getBusinessFeatures(businessType, language) {
  const featuresMap = {
    'Restaurant': {
      fr_FR: [
        "Produits frais et locaux",
        "Cuisine créative et authentique", 
        "Ambiance chaleureuse et conviviale",
        "Service attentionné et professionnel",
        "Cadre exceptionnel et accueillant"
      ],
      en_US: [
        "Fresh and local products",
        "Creative and authentic cuisine",
        "Warm and friendly atmosphere", 
        "Attentive and professional service",
        "Exceptional and welcoming setting"
      ]
    },
    'Boutique en_US ligne': {
      fr_FR: [
        "Produits de haute qualité",
        "Livraison rapide et sécurisée",
        "Service client réactif",
        "Paiements sécurisés",
        "Retours faciles et gratuits"
      ],
      en_US: [
        "High quality products",
        "Fast and secure delivery",
        "Responsive customer service", 
        "Secure payments",
        "Easy and free returns"
      ]
    },
    'Service professionnel': {
      fr_FR: [
        "Expertise sectorielle reconnue",
        "Approche personnalisée",
        "Résultats mesurables et garantis", 
        "Équipe d'experts dédiés",
        "Support continu et réactif"
      ],
      en_US: [
        "Recognized sector expertise",
        "Personalized approach",
        "Measurable and guaranteed results",
        "Dedicated team of experts", 
        "Continuous and responsive support"
      ]
    },
    'Artiste/Créatif': {
      fr_FR: [
        "Style unique et reconnaissable",
        "Créations originales et authentiques",
        "Attention aux détails",
        "Processus créatif maîtrisé", 
        "Œuvres faites main avec passion"
      ],
      en_US: [
        "Unique and recognizable style",
        "Original and authentic creations", 
        "Attention to detail",
        "Mastered creative process",
        "Handmade works with passion"
      ]
    },
    'Association': {
      fr_FR: [
        "Impact concret et mesurable",
        "Transparence totale des actions",
        "Équipe bénévole dévouée",
        "Partenariats solides et durables",
        "Rapports d'activité réguliers"
      ],
      en_US: [
        "Concrete and measurable impact",
        "Total transparency of actions",
        "Dedicated volunteer team",
        "Strong and sustainable partnerships", 
        "Regular activity reports"
      ]
    }
  };

  return featuresMap[businessType]?.[language] || 
    (language === 'fr_FR' ? 
      ["Qualité exceptionnelle", "Service personnalisé", "Expertise reconnue", "Satisfaction garantie"] :
      ["Exceptional quality", "Personalized service", "Recognized expertise", "Guaranteed satisfaction"]
    );
}

/**
 * Retourne le texte CTA selon le type et la langue
 */
export function getCTAText(ctaType, language) {
  const ctaMap = {
    'primary': {
      fr_FR: ["Découvrir nos services", "Voir nos réalisations", "Explorer nos produits", "Commencer maintenant"],
      en_US: ["Discover our services", "See our work", "Explore our products", "Get started now"]
    },
    'secondary': {
      fr_FR: ["Nous contacter", "Demander un devis", "Prendre rendez-vous", "En savoir plus"],
      en_US: ["Contact us", "Request a quote", "Book an appointment", "Learn more"] 
    },
    'hero': {
      fr_FR: ["Découvrir l'expérience", "Réserver maintenant", "Commander en_US ligne", "Explorer la galerie"],
      en_US: ["Discover the experience", "Book now", "Order online", "Explore gallery"]
    }
  };

  const texts = ctaMap[ctaType] || ctaMap.primary;
  return texts[language === 'fr_FR' ? 'fr_FR' : 'en_US'][Math.floor(Math.random() * texts.fr_FR.length)];
}

/**
 * Retourne un sous-titre hero contextualisé
 */
export function getHeroSubtitle(businessType, language) {
  const subtitleMap = {
    'Restaurant': {
      fr_FR: [
        "Une expérience culinaire exceptionnelle vous attend",
        "Découvrez l'art de la gastronomie sous son meilleur jour", 
        "Savourez des moments inoubliables dans un cadre unique",
        "L'excellence culinaire au service de vos papilles"
      ],
      en_US: [
        "An exceptional culinary experience awaits you",
        "Discover the art of gastronomy at its best",
        "Savor unforgettable moments in a unique setting", 
        "Culinary excellence at the service of your taste buds"
      ]
    },
    'Boutique en_US ligne': {
      fr_FR: [
        "Découvrez des produits exclusifs soigneusement sélectionnés",
        "Votre destination shopping en_US ligne de confiance",
        "Des articles de qualité qui font la différence",
        "Shopping en_US ligne sécurisé et personnalisé"
      ],
      en_US: [
        "Discover exclusive products carefully selected", 
        "Your trusted online shopping destination",
        "Quality items that make the difference",
        "Secure and personalized online shopping"
      ]
    },
    'Service professionnel': {
      fr_FR: [
        "Des solutions sur mesure pour votre réussite",
        "L'expertise qui fait la différence depuis des années", 
        "Votre partenaire de confiance pour tous vos projets",
        "Des résultats concrets qui dépassent vos attentes"
      ],
      en_US: [
        "Customized solutions for your success",
        "The expertise that makes the difference for years",
        "Your trusted partner for all your projects", 
        "Concrete results that exceed your expectations"
      ]
    },
    'Artiste/Créatif': {
      fr_FR: [
        "Là où l'art prend vie et l'émotion s'exprime",
        "Découvrez un univers créatif unique et inspirant", 
        "Des œuvres qui racontent des histoires extraordinaires",
        "L'excellence artistique au service de l'émotion"
      ],
      en_US: [
        "Where art comes to life and emotion is expressed",
        "Discover a unique and inspiring creative universe",
        "Works that tell extraordinary stories", 
        "Artistic excellence at the service of emotion"
      ]
    },
    'Association': {
      fr_FR: [
        "Ensemble, créons un impact positif et durable",
        "Votre engagement fait la différence chaque jour", 
        "Rejoignez une communauté qui change des vies",
        "Des actions concrètes pour un avenir meilleur"
      ],
      en_US: [
        "Together, let's create a positive and lasting impact",
        "Your commitment makes a difference every day",
        "Join a community that changes lives", 
        "Concrete actions for a better future"
      ]
    }
  };

  const subtitles = subtitleMap[businessType] || subtitleMap['Service professionnel'];
  const langKey = language === 'fr_FR' ? 'fr_FR' : 'en_US';
  return subtitles[langKey][Math.floor(Math.random() * subtitles[langKey].length)];
}

/**
 * Blocs spécifiques pour le e-commerce
 */
function getEcommerceBlocks(pageTitle, language, siteName) {
  const blocks = [];

  if (pageTitle === "Accueil" || pageTitle === "Home") {
    blocks.push(
      {
        type: "hero",
        content: language === 'fr_FR' ? `Bienvenue chez ${siteName}` : `Welcome to ${siteName}`,
        attributes: {
          subtitle: getHeroSubtitle('Boutique en_US ligne', language),
          buttonText: getCTAText('hero', language),
          buttonLink: language === 'fr_FR' ? "/boutique" : "/shop"
        }
      },
      {
        type: "heading", 
        content: language === 'fr_FR' ? "Nos collections exclusives" : "Our Exclusive Collections",
        attributes: { level: 2 }
      },
      {
        type: "features",
        content: language === 'fr_FR' ? "Pourquoi choisir notre boutique ?" : "Why Choose Our Shop?",
        attributes: {
          items: getBusinessFeatures('Boutique en_US ligne', language)
        }
      }
    );
  } else if (pageTitle === "Boutique" || pageTitle === "Shop") {
    blocks.push(
      {
        type: "heading",
        content: language === 'fr_FR' ? "Notre sélection de produits" : "Our Product Selection", 
        attributes: { level: 1 }
      },
      {
        type: "paragraph",
        content: language === 'fr_FR' ? 
          "Découvrez notre gamme soigneusement sélectionnée de produits de qualité. Chaque article est choisi pour son excellence et sa valeur ajoutée." :
          "Discover our carefully selected range of quality products. Each item is chosen for its excellence and added value."
      }
    );
  }

  return blocks.length > 0 ? blocks : getDefaultBlocks(pageTitle, 'Boutique en_US ligne', language);
}

/**
 * Blocs spécifiques pour les services professionnels
 */
function getServiceBlocks(pageTitle, language, siteName) {
  const blocks = [];

  if (pageTitle === "Accueil" || pageTitle === "Home") {
    blocks.push(
      {
        type: "hero", 
        content: language === 'fr_FR' ? `Solutions ${siteName}` : `${siteName} Solutions`,
        attributes: {
          subtitle: getHeroSubtitle('Service professionnel', language),
          buttonText: getCTAText('hero', language),
          buttonLink: language === 'fr_FR' ? "/expertise" : "/expertise"
        }
      },
      {
        type: "heading",
        content: language === 'fr_FR' ? "Notre expertise sectorielle" : "Our Sector Expertise", 
        attributes: { level: 2 }
      },
      {
        type: "features",
        content: language === 'fr_FR' ? "Notre valeur ajoutée" : "Our Added Value",
        attributes: {
          items: getBusinessFeatures('Service professionnel', language)
        }
      }
    );
  } else if (pageTitle === "Expertise") {
    blocks.push(
      {
        type: "heading",
        content: language === 'fr_FR' ? "Notre méthodologie éprouvée" : "Our Proven Methodology",
        attributes: { level: 1 }
      },
      {
        type: "paragraph", 
        content: language === 'fr_FR' ?
          "Notre approche structurée et nos méthodes éprouvées garantissent des résultats optimaux pour chaque projet que nous entreprenons." :
          "Our structured approach and proven methods guarantee optimal results for every project we undertake."
      }
    );
  }

  return blocks.length > 0 ? blocks : getDefaultBlocks(pageTitle, 'Service professionnel', language);
}

/**
 * Blocs par défaut améliorés
 */
function getDefaultBlocks(pageTitle, businessType, language) {
  const blocks = [];
  
  if (pageTitle === "Accueil" || pageTitle === "Home") {
    blocks.push(
      {
        type: "hero",
        content: language === 'fr_FR' ? `Bienvenue chez ${businessType}` : `Welcome to ${businessType}`,
        attributes: {
          subtitle: getHeroSubtitle(businessType, language),
          buttonText: getCTAText('primary', language),
          buttonLink: language === 'fr_FR' ? "/services" : "/services"
        }
      },
      {
        type: "heading",
        content: language === 'fr_FR' ? "Notre valeur ajoutée" : "Our Added Value",
        attributes: { level: 2 }
      },
      {
        type: "features", 
        content: language === 'fr_FR' ? "Ce qui nous distingue" : "What Sets Us Apart",
        attributes: {
          items: getBusinessFeatures(businessType, language)
        }
      }
    );
  } else {
    blocks.push({
      type: "heading",
      content: pageTitle,
      attributes: { level: 1 }
    });
  }

  blocks.push({
    type: "paragraph",
    content: getDefaultContent(pageTitle, businessType, language)
  });

  return blocks;
}

/**
 * Contenu enrichi pour les pages
 */
export function getEnrichedContent(pageTitle, businessType, language, siteName) {
  const enrichedContentMap = {
    'Restaurant': {
      'Accueil': language === 'fr_FR' ? 
        `Bienvenue au ${siteName}, où la passion de la gastronomie rencontre l'excellence culinaire. 
        Notre chef et son équipe vous invitent à un voyage sensoriel unique, mettant en_US valeur 
        les meilleurs produits de saison dans une ambiance raffinée et chaleureuse.` :
        `Welcome to ${siteName}, where the passion for gastronomy meets culinary excellence.
        Our chef and his team invite you on a unique sensory journey, showcasing
        the best seasonal products in a refined and warm atmosphere.`,
      
      'Menu': language === 'fr_FR' ?
        `Notre carte est le reflet de notre philosophie : authenticité, créativité et respect 
        des produits. Chaque plat est une composition unique, élaborée avec des ingrédients 
        frais et locaux, pour une expérience gustative mémorable.` :
        `Our menu reflects our philosophy: authenticity, creativity and respect
        for products. Each dish is a unique composition, made with fresh
        and local ingredients, for a memorable taste experience.`
    },
    'Boutique en_US ligne': {
      'Accueil': language === 'fr_FR' ?
        `${siteName} vous propose une sélection rigoureuse de produits d'exception. 
        Notre engagement : qualité, originalité et satisfaction client. 
        Découvrez notre univers et trouvez les pièces qui vous ressemblent.` :
        `${siteName} offers you a rigorous selection of exceptional products.
        Our commitment: quality, originality and customer satisfaction.
        Discover our universe and find the pieces that look like you.`,
      
      'Boutique': language === 'fr_FR' ?
        `Parcourez nos collections soigneusement sélectionnées. Chaque produit 
        a été choisi pour sa qualité, son design et sa valeur ajoutée. 
        Des pièces uniques qui allient esthétique et fonctionnalité.` :
        `Browse our carefully selected collections. Each product
        has been chosen for its quality, design and added value.
        Unique pieces that combine aesthetics and functionality.`
    },
    'Service professionnel': {
      'Accueil': language === 'fr_FR' ?
        `${siteName} vous accompagne dans la réalisation de vos projets avec 
        expertise et innovation. Notre approche personnalisée et nos solutions 
        sur mesure garantissent votre réussite et votre satisfaction.` :
        `${siteName} supports you in the realization of your projects with
        expertise and innovation. Our personalized approach and our solutions
        custom-made guarantee your success and your satisfaction.`,
      
      'Expertise': language === 'fr_FR' ?
        `Notre méthodologie éprouvée s'appuie sur des années d'expérience 
        et d'innovation. Nous combinons savoir-faire traditionnel et 
        technologies de pointe pour des résultats optimaux et durables.` :
        `Our proven methodology is based on years of experience
        and innovation. We combine traditional know-how and
        cutting-edge technologies for optimal and sustainable results.`
    }
  };

  const businessContent = enrichedContentMap[businessType];
  if (businessContent && businessContent[pageTitle]) {
    return businessContent[pageTitle];
  }

  // Fallback vers le contenu par défaut
  return getDefaultContent(pageTitle, businessType, language);
}

/**
 * Génère une structure de fallback contextualisée
 */
export function generateContextualFallback(siteName, businessType, language, targetAudience, stylePreference) {
  const pages = generateDefaultPages(businessType, language);
  
  return {
    pages: pages.map(page => ({
      ...page,
      content: {
        blocks: generateContextualBlocks(page.title, { 
          businessType, 
          language, 
          targetAudience, 
          siteName 
        })
      }
    })),
    menu: generateDefaultMenu(pages, language),
    themeSuggestions: getContextualThemeSuggestions(businessType, stylePreference)
  };
}

/**
 * Génère une structure de fallback
 */
export function generateFallbackStructure(siteName, businessType, language) {
  const pages = generateDefaultPages(businessType, language);
  return {
    pages: pages,
    menu: generateContextualMenu(pages, language, businessType), // ← Utiliser la nouvelle fonction
    themeSuggestions: ["astra", "oceanwp", "generatepress"]
  };
}

/**
 * Génère un menu contextualisé selon le type de business
 */
export function generateContextualMenu(pages, language, businessType = 'Service professionnel') {
  const menuTemplates = {
    'Restaurant': getRestaurantMenu(pages, language),
    'Boutique en_US ligne': getEcommerceMenu(pages, language),
    'Service professionnel': getServiceMenu(pages, language),
    'Artiste/Créatif': getCreativeMenu(pages, language),
    'Association': getAssociationMenu(pages, language),
    'default': getDefaultMenu(pages, language)
  };

  return menuTemplates[businessType] || menuTemplates.default;
}

/**
 * Menu spécifique pour les restaurants
 */
function getRestaurantMenu(pages, language) {
  const menuStructure = [
    { label: language === 'fr_FR' ? "Accueil" : "Home", url: "/", type: "page", priority: 1 },
    { label: language === 'fr_FR' ? "Notre Menu" : "Our Menu", url: "/menu", type: "page", priority: 2 },
    { label: language === 'fr_FR' ? "La Carte des Vins" : "Wine List", url: "/carte-des-vins", type: "page", priority: 3 },
    { label: language === 'fr_FR' ? "Événements" : "Events", url: "/evenements", type: "page", priority: 4 },
    { label: language === 'fr_FR' ? "Galerie" : "Gallery", url: "/galerie", type: "page", priority: 5 },
    { label: language === 'fr_FR' ? "Réservation" : "Reservation", url: "/reservation", type: "page", priority: 6 },
    { label: language === 'fr_FR' ? "Contact" : "Contact", url: "/contact", type: "page", priority: 7 }
  ];

  return buildMenuFromStructure(menuStructure, pages, language);
}

/**
 * Menu spécifique pour le e-commerce
 */
function getEcommerceMenu(pages, language) {
  const menuStructure = [
    { label: language === 'fr_FR' ? "Accueil" : "Home", url: "/", type: "page", priority: 1 },
    { label: language === 'fr_FR' ? "Boutique" : "Shop", url: "/boutique", type: "page", priority: 2 },
    { label: language === 'fr_FR' ? "Nouveautés" : "New Arrivals", url: "/nouveautes", type: "page", priority: 3 },
    { label: language === 'fr_FR' ? "Promotions" : "Deals", url: "/promotions", type: "page", priority: 4 },
    { label: language === 'fr_FR' ? "Collections" : "Collections", url: "/collections", type: "page", priority: 5 },
    { label: language === 'fr_FR' ? "Marques" : "Brands", url: "/marques", type: "page", priority: 6 },
    { label: language === 'fr_FR' ? "Contact" : "Contact", url: "/contact", type: "page", priority: 7 }
  ];

  return buildMenuFromStructure(menuStructure, pages, language);
}

/**
 * Menu spécifique pour les services professionnels
 */
function getServiceMenu(pages, language) {
  const menuStructure = [
    { label: language === 'fr_FR' ? "Accueil" : "Home", url: "/", type: "page", priority: 1 },
    { label: language === 'fr_FR' ? "Expertise" : "Expertise", url: "/expertise", type: "page", priority: 2 },
    { label: language === 'fr_FR' ? "Services" : "Services", url: "/services", type: "page", priority: 3 },
    { label: language === 'fr_FR' ? "Méthodologie" : "Methodology", url: "/methodologie", type: "page", priority: 4 },
    { label: language === 'fr_FR' ? "Réalisations" : "Portfolio", url: "/realisations", type: "page", priority: 5 },
    { label: language === 'fr_FR' ? "Témoignages" : "Testimonials", url: "/temoignages", type: "page", priority: 6 },
    { label: language === 'fr_FR' ? "Contact" : "Contact", url: "/contact", type: "page", priority: 7 }
  ];

  return buildMenuFromStructure(menuStructure, pages, language);
}

/**
 * Menu spécifique pour les artistes/créatifs
 */
function getCreativeMenu(pages, language) {
  const menuStructure = [
    { label: language === 'fr_FR' ? "Accueil" : "Home", url: "/", type: "page", priority: 1 },
    { label: language === 'fr_FR' ? "Portfolio" : "Portfolio", url: "/portfolio", type: "page", priority: 2 },
    { label: language === 'fr_FR' ? "Galerie" : "Gallery", url: "/galerie", type: "page", priority: 3 },
    { label: language === 'fr_FR' ? "À propos" : "About", url: "/a-propos", type: "page", priority: 4 },
    { label: language === 'fr_FR' ? "Processus" : "Process", url: "/processus", type: "page", priority: 5 },
    { label: language === 'fr_FR' ? "Expositions" : "Exhibitions", url: "/expositions", type: "page", priority: 6 },
    { label: language === 'fr_FR' ? "Contact" : "Contact", url: "/contact", type: "page", priority: 7 }
  ];

  return buildMenuFromStructure(menuStructure, pages, language);
}

/**
 * Menu spécifique pour les associations
 */
function getAssociationMenu(pages, language) {
  const menuStructure = [
    { label: language === 'fr_FR' ? "Accueil" : "Home", url: "/", type: "page", priority: 1 },
    { label: language === 'fr_FR' ? "Notre Mission" : "Our Mission", url: "/mission", type: "page", priority: 2 },
    { label: language === 'fr_FR' ? "Nos Actions" : "Our Actions", url: "/actions", type: "page", priority: 3 },
    { label: language === 'fr_FR' ? "Actualités" : "News", url: "/actualites", type: "page", priority: 4 },
    { label: language === 'fr_FR' ? "Devenir Bénévole" : "Volunteer", url: "/benevole", type: "page", priority: 5 },
    { label: language === 'fr_FR' ? "Faire un Don" : "Donate", url: "/don", type: "page", priority: 6 },
    { label: language === 'fr_FR' ? "Contact" : "Contact", url: "/contact", type: "page", priority: 7 }
  ];

  return buildMenuFromStructure(menuStructure, pages, language);
}

/**
 * Menu par défaut amélioré
 */
function getDefaultMenu(pages, language) {
  const menuStructure = [
    { label: language === 'fr_FR' ? "Accueil" : "Home", url: "/", type: "page", priority: 1 },
    { label: language === 'fr_FR' ? "Services" : "Services", url: "/services", type: "page", priority: 2 },
    { label: language === 'fr_FR' ? "À propos" : "About", url: "/a-propos", type: "page", priority: 3 },
    { label: language === 'fr_FR' ? "Réalisations" : "Portfolio", url: "/realisations", type: "page", priority: 4 },
    { label: language === 'fr_FR' ? "Blog" : "Blog", url: "/blog", type: "page", priority: 5 },
    { label: language === 'fr_FR' ? "Contact" : "Contact", url: "/contact", type: "page", priority: 6 }
  ];

  return buildMenuFromStructure(menuStructure, pages, language);
}

/**
 * Construit le menu final en_US fusionnant la structure idéale avec les pages disponibles
 */
function buildMenuFromStructure(menuStructure, availablePages, language) {
  const availableSlugs = availablePages.map(page => page.slug);
  
  return menuStructure
    .filter(menuItem => {
      // Pour l'accueil, on garde toujours
      if (menuItem.url === '/') return true;
      
      // Pour les autres pages, on vérifie si la page existe
      const slug = menuItem.url.replace('/', '');
      return availableSlugs.includes(slug);
    })
    .slice(0, 6) // Maximum 6 éléments dans le menu
    .sort((a, b) => a.priority - b.priority)
    .map(menuItem => ({
      label: menuItem.label,
      url: menuItem.url,
      type: menuItem.type
    }));
}

/**
 * Génère un menu avec sous-menus pour les structures complexes
 */
export function generateAdvancedMenu(pages, language, businessType) {
  const mainMenu = generateContextualMenu(pages, language, businessType);
  
  // Ajouter des sous-menus pour certains types de business
  if (businessType === 'Boutique en_US ligne') {
    return addEcommerceSubmenus(mainMenu, language);
  } else if (businessType === 'Service professionnel') {
    return addServiceSubmenus(mainMenu, language);
  }
  
  return mainMenu;
}

/**
 * Ajoute des sous-menus pour le e-commerce
 */
function addEcommerceSubmenus(menu, language) {
  return menu.map(menuItem => {
    if (menuItem.label === (language === 'fr_FR' ? "Boutique" : "Shop")) {
      return {
        ...menuItem,
        children: [
          { label: language === 'fr_FR' ? "Tous les produits" : "All Products", url: "/boutique", type: "page" },
          { label: language === 'fr_FR' ? "Nouveautés" : "New Arrivals", url: "/nouveautes", type: "page" },
          { label: language === 'fr_FR' ? "Meilleures ventes" : "Best Sellers", url: "/best-sellers", type: "page" },
          { label: language === 'fr_FR' ? "Soldes" : "Sale", url: "/soldes", type: "page" }
        ]
      };
    }
    return menuItem;
  });
}

/**
 * Ajoute des sous-menus pour les services professionnels
 */
function addServiceSubmenus(menu, language) {
  return menu.map(menuItem => {
    if (menuItem.label === (language === 'fr_FR' ? "Services" : "Services")) {
      return {
        ...menuItem,
        children: [
          { label: language === 'fr_FR' ? "Consulting" : "Consulting", url: "/consulting", type: "page" },
          { label: language === 'fr_FR' ? "Formation" : "Training", url: "/formation", type: "page" },
          { label: language === 'fr_FR' ? "Accompagnement" : "Coaching", url: "/accompagnement", type: "page" },
          { label: language === 'fr_FR' ? "Audit" : "Audit", url: "/audit", type: "page" }
        ]
      };
    }
    return menuItem;
  });
}

/**
 * Génère un menu footer spécifique
 */
export function generateFooterMenu(pages, language, businessType) {
  const footerTemplates = {
    'Restaurant': [
      { label: language === 'fr_FR' ? "Horaires" : "Hours", url: "/horaires", type: "page" },
      { label: language === 'fr_FR' ? "Accès" : "Location", url: "/acces", type: "page" },
      { label: language === 'fr_FR' ? "Mentions légales" : "Legal", url: "/mentions-legales", type: "page" },
      { label: language === 'fr_FR' ? "CGV" : "Terms", url: "/cgv", type: "page" }
    ],
    'Boutique en_US ligne': [
      { label: language === 'fr_FR' ? "Livraison" : "Delivery", url: "/livraison", type: "page" },
      { label: language === 'fr_FR' ? "Retours" : "Returns", url: "/retours", type: "page" },
      { label: language === 'fr_FR' ? "CGV" : "Terms", url: "/cgv", type: "page" },
      { label: language === 'fr_FR' ? "Confidentialité" : "Privacy", url: "/confidentialite", type: "page" }
    ],
    'Service professionnel': [
      { label: language === 'fr_FR' ? "Mentions légales" : "Legal", url: "/mentions-legales", type: "page" },
      { label: language === 'fr_FR' ? "CGV" : "Terms", url: "/cgv", type: "page" },
      { label: language === 'fr_FR' ? "Confidentialité" : "Privacy", url: "/confidentialite", type: "page" },
      { label: language === 'fr_FR' ? "Plan du site" : "Sitemap", url: "/sitemap", type: "page" }
    ],
    'default': [
      { label: language === 'fr_FR' ? "Mentions légales" : "Legal", url: "/mentions-legales", type: "page" },
      { label: language === 'fr_FR' ? "Confidentialité" : "Privacy", url: "/confidentialite", type: "page" },
      { label: language === 'fr_FR' ? "Plan du site" : "Sitemap", url: "/sitemap", type: "page" },
      { label: language === 'fr_FR' ? "Contact" : "Contact", url: "/contact", type: "page" }
    ]
  };

  return footerTemplates[businessType] || footerTemplates.default;
}

/**
 * Valide et corrige un menu généré
 */
export function validateMenu(menu, availablePages) {
  const availableSlugs = availablePages.map(page => page.slug);
  
  return menu
    .filter(menuItem => {
      // L'accueil est toujours valide
      if (menuItem.url === '/') return true;
      
      // Vérifier si la page existe
      const slug = menuItem.url.replace('/', '');
      return availableSlugs.includes(slug);
    })
    .map(menuItem => ({
      label: menuItem.label || 'Menu Item',
      url: menuItem.url || '/',
      type: menuItem.type || 'page',
      children: menuItem.children ? validateMenu(menuItem.children, availablePages) : undefined
    }));
}