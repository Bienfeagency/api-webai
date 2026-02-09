// routes/wpProxy.routes.js
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { getWpPort } from "../utils/wpPorts.js";

const router = express.Router();

// Proxy dynamique pour WordPress
router.use("/:site", createProxyMiddleware({
  target: "http://localhost",
  changeOrigin: true,
  secure: false,
  router: (req) => {
    const site = req.params.site;
    const port = getWpPort(site?.toLowerCase());
    if (!port) throw new Error(`Port WP introuvable pour ${site}`);
    console.log(`🔗 Routing ${site} to port ${port}`);
    return `http://localhost:${port}`;
  },
  pathRewrite: (path, req) => {
    // Supprime seulement la partie /api/wp-proxy/{site} du chemin
    const site = req.params.site;
    const newPath = path.replace(`/api/wp-proxy/${site}`, '');
    console.log(`🔄 Path rewrite: ${path} -> ${newPath}`);
    return newPath || '/';
  },
  onProxyReq(proxyReq, req) {
    console.log(`➡️ Proxying: ${req.method} ${req.originalUrl} -> http://localhost:${getWpPort(req.params.site?.toLowerCase())}${req.path}`);
    
    if (req.headers.cookie) {
      proxyReq.setHeader("cookie", req.headers.cookie);
    }
    proxyReq.setHeader("X-Forwarded-Host", req.headers.host);
    proxyReq.setHeader("X-Forwarded-Proto", req.headers['x-forwarded-proto'] || 'http');
  },
  onProxyRes(proxyRes, req, res) {
    delete proxyRes.headers['x-frame-options'];
    delete proxyRes.headers['content-security-policy'];
    proxyRes.headers['access-control-allow-origin'] = '*';
    
    console.log(`✅ Proxy response: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error:', err);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
}));

export default router;