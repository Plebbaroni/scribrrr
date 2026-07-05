function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

export function getFrontendUrl() {
  if (process.env.FRONTEND_URL) {
    return stripTrailingSlash(process.env.FRONTEND_URL);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("FRONTEND_URL is required in production");
  }
  return "http://localhost:3000";
}

export function getBackendUrl() {
  if (process.env.BACKEND_URL) {
    return stripTrailingSlash(process.env.BACKEND_URL);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("BACKEND_URL is required in production");
  }
  return `http://localhost:${process.env.PORT ?? 3001}`;
}

export function getGoogleRedirectUri() {
  return `${getBackendUrl()}/auth/google/callback`;
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
