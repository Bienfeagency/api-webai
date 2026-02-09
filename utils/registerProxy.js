import { createProxyMiddleware } from "http-proxy-middleware";

const BASE_URL = process.env.NODE_ENV === 'production' ? process.env.BASE_URL_PRODUCTION : process.env.BASE_URL || 'http://localhost';

export const registerWpProxy = (app, siteSlug, wpPort) => {
  const route = `/wp-proxy/${siteSlug}`;

  console.log(`🔗 Proxy actif: ${route} → ${BASE_URL}:${wpPort}`);
  app.use(
    route,
    createProxyMiddleware({
      target: `${BASE_URL}:${wpPort}`,
      changeOrigin: true,
      secure: false,
      ws: true,
    })
  );
};
