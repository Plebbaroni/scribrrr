import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import {
  createSonioxSession,
  type SessionContext,
  type SonioxResponse,
} from "../services/sonion.js";

// Control frames the browser sends as JSON text.
// Binary frames are treated as raw PCM audio and forwarded as-is.
type ClientControl =
  | { type: "start"; context?: SessionContext }
  | { type: "stop" };

// Messages we send back to the browser as JSON.
type ServerMessage =
  | { type: "tokens"; data: SonioxResponse }
  | { type: "error"; code: number; message: string }
  | { type: "finished" };

export default async function streamRoutes(app: FastifyInstance): Promise<void> {
  // Frontend connects: ws://<server>/stream/<sessionId>
  app.get("/stream/:sessionId", { websocket: true }, (connection, req) => {
    const { sessionId } = req.params as { sessionId: string };
    const browser: WebSocket = connection;

    app.log.info({ sessionId }, "browser connected to stream");

    const send = (msg: ServerMessage) => {
      if (browser.readyState === browser.OPEN) {
        browser.send(JSON.stringify(msg));
      }
    };

    // Soniox session is created lazily so the browser can pass context first.
    let soniox: ReturnType<typeof createSonioxSession> | null = null;

    const startSoniox = (context?: SessionContext) => {
      if (soniox) return;
      try {
        soniox = createSonioxSession(
          {
            onToken: (res) => {
              send({ type: "tokens", data: res });
              if (res.finished) send({ type: "finished" });
            },
            onError: (code, message) => send({ type: "error", code, message }),
            onClose: () => { },
          },
          context,
        );
      } catch (err) {
        send({
          type: "error",
          code: -1,
          message: err instanceof Error ? err.message : "soniox init failed",
        });
      }
    };

    browser.on("message", (raw: Buffer, isBinary: boolean) => {
      // Binary => raw PCM audio, forward straight to Soniox.
      if (isBinary) {
        if (!soniox) startSoniox();
        soniox?.sendAudio(raw);
        return;
      }
      // Text => JSON control message.
      let ctrl: ClientControl;
      try {
        ctrl = JSON.parse(raw.toString()) as ClientControl;
      } catch {
        return;
      }
      if (ctrl.type === "start") startSoniox(ctrl.context);
      else if (ctrl.type === "stop") soniox?.finish();
    });

    browser.on("close", () => {
      app.log.info({ sessionId }, "browser disconnected");
      soniox?.close();
      soniox = null;
    });

    browser.on("error", (err: Error) => {
      app.log.error({ sessionId, err: err.message }, "browser socket error");
      soniox?.close();
      soniox = null;
    });
  });
}
