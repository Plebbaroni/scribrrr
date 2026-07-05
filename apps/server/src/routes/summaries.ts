import type { FastifyInstance } from "fastify";
import { db, supabase } from "../supabase.js";
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

type MessageRow = {
  id: string;
  speaker_id: string | null;
  text: string | null;
  start_time_ms: number | null;
  created_at: string;
};

const FULL_SESSION_SUMMARY_TYPE = "full_session";

export default async function summaryRoutes(fastify: FastifyInstance) {
  fastify.get("/summaries/example", async () => {
    const transcriptJson = transcriptRowsToMeetingTranscriptJson(
      "example-meeting",
      exampleTranscriptRows
    );
    const summary = await summariseMeetingTranscript(transcriptJson);

    // console.log("Gemini example summary:\n", summary);

    return {
      transcript: transcriptJson,
      summary,
    };
  });

  async function getStoredSessionSummary(sessionId: string) {
    const { data: summary, error: summaryError } = await supabase
      .from("summaries")
      .select("id, session_id, summary_type, content, created_at")
      .eq("session_id", sessionId)
      .eq("summary_type", FULL_SESSION_SUMMARY_TYPE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (summaryError) {
      throw new Error(`Failed to fetch stored summary: ${summaryError.message}`);
    }

    return summary;
  }

  async function createSessionSummary(sessionId: string) {
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, speaker_id, text, start_time_ms, created_at")
      .eq("session_id", sessionId)
      .order("start_time_ms", { ascending: true });

    if (messagesError) {
      throw new Error(`Failed to fetch messages: ${messagesError.message}`);
    }

    if (!messages || messages.length === 0) {
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("id, session_name, room_id")
        .eq("id", sessionId)
        .maybeSingle();

      return {
        error: "No messages found for this session",
        debug: {
          sessionId,
          sessionVisible: Boolean(session),
          session,
          sessionError: sessionError?.message,
          possibleCause:
            "The session/messages may be hidden by Supabase RLS when using NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Use SUPABASE_SERVICE_ROLE_KEY on the server for backend summary generation.",
        },
      };
    }

    const { data: speakers, error: speakersError } = await supabase
      .from("speakers")
      .select("id, name, display_id")
      .eq("session_id", sessionId);

    if (speakersError) {
      throw new Error(`Failed to fetch speakers: ${speakersError.message}`);
    }

    const speakerNames = new Map(
      (speakers ?? []).map((speaker: any) => [
        speaker.id,
        speaker.name ?? `Speaker ${speaker.display_id}`,
      ])
    );

    const transcriptRows = (messages as MessageRow[])
      .filter((message) => message.text)
      .map((message) => ({
        speaker: message.speaker_id
          ? speakerNames.get(message.speaker_id) ?? "Unknown"
          : "Unknown",
        text: message.text ?? "",
        created_at: message.created_at,
      }));

    const transcriptJson = transcriptRowsToMeetingTranscriptJson(sessionId, transcriptRows);
    const summaryText = await summariseMeetingTranscript(transcriptJson);

    // console.log("Gemini session summary:\n", summaryText);

    const { data: existingSummary, error: existingSummaryError } = await supabase
      .from("summaries")
      .select("id")
      .eq("session_id", sessionId)
      .eq("summary_type", FULL_SESSION_SUMMARY_TYPE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSummaryError) {
      throw new Error(`Failed to check existing summary: ${existingSummaryError.message}`);
    }

    const summaryPayload = {
      session_id: sessionId,
      summary_type: FULL_SESSION_SUMMARY_TYPE,
      content: { summary: summaryText },
      created_at: new Date().toISOString(),
    };

    const saveQuery = existingSummary
      ? supabase.from("summaries").update(summaryPayload).eq("id", existingSummary.id)
      : supabase.from("summaries").insert(summaryPayload);

    const { data: summary, error: summaryError } = await saveQuery.select().single();

    if (summaryError) {
      throw new Error(`Failed to save summary: ${summaryError.message}`);
    }

    return {
      transcript: transcriptJson,
      summary,
    };
  }

  fastify.get("/sessions/:sessionId/summaries", async (request, reply) => {
    const { sessionId } = request.params as any;
    const summary = await getStoredSessionSummary(sessionId);

    if (!summary) {
      return reply.status(404).send({ error: "No stored summary found for this session" });
    }

    return summary;
  });

  fastify.get("/sessions/:sessionId/summaries/", async (request, reply) => {
    const { sessionId } = request.params as any;
    const summary = await getStoredSessionSummary(sessionId);

    if (!summary) {
      return reply.status(404).send({ error: "No stored summary found for this session" });
    }

    return summary;
  });

  fastify.post("/sessions/:sessionId/summaries", async (request, reply) => {
    const { sessionId } = request.params as any;
    const result = await createSessionSummary(sessionId);

    if ("error" in result) {
      return reply.status(404).send(result);
    }

    return result;
  });

  fastify.post("/sessions/:sessionId/summaries/", async (request, reply) => {
    const { sessionId } = request.params as any;
    const result = await createSessionSummary(sessionId);

    if ("error" in result) {
      return reply.status(404).send(result);
    }

    return result;
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

    // console.log("Gemini recent summary:\n", summaryText);

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
