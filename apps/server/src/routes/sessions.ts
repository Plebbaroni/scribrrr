import type { FastifyInstance } from "fastify";
import { supabase } from "../supabase.js";

export default async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post("/sessions", async (request, reply) => {
    try {
      const body = request.body as { title?: string } | null;
      const id = crypto.randomUUID();
      const title = body?.title || "Untitled Session";
      const created_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("sessions")
        .insert({ id, title, created_at })
        .select()
        .single();

      if (error) {
        return reply.status(500).send({ error: error.message });
      }

      return reply.status(201).send(data);
    } catch (err) {
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  fastify.get("/sessions/:sessionId", async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };

      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error) {
        return reply.status(404).send({ error: error.message });
      }

      return data;
    } catch (err) {
      return reply
        .status(500)
        .send({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  fastify.get(
    "/sessions/:sessionId/transcript",
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };

        const { data, error } = await supabase
          .from("transcript_segments")
          .select("*")
          .eq("session_id", sessionId)
          .order("start_time_ms", { ascending: true });

        if (error) {
          return reply.status(500).send({ error: error.message });
        }

        return data;
      } catch (err) {
        return reply.status(500).send({
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  );
}
