import { DockerService } from './docker.service.js';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export class MySQLService {
  static async createDatabaseContainer(config) {
    const { containerName, networkName, dbName, dbUser, dbPass } = config;

    if (await DockerService.containerExists(containerName)) {
      console.log(`✅ Conteneur DB ${containerName} existe déjà`);
      return;
    }

    console.log(`🔨 Création conteneur DB ${containerName}...`);
    await execAsync(`
      docker run -d --name ${containerName} --network ${networkName} \
      -e MYSQL_ROOT_PASSWORD=${dbPass} -e MYSQL_DATABASE=${dbName} \
      mysql:8
    `);
    console.log(`✅ Conteneur DB ${containerName} créé`);
  }

  static async waitForMySQLReady(container, user, password, maxRetries = 30) {
    await DockerService.waitForService(
      container,
      `docker exec ${container} mysqladmin ping -h127.0.0.1 -u${user} -p${password} --silent`,
      'MySQL',
      maxRetries
    );
  }

  static async waitForWordPressReady(container, maxRetries = 30) {
    await DockerService.waitForService(
      container,
      `docker exec ${container} curl -f http://localhost:80/wp-admin/install.php --silent`,
      'WordPress',
      maxRetries
    );
  }
}