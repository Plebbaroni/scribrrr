"use client";

import { useEffect, useRef } from "react";

// TODO: The audio format (webm/opus via MediaRecorder) needs to match what
// Deepgram expects. For production, consider sending raw PCM via AudioWorklet.

export function useAudioRecorder(
  send: (data: ArrayBuffer) => void,
  isRecording: boolean
) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isRecording) return;

    let cancelled = false;

    async function start() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const buffer = await e.data.arrayBuffer();
          send(buffer);
        }
      };

      recorder.start(250); // send chunks every 250ms
    }

    start();

    return () => {
      cancelled = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      mediaRecorderRef.current = null;
      streamRef.current = null;
    };
  }, [isRecording, send]);
}
