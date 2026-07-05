import type { FastifyInstance } from "fastify";
import { supabase } from "../supabase.js";
import { getUserFromRequest } from "../lib/auth.js";
import { SESSION_COLUMNS } from "./sessions.js";

// DB column is "room_name"; API/frontend contract uses "name", so we alias
// it in the select rather than rename it everywhere downstream (same
// convention as sessions.ts's SESSION_COLUMNS).
const ROOM_COLUMNS = "id, name:room_name, user_id, created_at";

export default async function roomRoutes(fastify: FastifyInstance) {
  // Create a new room owned by the current user
  fastify.post("/rooms", async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).send({ error: "Not logged in" });

    const body = req.body as any;

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        room_name: body?.name || "Untitled Room",
        user_id: user.id,
      })
      .select(ROOM_COLUMNS)
      .single();

    if (error) return res.status(500).send({ error: error.message });
    return res.status(201).send(data);
  });

  // List the current user's rooms
  fastify.get("/rooms", async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).send({ error: "Not logged in" });

    const { data, error } = await supabase
      .from("rooms")
      .select(ROOM_COLUMNS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).send({ error: error.message });
    return data;
  });

  // Get a single room (must belong to the current user)
  fastify.get("/rooms/:roomId", async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).send({ error: "Not logged in" });

    const { roomId } = req.params as any;

    const { data, error } = await supabase
      .from("rooms")
      .select(ROOM_COLUMNS)
      .eq("id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return res.status(500).send({ error: error.message });
    if (!data) return res.status(404).send({ error: "Not found" });
    return data;
  });

  // List the sessions that belong to a room (ownership checked via the room,
  // not the session, since that's the only path a browser has into these).
  fastify.get("/rooms/:roomId/sessions", async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).send({ error: "Not logged in" });

    const { roomId } = req.params as any;

    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (roomErr) return res.status(500).send({ error: roomErr.message });
    if (!room) return res.status(404).send({ error: "Not found" });

    const { data, error } = await supabase
      .from("sessions")
      .select(SESSION_COLUMNS)
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).send({ error: error.message });
    return data;
  });
}
