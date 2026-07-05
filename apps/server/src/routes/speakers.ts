// Speakers:
// POST /sessions/:sessionId/speakers - creates a new speaker
// GET /sessions/:sessionId/speakers - gets speakers given a particular session
// PUT /sessions/:sessionId/speakers/:speakerId - renames a speaker
// DELETE /sessions/:sessionId/speakers/:speakerId - situational, but needed to delete a speaker

import type { FastifyInstance } from "fastify";
import { supabase } from "../supabase.js";

export default async function speakerRoutes(fastify: FastifyInstance) {
  // POST /sessions/:sessionId/speakers
  // body: { name?: string, display_id?: number }
  // Create a new speaker for the given session.
  // If name is not given, speaker becomes "Speaker <display_id>" by default.
  fastify.post("/sessions/:sessionId/speakers", async (request, reply) => {
    const { sessionId } = request.params as any;
    const body = (request.body as any) ?? {};

    let displayId = body.display_id;

    if (displayId === undefined || displayId === null) {
      const { data: existing, error: findErr } = await supabase
        .from("speakers")
        .select("display_id")
        .eq("session_id", sessionId)
        .order("display_id", { ascending: false })
        .limit(1);

      if (findErr) return reply.status(500).send({ error: findErr.message });
      displayId = existing?.length ? existing[0].display_id + 1 : 0;
    } else {
      displayId = Number(displayId);
    }

    const { data, error } = await supabase
      .from("speakers")
      .insert({
        session_id: sessionId,
        display_id: displayId,
        name: body.name || `Speaker ${displayId}`,
      })
      .select("id, session_id, display_id, name")
      .single();

    if (error) {
      // Postgres unique_violation
      if ((error as any).code === "23505") {
        return reply.status(409).send({ error: `display_id ${displayId} already exists for this session` });
      }
      return reply.status(500).send({ error: error.message });
    }

    return reply.status(201).send(data);
  });

  // GET /sessions/:sessionId/speakers
  // Return all speakers for a given session, ordered by display_id ascending
  fastify.get("/sessions/:sessionId/speakers", async (request, reply) => {
    const { sessionId } = request.params as any;

    const { data, error } = await supabase
      .from("speakers")
      .select("id, session_id, display_id, name")
      .eq("session_id", sessionId)
      .order("display_id", { ascending: true });

    if (error) return reply.status(500).send({ error: error.message });
    return data ?? [];
  });

  // PUT /sessions/:sessionId/speakers/:speakerId
  // body: { name: string }
  // Update the speaker's name for the given session.
  fastify.put("/sessions/:sessionId/speakers/:speakerId", async (request, reply) => {
    const { sessionId, speakerId } = request.params as any;
    const body = request.body as any;

    if (!body?.name) {
      return reply.status(400).send({ error: "name is required" });
    }

    const { data, error } = await supabase
      .from("speakers")
      .update({ name: body.name })
      .eq("id", speakerId)
      .eq("session_id", sessionId) // scoped, so you can't rename another session's speaker by guessing an id
      .select("id, session_id, display_id, name")
      .maybeSingle();

    if (error) return reply.status(500).send({ error: error.message });
    if (!data) return reply.status(404).send({ error: "Speaker not found" });

    return data;
  });

  // DELETE /sessions/:sessionId/speakers/:speakerId
  // Remove the speaker's name from the session and replaces it with "Deleted user".
  // Retains all the speaker's previous messages
  fastify.delete("/sessions/:sessionId/speakers/:speakerId", async (request, reply) => {
    const { sessionId, speakerId } = request.params as any;
 
    const { data, error } = await supabase
      .from("speakers")
      .update({ name: "Deleted user" })
      .eq("id", speakerId)
      .eq("session_id", sessionId)
      .select("id, session_id, display_id, name")
      .maybeSingle();
 
    if (error) return reply.status(500).send({ error: error.message });
    if (!data) return reply.status(404).send({ error: "Speaker not found" });
 
    return data;
  });

}