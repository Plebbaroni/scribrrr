export const SPEAKER_STYLES = [
  { label: "text-[#a16207]", card: "bg-[#FEF9C3]" },
  { label: "text-[#7e22ce]", card: "bg-[#EDE9FE]" },
  { label: "text-[#be123c]", card: "bg-[#FFE4E6]" },
  { label: "text-[#1d4ed8]", card: "bg-[#DBEAFE]" },
] as const;

export function getSpeakerStyle(speaker?: string, displayId?: number | null) {
  const idx =
    displayId ??
    parseInt(speaker?.replace(/\D/g, "") || "0", 10);
  return SPEAKER_STYLES[idx % SPEAKER_STYLES.length];
}

export function collectSpeakerNames(segments: { speaker?: string }[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const seg of segments) {
    const name = seg.speaker?.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names.sort((a, b) => b.length - a.length);
}

export function resolveSpeakerDisplayName(
  speakers: { id: string; name: string; display_id: number }[],
  label?: string
): string | undefined {
  if (!label) return undefined;

  const match = label.match(/Speaker\s*(\d+)/i);
  const displayId = match ? Number(match[1]) : /^\d+$/.test(label) ? Number(label) : null;
  if (displayId !== null) {
    const byDisplay = speakers.find((s) => s.display_id === displayId);
    if (byDisplay) return byDisplay.name;
  }

  const byName = speakers.find((s) => s.name === label);
  if (byName) return byName.name;

  return label;
}
