const SESSION_KEY = "scribrrr_session";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY);
}

export function setSessionToken(token: string) {
  window.localStorage.setItem(SESSION_KEY, token);
}

export function clearSessionToken() {
  window.localStorage.removeItem(SESSION_KEY);
}
