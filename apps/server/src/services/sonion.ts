import WebSocket from "ws";

const SONIOX_WEBSOCKET_URL = "wss://stt-rt.soniox.com/transcribe-websocket";

// ---- Types -----------------------------------------------------------------

type AudioFormat = "auto" | "pcm_s16le";

interface ContextEntry {
  key: string;
  value: string;
}

interface SonioxContext {
  general?: ContextEntry[];
  terms?: string[];
}

interface SonioxConfig {
  api_key: string;
  model: string;
  language_hints?: string[];
  enable_language_identification?: boolean;
  enable_speaker_diarization?: boolean;
  enable_endpoint_detection?: boolean;
  context?: SonioxContext;
  audio_format?: AudioFormat;
  sample_rate?: number;
  num_channels?: number;
}

// A single token in a Soniox response.
// Optional fields only appear when their feature is enabled in the config.
export interface SonioxToken {
  text: string;
  is_final: boolean;
  speaker?: string;
  language?: string;
  start_ms?: number;
  end_ms?: number;
  confidence?: number;
}

// The parsed JSON of each WebSocket message from Soniox.
export interface SonioxResponse {
  tokens?: SonioxToken[];
  final_audio_proc_ms?: number;
  total_audio_proc_ms?: number;
  finished?: boolean;
  error_code?: number;
  error_message?: string;
}

// Optional per-session priming passed in from the client (session/new page).
export interface SessionContext {
  topic?: string;
  participants?: string[];
  terms?: string[];
}

// A finalized, speaker-attributed chunk of transcript ready to show/store.
export interface AssembledSegment {
  speaker?: string;
  text: string;
  startMs?: number;
  endMs?: number;
}

// Callbacks the route wires up to relay data back to the browser.
export interface SonioxHandlers {
  onSegment: (segment: AssembledSegment) => void; // a segment finalized (speaker change / endpoint / stream end)
  onPartial: (speaker: string | undefined, text: string) => void; // live, mutable in-progress text
  onError: (code: number, message: string) => void; // Soniox reported an error
  onFinished: () => void; // Soniox has flushed everything and is done
  onClose: () => void; // Soniox connection closed
}

// ---- Segment assembly -------------------------------------------------------

// Soniox marks the end of an utterance (when enable_endpoint_detection is on)
// with a final token whose text is literally "<end>" — not real transcript
// content, just a boundary marker. See:
// https://soniox.com/docs/stt/rt/endpoint-detection
const END_TOKEN_TEXT = "<end>";

/**
 * Groups a raw Soniox token stream into speaker-attributed segments.
 *
 * Soniox semantics this relies on (see docs/stt/rt):
 *   - Each message's tokens are only the NEW final tokens since the last
 *     message (final tokens are sent exactly once, in order, never repeated)
 *     followed by the CURRENT full set of non-final tokens (non-final tokens
 *     replace the previous non-final buffer wholesale, not incrementally).
 *   - A final "<end>" token marks an endpoint (pause) and means everything
 *     before it in the segment is now final.
 *
 * A segment is flushed (via onSegment) when: the speaker on incoming final
 * tokens changes, an "<end>" token arrives, or the stream finishes.
 */
export class SegmentAssembler {
  private speaker: string | undefined;
  private text: string[] = [];
  private startMs: number | undefined;
  private endMs: number | undefined;

  constructor(
    private readonly onSegment: (segment: AssembledSegment) => void,
    private readonly onPartial: (speaker: string | undefined, text: string) => void,
  ) { }

  push(response: SonioxResponse): void {
    const tokens = response.tokens ?? [];
    let sawFinal = false;

    for (const token of tokens) {
      if (!token.is_final) continue;
      sawFinal = true;

      if (token.text === END_TOKEN_TEXT) {
        this.flush();
        continue;
      }
      this.appendFinal(token);
    }

    const pending = tokens.filter((t) => !t.is_final);
    if (pending.length > 0) {
      const speaker = pending.find((t) => t.speaker !== undefined)?.speaker ?? this.speaker;
      this.onPartial(speaker, pending.map((t) => t.text).join(""));
    } else if (sawFinal) {
      // Everything that was pending became final (or hit <end>) this round.
      this.onPartial(this.speaker, "");
    }

    if (response.finished) this.flush();
  }

