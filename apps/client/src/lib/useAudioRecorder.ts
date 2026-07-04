"use client";

import { useEffect, useRef } from "react";

const WORKLET_URL = "/pcm-worklet.js";
const WORKLET_NAME = "pcm-worklet";

export function useAudioRecorder(
  send: (data: ArrayBuffer) => void,
  isRecording: boolean
) {
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);

  useEffect(() => {
    if (!isRecording) return;

    let cancelled = false;
    let bytesThisSecond = 0;

    async function start() {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      await audioContext.audioWorklet.addModule(WORKLET_URL);
      if (cancelled) {
        await audioContext.close();
        return;
      }

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const worklet = new AudioWorkletNode(audioContext, WORKLET_NAME);
      workletRef.current = worklet;

      worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        bytesThisSecond += event.data.byteLength;
        send(event.data);
      };

      source.connect(worklet);
      // Some browsers only pull an AudioWorkletNode's process() calls when it
      // has a path to the destination. Safe to connect: our worklet never
      // writes to its output, so this stays silent (no mic feedback).
      worklet.connect(audioContext.destination);
    }

    start();

    const logInterval = setInterval(() => {
      console.log(`[useAudioRecorder] PCM: ${bytesThisSecond} bytes/sec`);
      bytesThisSecond = 0;
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(logInterval);
      workletRef.current?.disconnect();
      sourceRef.current?.disconnect();
      audioContextRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      workletRef.current = null;
      sourceRef.current = null;
      audioContextRef.current = null;
      streamRef.current = null;
    };
  }, [isRecording, send]);
}
