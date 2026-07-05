import type { FastifyInstance } from "fastify";
import { supabase } from "../supabase.js";

export default async function speakerRoutes(fastify: FastifyInstance) {
  fastify.get("/sessions/:sessionId/speakers", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    const { data, error } = await supabase
      .from("speakers")
      .select("id, name, display_id, session_id")
      .eq("session_id", sessionId)
      .order("display_id", { ascending: true });

    if (error) return reply.status(500).send({ error: error.message });
    return data ?? [];
  });

  fastify.put("/sessions/:sessionId/speakers/:speakerId", async (request, reply) => {
    const { sessionId, speakerId } = request.params as { sessionId: string; speakerId: string };
    const body = request.body as { name?: string };
    const name = body?.name?.trim();

    if (!name) return reply.status(400).send({ error: "Name is required" });

    const { data, error } = await supabase
      .from("speakers")
      .update({ name })
      .eq("id", speakerId)
      .eq("session_id", sessionId)
      .select("id, name, display_id")
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    if (!data) return reply.status(404).send({ error: "Not found" });
    return data;
  });
}
