"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSession, downloadSessionPdf, getRoom, getRoomSessions, getSessionSummary, summarizeSession, updateSession } from "@/lib/api";
import { AppNavbar } from "@/components/AppNavbar";
import { PencilIcon } from "@/components/PencilIcon";

type RoomSession = {
  id: string;
  title: string;
  created_at: string;
  participants: string[];
};

function SessionRow({
  session,
  onRename,
  onSummarize,
  summarizing,
}: {
  session: RoomSession;
  onRename: (id: string, title: string) => Promise<void>;
  onSummarize: (id: string) => Promise<void>;
  summarizing: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(session.title);
  }, [session.title]);

  function startEditing(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDraft(session.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function save() {
    const next = draft.trim();
    if (!next || next === session.title) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onRename(session.id, next);
      setEditing(false);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  async function handleSummarize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await onSummarize(session.id);
  }

  const formattedDate = new Date(session.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="group border-b border-border px-6 py-5 transition-colors hover:bg-surface/60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void save()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setDraft(session.title);
                  setEditing(false);
                }
              }}
              disabled={saving}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-lg font-medium text-text focus:border-text focus:outline-none"
            />
          ) : (
            <>
              <Link
                href={`/session/${session.id}`}
                className="text-lg font-medium text-text transition-colors hover:text-muted"
              >
                {session.title}
              </Link>
              <button
                type="button"
                onClick={(e) => void handleSummarize(e)}
                disabled={summarizing}
                className="shrink-0 text-sm text-muted transition-colors hover:text-text disabled:opacity-50"
              >
                {summarizing ? "Downloading…" : "Download PDF"}
              </button>
            </>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="shrink-0 rounded p-1 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text"
            aria-label="Rename session"
          >
            <PencilIcon />
          </button>
        )}
      </div>
      <Link href={`/session/${session.id}`} className="mt-1 block">
        <p className="text-sm text-muted">{formattedDate}</p>
        {session.participants.length > 0 ? (
          <p className="mt-2 text-sm text-muted">{session.participants.join(", ")}</p>
        ) : (
          <p className="mt-2 text-sm text-muted/70">No participants yet</p>
        )}
      </Link>
    </div>
  );
}

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const router = useRouter();

  const [sessions, setSessions] = useState<RoomSession[]>([]);
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [summarizingId, setSummarizingId] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    Promise.all([getRoom(roomId), getRoomSessions(roomId)])
      .then(([room, sessionList]) => {
        setRoomName(room.name);
        setSessions(sessionList);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [roomId]);

  function openModal() {
    setSessionName("Untitled Session");
    setModalOpen(true);
  }

  function closeModal() {
    if (creating) return;
    setModalOpen(false);
    setSessionName("");
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    const name = sessionName.trim();
    if (!name || !roomId) return;

    setCreating(true);
    try {
      const session = await createSession(name, roomId);
      router.push(`/session/${session.id}`);
    } catch (err) {
      console.error(err);
      setCreating(false);
    }
  }

  async function handleSummarize(sessionId: string) {
    if (summarizingId) return;
    setSummarizingId(sessionId);
    try {
      try {
        await getSessionSummary(sessionId);
      } catch {
        await summarizeSession(sessionId);
      }
      await downloadSessionPdf(sessionId);
      router.push(`/session/${sessionId}?summary=open`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Summarize failed");
      setSummarizingId(null);
    }
  }

  async function handleRename(sessionId: string, title: string) {
    const updated = await updateSession(sessionId, title);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: updated.title } : s))
    );
  }

  return (
    <main className="min-h-screen bg-bg text-text">
      <AppNavbar />

      <Link
        href="/rooms"
        className="inline-block px-8 pt-5 text-lg text-muted transition-colors hover:text-text"
        aria-label="Back to rooms"
      >
        ←
      </Link>

      <div className="mx-auto max-w-4xl px-8 pb-12">
        <div className="mt-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-text">
            {roomName ? `${roomName}'s sessions` : "Sessions"}
          </h2>
          <button
            type="button"
            onClick={openModal}
            disabled={creating}
            className="shrink-0 text-sm font-medium text-text transition-colors hover:text-muted disabled:opacity-50"
          >
            + New Session
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-text" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-8 text-sm text-muted">No sessions in this room yet</p>
        ) : (
          <ul className="mt-4">
            {sessions.map((session) => (
              <li key={session.id}>
                <SessionRow
                  session={session}
                  onRename={handleRename}
                  onSummarize={handleSummarize}
                  summarizing={summarizingId === session.id}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/20 p-4"
          onClick={closeModal}
        >
          <div
            className="app-card w-full max-w-md cursor-default rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-text">New Session</h2>
            <p className="mt-1 text-sm text-muted">Name this session before you start</p>

            <form onSubmit={handleCreate} className="mt-4">
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Session name"
                autoFocus
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus:border-text focus:outline-none"
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={creating}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-text disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !sessionName.trim()}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-bg disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
