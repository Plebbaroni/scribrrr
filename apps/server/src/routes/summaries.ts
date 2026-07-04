import type { FastifyInstance } from "fastify";
import { db } from "../supabase.js";
import { openai } from "../services/openai.js";

export default async function summaryRoutes(fastify: FastifyInstance) {
  fastify.post("/sessions/:sessionId/summaries/recent", async (request, reply) => {
    const { sessionId } = request.params as any;
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const segments = db.find("transcript_segments", "session_id", sessionId)
      .filter((s: any) => s.created_at >= cutoff)
      .sort((a: any, b: any) => (a.start_time_ms || 0) - (b.start_time_ms || 0));

    if (segments.length === 0) {
      return reply.status(400).send({ error: "No recent transcript segments" });
    }

    const transcript = segments.map((s: any) => `[${s.speaker || "Unknown"}]: ${s.text}`).join("\n");

    // TODO: tune model
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a meeting assistant. Given a transcript excerpt, produce JSON with: summary, decisions, action_items, open_questions, risks_or_blockers. Respond ONLY with valid JSON.`,
        },
        { role: "user", content: transcript },
      ],
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { summary: raw }; }

    const summary = db.insert("summaries", {
      id: crypto.randomUUID(),
      session_id: sessionId,
      summary_type: "recent_2min",
      content: parsed,
      created_at: new Date().toISOString(),
    });

    return summary;
  });
}