  private appendFinal(token: SonioxToken): void {
    if (this.speaker !== undefined && token.speaker !== undefined && token.speaker !== this.speaker) {
      this.flush();
    }
    if (this.speaker === undefined) this.speaker = token.speaker;
    if (this.startMs === undefined) this.startMs = token.start_ms;
    this.endMs = token.end_ms ?? this.endMs;
    this.text.push(token.text);
  }

  private flush(): void {
    if (this.text.length === 0) return;
    this.onSegment({
      speaker: this.speaker,
      text: this.text.join("").trim(),
      startMs: this.startMs,
      endMs: this.endMs,
    });
    this.speaker = undefined;
    this.text = [];
    this.startMs = undefined;
    this.endMs = undefined;
  }
}

// ---- Config builder --------------------------------------------------------

function getConfig(
  apiKey: string,
  sessionContext?: SessionContext,
): SonioxConfig {
  const config: SonioxConfig = {
    api_key: apiKey,
    model: "stt-rt-v5",
    language_hints: ["en"],
    enable_speaker_diarization: true,
    enable_endpoint_detection: true,
    // Browser sends raw PCM: 16-bit signed little-endian, 16 kHz, mono.
    // This MUST match what the frontend's AudioWorklet produces.
    audio_format: "pcm_s16le",
    sample_rate: 16000,
    num_channels: 1,
  };

  // Attach context only if the caller actually provided something useful.
  if (sessionContext) {
    const general: ContextEntry[] = [];
    if (sessionContext.topic) {
      general.push({ key: "topic", value: sessionContext.topic });
    }
    if (sessionContext.participants?.length) {
      general.push({
        key: "participants",
        value: sessionContext.participants.join(", "),
      });
    }

    const ctx: SonioxContext = {};
    if (general.length) ctx.general = general;
    if (sessionContext.terms?.length) ctx.terms = sessionContext.terms;
    if (general.length || sessionContext.terms?.length) config.context = ctx;
  }

  return config;
}

// ---- Session ---------------------------------------------------------------

/**
 * Opens a WebSocket to Soniox for one transcription session.
 *
 * Returns a small controller the route uses to drive it:
 *   - sendAudio(chunk): forward a raw PCM chunk from the browser to Soniox
 *   - finish(): signal end-of-audio (Soniox flushes remaining tokens, then finishes)
 *   - close(): tear the connection down immediately (e.g. browser disconnected)
 *
 * The handlers (onSegment/onPartial/onError/onFinished/onClose) fire as data
 * comes back from Soniox, via the SegmentAssembler.
 */
export function createSonioxSession(
  handlers: SonioxHandlers,
  sessionContext?: SessionContext,
): {
  sendAudio: (chunk: Buffer) => void;
  finish: () => void;
  close: () => void;
} {
  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) {
    throw new Error("Missing SONIOX_API_KEY environment variable.");
  }

  const config = getConfig(apiKey, sessionContext);
  const ws = new WebSocket(SONIOX_WEBSOCKET_URL);
  const assembler = new SegmentAssembler(handlers.onSegment, handlers.onPartial);

  // Audio chunks may arrive from the browser before the Soniox socket is open.
  // Buffer them until "open", then flush in order.
  let isOpen = false;
  const pending: Buffer[] = [];

  ws.on("open", () => {
    isOpen = true;
    // First frame must be the JSON config.
    ws.send(JSON.stringify(config));
    // Flush anything the browser already sent.
    for (const chunk of pending) ws.send(chunk);
    pending.length = 0;
  });

  ws.on("message", (msg: WebSocket.RawData) => {
    let res: SonioxResponse;
    try {
      res = JSON.parse(msg.toString()) as SonioxResponse;
    } catch {
      return; // ignore malformed frames
    }

    if (res.error_code) {
      handlers.onError(res.error_code, res.error_message ?? "unknown error");
      ws.close();
      return;
    }

    assembler.push(res);

    if (res.finished) {
      handlers.onFinished();
      ws.close();
    }
  });

  ws.on("error", (err: Error) => {
    handlers.onError(-1, err.message);
  });

  ws.on("close", () => {
    handlers.onClose();
  });

  return {
    sendAudio(chunk: Buffer) {
      if (isOpen && ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      } else {
        pending.push(chunk);
      }
    },
    finish() {
      // Empty string signals end-of-audio to Soniox.
      if (ws.readyState === WebSocket.OPEN) ws.send("");
    },
    close() {
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
    },
  };
}
