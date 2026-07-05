import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { supabase } from "../supabase.js";

type SessionParams = {
  sessionId: string;
};

type MessageRow = {
  id: string;
  speaker_id: string | null;
  text: string | null;
  start_time_ms: number | null;
  end_time_ms: number | null;
  created_at: string;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not specified";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(startMs: number | null, endMs: number | null) {
  if (startMs == null && endMs == null) return "";

  const formatMs = (ms: number | null) => {
    if (ms == null) return "--:--";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return `${formatMs(startMs)} - ${formatMs(endMs)}`;
}

function markdownToHtml(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  let inList = false;

  const html = lines
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        if (inList) {
          inList = false;
          return "</ul>";
        }
        return "";
      }

      if (trimmed.startsWith("## ")) {
        const closeList = inList ? "</ul>" : "";
        inList = false;
        return `${closeList}<h3>${escapeHtml(trimmed.slice(3))}</h3>`;
      }

      if (trimmed.startsWith("# ")) {
        const closeList = inList ? "</ul>" : "";
        inList = false;
        return `${closeList}<h2>${escapeHtml(trimmed.slice(2))}</h2>`;
      }

      if (trimmed.startsWith("- ")) {
        const openList = inList ? "" : "<ul>";
        inList = true;
        return `${openList}<li>${escapeHtml(trimmed.slice(2))}</li>`;
      }

      const closeList = inList ? "</ul>" : "";
      inList = false;
      return `${closeList}<p>${escapeHtml(trimmed)}</p>`;
    })
    .join("\n");

  return inList ? `${html}</ul>` : html;
}

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default async function pdfRoutes(fastify: FastifyInstance) {
  async function downloadSessionPdf(
    request: FastifyRequest<{ Params: SessionParams }>,
    reply: FastifyReply
  ) {
    const { sessionId } = request.params;

    try {
      return await buildSessionPdf(sessionId, reply);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/executable doesn't exist|playwright install/i.test(message)) {
        return reply.status(503).send({
          error:
            "PDF renderer is not installed. Run `npx playwright install chromium` in apps/server, then restart the server.",
        });
      }
      throw err;
    }
  }

  fastify.get("/sessions/:sessionId/pdf", downloadSessionPdf);
  fastify.post("/sessions/:sessionId/pdf", downloadSessionPdf);
}

