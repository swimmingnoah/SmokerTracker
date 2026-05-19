const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { createProxyMiddleware } = require("http-proxy-middleware");

// Change this if your backend lives elsewhere. Only used for web dev —
// native builds hit CONFIG.apiUrl directly.
const BACKEND_TARGET = "http://10.0.0.3:3001";

const config = getDefaultConfig(__dirname);

const proxy = createProxyMiddleware({
  target: BACKEND_TARGET,
  changeOrigin: true,
});

const originalEnhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = originalEnhanceMiddleware
    ? originalEnhanceMiddleware(middleware, server)
    : middleware;
  return (req, res, cb) => {
    if (req.url && req.url.startsWith("/api")) {
      return proxy(req, res, cb);
    }
    return next(req, res, cb);
  };
};

module.exports = withNativeWind(config, { input: "./global.css" });
