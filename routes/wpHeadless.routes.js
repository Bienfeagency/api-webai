router.all("/wp/headless/:siteSlug/*", authMiddleware, async (req, res) => {
  const { siteSlug } = req.params;
  const wpPort = getWpPort(siteSlug);
  const target = `http://localhost:${wpPort}/wp-json/headless/v1/${req.params[0]}`;

  const jwt = req.user?.wpToken || process.env.DEFAULT_WP_ADMIN_JWT;

  const response = await fetch(target, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
    },
    body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body)
  });

  const data = await response.text();
  res.status(response.status).send(data);
});
