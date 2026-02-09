import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import WordPressService from '../services/wordpress.service.js';
import Theme from '../models/theme.js';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.BASE_URL_PRODUCTION 
  : process.env.BASE_URL || 'http://localhost';
/**
 * Crée un réseau Docker s'il n'existe pas
 */
export async function createDockerNetwork(networkName) {
  try {
    await execAsync(`docker network inspect ${networkName}`);
    console.log(`✅ Réseau ${networkName} existe déjà`);
  } catch {
    await execAsync(`docker network create ${networkName}`);
    console.log(`✅ Réseau ${networkName} créé`);
  }
}

/**
 * Récupère le port d'un conteneur
 */
export async function getContainerPort(containerName) {
  const portInfo = await execAsync(`docker port ${containerName}`);
  const portMatch = portInfo.stdout.match(/80\/tcp -> 0.0.0.0:(\d+)/);
  if (portMatch) {
    const port = parseInt(portMatch[1]);
    console.log(`✅ Port existant trouvé: ${port}`);
    return port;
  }
  throw new Error("Port non trouvé");
}


async function waitForMySQL(dbContainer) {
  console.log("⏳ Attente que MySQL soit prêt...");

  for (let i = 0; i < 20; i++) {
    try {
      await execAsync(
        `docker exec ${dbContainer} mysqladmin ping -uroot --password=root --silent`
      );
      console.log("✅ MySQL est prêt");
      return true;
    } catch {
      await new Promise((res) => setTimeout(res, 1000));
    }
  }

  throw new Error("❌ MySQL n'est jamais devenu prêt");
}

export async function configureWordPress(
  wpContainer,
  dbContainer,
  dbName,
  dbUser,
  dbPass,
  siteName,
  language,
  wpPort
) {
  // 1️⃣ Attendre que MySQL soit prêt
  await waitForMySQL(dbContainer);

  // 2️⃣ Créer wp-config
  try {
    await execAsync(`
      docker exec ${wpContainer} wp config create \
      --dbname=${dbName} \
      --dbuser=${dbUser} \
      --dbpass=${dbPass} \
      --dbhost=${dbContainer} \
      --locale=${language} \
      --allow-root \
      --force
    `);
    console.log("✅ wp-config.php créé");
  } catch (err) {
    console.warn("⚠ wp-config.php déjà créé ou erreur:", err.message);
  }

  // 3️⃣ Tester si WP est installé
  let coreInstalled = false;
  try {
    await execAsync(
      `docker exec ${wpContainer} wp core is-installed --allow-root`
    );
    coreInstalled = true;
  } catch {
    coreInstalled = false;
  }

  // 4️⃣ Installer WP si pas installé
  if (!coreInstalled) {
    console.log("🔨 Installation de WordPress...");
    await execAsync(`
      docker exec ${wpContainer} wp core install \
      --url=${BASE_URL}:${wpPort} \
      --title="${siteName}" \
      --admin_user=admin \
      --admin_password=admin \
      --admin_email=admin@example.com \
      --locale=${language} \
      --allow-root
    `);
    console.log("✅ WordPress installé");
  } else {
    console.log("✅ WordPress déjà installé");
  }

    // 5️⃣ Installer et activer la langue FR
  await execAsync(`
    docker exec ${wpContainer} wp language core install ${language} \
    --activate \
    --allow-root
  `);

  console.log("🇫🇷 Langue WordPress installée et activée");

  // 6️⃣ Forcer la langue du site
  await execAsync(`
    docker exec ${wpContainer} wp option update WPLANG ${language} \
    --allow-root
  `);
  console.log("✅ Langue du site WordPress mise à jour");
}


/**
 * Configure le conteneur de base de données
 */
