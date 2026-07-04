"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSessionStore, type TranscriptSegment } from "./store";

const WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:3001";

// How long to wait for the server's "finished" message (after we send "stop")
// before we give up and close the socket ourselves.
const STOP_GRACE_MS = 5000;

export interface SessionContext {
  topic?: string;
  participants?: string[];
  terms?: string[];
}

interface AssembledSegment {
  speaker?: string;
  text: string;
  startMs?: number;
  endMs?: number;
}

type ServerMessage =
  | { type: "segment"; segment: AssembledSegment }
  | { type: "partial"; speaker?: string; text: string }
  | { type: "error"; code: number; message: string }
  | { type: "finished" };

function toTranscriptSegment(seg: AssembledSegment): TranscriptSegment {
  return {
    speaker: seg.speaker,
    text: seg.text,
    start_time_ms: seg.startMs,
    end_time_ms: seg.endMs,
    is_final: true,
  };
}

export function useSocket(
  sessionId: string | null,
  context: SessionContext | undefined,
  isRecording: boolean
) {
  const wsRef = useRef<WebSocket | null>(null);
  const addSegment = useSessionStore((s) => s.addSegment);
  const setPartial = useSessionStore((s) => s.setPartial);

  useEffect(() => {
    if (!isRecording || !sessionId) return;

    const ws = new WebSocket(`${WS_BASE}/stream/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "start", context }));
    };

    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "segment":
          addSegment(toTranscriptSegment(msg.segment));
          break;
        case "partial":
          setPartial(msg.speaker, msg.text);
          break;
        case "error":
          console.error("[useSocket] Soniox error:", msg.code, msg.message);
          break;
        case "finished":
          ws.close();
          break;
      }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        // Ask the server to flush the last segment(s) from Soniox. It closes
        // us once it sends "finished" (handled above); fall back to a hard
        // close if that never arrives.
        ws.send(JSON.stringify({ type: "stop" }));
        const timeout = setTimeout(() => ws.close(), STOP_GRACE_MS);
        ws.addEventListener("close", () => clearTimeout(timeout), { once: true });
      } else {
        ws.close();
      }
    };
  }, [isRecording, sessionId, context, addSegment, setPartial]);

  const send = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { send };
}
