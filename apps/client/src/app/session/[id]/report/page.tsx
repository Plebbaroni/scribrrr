"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSession, getTranscript, generatePdf } from "@/lib/api";
import type { TranscriptSegment } from "@/lib/store";
import { getSpeakerStyle } from "@/lib/speakerStyles";
import { AppNavbar } from "@/components/AppNavbar";

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
        setSegments(transcript);
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
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#EAEAEA] border-t-[#0A0A0A]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg text-text">
      <AppNavbar />

      <Link
        href={`/session/${sessionId}`}
        className="inline-block px-8 pt-5 text-lg text-muted transition-colors hover:text-text"
        aria-label="Back to session"
      >
        ←
      </Link>

      <div className="mx-auto max-w-3xl px-8 py-6">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-[#0A0A0A]">{title}</h2>
          <button
            onClick={handleGeneratePdf}
            className="shrink-0 rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-bg"
          >
            Generate PDF
          </button>
        </div>

        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737373]">
            Full Transcript
          </h3>
          {segments.map((seg, i) => {
            const style = getSpeakerStyle(seg.speaker, seg.speaker_display_id);
            return (
              <div key={seg.id ?? i} className="text-sm leading-relaxed">
                {seg.speaker && (
                  <span className={`font-medium ${style.label}`}>{seg.speaker}</span>
                )}
                <p className={`mt-1 rounded-lg px-4 py-3 ${style.card} text-[#0A0A0A]`}>
                  {seg.text}
                </p>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
