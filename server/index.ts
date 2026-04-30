/**
 * EcoClean 3D — production server.
 * Serves the built Vite client (dist/) and hosts the multiplayer WebSocket on /api/ws.
 */

import express from "express";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { attachMultiplayer } from "./wsHandler.js";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

const app = express();
app.disable("x-powered-by");

app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, {
    maxAge: "1h",
    setHeaders: (res, file) => {
      if (file.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  }));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.status(503).type("text/plain").send(
      "Client build not found. Run `npm run build:all` to generate dist/."
    );
  });
}

const port = Number(process.env.PORT ?? 8080);
const server = createServer(app);
attachMultiplayer(server);

server.listen(port, "0.0.0.0", () => {
  console.log(`[server] EcoClean 3D listening on :${port}`);
});
