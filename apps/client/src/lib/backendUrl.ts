const PRODUCTION_HTTP = "https://scribrrr.fly.dev";
const PRODUCTION_WS = "wss://scribrrr.fly.dev";

export function getBackendUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  // NEXT_PUBLIC_* is inlined at build time — if missing, don't fall back to localhost in prod.
  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_HTTP;
  }

  return "http://localhost:3001";
}

export function getBackendWsUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_BACKEND_WS_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_WS;
  }

  return "ws://localhost:3001";
}
