"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSessionStore } from "@/lib/store";
import { useSocket } from "@/lib/useSocket";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import { getSession, getTranscript, summarizeRecent, updateSession } from "@/lib/api";
import type { Summary } from "@/lib/store";

const SPEAKER_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  0: { bg: "bg-blue-100", text: "text-blue-900", label: "text-blue-600" },
  1: { bg: "bg-emerald-100", text: "text-emerald-900", label: "text-emerald-600" },
  2: { bg: "bg-purple-100", text: "text-purple-900", label: "text-purple-600" },
  3: { bg: "bg-amber-100", text: "text-amber-900", label: "text-amber-600" },
};

function getSpeakerStyle(speaker?: string) {
  const idx = parseInt(speaker?.replace(/\D/g, "") || "0", 10);
  return SPEAKER_COLORS[idx % Object.keys(SPEAKER_COLORS).length];
}

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const router = useRouter();

  const { title, isRecording, segments, partial, summaries, resetForSession, setTitle, setRecording, setSegments, addSummary } =
    useSessionStore();

  const { send } = useSocket(sessionId, undefined, isRecording);
  useAudioRecorder(send, isRecording);

  const scrollRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [activeSummary, setActiveSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function load() {
      try {
        const [session, transcript] = await Promise.all([
          getSession(sessionId),
          getTranscript(sessionId),
        ]);
        if (cancelled) return;
        resetForSession(session.id, session.title);
        setSegments(transcript);
        if (session.room_id) setRoomId(session.room_id);
        setActiveSummary(null);
        setSummaryOpen(false);
        setSummaryError(null);
      } catch (e) {
        console.error(e);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, resetForSession, setSegments]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [segments, partial]);

  async function handleSummarize() {
    if (!sessionId || summarizing) return;
    setSummarizing(true);
    setSummaryError(null);
    try {
      const result = await summarizeRecent(sessionId);
      addSummary(result);
      setActiveSummary(result);
      setSummaryOpen(true);
    } catch (e) {
      console.error("Summarize failed:", e);
      setSummaryError(e instanceof Error ? e.message : "Summarize failed");
      setSummaryOpen(true);
    }
    setSummarizing(false);
  }

  function handleBack() {
    setRecording(false);
    if (roomId) router.push(`/rooms/${roomId}`);
    else router.push("/rooms");
  }

  function handleFinish() {
    handleBack();
  }

  function startEditingTitle() {
    setDraftTitle(title || "New Session");
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 0);
  }

  async function saveTitle() {
    const next = draftTitle.trim();
    if (!next || !sessionId) {
      setEditingTitle(false);
      return;
    }
    if (next === title) {
      setEditingTitle(false);
      return;
    }

    setSavingTitle(true);
    try {
      const updated = await updateSession(sessionId, next);
      setTitle(updated.title);
      setEditingTitle(false);
    } catch (e) {
      console.error(e);
    }
    setSavingTitle(false);
  }

  function cancelEditingTitle() {
    setEditingTitle(false);
    setDraftTitle(title);
  }

  // Group consecutive segments by same speaker — all left-aligned
  const grouped: { speaker: string; texts: string[] }[] = [];
  for (const seg of segments) {
    const sp = seg.speaker || "Unknown";
    const last = grouped[grouped.length - 1];
    if (last && last.speaker === sp) {
      last.texts.push(seg.text);
    } else {
      grouped.push({ speaker: sp, texts: [seg.text] });
    }
  }

  const latestSummary = activeSummary ?? summaries[summaries.length - 1] ?? null;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-white">
      <header className="shrink-0 border-b border-gray-200 px-8 py-5 pb-6 mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Scribrrr</h1>
      </header>

      <div className="shrink-0 flex items-center gap-3 px-8 pb-4">
        <button
          onClick={handleBack}
          className="shrink-0 text-gray-400 hover:text-gray-600 text-lg"
          aria-label="Back"
        >
          ←
        </button>
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveTitle();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEditingTitle();
              }
            }}
            disabled={savingTitle}
            className="min-w-0 flex-1 max-w-lg rounded-lg border border-gray-300 px-3 py-2 text-xl font-semibold text-gray-900 focus:border-gray-400 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={startEditingTitle}
            className="min-w-0 text-left text-xl font-semibold text-gray-700 hover:text-gray-900"
            title="Click to rename"
          >
            {title || "New Session"}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto py-4 pb-6 space-y-5 mx-[10%]">
        {segments.length === 0 && !isRecording && !partial && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">Press Start to begin transcribing</p>
          </div>
        )}

        {segments.length === 0 && isRecording && !partial && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">Listening…</p>
          </div>
        )}

        {grouped.map((group, gi) => {
          const style = getSpeakerStyle(group.speaker);
          return (
            <div key={gi} className="flex flex-col items-start max-w-[85%]">
              <span className={`mb-1 text-xs font-semibold ${style.label}`}>
                {group.speaker}
              </span>
              <div className={`rounded-2xl border border-gray-200 px-5 py-3 ${style.bg}`}>
                {group.texts.map((text, ti) => (
                  <p key={ti} className={`text-sm leading-relaxed ${style.text}`}>
                    {text}
                  </p>
                ))}
              </div>
            </div>
          );
        })}

        {partial?.text && (
          <div className="flex flex-col items-start max-w-[85%] opacity-60">
            {partial.speaker && (
              <span className="mb-1 text-xs font-semibold text-gray-500">
                {partial.speaker}
              </span>
            )}
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-3">
              <p className="text-sm leading-relaxed text-gray-700">{partial.text}</p>
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-gray-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleFinish}
            className="rounded-xl border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
          >
            Finish
          </button>

          <button
            onClick={() => setRecording(!isRecording)}
            className={`rounded-xl border px-8 py-2.5 text-sm font-medium shadow-sm transition-colors ${
              isRecording
                ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
            }`}
          >
            {isRecording ? "Pause" : "Start"}
          </button>

          <button
            onClick={handleSummarize}
            disabled={summarizing || segments.length === 0}
            className="rounded-xl border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {summarizing ? "Summarizing…" : "Summarize"}
          </button>
        </div>
      </footer>

      {summaryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSummaryOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900">Summary</h2>

            {summaryError ? (
              <p className="mt-3 text-sm text-red-600">{summaryError}</p>
            ) : latestSummary?.summary ? (
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 font-sans">
                {latestSummary.summary}
              </pre>
            ) : (
              <p className="mt-3 text-sm text-gray-500">No summary available.</p>
            )}

            {!summaryError && latestSummary && (
              <>
                <SummaryList label="Decisions" items={latestSummary.decisions} />
                <SummaryList label="Action Items" items={latestSummary.action_items} />
                <SummaryList label="Open Questions" items={latestSummary.open_questions} />
                <SummaryList label="Risks" items={latestSummary.risks_or_blockers} />
              </>
            )}

            <button
              onClick={() => setSummaryOpen(false)}
              className="mt-6 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryList({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</h4>
      <ul className="mt-1 list-disc list-inside text-sm text-gray-700 space-y-0.5">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}
