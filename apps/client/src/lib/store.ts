import { create } from "zustand";

export interface TranscriptSegment {
  id?: string;
  speaker?: string;
  text: string;
  start_time_ms?: number;
  end_time_ms?: number;
  is_final?: boolean;
  confidence?: number;
}

export interface Summary {
  id?: string;
  summary: string;
  decisions: string[];
  action_items: string[];
  open_questions: string[];
  risks_or_blockers: string[];
  created_at?: string;
}

export interface SessionStore {
  sessionId: string | null;
  title: string;
  isRecording: boolean;
  isMockMode: boolean;
  segments: TranscriptSegment[];
  summaries: Summary[];

  setSession: (id: string, title: string) => void;
  setRecording: (val: boolean) => void;
  setMockMode: (val: boolean) => void;
  addSegment: (seg: TranscriptSegment) => void;
  addSummary: (s: Summary) => void;
  clearSegments: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessionId: null,
  title: "",
  isRecording: false,
  isMockMode: false,
  segments: [],
  summaries: [],

  setSession: (id, title) => set({ sessionId: id, title }),
  setRecording: (val) => set({ isRecording: val }),
  setMockMode: (val) => set({ isMockMode: val }),
  addSegment: (seg) => set((state) => ({ segments: [...state.segments, seg] })),
  addSummary: (s) => set((state) => ({ summaries: [...state.summaries, s] })),
  clearSegments: () => set({ segments: [] }),
}));
