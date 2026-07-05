// Messages:
// GET /sessions/:sessionId/messages - gets all messages
// PUT /sessions/:sessionId/messages/:messageId - update message info (inside body can be new user)
// POST /sessions/:sessionId/messages - creates a message (info in body)
// POST /sessions/:sessionId/messages/range - (ceebs to use query params so js chuck start time end time in body?)

import type { FastifyInstance } from "fastify";
import { supabase, getOrCreateSpeaker } from "../supabase.js";

export interface InsertMessageParams {
  displayId: number;
  text: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
}

/**
 * Shared by POST /sessions/:sessionId/messages and the live Soniox stream
 * (stream.ts calls this directly in-process on each finalized segment,
 * rather than looping back through HTTP to its own server).
 */
export async function insertMessage(sessionId: string, params: InsertMessageParams) {
  const speaker = await getOrCreateSpeaker(sessionId, params.displayId);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      session_id: sessionId,
      speaker_id: speaker.id,
      text: params.text,
      start_time_ms: params.startMs ?? null,
      end_time_ms: params.endMs ?? null,
      confidence: params.confidence ?? null,
    })
    .select("id, text, start_time_ms, end_time_ms, confidence, created_at")
    .single();

  if (error) throw new Error(error.message);

  return {
    ...data,
    session_id: sessionId,
    speaker: { id: speaker.id, name: speaker.name, display_id: speaker.display_id },
  };
}

export default async function messageRoutes(fastify: FastifyInstance) {
  // GET /sessions/:sessionId/messages
  // Returns messages for a session
  fastify.get("/sessions/:sessionId/messages", async (request, reply) => {
    const { sessionId } = request.params as any;

    const { data, error } = await supabase
      .from("messages")
      .select("id, text, start_time_ms, end_time_ms, confidence, created_at, speakers ( id, name, display_id )")
      .eq("session_id", sessionId)
      .order("start_time_ms", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

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

  // PUT /sessions/:sessionId/messages/:messageId
  // body: any subset of { message, speaker, timestamp, end_timestamp, confidence }
  // Update any field of a message provided by the session ID and message ID.
  fastify.put("/sessions/:sessionId/messages/:messageId", async (request, reply) => {
    const { sessionId, messageId } = request.params as any;
    const body = request.body as any;

    // Scope the update to this session so you can't edit another session's
    // message just by guessing/knowing its id.
    const { data: existing, error: findErr } = await supabase
      .from("messages")
      .select("id")
      .eq("id", messageId)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (findErr) return reply.status(500).send({ error: findErr.message });
    if (!existing) return reply.status(404).send({ error: "Message not found" });

    const update: Record<string, any> = {};
    if (body?.message !== undefined) update.text = body.message;
    if (body?.timestamp !== undefined) update.start_time_ms = body.timestamp;
    if (body?.end_timestamp !== undefined) update.end_time_ms = body.end_timestamp;
    if (body?.confidence !== undefined) update.confidence = body.confidence;

    try {
      if (body?.speaker !== undefined && body?.speaker !== null) {
        const speaker = await getOrCreateSpeaker(sessionId, Number(body.speaker));
        update.speaker_id = speaker.id;
      }

      if (Object.keys(update).length === 0) {
        return reply.status(400).send({ error: "No updatable fields provided" });
      }

      const { data, error } = await supabase
        .from("messages")
        .update(update)
        .eq("id", messageId)
        .select("id, text, start_time_ms, end_time_ms, confidence, created_at, speakers ( id, name, display_id )")
        .single();

      if (error) return reply.status(500).send({ error: error.message });

      return {
        id: data.id,
        session_id: sessionId,
        text: data.text,
        start_time_ms: data.start_time_ms,
        end_time_ms: data.end_time_ms,
        confidence: data.confidence,
        created_at: data.created_at,
        speaker: (data as any).speakers
          ? {
              id: (data as any).speakers.id,
              name: (data as any).speakers.name,
              display_id: (data as any).speakers.display_id,
            }
          : null,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message ?? "Failed to update message" });
    }
  });

  // POST /sessions/:sessionId/messages
  // body: { speaker: number (display_id, e.g. 0/1 from diarization), message: string,
  //         timestamp: number (ms), end_timestamp?: number (ms), confidence?: number }
  // Insert a new message by the session ID
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
      const message = await insertMessage(sessionId, {
        displayId: Number(body.speaker),
        text: body.message,
        startMs: body.timestamp,
        endMs: body.end_timestamp ?? body.timestamp,
        confidence: body.confidence ?? undefined,
      });
      return reply.status(201).send(message);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message ?? "Failed to create message" });
    }
  });

  // POST /sessions/:sessionId/messages/range
  // body: { start_time_ms: number, end_time_ms: number }
  // Return messages in a given time range for a session
  fastify.post("/sessions/:sessionId/messages/range", async (request, reply) => {
    const { sessionId } = request.params as any;
    const body = request.body as any;

    if (body?.start_time_ms === undefined || body?.end_time_ms === undefined) {
      return reply.status(400).send({ error: "start_time_ms and end_time_ms are required" });
    }
    if (Number(body.start_time_ms) > Number(body.end_time_ms)) {
      return reply.status(400).send({ error: "start_time_ms must be <= end_time_ms" });
    }

    const { data, error } = await supabase
      .from("messages")
      .select("id, text, start_time_ms, end_time_ms, confidence, created_at, speakers ( id, name, display_id )")
      .eq("session_id", sessionId)
      .gte("start_time_ms", body.start_time_ms)
      .lte("start_time_ms", body.end_time_ms)
      .order("start_time_ms", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

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
}
