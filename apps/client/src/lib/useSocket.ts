"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSessionStore } from "./store";

const WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:3001";

export function useSocket(sessionId: string | null, mock: boolean, isRecording: boolean) {
  const wsRef = useRef<WebSocket | null>(null);
  const addSegment = useSessionStore((s) => s.addSegment);

  useEffect(() => {
    if (!isRecording || !sessionId) return;

    const url = `${WS_BASE}/sessions/${sessionId}/stream${mock ? "?mock=true" : ""}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcript") {
          addSegment(data.segment ?? data);
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isRecording, sessionId, mock, addSegment]);

  const send = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { send };
}
