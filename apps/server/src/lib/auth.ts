import type { FastifyRequest } from "fastify";
import { supabase } from "../supabase.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export function readSessionToken(request: FastifyRequest): string | null {
  const cookieToken = request.cookies?.session;
  if (cookieToken) return cookieToken;

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() || null;
  }

  return null;
}

/**
 * Resolves the logged-in user from session cookie (same-origin) or Bearer token (Vercel → Fly).
 */
export async function getUserFromRequest(request: FastifyRequest): Promise<AuthUser | null> {
  const token = readSessionToken(request);
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
