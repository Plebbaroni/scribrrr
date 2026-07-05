import type { FastifyRequest } from "fastify";
import { supabase } from "../supabase.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/**
 * Resolves the logged-in user from the "session" cookie set by
 * routes/auth.ts's Google OAuth callback. Returns null if there's no
 * cookie, the token doesn't exist, or the session has expired -- callers
 * decide whether that's a 401 or just "anonymous".
 */
export async function getUserFromRequest(request: FastifyRequest): Promise<AuthUser | null> {
  const token = request.cookies?.session;
  if (!token) return null;

  const { data: session, error: sessionErr } = await supabase
    .from("auth_sessions")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (sessionErr) throw sessionErr;
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, email, name, picture")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userErr) throw userErr;
  return user ?? null;
}
