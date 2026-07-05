import type { FastifyInstance } from "fastify";
import { supabase } from "../supabase.js";
import { getUserFromRequest } from "../lib/auth.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const BACKEND_URL =
  process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
const REDIRECT_URI = `${BACKEND_URL.replace(/\/$/, "")}/auth/google/callback`;

export default async function authRoutes(fastify: FastifyInstance) {
  // Step 1: redirect user to Google consent screen
  fastify.get("/auth/google", async (_request, reply) => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
    });
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  // Step 2: Google redirects back here with ?code=
  fastify.get("/auth/google/callback", async (request, reply) => {
    const { code } = request.query as any;
    if (!code) return reply.status(400).send({ error: "Missing code" });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokens = (await tokenRes.json()) as any;

    if (!tokens.access_token) {
      return reply.status(401).send({ error: "Token exchange failed", details: tokens });
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = (await userRes.json()) as any;

    // Upsert user by google_id
    const { data: existingUser, error: findErr } = await supabase
      .from("users")
      .select()
      .eq("google_id", profile.id)
      .maybeSingle();

    if (findErr) return reply.status(500).send({ error: findErr.message });

    let user = existingUser;
    if (!user) {
      const { data: created, error: insErr } = await supabase
        .from("users")
        .insert({
          google_id: profile.id,
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
        })
        .select()
        .single();

      if (insErr) return reply.status(500).send({ error: insErr.message });
      user = created;
    } else {
      // Keep name/picture fresh in case they changed on the Google side.
      await supabase
        .from("users")
        .update({ name: profile.name, picture: profile.picture })
        .eq("id", user.id);
    }

    const { data: authSession, error: sessErr } = await supabase
      .from("auth_sessions")
      .insert({ user_id: user.id })
      .select("token")
      .single();

    if (sessErr) return reply.status(500).send({ error: sessErr.message });

    reply.setCookie("session", authSession.token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days -- keep in sync with schema's auth_sessions.expires_at default
    });

    return reply.redirect(FRONTEND_URL);
  });

  // Get current user
  fastify.get("/auth/me", async (request, reply) => {
    const user = await getUserFromRequest(request);
    if (!user) return reply.status(401).send({ error: "Not logged in" });
    return user;
  });

  // Logout
  fastify.post("/auth/logout", async (request, reply) => {
    const token = request.cookies?.session;
    if (token) {
      await supabase.from("auth_sessions").delete().eq("token", token);
    }
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });
}
