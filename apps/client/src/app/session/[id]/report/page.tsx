"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSession, getTranscript, generatePdf } from "@/lib/api";
import type { TranscriptSegment } from "@/lib/store";

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const [title, setTitle] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    Promise.all([getSession(sessionId), getTranscript(sessionId)]).then(
      ([session, transcript]) => {
        setTitle(session.title);
        setSegments(transcript.segments);
        setLoading(false);
      }
    );
  }, [sessionId]);

  async function handleGeneratePdf() {
    if (!sessionId) return;
    const result = await generatePdf(sessionId);
    window.open(result.url, "_blank");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading report…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <button
          onClick={handleGeneratePdf}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          Generate PDF
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Full Transcript
        </h2>
        {segments.map((seg, i) => (
          <div key={seg.id ?? i} className="text-sm leading-relaxed">
            {seg.speaker && (
              <span className="font-semibold text-indigo-600">
                {seg.speaker}:{" "}
              </span>
            )}
            <span className="text-gray-800">{seg.text}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
