import type { FastifyInstance } from "fastify";
import { createClient as createDeepgramClient } from "@deepgram/sdk";
import { supabase } from "../supabase.js";

const MOCK_PHRASES = [
  "I think we should focus on the core user experience first.",
  "Agreed. Let's prioritize the transcription accuracy before adding features.",
  "What about the latency? Users will notice if there's a big delay.",
  "We can buffer in 200ms chunks — that should feel real-time enough.",
  "Has anyone looked into speaker diarization quality?",
  "Yes, Deepgram's nova-2 model handles it pretty well out of the box.",
  "Let's make sure we have a fallback if the WebSocket drops.",
  "Good call. We should also handle reconnection on the frontend.",
  "I'll take the action item to write the reconnect logic.",
  "Perfect. Let's also add a mock mode for demos.",
];

export default async function streamRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/sessions/:sessionId/stream",
    { websocket: true },
    async (socket, request) => {
      const { sessionId } = request.params as { sessionId: string };
      const query = request.query as { mock?: string };
      const isMock = query.mock === "true";

      if (isMock) {
        handleMockStream(socket, sessionId);
      } else {
        handleDeepgramStream(socket, sessionId);
      }
    }
  );
}

function handleMockStream(socket: import("ws").WebSocket, sessionId: string): void {
  let phraseIndex = 0;
  let startTimeMs = 0;

  const interval = setInterval(async () => {
    const speaker = phraseIndex % 2 === 0 ? "Speaker 0" : "Speaker 1";
    const text = MOCK_PHRASES[phraseIndex % MOCK_PHRASES.length];
    const duration = 2000 + Math.random() * 1000;

    const segment = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      speaker,
      text,
      start_time_ms: startTimeMs,
      end_time_ms: startTimeMs + duration,
      confidence: 0.95 + Math.random() * 0.05,
      is_final: true,
      created_at: new Date().toISOString(),
    };

    socket.send(JSON.stringify({ type: "transcript", segment }));

    await supabase.from("transcript_segments").insert(segment);

    phraseIndex++;
    startTimeMs += duration;
  }, 2000 + Math.random() * 1000);

  socket.on("close", () => {
    clearInterval(interval);
  });
}

function handleDeepgramStream(
  socket: import("ws").WebSocket,
  sessionId: string
) {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramApiKey) {
    socket.send(
      JSON.stringify({ type: "error", message: "DEEPGRAM_API_KEY not set" })
    );
    socket.close();
    return;
  }

  const deepgram = createDeepgramClient(deepgramApiKey);

  // TODO: tune encoding, sample_rate, and channels to match frontend audio capture settings
  const dgConnection = deepgram.listen.live({
    model: "nova-2",
    smart_format: true,
    diarize: true,
    interim_results: true,
    // TODO: set encoding (e.g. "linear16"), sample_rate (e.g. 16000), channels (e.g. 1)
  });

  let startTimeMs = 0;

  dgConnection.on("open", () => {
    fastifyLog("Deepgram connection opened for session " + sessionId);
  });

  dgConnection.on("Results", async (data) => {
    try {
      const result = data.channel?.alternatives?.[0];
      if (!result || !result.transcript) return;

      const isFinal = data.is_final ?? false;
      const words = result.words ?? [];

      const speaker =
        words.length > 0 && words[0].speaker !== undefined
          ? `Speaker ${words[0].speaker}`
          : "Unknown";

      const segmentStart = words.length > 0 ? words[0].start * 1000 : startTimeMs;
      const segmentEnd =
        words.length > 0 ? words[words.length - 1].end * 1000 : startTimeMs;

      const segment = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        speaker,
        text: result.transcript,
        start_time_ms: segmentStart,
        end_time_ms: segmentEnd,
        confidence: result.confidence ?? 0,
        is_final: isFinal,
        created_at: new Date().toISOString(),
      };

      socket.send(JSON.stringify({ type: "transcript", segment }));

      if (isFinal) {
        await supabase.from("transcript_segments").insert(segment);
        startTimeMs = segmentEnd;
      }
    } catch (err) {
      fastifyLog("Error processing Deepgram result: " + err);
    }
  });

  dgConnection.on("error", (err) => {
    fastifyLog("Deepgram error: " + err);
    socket.send(
      JSON.stringify({
        type: "error",
        message: "Deepgram transcription error",
      })
    );
  });

  dgConnection.on("close", () => {
    fastifyLog("Deepgram connection closed for session " + sessionId);
  });

  socket.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
    if (dgConnection.getReadyState() === 1) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      dgConnection.send(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    }
  });

  socket.on("close", () => {
    dgConnection.requestClose();
  });
}

function fastifyLog(msg: string) {
  console.log(`[stream] ${msg}`);
}
