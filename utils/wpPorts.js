// utils/wpPorts.js
const wpPorts = new Map();

export const setWpPort = (siteSlug, port) => {
  console.log(`🔧 Enregistrement port ${port} pour le site: ${siteSlug}`);
  wpPorts.set(siteSlug.toLowerCase(), port);
  console.log('📊 Ports actuellement enregistrés:', Array.from(wpPorts.entries()));
};

export const getWpPort = (siteSlug) => {
  const port = wpPorts.get(siteSlug.toLowerCase());
  console.log(`🔍 Recherche port pour ${siteSlug}: ${port}`);
  console.log('📋 Tous les ports:', Array.from(wpPorts.entries()));
  return port;
};