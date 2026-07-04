import type { FastifyInstance } from "fastify";
import { db } from "../supabase.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const BACKEND_URL = `http://localhost:${process.env.PORT ?? 3001}`;
const REDIRECT_URI = `${BACKEND_URL}/auth/google/callback`;

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

    // Exchange code for tokens
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
    const tokens = await tokenRes.json() as any;

    if (!tokens.access_token) {
      return reply.status(401).send({ error: "Token exchange failed", details: tokens });
    }

    // Fetch user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json() as any;

    // Upsert user in memory store
    let user = db.findOne("users", "google_id", profile.id);
    if (!user) {
      user = db.insert("users", {
        id: crypto.randomUUID(),
        google_id: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        created_at: new Date().toISOString(),
      });
    }

    // Create a session token
    const token = crypto.randomUUID();
    db.insert("auth_sessions", {
      token,
      user_id: user.id,
      created_at: new Date().toISOString(),
    });

    // Set cookie and redirect to frontend
    reply.setCookie("session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return reply.redirect(FRONTEND_URL);
  });

  // Get current user
  fastify.get("/auth/me", async (request, reply) => {
    const token = request.cookies.session;
    if (!token) return reply.status(401).send({ error: "Not logged in" });

    const session = db.findOne("auth_sessions", "token", token);
    if (!session) return reply.status(401).send({ error: "Invalid session" });

    const user = db.findOne("users", "id", session.user_id);
    if (!user) return reply.status(401).send({ error: "User not found" });

    return { id: user.id, email: user.email, name: user.name, picture: user.picture };
  });

  // Logout
  fastify.post("/auth/logout", async (request, reply) => {
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });
}
