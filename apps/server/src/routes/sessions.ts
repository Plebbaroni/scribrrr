import type { FastifyInstance } from "fastify";
import { supabase } from "../supabase.js";
import { getUserFromRequest } from "../lib/auth.js";

// DB column is "session_name"; API/frontend contract uses "title", so we
// alias it in the select rather than rename it everywhere downstream.
export const SESSION_COLUMNS = "id, title:session_name, user_id, created_at, ended_at";

export default async function sessionRoutes(fastify: FastifyInstance) {
  // Create a new session
  fastify.post("/sessions", async (request, reply) => {
    const user = await getUserFromRequest(request);
    if (!user) return reply.status(401).send({ error: "Not logged in" });

    const body = request.body as any;

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        session_name: body?.title || "Untitled Session",
        user_id: user.id,
      })
      .select(SESSION_COLUMNS)
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send(data);
  });

  // Get a session by the ID
  fastify.get("/sessions/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as any;

    const { data, error } = await supabase
      .from("sessions")
      .select(SESSION_COLUMNS)
      .eq("id", sessionId)
      .maybeSingle();

    if (error) return reply.status(500).send({ error: error.message });
    if (!data) return reply.status(404).send({ error: "Not found" });
    return data;
  });

  // Get messages from a session ID
  fastify.get("/sessions/:sessionId/transcript", async (request, reply) => {
    const { sessionId } = request.params as any;

    const { data, error } = await supabase
      .from("messages")
      .select("id, text, start_time_ms, end_time_ms, confidence, created_at, speakers ( name, display_id )")
      .eq("session_id", sessionId)
      .order("start_time_ms", { ascending: true });

    if (error) return reply.status(500).send({ error: error.message });

    const segments = (data ?? []).map((row: any) => ({
      id: row.id,
      text: row.text,
      start_time_ms: row.start_time_ms,
      end_time_ms: row.end_time_ms,
      confidence: row.confidence,
      created_at: row.created_at,
      speaker: row.speakers?.name ?? `Speaker ${row.speakers?.display_id ?? "?"}`,
    }));

    return segments;
  });
}