export async function setupDatabaseContainer(dbContainer, networkName, dbName, dbPass, dbUser) {
  try {
    // S'assurer que le réseau existe d'abord
    await createDockerNetwork(networkName);
    
    // Vérifier si le conteneur existe déjà
    await execAsync(`docker inspect ${dbContainer}`);
    console.log(`✅ Conteneur DB ${dbContainer} existe déjà`);
  } catch {
    console.log(`❌ Conteneur DB ${dbContainer} non trouvé, création...`);
    
    // Créer le conteneur avec le réseau
    await execAsync(`
      docker run -d --name ${dbContainer} --network ${networkName} \
      -e MYSQL_ROOT_PASSWORD=${dbPass} -e MYSQL_DATABASE=${dbName} \
      mysql:8
    `);
    console.log(`✅ Conteneur DB ${dbContainer} créé`);
  }
}

/**
 * Crée et configure le conteneur WordPress
 */
export async function setupWordPressContainer({
  siteSlug,
  wpContainer,
  networkName,
  wpPort,
  sandboxDir,
  siteName,
  dbContainer,
  dbName,
  dbUser,
  dbPass, 
  language
}) {
  console.log(`🔨 Création du conteneur WP sur le port ${wpPort}...`);

  // Créer le conteneur WordPress
  await execAsync(`
    docker run -d \
    --name ${wpContainer} \
    --network ${networkName} \
    -p ${wpPort}:80 \
    -v ${sandboxDir}/wp-content:/var/www/html/wp-content \
    -e WORDPRESS_DB_HOST=${dbContainer} \
    -e WORDPRESS_DB_NAME=${dbName} \
    -e WORDPRESS_DB_USER=${dbUser} \
    -e WORDPRESS_DB_PASSWORD=${dbPass} \
    wordpress:php8.2-apache
  `);

  console.log(`✅ Conteneur WP ${wpContainer} lancé`);

  // Attendre que le conteneur soit complètement démarré
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Installer wp-cli inside container avec une meilleure gestion d'erreurs
  console.log("📦 Installation de WP-CLI...");
  
  try {
    // Méthode 1: Installation en étapes séparées
    await execAsync(`docker exec ${wpContainer} apt-get update`);
    console.log("✅ apt-get update réussi");
    
    await execAsync(`docker exec ${wpContainer} apt-get install -y curl`);
    console.log("✅ curl installé");
    
    // Télécharger WP-CLI
    await execAsync(`docker exec ${wpContainer} curl -o /usr/local/bin/wp https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar`);
    console.log("✅ WP-CLI téléchargé");
    
    // Rendre exécutable
    await execAsync(`docker exec ${wpContainer} chmod +x /usr/local/bin/wp`);
    console.log("✅ WP-CLI rendu exécutable");
    
    // Vérifier l'installation
    await execAsync(`docker exec ${wpContainer} wp --info`);
    console.log("✅ WP-CLI installé et fonctionnel");

  } catch (error) {
    console.error("❌ Échec installation WP-CLI, tentative alternative...");
    
    // Méthode alternative: utiliser une image avec WP-CLI préinstallé
    console.log("🔄 Utilisation de l'image WordPress avec WP-CLI préinstallé...");
    
    // Arrêter et supprimer le conteneur actuel
    await execAsync(`docker stop ${wpContainer}`).catch(() => {});
    await execAsync(`docker rm ${wpContainer}`).catch(() => {});
    
    // Recréer avec une image contenant WP-CLI
    await execAsync(`
      docker run -d \
      --name ${wpContainer} \
      --network ${networkName} \
      -p ${wpPort}:80 \
      -v ${sandboxDir}/wp-content:/var/www/html/wp-content \
      -e WORDPRESS_DB_HOST=${dbContainer} \
      -e WORDPRESS_DB_NAME=${dbName} \
      -e WORDPRESS_DB_USER=${dbUser} \
      -e WORDPRESS_DB_PASSWORD=${dbPass} \
      --health-cmd="curl -f http://localhost/ || exit 1" \
      --health-interval=10s \
      --health-timeout=5s \
      --health-retries=3 \
      wordpress:php8.2-apache
    `);

    console.log("✅ Conteneur recréé avec health check");

    // Installer WP-CLI plus simplement
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    await execAsync(`docker exec ${wpContainer} curl -o /tmp/wp-cli.phar https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar`);
    await execAsync(`docker exec ${wpContainer} chmod +x /tmp/wp-cli.phar`);
    await execAsync(`docker exec ${wpContainer} mv /tmp/wp-cli.phar /usr/local/bin/wp`);
    
    console.log("✅ WP-CLI installé via méthode alternative");
  }

  // Configuration Apache
  console.log("🔧 Configuration Apache...");
  try {
    await execAsync(`docker exec ${wpContainer} a2enmod headers rewrite`);
    
    // Créer le fichier de configuration sandbox
    await execAsync(`docker exec ${wpContainer} sh -c "echo 'Header always unset X-Frame-Options' > /etc/apache2/conf-available/sandbox.conf"`);
    await execAsync(`docker exec ${wpContainer} sh -c "echo 'Header always set Access-Control-Allow-Origin \"*\"' >> /etc/apache2/conf-available/sandbox.conf"`);
    await execAsync(`
      docker exec ${wpContainer} sh -c "echo 'Header always set Access-Control-Allow-Headers \\\"Content-Type, Authorization\\\"' >> /etc/apache2/conf-available/sandbox.conf"
    `);
    await execAsync(`docker exec ${wpContainer} sh -c "echo 'Header always set Access-Control-Allow-Methods \"GET, POST, PUT, DELETE, OPTIONS\"' >> /etc/apache2/conf-available/sandbox.conf"`);
    
    await execAsync(`docker exec ${wpContainer} a2enconf sandbox`);
    await execAsync(`docker exec ${wpContainer} service apache2 reload`);
    
    console.log("✅ Apache configuré (iframe + CORS)");
  } catch (error) {
    console.error("❌ Erreur configuration Apache:", error.message);
    // Continuer malgré l'erreur
  }

  // Attendre que WordPress soit prêt
  await WordPressService.waitForWordPress(wpContainer);

  // Setup WordPress
  await configureWordPress(
    wpContainer,
    dbContainer,
    dbName,
    dbUser,
    dbPass,
    siteName,
    language,
    wpPort
  );

  console.log(`🎯 WordPress prêt 🚀`);
  
  return wpPort;
}

