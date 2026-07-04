"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useSessionStore } from "@/lib/store";
import { useSocket } from "@/lib/useSocket";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import { getSession, summarizeRecent, generatePdf } from "@/lib/api";
import type { TranscriptSegment, Summary } from "@/lib/store";

const SPEAKER_COLORS = [
  "text-blue-600",
  "text-green-600",
  "text-purple-600",
  "text-orange-600",
  "text-pink-600",
  "text-teal-600",
];

function speakerColor(speaker?: string): string {
  if (!speaker) return "text-gray-700";
  const idx = parseInt(speaker.replace(/\D/g, ""), 10) || 0;
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
}

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const {
    title,
    isRecording,
    isMockMode,
    segments,
    summaries,
    setSession,
    setRecording,
    setMockMode,
    addSummary,
  } = useSessionStore();

  const { send } = useSocket(sessionId, isMockMode, isRecording);
  useAudioRecorder(send, isRecording);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) {
      getSession(sessionId).then((s) => setSession(s.id, s.title));
    }
  }, [sessionId, setSession]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments]);

  async function handleSummarize() {
    if (!sessionId) return;
    const result = await summarizeRecent(sessionId);
    addSummary(result);
  }

  async function handleGeneratePdf() {
    if (!sessionId) return;
    const result = await generatePdf(sessionId);
    window.open(result.url, "_blank");
  }

  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">
            {title || "Untitled Session"}
          </h1>
          {isRecording && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Recording
            </span>
          )}
        </div>
        <a href="/" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back
        </a>
      </header>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 border-b bg-white px-6 py-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isMockMode}
            onChange={(e) => setMockMode(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Mock Mode
        </label>

        <button
          onClick={() => setRecording(!isRecording)}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors ${
            isRecording
              ? "bg-red-600 hover:bg-red-500"
              : "bg-indigo-600 hover:bg-indigo-500"
          }`}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>

        <button
          onClick={handleSummarize}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          Summarize last 2 min
        </button>

        <button
          onClick={handleGeneratePdf}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          Generate PDF
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        {/* Transcript panel */}
        <section className="flex-1 rounded-lg border bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Live Transcript
            </h2>
          </div>
          <div className="h-[60vh] overflow-y-auto p-4 space-y-2">
            {segments.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                Transcript will appear here when recording starts…
              </p>
            )}
            {segments.map((seg: TranscriptSegment, i: number) => (
              <div key={seg.id ?? i} className="text-sm">
                {seg.speaker && (
                  <span className={`font-semibold ${speakerColor(seg.speaker)}`}>
                    {seg.speaker}:{" "}
                  </span>
                )}
                <span className="text-gray-800">{seg.text}</span>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </section>

        {/* Summaries panel */}
        <section className="w-full lg:w-96 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Summaries</h2>
          {summaries.length === 0 && (
            <p className="text-sm text-gray-400 italic">
              No summaries yet. Click &quot;Summarize last 2 min&quot; to generate one.
            </p>
          )}
          {summaries.map((s: Summary, i: number) => (
            <div
              key={s.id ?? i}
              className="rounded-lg border bg-white p-4 shadow-sm space-y-3"
            >
              <p className="text-sm text-gray-800">{s.summary}</p>
              <SummaryList label="Decisions" items={s.decisions} />
              <SummaryList label="Action Items" items={s.action_items} />
              <SummaryList label="Open Questions" items={s.open_questions} />
              <SummaryList label="Risks / Blockers" items={s.risks_or_blockers} />
              {s.created_at && (
                <p className="text-xs text-gray-400">
                  {new Date(s.created_at).toLocaleTimeString()}
                </p>
              )}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function SummaryList({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </h4>
      <ul className="mt-1 list-disc list-inside text-sm text-gray-700 space-y-0.5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
