import type { FastifyInstance } from "fastify";
import { db } from "../supabase.js";
import {
  summariseMeetingTranscript,
  transcriptRowsToMeetingTranscriptJson,
} from "../services/summaries.js";

const exampleTranscriptRows = [
  {
    speaker: "Aisha",
    text: "We need the landing page draft ready before Friday's demo.",
    created_at: "2026-07-05T09:00:00.000Z",
  },
  {
    speaker: "Ben",
    text: "I can handle the hero section and pricing cards by Wednesday.",
    created_at: "2026-07-05T09:01:00.000Z",
  },
  {
    speaker: "Aisha",
    text: "Great. Please also check mobile layout because the current buttons wrap badly.",
    created_at: "2026-07-05T09:02:00.000Z",
  },
  {
    speaker: "Casey",
    text: "I am blocked on the Supabase schema until the meeting_summaries table is created.",
    created_at: "2026-07-05T09:03:00.000Z",
  },
  {
    speaker: "Ben",
    text: "Decision: keep the first version simple and ship summary generation before analytics.",
    created_at: "2026-07-05T09:04:00.000Z",
  },
];

export default async function summaryRoutes(fastify: FastifyInstance) {
  fastify.get("/summaries/example", async () => {
    const transcriptJson = transcriptRowsToMeetingTranscriptJson(
      "example-meeting",
      exampleTranscriptRows
    );
    const summary = await summariseMeetingTranscript(transcriptJson);

    console.log("Gemini example summary:\n", summary);

    return {
      transcript: transcriptJson,
      summary,
    };
  });

  fastify.post("/sessions/:sessionId/summaries/recent", async (request, reply) => {
    const { sessionId } = request.params as any;
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const segments = db.find("transcript_segments", "session_id", sessionId)
      .filter((s: any) => s.created_at >= cutoff)
      .sort((a: any, b: any) => (a.start_time_ms || 0) - (b.start_time_ms || 0));

    if (segments.length === 0) {
      return reply.status(400).send({ error: "No recent transcript segments" });
    }

    const transcriptJson = transcriptRowsToMeetingTranscriptJson(sessionId, segments);

    const summaryText = await summariseMeetingTranscript(transcriptJson);

    console.log("Gemini recent summary:\n", summaryText);

    const summary = db.insert("summaries", {
      id: crypto.randomUUID(),
      session_id: sessionId,
      summary_type: "recent_2min",
      content: { summary: summaryText },
      created_at: new Date().toISOString(),
    });

    return summary;
  });
}