/**
 * Configure l'environnement Docker complet
 */
export async function setupDockerEnvironment({ siteSlug, networkName, dbContainer, wpContainer, dbName, dbUser, dbPass, sandboxDir, siteName, language }) {
  const wpPort = await WordPressService.getAvailablePort();
  console.log(`✅ Port disponible trouvé: ${wpPort}`);

  // Créer le conteneur MySQL si inexistant
  await setupDatabaseContainer(dbContainer, networkName, dbName, dbPass, dbUser);
  
  // Créer le conteneur WordPress
  await setupWordPressContainer({
    siteSlug, wpContainer, networkName, wpPort, sandboxDir, siteName,
    dbContainer, dbName, dbUser, dbPass, language
  });

  return wpPort;
}

/**
 * Configure WordPress (plugins et thème)
 */
export async function setupWordPressPluginsAndTheme(wpContainer, dbContainer,selectedTheme) {
  // Vérifier que les deux conteneurs sont démarrés
  const isDbRunning = await WordPressService.ensureContainerRunning(dbContainer);
  const isWpRunning = await WordPressService.ensureContainerRunning(wpContainer);
  
  if (!isDbRunning || !isWpRunning) {
    throw new Error(`Les conteneurs ne sont pas accessibles: DB=${isDbRunning}, WP=${isWpRunning}`);
  }

  
  console.log("🔌 Installing plugins for headless Gutenberg...");
  await execAsync(`docker exec ${wpContainer} wp plugin install jwt-authentication-for-wp-rest-api --activate --allow-root`);
  await execAsync(`docker exec ${wpContainer} wp plugin install classic-editor --activate --allow-root`);
  await execAsync(`docker exec ${wpContainer} wp rewrite structure '/%postname%/' --allow-root`);

  await installHealthcheckPlugin(wpContainer);

  // Récupérer les informations du thème depuis la base de données
  try {
    const theme = await Theme.findOne({ 
      where: { 
        slug: selectedTheme,
        isActive: true 
      } 
    });

    if (!theme) {
      throw new Error(`Thème ${selectedTheme} non trouvé dans la base de données`);
    }

    console.log(`🎨 Installation du thème: ${theme.name} (${theme.slug})`);

    // Vérifier si le thème est déjà installé
    const installedThemesResult = await execAsync(`docker exec ${wpContainer} wp theme list --field=name --format=csv --allow-root`);
    
    // Convertir la sortie CSV en tableau et nettoyer les espaces
    const installedThemes = installedThemesResult.stdout
      .split('\n')
      .filter(theme => theme.trim()) // Supprimer les lignes vides
      .map(theme => theme.trim()); // Supprimer les espaces

    console.log(`📋 Thèmes installés:`, installedThemes);

    // Vérifier si le thème est déjà installé
    if (!installedThemes.includes(theme.slug)) {
      console.log(`📥 Téléchargement du thème: ${theme.slug}`);
      
      if (theme.downloadUrl) {
        // Télécharger et installer le thème depuis l'URL
        console.log(`🔗 Utilisation de l'URL de téléchargement: ${theme.downloadUrl}`);
        await execAsync(`docker exec ${wpContainer} wp theme install ${theme.downloadUrl} --allow-root`);
      } else {
        // Fallback: installer depuis le dépôt WordPress
        console.log(`📦 Installation depuis le dépôt WordPress`);
        await execAsync(`docker exec ${wpContainer} wp theme install ${theme.slug} --allow-root`);
      }
      
      console.log(`✅ Thème ${theme.name} téléchargé et installé`);
    } else {
      console.log(`✅ Thème ${theme.name} déjà installé`);
    }

    // Activer le thème
    await execAsync(`docker exec ${wpContainer} wp theme activate ${theme.slug} --allow-root`);
    console.log(`🎯 Thème ${theme.name} activé`);

    // Mettre à jour les métriques d'usage
    await theme.update({ 
      usageCount: theme.usageCount + 1 
    });

    return theme;

  } catch (err) {
    console.error("❌ Erreur installation thème:", err.message);
    
    // Fallback: essayer d'installer directement depuis le dépôt WordPress
    console.log("🔄 Tentative d'installation directe depuis le dépôt WordPress...");
    try {
      await execAsync(`docker exec ${wpContainer} wp theme install ${selectedTheme} --allow-root`);
      await execAsync(`docker exec ${wpContainer} wp theme activate ${selectedTheme} --allow-root`);
      console.log(`✅ Thème ${selectedTheme} installé et activé via fallback`);
    } catch (fallbackError) {
      console.error("❌ Échec de l'installation du thème même en fallback:", fallbackError.message);
      throw err; // Relancer l'erreur originale
    }
  }
}

