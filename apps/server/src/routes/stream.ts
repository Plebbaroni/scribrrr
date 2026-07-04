import type { FastifyInstance } from "fastify";
import { createClient as createDeepgramClient } from "@deepgram/sdk";
import { db } from "../supabase.js";

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
  fastify.get("/sessions/:sessionId/stream", { websocket: true }, async (socket, request) => {
    const { sessionId } = request.params as any;
    const query = request.query as any;
    const isMock = query.mock === "true";

    if (isMock) {
      handleMock(socket, sessionId);
    } else {
      handleDeepgram(socket, sessionId);
    }
  });
}

function handleMock(socket: import("ws").WebSocket, sessionId: string) {
  let idx = 0;
  let time = 0;

  const interval = setInterval(() => {
    const speaker = idx % 2 === 0 ? "Speaker 0" : "Speaker 1";
    const text = MOCK_PHRASES[idx % MOCK_PHRASES.length];
    const dur = 2000 + Math.random() * 1000;

    const seg = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      speaker,
      text,
      start_time_ms: time,
      end_time_ms: time + dur,
      is_final: true,
      created_at: new Date().toISOString(),
    };

    socket.send(JSON.stringify({ type: "transcript", segment: seg }));
    db.insert("transcript_segments", seg);

    idx++;
    time += dur;
  }, 2000 + Math.random() * 1000);

  socket.on("close", () => clearInterval(interval));
}

function handleDeepgram(socket: import("ws").WebSocket, sessionId: string) {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    socket.send(JSON.stringify({ type: "error", message: "DEEPGRAM_API_KEY not set" }));
    socket.close();
    return;
  }

  const dg = createDeepgramClient(key);

  // TODO: tune encoding, sample_rate, channels to match frontend audio format
  const conn = dg.listen.live({
    model: "nova-2",
    smart_format: true,
    diarize: true,
    interim_results: true,
  });

  conn.on("open", () => console.log(`[stream] Deepgram open for ${sessionId}`));

  conn.on("Results", (data: any) => {
    const alt = data.channel?.alternatives?.[0];
    if (!alt?.transcript) return;

    const words = alt.words || [];
    const speaker = words[0]?.speaker !== undefined ? `Speaker ${words[0].speaker}` : "Unknown";

    const seg = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      speaker,
      text: alt.transcript,
      start_time_ms: words[0]?.start ? words[0].start * 1000 : 0,
      end_time_ms: words.length ? words[words.length - 1].end * 1000 : 0,
      is_final: data.is_final ?? false,
      created_at: new Date().toISOString(),
    };

    socket.send(JSON.stringify({ type: "transcript", segment: seg }));
    if (seg.is_final) db.insert("transcript_segments", seg);
  });

  conn.on("error", (err: any) => {
    console.error("[stream] Deepgram error:", err);
    socket.send(JSON.stringify({ type: "error", message: "Deepgram error" }));
  });

  socket.on("message", (data: any) => {
    if (conn.getReadyState() === 1) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      conn.send(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    }
  });

  socket.on("close", () => conn.requestClose());
}
