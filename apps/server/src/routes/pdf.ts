import type { FastifyInstance } from "fastify";
import { db } from "../supabase.js";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = "/tmp/generated";

export default async function pdfRoutes(fastify: FastifyInstance) {
  fastify.post("/sessions/:sessionId/pdf", async (request, reply) => {
    const { sessionId } = request.params as any;

    const session = db.findOne("sessions", "id", sessionId);
    if (!session) return reply.status(404).send({ error: "Session not found" });

    const segments = db.find("transcript_segments", "session_id", sessionId)
      .sort((a: any, b: any) => (a.start_time_ms || 0) - (b.start_time_ms || 0));

    const summaries = db.find("summaries", "session_id", sessionId)
      .sort((a: any, b: any) => (a.created_at || "").localeCompare(b.created_at || ""));

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const transcriptHtml = segments
      .map((s: any) => `<p><strong>${esc(s.speaker || "Unknown")}:</strong> ${esc(s.text || "")}</p>`)
      .join("\n");

    const summariesHtml = summaries
      .map((s: any) => {
        const c = s.content || {};
        const list = (title: string, items: string[]) => {
          if (!items?.length) return "";
          return `<h4>${esc(title)}</h4><ul>${items.map((i: string) => `<li>${esc(i)}</li>`).join("")}</ul>`;
        };
        return `<div style="margin-bottom:16px;padding:12px;background:#f5f5f5;border-radius:6px;">
          ${c.summary ? `<p>${esc(c.summary)}</p>` : ""}
          ${list("Decisions", c.decisions)}
          ${list("Action Items", c.action_items)}
          ${list("Open Questions", c.open_questions)}
          ${list("Risks / Blockers", c.risks_or_blockers)}
        </div>`;
      })
      .join("\n");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;">
  <h1>${esc(session.title || "Session")}</h1>
  <h2>Transcript</h2>${transcriptHtml || "<p><em>None</em></p>"}
  <h2>Summaries</h2>${summariesHtml || "<p><em>None</em></p>"}
</body></html>`;

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const filename = `${sessionId}-${Date.now()}.pdf`;
    const filepath = path.join(OUTPUT_DIR, filename);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({ path: filepath, format: "A4", printBackground: true });
    await browser.close();

    return { path: `/files/${filename}` };
  });
}
