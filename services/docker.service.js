import { exec } from 'child_process';
import util from 'util';
import net from 'net';
import fs from 'fs/promises';
import path from 'path';

const execAsync = util.promisify(exec);

export class DockerService {
  static async getAvailablePort() {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      
      server.listen(0, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
    });
  }

  static async containerExists(containerName) {
    try {
      await execAsync(`docker inspect ${containerName}`);
      return true;
    } catch {
      return false;
    }
  }

  static async networkExists(networkName) {
    try {
      await execAsync(`docker network inspect ${networkName}`);
      return true;
    } catch {
      return false;
    }
  }

  static async createNetwork(networkName) {
    if (!(await this.networkExists(networkName))) {
      await execAsync(`docker network create ${networkName}`);
      console.log(`✅ Réseau ${networkName} créé`);
    }
  }

  static async waitForService(container, checkCommand, serviceName, maxRetries = 30) {
    let retries = maxRetries;
    while (retries > 0) {
      try {
        await execAsync(checkCommand);
        console.log(`✅ ${serviceName} est prêt`);
        return;
      } catch (error) {
        retries--;
        if (retries > 0) {
          console.log(`⏳ Attente ${serviceName}... (${retries} tentatives restantes)`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw new Error(`${serviceName} non prêt après ${maxRetries} tentatives`);
        }
      }
    }
  }

  static async getContainerPort(containerName) {
    const portInfo = await execAsync(`docker port ${containerName}`);
    const portMatch = portInfo.stdout.match(/80\/tcp -> 0.0.0.0:(\d+)/);
    if (portMatch) {
      return parseInt(portMatch[1]);
    }
    throw new Error("Port non trouvé");
  }

  static async startContainer(containerName) {
    await execAsync(`docker start ${containerName}`);
    console.log(`✅ Conteneur ${containerName} démarré`);
  }

  static async stopContainer(containerName) {
    try {
      await execAsync(`docker stop ${containerName}`);
      console.log(`✅ Conteneur ${containerName} arrêté`);
    } catch (error) {
      console.warn(`⚠ Impossible d'arrêter ${containerName}:`, error.message);
    }
  }

  static async removeContainer(containerName) {
    try {
      await execAsync(`docker rm -f ${containerName}`);
      console.log(`✅ Conteneur ${containerName} supprimé`);
    } catch (error) {
      console.warn(`⚠ Impossible de supprimer ${containerName}:`, error.message);
    }
  }
}