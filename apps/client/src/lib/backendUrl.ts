const PRODUCTION_HTTP = "https://scribrrr.fly.dev";

function httpToWs(httpUrl: string) {
  return httpUrl.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");
}

export function getBackendUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  // NEXT_PUBLIC_* is inlined at build time — if missing, don't fall back to localhost in prod.
  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_HTTP;
  }

  return "http://localhost:8080";
}

export function getBackendWsUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_BACKEND_WS_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  // Derive wss:// from https:// so you only need NEXT_PUBLIC_BACKEND_URL on Vercel.
  return httpToWs(getBackendUrl());
}
