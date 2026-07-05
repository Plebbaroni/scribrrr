"use client";

import { useRef, useState } from "react";
import type { Speaker } from "@/lib/api";
import { getSpeakerStyle } from "@/lib/speakerStyles";
import { PencilIcon } from "@/components/PencilIcon";

export function findSpeakerId(speakers: Speaker[], label: string): string | null {
  const match = label.match(/Speaker\s*(\d+)/i);
  if (match) {
    const byDisplay = speakers.find((s) => s.display_id === Number(match[1]));
    if (byDisplay) return byDisplay.id;
  }

  if (/^\d+$/.test(label)) {
    const byDisplay = speakers.find((s) => s.display_id === Number(label));
    if (byDisplay) return byDisplay.id;
  }

  const byName = speakers.find((s) => s.name === label);
  if (byName) return byName.id;

  return null;
}

type SpeakerLabelProps = {
  name: string;
  speakerId: string | null;
  displayId?: number | null;
  onRename: (speakerId: string, newName: string) => Promise<void>;
};

export function SpeakerLabel({ name, speakerId, displayId, onRename }: SpeakerLabelProps) {
  const style = getSpeakerStyle(name, displayId);

  if (!speakerId) {
    return (
      <span className={`mb-1 text-sm font-medium ${style.label}`}>
        {name}
      </span>
    );
  }

  return (
    <EditableSpeakerLabel
      name={name}
      speakerId={speakerId}
      labelClass={style.label}
      onRename={onRename}
    />
  );
}

function EditableSpeakerLabel({
  name,
  speakerId,
  labelClass,
  onRename,
}: {
  name: string;
  speakerId: string;
  labelClass: string;
  onRename: (speakerId: string, newName: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setDraft(name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function save() {
    const next = draft.trim();
    if (!next || next === name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onRename(speakerId, next);
      setEditing(false);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  if (editing) {
    return (
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
            setDraft(name);
            setEditing(false);
          }
        }}
        disabled={saving}
        className="mb-1.5 w-full max-w-xs rounded border border-[#EAEAEA] bg-white px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
      />
    );
  }

  return (
    <div className="group mb-1.5 flex items-center gap-1">
      <span className={`text-sm font-medium ${labelClass}`}>{name}</span>
      <button
        type="button"
        onClick={startEditing}
        className="shrink-0 rounded p-1 text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-text"
        aria-label="Rename speaker"
      >
        <PencilIcon />
      </button>
    </div>
  );
}

export function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}
