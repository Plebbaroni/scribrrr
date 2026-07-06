"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/lib/store";
import { useSocket } from "@/lib/useSocket";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import { getSession, getSessionSummary, getSpeakers, getTranscript, summarizeSession, updateSession, updateSpeakerName } from "@/lib/api";
import type { Speaker } from "@/lib/api";
import type { Summary } from "@/lib/store";
import { SummaryMarkdown } from "@/components/SummaryMarkdown";
import { AppNavbar } from "@/components/AppNavbar";
import { PencilIcon } from "@/components/PencilIcon";
import { findSpeakerId, PauseIcon, PlayIcon, SpeakerLabel } from "@/components/SpeakerLabel";
import { collectSpeakerNames, getSpeakerStyle, resolveSpeakerDisplayName } from "@/lib/speakerStyles";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();

  const { title, isRecording, segments, partial, summaries, resetForSession, setTitle, setRecording, setSegments, setPartial, addSummary } =
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
  const [speakers, setSpeakers] = useState<Speaker[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function load() {
      try {
        const [session, transcript, speakerList] = await Promise.all([
          getSession(sessionId),
          getTranscript(sessionId),
          getSpeakers(sessionId),
        ]);
        if (cancelled) return;
        resetForSession(session.id, session.title);
        setSegments(transcript);
        setSpeakers(speakerList);
        if (session.room_id) setRoomId(session.room_id);
        setActiveSummary(null);
        setSummaryOpen(false);
        setSummaryError(null);

        if (searchParams.get("summary") === "open") {
          try {
            const result = await getSessionSummary(sessionId);
            if (cancelled) return;
            addSummary(result);
            setActiveSummary(result);
            setSummaryOpen(true);
          } catch (e) {
            if (cancelled) return;
            console.error(e);
            setSummaryError(e instanceof Error ? e.message : "Failed to load summary");
            setSummaryOpen(true);
          }
          router.replace(`/session/${sessionId}`);
        }
      } catch (e) {
        console.error(e);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, searchParams, resetForSession, setSegments, addSummary, router]);

  useEffect(() => {
    if (!sessionId) return;
    getSpeakers(sessionId).then(setSpeakers).catch(console.error);
  }, [sessionId, segments.length]);

  useEffect(() => {
    if (!partial?.speaker || speakers.length === 0) return;
    const resolved = resolveSpeakerDisplayName(speakers, partial.speaker);
    if (resolved && resolved !== partial.speaker) {
      setPartial(resolved, partial.text);
    }
  }, [speakers, partial, setPartial]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [segments, partial]);

  async function handleSummarize(force = false) {
    if (!sessionId || summarizing) return;
    setSummarizing(true);
    setSummaryError(null);
    try {
      const result = await summarizeSession(sessionId, { force });
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

  function handleToggleRecording() {
    setRecording(!isRecording);
  }

  function handleFinish() {
    setRecording(false);
    summarizeSession(sessionId);
    if (roomId) router.push(`/rooms/${roomId}`);
    else router.push("/rooms");
  }

  async function handleRenameSpeaker(speakerId: string, newName: string) {
    if (!sessionId || !speakerId) return;

    await updateSpeakerName(sessionId, speakerId, newName);

    const speakerList = await getSpeakers(sessionId);
    setSpeakers(speakerList);
    setSegments(
      segments.map((seg) =>
        seg.speaker_id === speakerId ? { ...seg, speaker: newName } : seg
      )
    );

    if (partial?.text) {
      const partialId = findSpeakerId(speakerList, partial.speaker ?? "");
      if (partialId === speakerId) {
        setPartial(newName, partial.text);
      } else {
        const resolved = resolveSpeakerDisplayName(speakerList, partial.speaker);
        if (resolved && resolved !== partial.speaker) {
          setPartial(resolved, partial.text);
        }
      }
    }
  }

  function handleBack() {
    setRecording(false);
    if (roomId) router.push(`/rooms/${roomId}`);
    else router.push("/rooms");
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

  const latestSummary = activeSummary ?? summaries[summaries.length - 1] ?? null;
  const summaryPanelWidth = "w-[36rem] max-w-[55vw]";
  const showEmpty = segments.length === 0 && !partial;
  const speakerNames = collectSpeakerNames(segments);
  const partialSpeaker = partial?.speaker
    ? resolveSpeakerDisplayName(speakers, partial.speaker) ?? partial.speaker
    : undefined;
  const partialSpeakerId = partialSpeaker
    ? findSpeakerId(speakers, partialSpeaker) ?? findSpeakerId(speakers, partial?.speaker ?? "")
    : null;
  const partialDisplayId =
    speakers.find((s) => s.id === partialSpeakerId)?.display_id ?? null;

  type SpeakerGroup = {
    groupKey: string;
    speaker: string;
    speakerId: string | null;
    speakerDisplayId: number | null;
    firstId?: string;
    texts: string[];
  };

  const grouped: SpeakerGroup[] = [];
  for (const seg of segments) {
    const speaker = seg.speaker || "Unknown";
    const groupKey = seg.speaker_id ?? speaker;
    const last = grouped[grouped.length - 1];
    if (last && last.groupKey === groupKey) {
      last.texts.push(seg.text);
      last.speaker = speaker;
    } else {
      grouped.push({
        groupKey,
        speaker,
        speakerId: seg.speaker_id ?? null,
        speakerDisplayId: seg.speaker_display_id ?? null,
        firstId: seg.id,
        texts: [seg.text],
      });
    }
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-bg font-sans font-normal text-[#0A0A0A]">
      <AppNavbar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-4 bg-bg px-8 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                onClick={handleBack}
                className="shrink-0 text-lg text-[#737373] transition-colors duration-150 hover:text-[#0A0A0A]"
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
                  className="min-w-0 flex-1 max-w-lg rounded-lg border border-border bg-white px-3 py-2 text-xl font-semibold text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
                />
              ) : (
                <div className="group flex min-w-0 items-center gap-2">
                  <span className="truncate text-xl font-semibold text-[#0A0A0A]">
                    {title || "New Session"}
                  </span>
                  <button
                    type="button"
                    onClick={startEditingTitle}
                    className="shrink-0 rounded p-1 text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-text"
                    aria-label="Rename session"
                  >
                    <PencilIcon />
                  </button>
                </div>
              )}
            </div>
            {!summaryOpen && (
              <button
                onClick={() => void handleSummarize()}
                disabled={summarizing || segments.length === 0}
                className="shrink-0 rounded-lg border border-border bg-white px-5 py-2 text-sm text-[#0A0A0A] transition-colors duration-150 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
              >
                {summarizing ? "Summarizing…" : "Summarize"}
              </button>
            )}
          </div>

          <div ref={scrollRef} className="hide-scrollbar min-h-0 flex-1 overflow-y-auto py-6 pb-8 pl-8 pr-6 space-y-8">
            {showEmpty && !isRecording && (
              <EmptyState message="Press play to begin transcribing" />
            )}

            {showEmpty && isRecording && (
              <EmptyState message="Listening…" recording />
            )}

            {grouped.map((group, i) => {
              const style = getSpeakerStyle(group.speaker, group.speakerDisplayId);
              const speakerId =
                group.speakerId ??
                findSpeakerId(speakers, group.speaker) ??
                null;

              return (
                <div key={group.firstId ?? `${group.groupKey}-${i}`} className="flex max-w-[72%] flex-col items-start">
                  <SpeakerLabel
                    name={group.speaker}
                    speakerId={speakerId}
                    displayId={group.speakerDisplayId}
                    onRename={handleRenameSpeaker}
                  />
                  <div className={`rounded-lg px-4 py-3 ${style.card}`}>
                    <p className="text-sm leading-relaxed text-[#0A0A0A]">{group.texts.join(" ")}</p>
                  </div>
                </div>
              );
            })}

            {partial?.text && (
              <div className="flex max-w-[72%] flex-col items-start opacity-80">
                {partialSpeaker && (
                  <SpeakerLabel
                    name={partialSpeaker}
                    speakerId={partialSpeakerId}
                    displayId={partialDisplayId}
                    onRename={handleRenameSpeaker}
                  />
                )}
                <div className={`rounded-lg px-4 py-3 ${getSpeakerStyle(partialSpeaker, partialDisplayId).card}`}>
                  <p className="text-sm leading-relaxed text-[#737373]">{partial.text}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside
          className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-out ${summaryOpen ? summaryPanelWidth : "w-0"
            }`}
        >
          <div className={`app-surface flex h-full flex-col border-l ${summaryPanelWidth}`}>
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-normal text-[#0A0A0A]">Summary</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleSummarize(true)}
                  disabled={summarizing || segments.length === 0}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-[#0A0A0A] transition-colors duration-150 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {summarizing ? "Regenerating…" : "Retry"}
                </button>
                <button
                  onClick={() => setSummaryOpen(false)}
                  className="px-1 text-[#737373] transition-colors duration-150 hover:text-[#0A0A0A]"
                  aria-label="Close summary"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {summaryError ? (
                <p className="text-sm text-red-600">{summaryError}</p>
              ) : latestSummary?.summary ? (
                <SummaryMarkdown content={latestSummary.summary} speakers={speakerNames} />
              ) : (
                <p className="text-sm text-[#737373]">No summary available.</p>
              )}

              {!summaryError && latestSummary && (
                <>
                  <SummaryList label="Decisions" items={latestSummary.decisions} />
                  <SummaryList label="Action Items" items={latestSummary.action_items} />
                  <SummaryList label="Open Questions" items={latestSummary.open_questions} />
                  <SummaryList label="Risks" items={latestSummary.risks_or_blockers} />
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <footer className="app-surface shrink-0 border-t px-8 py-5">
        <div className="mx-auto flex items-center justify-center gap-3">
          <button
            onClick={handleToggleRecording}
            aria-label={isRecording ? "Pause" : "Play"}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-bg text-muted transition-colors duration-150 hover:bg-surface hover:text-text"
          >
            {isRecording ? <PauseIcon /> : <PlayIcon />}
          </button>

          <button
            onClick={handleFinish}
            className="rounded-full bg-text px-7 py-2.5 text-sm font-medium text-surface shadow-sm transition-opacity duration-150 hover:opacity-90"
          >
            Finish
          </button>
        </div>
      </footer>
    </main>
  );
}

function EmptyState({ message, recording = false }: { message: string; recording?: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      {recording && <WaveformBars large />}
      <p className="text-sm text-[#737373]">{message}</p>
    </div>
  );
}

function WaveformBars({ large = false }: { large?: boolean }) {
  const heights = large ? [0.35, 0.65, 1, 0.5, 0.8, 0.45, 0.7] : [0.4, 0.75, 1, 0.55, 0.85];
  const barH = large ? "h-8" : "h-4";

  return (
    <div className={`flex ${barH} items-end gap-0.5`} aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-0.5 animate-waveform rounded-full bg-[#16A34A]"
          style={{ height: `${h * 100}%`, animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

function SummaryList({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-normal uppercase tracking-wide text-[#737373]">{label}</h4>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm font-normal text-[#0A0A0A]">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}
