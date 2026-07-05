"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getRoomSessions, createSession } from "@/lib/api";

type Session = { id: string; title: string; created_at: string };

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const router = useRouter();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    getRoomSessions(roomId)
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [roomId]);

  async function handleNewSession() {
    if (!roomId) return;
    setCreating(true);
    try {
      const session = await createSession("Untitled Session", roomId);
      router.push(`/session/${session.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <Link href="/rooms" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Scribrrr</h1>
        </div>
        <button
          onClick={handleNewSession}
          disabled={creating}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {creating ? "Creating…" : "New Session"}
        </button>
      </header>

      <div className="mx-auto max-w-2xl p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Sessions
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-500">No sessions in this room yet</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/session/${s.id}`}
                  className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900">{s.title}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
