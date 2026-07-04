import type { FastifyInstance } from "fastify";
import { db } from "../supabase.js";

export default async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post("/sessions", async (request, reply) => {
    const body = request.body as any;
    const session = db.insert("sessions", {
      id: crypto.randomUUID(),
      title: body?.title || "Untitled Session",
      created_at: new Date().toISOString(),
    });
    return reply.status(201).send(session);
  });

  fastify.get("/sessions/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as any;
    const session = db.findOne("sessions", "id", sessionId);
    if (!session) return reply.status(404).send({ error: "Not found" });
    return session;
  });

  fastify.get("/sessions/:sessionId/transcript", async (request) => {
    const { sessionId } = request.params as any;
    return db.find("transcript_segments", "session_id", sessionId)
      .sort((a: any, b: any) => (a.start_time_ms || 0) - (b.start_time_ms || 0));
  });
}
