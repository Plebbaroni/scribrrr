"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSessionStore } from "@/lib/store";
import { useSocket } from "@/lib/useSocket";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import { getSession, summarizeRecent, generatePdf } from "@/lib/api";
import type { TranscriptSegment, Summary } from "@/lib/store";

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

function formatTime(ms?: number) {
  if (ms == null) return "";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const { title, isRecording, segments, summaries, setSession, setRecording, addSummary } =
    useSessionStore();

  const { send } = useSocket(sessionId, undefined, isRecording);
  useAudioRecorder(send, isRecording);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (sessionId) getSession(sessionId).then((s) => setSession(s.id, s.title));
  }, [sessionId, setSession]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [segments]);

  async function handleSummarize() {
    if (!sessionId || summarizing) return;
    setSummarizing(true);
    try {
      const result = await summarizeRecent(sessionId);
      addSummary(result);
    } catch (e) {
      console.error("Summarize failed:", e);
    }
    setSummarizing(false);
  }

  async function handlePdf() {
    if (!sessionId || generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const result = await generatePdf(sessionId);
      window.open(result.url, "_blank");
    } catch (e) {
      console.error("PDF failed:", e);
    }
    setGeneratingPdf(false);
  }

  // Group consecutive segments by same speaker
  const grouped: { speaker: string; texts: { text: string; time?: number }[] }[] = [];
  for (const seg of segments) {
    const sp = seg.speaker || "Unknown";
    const last = grouped[grouped.length - 1];
    if (last && last.speaker === sp) {
      last.texts.push({ text: seg.text, time: seg.start_time_ms });
    } else {
      grouped.push({ speaker: sp, texts: [{ text: seg.text, time: seg.start_time_ms }] });
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ── Main transcript area ── */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-gray-600 text-lg">←</a>
            <h1 className="text-lg font-semibold text-gray-900">{title || "Untitled Session"}</h1>
            {isRecording && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                Live
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">{segments.length} segments</span>
        </header>

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {segments.length === 0 && !isRecording && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-3">🎙️</div>
              <p className="text-gray-500 text-sm">Hit record to start transcribing</p>
            </div>
          )}
          {segments.length === 0 && isRecording && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
              <p className="text-gray-500 text-sm mt-3">Listening…</p>
            </div>
          )}
          {grouped.map((group, gi) => {
            const style = getSpeakerStyle(group.speaker);
            const isEven = parseInt(group.speaker.replace(/\D/g, "") || "0", 10) % 2 === 0;
            return (
              <div key={gi} className={`flex flex-col ${isEven ? "items-start" : "items-end"}`}>
                <span className={`text-xs font-semibold mb-1 ${style.label}`}>
                  {group.speaker}
                </span>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${style.bg}`}>
                  {group.texts.map((t, ti) => (
                    <p key={ti} className={`text-sm leading-relaxed ${style.text}`}>
                      {t.text}
                      {t.time != null && (
                        <span className="ml-2 text-[10px] opacity-40">{formatTime(t.time)}</span>
                      )}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Record button bar */}
        <div className="border-t bg-white px-6 py-4 flex justify-center">
          <button
            onClick={() => setRecording(!isRecording)}
            className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold text-white shadow-md transition-all ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                : "bg-gray-900 hover:bg-gray-800"
            }`}
          >
            {isRecording ? (
              <>
                <span className="h-3 w-3 rounded-sm bg-white" />
                Stop Recording
              </>
            ) : (
              <>
                <span className="h-3 w-3 rounded-full bg-red-500" />
                Start Recording
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Sidebar ── */}
      <aside className="w-80 border-l bg-white flex flex-col overflow-hidden">
        {/* Summary section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Summary
            </h2>
            <button
              onClick={handleSummarize}
              disabled={summarizing || segments.length === 0}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {summarizing ? "Summarizing…" : "Summarize last 2 min"}
            </button>
          </div>

          {summaries.length === 0 && (
            <p className="text-xs text-gray-400 italic">
              Summaries will appear here
            </p>
          )}

          {summaries.map((s: Summary, i: number) => (
            <div key={s.id ?? i} className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
              <p className="text-sm text-gray-800 leading-relaxed">{s.summary}</p>
              <SummaryList label="Decisions" items={s.decisions} />
              <SummaryList label="Action Items" items={s.action_items} />
              <SummaryList label="Open Questions" items={s.open_questions} />
              <SummaryList label="Risks" items={s.risks_or_blockers} />
              {s.created_at && (
                <p className="text-[10px] text-gray-400">{new Date(s.created_at).toLocaleTimeString()}</p>
              )}
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="border-t p-4 space-y-2">
          <button
            onClick={handlePdf}
            disabled={generatingPdf || segments.length === 0}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generatingPdf ? "Generating…" : "Generate PDF"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function SummaryList({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</h4>
      <ul className="mt-0.5 list-disc list-inside text-xs text-gray-700 space-y-0.5">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}
