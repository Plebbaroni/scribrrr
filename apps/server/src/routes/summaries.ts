import type { FastifyInstance } from "fastify";
import { supabase } from "../supabase.js";
import { openai } from "../services/openai.js";

export default async function summaryRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/sessions/:sessionId/summaries/recent",
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };

        const twoMinutesAgo = new Date(
          Date.now() - 2 * 60 * 1000
        ).toISOString();

        const { data: segments, error: segError } = await supabase
          .from("transcript_segments")
          .select("*")
          .eq("session_id", sessionId)
          .gte("created_at", twoMinutesAgo)
          .order("start_time_ms", { ascending: true });

        if (segError) {
          return reply.status(500).send({ error: segError.message });
        }

        if (!segments || segments.length === 0) {
          return reply
            .status(400)
            .send({ error: "No recent transcript segments found" });
        }

        const transcriptBlock = segments
          .map(
            (s: { speaker: string; text: string }) =>
              `[${s.speaker}]: ${s.text}`
          )
          .join("\n");

        // TODO: tune model choice based on cost/quality tradeoffs
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a meeting assistant. Given a transcript excerpt, produce a structured JSON summary with these fields:
- summary: a concise paragraph summarizing what was discussed
- decisions: array of decisions made
- action_items: array of action items with owners if mentioned
- open_questions: array of unresolved questions
- risks_or_blockers: array of risks or blockers mentioned

Respond ONLY with valid JSON, no markdown fences.`,
            },
            {
              role: "user",
              content: transcriptBlock,
            },
          ],
          temperature: 0.3,
        });

        const raw = completion.choices[0]?.message?.content ?? "{}";
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { summary: raw, decisions: [], action_items: [], open_questions: [], risks_or_blockers: [] };
        }

        const { data: summary, error: insertError } = await supabase
          .from("summaries")
          .insert({
            id: crypto.randomUUID(),
            session_id: sessionId,
            summary_type: "recent_2min",
            content: parsed,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          return reply.status(500).send({ error: insertError.message });
        }

        return summary;
      } catch (err) {
        return reply.status(500).send({
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  );
}
