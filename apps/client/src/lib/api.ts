import type { Summary } from "./store";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  });
  if (!res.ok) {
    let message = `API error: ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    if (res.status === 429) {
      message = "Too many requests — wait a moment and try again.";
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// TODO: UI note: Include session name option in UI and carry room name into
// this function
export function createSession(title?: string, roomId?: string) {
  return request<{ id: string; title: string; room_id?: string | null }>("/sessions", {
    method: "POST",
    body: JSON.stringify({ title: title || "Untitled Session", room_id: roomId }),
  });
}

export function getSession(id: string) {
  return request<{ id: string; title: string; room_id?: string | null }>(`/sessions/${id}`);
}

export function updateSession(id: string, title: string) {
  return request<{ id: string; title: string; room_id?: string | null }>(`/sessions/${id}`, {
    method: "PUT",
    body: JSON.stringify({ title }),
  });
}

export function getTranscript(sessionId: string) {
  return request<
    Array<{
      id?: string;
      speaker?: string;
      speaker_id?: string | null;
      speaker_display_id?: number | null;
      text: string;
      start_time_ms?: number;
      end_time_ms?: number;
      is_final?: boolean;
      confidence?: number;
    }>
  >(`/sessions/${sessionId}/transcript`);
}

export type Speaker = { id: string; name: string; display_id: number };

export function getSpeakers(sessionId: string) {
  return request<Speaker[]>(`/sessions/${sessionId}/speakers`);
}

export function updateSpeakerName(sessionId: string, speakerId: string, name: string) {
  return request<Speaker>(`/sessions/${sessionId}/speakers/${speakerId}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export function getSessionSummary(sessionId: string) {
  return request<unknown>(`/sessions/${sessionId}/summaries`).then(normalizeSummaryResponse);
}

export function summarizeRecent(sessionId: string) {
  return summarizeSession(sessionId);
}

export function summarizeSession(sessionId: string, options?: { force?: boolean }) {
  return request<unknown>(`/sessions/${sessionId}/summaries`, {
    method: "POST",
    body: JSON.stringify({ force: options?.force ?? false }),
  }).then(normalizeSummaryResponse);
}

export function normalizeSummaryResponse(data: unknown): Summary {
  const row = (data as any)?.summary ?? data;
  const content = row?.content ?? {};

  const summaryText =
    typeof content === "string"
      ? content
      : content.summary ?? row.summary ?? "";

  return {
    id: row?.id,
    summary: summaryText,
    decisions: content.decisions ?? [],
    action_items: content.action_items ?? [],
    open_questions: content.open_questions ?? [],
    risks_or_blockers: content.risks_or_blockers ?? [],
    created_at: row?.created_at,
  };
}

export function generatePdf(sessionId: string) {
  return fetchSessionPdf(sessionId).then(({ blob }) => {
    const url = URL.createObjectURL(blob);
    return { url };
  });
}

export function downloadSessionPdf(sessionId: string) {
  return fetchSessionPdf(sessionId).then(({ blob, filename }) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

async function fetchSessionPdf(sessionId: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}/pdf`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    let message = `API error: ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filenameMatch = disposition?.match(/filename="([^"]+)"/);
  const filename = filenameMatch?.[1] ?? "session-report.pdf";

  return { blob, filename };
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

export function getRooms() {
  return request<Array<{ id: string; name: string; created_at: string }>>("/rooms");
}

export function getRoom(roomId: string) {
  return request<{ id: string; name: string; created_at: string }>(`/rooms/${roomId}`);
}

export function createRoom(name?: string) {
  return request<{ id: string; name: string; created_at: string }>("/rooms", {
    method: "POST",
    body: JSON.stringify({ name: name || "Untitled Room" }),
  });
}

export function getRoomSessions(roomId: string) {
  return request<
    Array<{ id: string; title: string; created_at: string; participants: string[] }>
  >(`/rooms/${roomId}/sessions`);
}
