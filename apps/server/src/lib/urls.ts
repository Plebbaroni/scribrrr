import type { FastifyRequest } from "fastify";

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  return value?.[0];
}

export function getFrontendUrl() {
  if (process.env.FRONTEND_URL) {
    return stripTrailingSlash(process.env.FRONTEND_URL);
  }
  if (process.env.NODE_ENV === "production") {
    return "https://scribrrr.vercel.app";
  }
  return "http://localhost:3000";
}

export function getBackendUrl() {
  if (process.env.BACKEND_URL) {
    return stripTrailingSlash(process.env.BACKEND_URL);
  }
  if (process.env.NODE_ENV === "production") {
    return "https://scribrrr.fly.dev";
  }
  return `http://localhost:${process.env.PORT ?? 8080}`;
}

/**
 * Must match exactly what's registered in Google Cloud Console.
 * Prefer the incoming Host (Fly/Vercel proxy) over BACKEND_URL env — stale
 * secrets like BACKEND_URL=http://localhost:8080 cause redirect_uri_mismatch.
 */
export function getGoogleRedirectUri(request?: FastifyRequest) {
  if (request) {
    const host = headerValue(request.headers["x-forwarded-host"]) ?? headerValue(request.headers.host);
    const proto =
      headerValue(request.headers["x-forwarded-proto"]) ??
      (request.protocol === "https" ? "https" : "http");

    if (host) {
      const hostname = host.split(",")[0]?.trim();
      if (hostname) {
        return `${stripTrailingSlash(`${proto}://${hostname}`)}/auth/google/callback`;
      }
    }
  }

  return `${getBackendUrl()}/auth/google/callback`;
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