async function buildSessionPdf(sessionId: string, reply: FastifyReply) {

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, session_name, created_at, ended_at, room_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      throw new Error(`Failed to fetch session: ${sessionError.message}`);
    }

    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }

    const { data: room, error: roomError } = session.room_id
      ? await supabase
          .from("rooms")
          .select("id, room_name")
          .eq("id", session.room_id)
          .maybeSingle()
      : { data: null, error: null };

    if (roomError) {
      throw new Error(`Failed to fetch room: ${roomError.message}`);
    }

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, speaker_id, text, start_time_ms, end_time_ms, created_at")
      .eq("session_id", sessionId)
      .order("start_time_ms", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw new Error(`Failed to fetch messages: ${messagesError.message}`);
    }

    const { data: speakers, error: speakersError } = await supabase
      .from("speakers")
      .select("id, name, display_id")
      .eq("session_id", sessionId);

    if (speakersError) {
      throw new Error(`Failed to fetch speakers: ${speakersError.message}`);
    }

    const { data: summaries, error: summariesError } = await supabase
      .from("summaries")
      .select("id, summary_type, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (summariesError) {
      throw new Error(`Failed to fetch summaries: ${summariesError.message}`);
    }

    const speakerNames = new Map(
      (speakers ?? []).map((speaker: any) => [
        speaker.id,
        speaker.name ?? `Speaker ${speaker.display_id}`,
      ])
    );

    const transcriptRows = (messages as MessageRow[] | null ?? []).filter((message) =>
      Boolean(message.text)
    );

    const transcriptHtml = transcriptRows.length
      ? transcriptRows
          .map((message, index) => {
            const speaker = message.speaker_id
              ? speakerNames.get(message.speaker_id) ?? "Unknown"
              : "Unknown";

            return `
              <article class="message">
                <div class="messageMeta">
                  <span class="messageNumber">${index + 1}</span>
                  <span class="speaker">${escapeHtml(speaker)}</span>
                  <span class="timestamp">${escapeHtml(formatDateTime(message.created_at))}</span>
                  <span class="duration">${escapeHtml(
                    formatDuration(message.start_time_ms, message.end_time_ms)
                  )}</span>
                </div>
                <p>${escapeHtml(message.text)}</p>
              </article>
            `;
          })
          .join("\n")
      : `<p class="empty">No transcript messages found.</p>`;

    const summariesHtml = (summaries ?? []).length
      ? (summaries ?? [])
          .map((summary: any) => {
            const content = summary.content;
            const summaryText =
              typeof content === "string"
                ? content
                : content?.summary ?? JSON.stringify(content ?? {}, null, 2);

            return `
              <section class="summaryBlock">
                <div class="summaryMeta">
                  <span>${escapeHtml(summary.summary_type)}</span>
                  <span>${escapeHtml(formatDateTime(summary.created_at))}</span>
                </div>
                <div class="summaryContent">
                  ${markdownToHtml(summaryText)}
                </div>
              </section>
            `;
          })
          .join("\n")
      : `<p class="empty">No summary has been generated for this session yet.</p>`;

    const sessionName = session.session_name || "Untitled Session";
    const roomName = (room as any)?.room_name || "No room";
    const generatedAt = formatDateTime(new Date().toISOString());

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(sessionName)} Report</title>
  <style>
    @page {
      size: A4;
      margin: 22mm 18mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      color: #172033;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      line-height: 1.55;
      margin: 0;
    }

    .cover {
      border-bottom: 2px solid #172033;
      margin-bottom: 26px;
      padding-bottom: 18px;
    }

    .eyebrow {
      color: #5d6b82;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      font-size: 30px;
      line-height: 1.1;
      margin: 8px 0 14px;
    }

    h2 {
      border-bottom: 1px solid #d9dee8;
      font-size: 18px;
      margin: 28px 0 12px;
      padding-bottom: 6px;
    }

    h3 {
      color: #22324c;
      font-size: 14px;
      margin: 16px 0 6px;
    }

    .details {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 16px;
    }

    .detail {
      background: #f5f7fb;
      border: 1px solid #e0e6f0;
      border-radius: 6px;
      padding: 10px 12px;
    }

    .label {
      color: #627089;
      display: block;
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 2px;
      text-transform: uppercase;
    }

    .value {
      color: #172033;
      font-weight: 650;
    }

    .summaryBlock {
      background: #fbfcff;
      border: 1px solid #dce3ee;
      border-radius: 7px;
      margin-bottom: 14px;
      padding: 14px 16px;
    }

    .summaryMeta {
      color: #627089;
      display: flex;
      font-size: 10px;
      font-weight: 700;
      justify-content: space-between;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .summaryContent p {
      margin: 6px 0;
    }

    ul {
      margin: 6px 0 10px 18px;
      padding: 0;
    }

    li {
      margin: 4px 0;
    }

    .message {
      border-bottom: 1px solid #edf0f5;
      break-inside: avoid;
      padding: 10px 0;
    }

    .messageMeta {
      align-items: center;
      display: grid;
      gap: 8px;
      grid-template-columns: 28px 1fr 145px 70px;
      margin-bottom: 4px;
    }

    .messageNumber {
      background: #172033;
      border-radius: 999px;
      color: white;
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      height: 22px;
      line-height: 22px;
      text-align: center;
      width: 22px;
    }

    .speaker {
      font-weight: 750;
    }

    .timestamp,
    .duration {
      color: #627089;
      font-size: 10px;
      text-align: right;
    }

    .message p {
      margin: 0 0 0 36px;
    }

    .empty {
      color: #627089;
      font-style: italic;
    }

    .footerNote {
      color: #627089;
      font-size: 10px;
      margin-top: 28px;
    }
  </style>
</head>
<body>
  <section class="cover">
    <div class="eyebrow">Scribrrr Meeting Report</div>
    <h1>${escapeHtml(sessionName)}</h1>
    <div class="details">
      <div class="detail">
        <span class="label">Room</span>
        <span class="value">${escapeHtml(roomName)}</span>
      </div>
      <div class="detail">
        <span class="label">Generated</span>
        <span class="value">${escapeHtml(generatedAt)}</span>
      </div>
      <div class="detail">
        <span class="label">Session Started</span>
        <span class="value">${escapeHtml(formatDateTime(session.created_at))}</span>
      </div>
      <div class="detail">
        <span class="label">Messages</span>
        <span class="value">${transcriptRows.length}</span>
      </div>
    </div>
  </section>

  <h2>Full Transcript</h2>
  ${transcriptHtml}

  <h2>Report Details</h2>
  ${summariesHtml}

  <p class="footerNote">Generated automatically by Scribrrr.</p>
</body>
</html>`;

    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        footerTemplate:
          '<div style="font-size:8px;color:#7b8798;width:100%;padding:0 18mm;text-align:right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
        headerTemplate: "<div></div>",
        margin: {
          top: "18mm",
          right: "18mm",
          bottom: "18mm",
          left: "18mm",
        },
      });

      const filename = `${sanitizeFilename(sessionName) || "session"}-report.pdf`;

      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(pdf);
    } finally {
      await browser.close();
    }
}
