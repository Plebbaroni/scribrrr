import type { FastifyInstance } from "fastify";
import { supabase } from "../supabase.js";
import { getUserFromRequest, readSessionToken } from "../lib/auth.js";
import { getFrontendUrl, getGoogleRedirectUri, isProduction } from "../lib/urls.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;

function sessionCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    // Vercel (frontend) and Fly (API) are different sites — Lax blocks credentialed fetches.
    sameSite: isProduction() ? ("none" as const) : ("lax" as const),
    secure: isProduction(),
    maxAge: 60 * 60 * 24 * 7,
  };
}

export default async function authRoutes(fastify: FastifyInstance) {
  // See exactly what redirect_uri the server will send (compare to Google Console).
  fastify.get("/auth/google/config", async (request) => ({
    redirect_uri: getGoogleRedirectUri(request),
    backend_url_env: process.env.BACKEND_URL ?? null,
  }));

  // Step 1: redirect user to Google consent screen
  fastify.get("/auth/google", async (request, reply) => {
    const redirectUri = getGoogleRedirectUri(request);
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
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

    const redirectUri = getGoogleRedirectUri(request);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokens = (await tokenRes.json()) as any;

    if (!tokens.access_token) {
      console.error("Google token exchange failed", {
        redirect_uri: redirectUri,
        error: tokens.error,
        error_description: tokens.error_description,
      });
      return reply.status(401).send({
        error: "Token exchange failed",
        redirect_uri: redirectUri,
        details: tokens,
      });
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

    reply.setCookie("session", authSession.token, sessionCookieOptions());

    // Cookie is on fly.dev; frontend is vercel.app — pass token for localStorage.
    const completeUrl = new URL("/auth/complete", getFrontendUrl());
    completeUrl.searchParams.set("token", authSession.token);
    return reply.redirect(completeUrl.toString());
  });

  fastify.get("/auth/me", async (request, reply) => {
    const user = await getUserFromRequest(request);
    if (!user) return reply.status(401).send({ error: "Not logged in" });
    return user;
  });

  fastify.post("/auth/logout", async (request, reply) => {
    const token = readSessionToken(request);
    if (token) {
      await supabase.from("auth_sessions").delete().eq("token", token);
    }
    reply.clearCookie("session", sessionCookieOptions());
    return { ok: true };
  });
}
