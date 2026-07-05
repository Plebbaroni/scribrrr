import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  supabaseClient = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { transport: ws as any },
  });

  return supabaseClient;
}

/** Lazy proxy so the process can boot /health before secrets are validated on first DB call. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabase();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Speakers are keyed by (session_id, display_id). This finds or creates
 * the corresponding row so messages.speaker_id can point at a real speaker.
 */
export async function getOrCreateSpeaker(sessionId: string, displayId: number) {
  const { data: existing, error: findErr } = await supabase
    .from("speakers")
    .select()
    .eq("session_id", sessionId)
    .eq("display_id", displayId)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing;

  const { data: created, error: insErr } = await supabase
    .from("speakers")
    .insert({ session_id: sessionId, display_id: displayId, name: `Speaker ${displayId}` })
    .select()
    .single();

  if (insErr) throw insErr;
  return created;
}
