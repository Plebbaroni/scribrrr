import type { FastifyInstance } from "fastify";
import { supabase } from "../supabase.js";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = "/tmp/generated";

export default async function pdfRoutes(fastify: FastifyInstance) {
  fastify.post("/sessions/:sessionId/pdf", async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };

      const { data: session, error: sessionErr } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionErr || !session) {
        return reply
          .status(404)
          .send({ error: sessionErr?.message ?? "Session not found" });
      }

      const { data: segments } = await supabase
        .from("transcript_segments")
        .select("*")
        .eq("session_id", sessionId)
        .order("start_time_ms", { ascending: true });

      const { data: summaries } = await supabase
        .from("summaries")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      const transcriptHtml = (segments ?? [])
        .map(
          (s: { speaker: string; text: string }) =>
            `<p><strong>${escapeHtml(s.speaker)}:</strong> ${escapeHtml(s.text)}</p>`
        )
        .join("\n");

      const summariesHtml = (summaries ?? [])
        .map((s: { summary_type: string; content: Record<string, unknown> }) => {
          const c = s.content as {
            summary?: string;
            decisions?: string[];
            action_items?: string[];
            open_questions?: string[];
            risks_or_blockers?: string[];
          };
          return `
            <div style="margin-bottom:16px;padding:12px;background:#f5f5f5;border-radius:6px;">
              <h3 style="margin:0 0 8px;">${escapeHtml(s.summary_type)}</h3>
              ${c.summary ? `<p>${escapeHtml(c.summary)}</p>` : ""}
              ${renderList("Decisions", c.decisions)}
              ${renderList("Action Items", c.action_items)}
              ${renderList("Open Questions", c.open_questions)}
              ${renderList("Risks / Blockers", c.risks_or_blockers)}
            </div>`;
        })
        .join("\n");

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(session.title)}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#1a1a1a;">
  <h1 style="border-bottom:2px solid #333;padding-bottom:8px;">${escapeHtml(session.title)}</h1>
  <p style="color:#666;font-size:0.9em;">Generated ${new Date().toLocaleString()}</p>

  <h2>Transcript</h2>
  ${transcriptHtml || "<p><em>No transcript segments.</em></p>"}

  <h2>Summaries</h2>
  ${summariesHtml || "<p><em>No summaries generated.</em></p>"}
</body>
</html>`;

      fs.mkdirSync(OUTPUT_DIR, { recursive: true });

      const timestamp = Date.now();
      const filename = `${sessionId}-${timestamp}.pdf`;
      const filepath = path.join(OUTPUT_DIR, filename);

      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.pdf({ path: filepath, format: "A4", printBackground: true });
      await browser.close();

      const { data: fileRecord, error: fileErr } = await supabase
        .from("generated_files")
        .insert({
          id: crypto.randomUUID(),
          session_id: sessionId,
          file_type: "pdf",
          storage_path: `/files/${filename}`,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (fileErr) {
        return reply.status(500).send({ error: fileErr.message });
      }

      return { path: `/files/${filename}`, id: fileRecord.id };
    } catch (err) {
      return reply.status(500).send({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderList(title: string, items?: string[]): string {
  if (!items || items.length === 0) return "";
  const lis = items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  return `<h4 style="margin:8px 0 4px;">${escapeHtml(title)}</h4><ul>${lis}</ul>`;
}
