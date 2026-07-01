// Vercel serverless entry point
// No Socket.IO — serverless functions don't support persistent WebSocket connections.
// Storage is in-memory, so each cold start begins with a fresh, empty database.

const { createApp } = require("../dist/app");

let app = null;

function getApp() {
  if (!app) app = createApp();
  return app;
}

module.exports = (req, res) => getApp()(req, res);
