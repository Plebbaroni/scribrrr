const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function createSession(title?: string) {
  return request<{ id: string; title: string }>("/sessions", {
    method: "POST",
    body: JSON.stringify({ title: title || "Untitled Session" }),
  });
}

export function getSession(id: string) {
  return request<{ id: string; title: string }>(`/sessions/${id}`);
}

export function getTranscript(sessionId: string) {
  return request<{ segments: Array<{ id?: string; speaker?: string; text: string; start_time_ms?: number; end_time_ms?: number; is_final?: boolean; confidence?: number }> }>(
    `/sessions/${sessionId}/transcript`
  );
}

export function summarizeRecent(sessionId: string) {
  return request<{ id?: string; summary: string; decisions: string[]; action_items: string[]; open_questions: string[]; risks_or_blockers: string[]; created_at?: string }>(
    `/sessions/${sessionId}/summaries/recent`,
    { method: "POST" }
  );
}

export function generatePdf(sessionId: string) {
  return request<{ url: string }>(`/sessions/${sessionId}/pdf`, {
    method: "POST",
  });
}

export function getMe() {
  return request<{ id: string; email: string; name: string; picture: string }>("/auth/me");
}

export function getGoogleLoginUrl() {
  return `${BASE_URL}/auth/google`;
}

export function logout() {
  return request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}
