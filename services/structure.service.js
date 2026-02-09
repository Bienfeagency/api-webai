import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export class StructureService {
  static convertBlocksToContent(blocks) {
    let content = '';
    
    blocks.forEach(block => {
      switch (block.type) {
        case 'hero':
          content += this.generateHeroBlock(block);
          break;
        case 'heading':
          content += this.generateHeadingBlock(block);
          break;
        case 'paragraph':
          content += this.generateParagraphBlock(block);
          break;
        case 'features':
          content += this.generateFeaturesBlock(block);
          break;
        case 'cta':
          content += this.generateCTABlock(block);
          break;
        default:
          content += this.generateParagraphBlock(block);
      }
    });
    
    return content;
  }

static generateHeroBlock(block) {
  return `<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group hero-block">
  
  <!-- wp:cover {"dimRatio":50} -->
  <div class="wp-block-cover">
    <span aria-hidden="true" class="wp-block-cover__background has-background-dim"></span>

    <div class="wp-block-cover__inner-container">
      <!-- wp:heading {"level":1} -->
      <h1>${block.content}</h1>
      <!-- /wp:heading -->

      <!-- wp:paragraph -->
      <p>${block.attributes?.subtitle || ''}</p>
      <!-- /wp:paragraph -->
    </div>
  </div>
  <!-- /wp:cover -->

</div>
<!-- /wp:group -->`;
}


  static generateHeadingBlock(block) {
    const level = block.attributes?.level || 2;
    return `<!-- wp:heading {"level":${level}} -->
<h${level}>${block.content}</h${level}>
<!-- /wp:heading -->`;
  }

  static generateParagraphBlock(block) {
    return `<!-- wp:paragraph -->
<p>${block.content}</p>
<!-- /wp:paragraph -->`;
  }

  static generateFeaturesBlock(block) {
    const items = block.attributes?.items || [];
    return `<!-- wp:list -->
<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>
<!-- /wp:list -->`;
  }

  static generateCTABlock(block) {
    return `<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${block.attributes?.buttonLink || '#'}">${block.content}</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;
  }

  static async setupWordPressMenu(container, menu, pages) {
    try {
      await execAsync(`docker exec ${container} wp menu create "Menu Principal" --allow-root`);

      for (const item of menu) {
        if (item.type === 'page') {
          const page = pages.find(p => p.title === item.label || p.slug === item.url.replace('/', ''));
          if (page) {
            const pageIdCmd = `docker exec ${container} wp post list --post_type=page --name=${page.slug} --field=ID --format=ids --allow-root`;
            const pageId = (await execAsync(pageIdCmd)).stdout.trim();
            
            if (pageId) {
              await execAsync(`docker exec ${container} wp menu item add-post "Menu Principal" ${pageId} --allow-root`);
            }
          }
        }
      }

      await execAsync(`docker exec ${container} wp menu location assign "Menu Principal" primary --allow-root`);
      console.log('✅ Menu WordPress configuré');
    } catch (error) {
      console.warn('⚠ Erreur configuration menu:', error.message);
    }
  }

  static async setHomePage(container, homePageSlug) {
    try {
      await execAsync(`docker exec ${container} wp option update show_on_front page --allow-root`);
      
      const homeIdCmd = `docker exec ${container} wp post list --post_type=page --name=${homePageSlug} --field=ID --format=ids --allow-root`;
      const homeId = (await execAsync(homeIdCmd)).stdout.trim();
      
      if (homeId) {
        await execAsync(`docker exec ${container} wp option update page_on_front ${homeId} --allow-root`);
        console.log(`✅ Page d'accueil configurée: ${homePageSlug}`);
      }
    } catch (error) {
      console.warn('⚠ Impossible de configurer la page d\'accueil:', error.message);
    }
  }

static async applyFullStructure(container, structure) {
    const results = {
      pages: [],
      menu: false
    };

    // Créer les pages
    for (const page of structure.pages) {
      try {
        console.log(`📄 Création de la page: ${page.title}`);
        
        const pageContent = this.convertBlocksToContent(page.content.blocks);
        const pageId = await this.createPageInWordPress(container, page, pageContent);
        
        if (pageId) {
          results.pages.push({
            page: page.title,
            status: 'success',
            id: pageId
          });
          console.log(`✅ Page créée: ${page.title} (ID: ${pageId})`);
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

    // Configurer la page d'accueil
    await this.configureHomePage(container, structure.pages);

    // Configurer le menu
    try {
      await this.setupWordPressMenu(container, structure.menu, structure.pages);
      results.menu = true;
      console.log('✅ Menu WordPress configuré');
    } catch (error) {
      console.warn('⚠ Erreur configuration menu:', error.message);
    }

    // Nettoyer le cache
    await this.flushCache(container);

    return results;
  }

  static async createPageInWordPress(container, page, content) {
    const { exec } = await import('child_process');
    const util = await import('util');
    const execAsync = util.promisify(exec);

    const pageCreateCmd = `
      docker exec ${container} wp post create \
      --post_type=page \
      --post_title="${page.title}" \
      --post_name="${page.slug}" \
      --post_status=publish \
      --post_content="${content.replace(/"/g, '\\"')}" \
      --allow-root
    `;

    const pageResult = await execAsync(pageCreateCmd);
    const pageIdMatch = pageResult.stdout.match(/Created post (\d+)/);
    
    return pageIdMatch ? pageIdMatch[1] : null;
  }

  static async configureHomePage(container, pages) {
    const homePage = pages.find(p => 
      p.slug === 'accueil' || p.title === 'Accueil' || p.slug === 'home' || p.title === 'Home'
    );
    
    if (!homePage) return;

    try {
      const { exec } = await import('child_process');
      const util = await import('util');
      const execAsync = util.promisify(exec);

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

  static async flushCache(container) {
    try {
      const { exec } = await import('child_process');
      const util = await import('util');
      const execAsync = util.promisify(exec);

      await execAsync(`docker exec ${container} wp cache flush --allow-root`);
      await execAsync(`docker exec ${container} wp rewrite flush --allow-root`);
      console.log('✅ Cache et réécritures nettoyés');
    } catch (error) {
      console.warn('⚠ Erreur nettoyage cache:', error.message);
    }
  }
}