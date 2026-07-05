import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";

import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import sessionRoutes from "./routes/sessions.js";
import roomRoutes from "./routes/rooms.js";
import summaryRoutes from "./routes/summaries.js";
import pdfRoutes from "./routes/pdf.js";
import streamRoutes from "./routes/stream.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const GENERATED_DIR = "/tmp/generated";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(websocket);

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  await app.register(fastifyStatic, {
    root: GENERATED_DIR,
    prefix: "/files/",
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(sessionRoutes);
  await app.register(roomRoutes);
  await app.register(summaryRoutes);
  await app.register(pdfRoutes);
  await app.register(streamRoutes);

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`🎙️ Scribrrr server listening on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
