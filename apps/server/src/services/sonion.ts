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

// Callbacks the route wires up to relay data back to the browser.
export interface SonioxHandlers {
  onToken: (res: SonioxResponse) => void; // a parsed response arrived
  onError: (code: number, message: string) => void; // Soniox reported an error
  onClose: () => void; // Soniox connection closed
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
 * The handlers (onToken/onError/onClose) fire as data comes back from Soniox.
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

    handlers.onToken(res);

    if (res.finished) {
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
