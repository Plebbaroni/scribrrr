import type { FastifyInstance } from "fastify";
import { supabase } from "../supabase.js";
import { getUserFromRequest } from "../lib/auth.js";

// DB column is "session_name"; API/frontend contract uses "title", so we
// alias it in the select rather than rename it everywhere downstream.
export const SESSION_COLUMNS = "id, title:session_name, user_id, room_id, created_at, ended_at";

export default async function sessionRoutes(fastify: FastifyInstance) {
  // Create a new session. room_id is optional (no room-picker UI yet) but,
  // when given, must belong to the current user.
  fastify.post("/sessions", async (request, reply) => {
    const user = await getUserFromRequest(request);
    if (!user) return reply.status(401).send({ error: "Not logged in" });

    const body = request.body as any;
    const roomId = body?.room_id as string | undefined;

    if (roomId) {
      const { data: room, error: roomErr } = await supabase
        .from("rooms")
        .select("id")
        .eq("id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (roomErr) return reply.status(500).send({ error: roomErr.message });
      if (!room) return reply.status(404).send({ error: "Room not found" });
    }

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        session_name: body?.title || "Untitled Session",
        user_id: user.id,
        room_id: roomId ?? null,
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

  // Rename a session
  fastify.put("/sessions/:sessionId", async (request, reply) => {
    const user = await getUserFromRequest(request);
    if (!user) return reply.status(401).send({ error: "Not logged in" });

    const { sessionId } = request.params as any;
    const body = request.body as any;
    const title = body?.title?.trim();
    if (!title) return reply.status(400).send({ error: "Title is required" });

    const { data: existing, error: findErr } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (findErr) return reply.status(500).send({ error: findErr.message });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const { data, error } = await supabase
      .from("sessions")
      .update({ session_name: title })
      .eq("id", sessionId)
      .select(SESSION_COLUMNS)
      .single();

    if (error) return reply.status(500).send({ error: error.message });
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