/**
 * Installe le plugin custom-healthcheck dans WordPress
 */
export async function installHealthcheckPlugin(wpContainer) {
  console.log("🩺 Installation du plugin custom-healthcheck...");

  const pluginDir = `/var/www/html/wp-content/plugins/custom-healthcheck`;
  const localTmpDir = path.join(process.cwd(), "tmp_plugin");
  const localPluginFile = path.join(localTmpDir, "custom-healthcheck.php");

  // Code du plugin PHP
  const pluginPhp = `<?php
/**
 * Plugin Name: Custom Healthcheck
 * Description: API Healthcheck pour monitoring Docker (RAM, Disk, CPU, etc.)
 */

error_reporting(E_ERROR | E_PARSE);

add_action('rest_api_init', function () {
    register_rest_route('custom', '/healthcheck', array(
        'methods'  => 'GET',
        'callback' => 'custom_healthcheck_endpoint'
    ));
});

function custom_healthcheck_endpoint() {
    global $wpdb;

    $start = microtime(true);

    // ----------------------------------------------------
    // CPU LOAD
    // ----------------------------------------------------
    $cpu_load = function_exists('sys_getloadavg') ? sys_getloadavg()[0] : null;

    // ----------------------------------------------------
    // MEMORY USAGE (SAFE)
    // ----------------------------------------------------
    $memory_current = @file_get_contents('/sys/fs/cgroup/memory.current');
    $memory_max     = @file_get_contents('/sys/fs/cgroup/memory.max');

    // Nettoyage — éviter "max" ou false
    if ($memory_current !== false && is_numeric(trim($memory_current))) {
        $memory_current_mb = round(((int)$memory_current) / 1024 / 1024, 2);
    } else {
        $memory_current_mb = null;
    }

    if ($memory_max !== false && is_numeric(trim($memory_max))) {
        $memory_max_mb = round(((int)$memory_max) / 1024 / 1024, 2);
    } else {
        $memory_max_mb = null;
    }

    // ----------------------------------------------------
    // DISK USAGE (SAFE)
    // ----------------------------------------------------
    $disk_total = @disk_total_space('/var/www/html');
    $disk_free  = @disk_free_space('/var/www/html');
    $disk_used_mb = ($disk_total !== false && $disk_free !== false) ? round(($disk_total - $disk_free) / 1024 / 1024, 2) : null;

    // ----------------------------------------------------
    // DATABASE VERSION
    // ----------------------------------------------------
    $db_version = method_exists($wpdb, 'db_version') ? $wpdb->db_version() : null;

    // ----------------------------------------------------
    // PLUGIN UPDATES
    // ----------------------------------------------------
    if (!function_exists('get_plugin_updates')) {
        require_once ABSPATH . 'wp-admin/includes/update.php';
    }

    $updates_count = function_exists('get_plugin_updates')
        ? count(get_plugin_updates())
        : null;

    // ----------------------------------------------------
    // RESPONSE TIME
    // ----------------------------------------------------
    $response_time = round((microtime(true) - $start) * 1000);

    return array(
        "status" => "healthy",
        "response_time" => $response_time,

        "wp_version"   => get_bloginfo('version'),
        "php_version"  => PHP_VERSION,
        "db_version"   => $db_version,

        "server" => array(
            "cpu_load"        => $cpu_load,
            "memory_current"  => $memory_current_mb,
            "memory_limit"    => $memory_max_mb,
            "disk_used"       => $disk_used_mb
        ),

        "plugins" => array(
            "updates_available" => $updates_count
        )
    );
}

`;

  try {
    // 1️⃣ Créer un dossier temporaire local
    await fs.mkdir(localTmpDir, { recursive: true });

    // 2️⃣ Écrire le fichier PHP localement
    await fs.writeFile(localPluginFile, pluginPhp, "utf8");

    // 3️⃣ Créer le dossier plugin dans le conteneur
    await execAsync(`docker exec ${wpContainer} mkdir -p ${pluginDir}`);

    // 4️⃣ Copier le fichier dans le conteneur
    await execAsync(`docker cp ${localPluginFile} ${wpContainer}:${pluginDir}/custom-healthcheck.php`);

    console.log("✅ Plugin custom-healthcheck copié dans le conteneur");

    // 5️⃣ Activer le plugin
    await execAsync(`docker exec ${wpContainer} wp plugin activate custom-healthcheck --allow-root`);

    console.log("🎉 Plugin custom-healthcheck activé");

    // 6️⃣ Supprimer le dossier temporaire local
    await fs.rm(localTmpDir, { recursive: true, force: true });

  } catch (err) {
    console.error("❌ Erreur installation plugin healthcheck:", err.message);
    throw err;
  }
}
