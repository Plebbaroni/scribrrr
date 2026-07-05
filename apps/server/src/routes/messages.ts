// Messages:
// GET /sessions/:sessionId/messages - gets all messages
// PUT /sessions/:sessionId/messages/:messageId - update message info (inside body can be new user)
// POST /sessions/:sessionId/messages - creates a message (info in body)
// POST /sessions/:sessionId/messages/range - (ceebs to use query params so js chuck start time end time in body?)

import type { FastifyInstance } from "fastify";
import { supabase, getOrCreateSpeaker } from "../supabase.js";

export default async function messageRoutes(fastify: FastifyInstance) {
  // POST /sessions/:sessionId/messages
  // body: { speaker: number (display_id, e.g. 0/1 from diarization), message: string,
  //         timestamp: number (ms), end_timestamp?: number (ms), confidence?: number }
  //
  // Note: this is a plain insert, not a true upsert -- messages don't have a
  // natural conflict key (no client-supplied id, and (session_id, start_time_ms)
  // isn't guaranteed unique if two speakers start at the same ms). If you need
  // idempotent writes (e.g. retrying a request after a dropped connection),
  // say so and we can add a client-generated id column with an on-conflict
  // upsert instead of a plain insert.
  fastify.post("/sessions/:sessionId/messages", async (request, reply) => {
    const { sessionId } = request.params as any;
    const body = request.body as any;

    if (body?.speaker === undefined || body?.speaker === null) {
      return reply.status(400).send({ error: "speaker (display_id) is required" });
    }
    if (!body?.message) {
      return reply.status(400).send({ error: "message is required" });
    }
    if (body?.timestamp === undefined || body?.timestamp === null) {
      return reply.status(400).send({ error: "timestamp is required" });
    }

    try {
      const speaker = await getOrCreateSpeaker(sessionId, Number(body.speaker));

      const { data, error } = await supabase
        .from("messages")
        .insert({
          session_id: sessionId,
          speaker_id: speaker.id,
          text: body.message,
          start_time_ms: body.timestamp,
          end_time_ms: body.end_timestamp ?? body.timestamp,
          confidence: body.confidence ?? null,
        })
        .select("id, text, start_time_ms, end_time_ms, confidence, created_at")
        .single();

      if (error) return reply.status(500).send({ error: error.message });

      return reply.status(201).send({
        ...data,
        session_id: sessionId,
        speaker: { id: speaker.id, name: speaker.name, display_id: speaker.display_id },
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message ?? "Failed to create message" });
    }
  });

  // GET /sessions/:sessionId/messages
  fastify.get("/sessions/:sessionId/messages", async (request, reply) => {
    const { sessionId } = request.params as any;

    const { data, error } = await supabase
      .from("messages")
      .select("id, text, start_time_ms, end_time_ms, confidence, created_at, speakers ( id, name, display_id )")
      .eq("session_id", sessionId)
      .order("start_time_ms", { ascending: true });

    if (error) return reply.status(500).send({ error: error.message });

    const messages = (data ?? []).map((row: any) => ({
      id: row.id,
      session_id: sessionId,
      text: row.text,
      start_time_ms: row.start_time_ms,
      end_time_ms: row.end_time_ms,
      confidence: row.confidence,
      created_at: row.created_at,
      speaker: row.speakers
        ? { id: row.speakers.id, name: row.speakers.name, display_id: row.speakers.display_id }
        : null,
    }));

    return messages;
  });

  // TODO: PUT /sessions/:sessionId/messages/:messageId - update message info (inside body can be new user)
  // TODO: POST /sessions/:sessionId/messages/range - filter messages by a start/end time window
}
