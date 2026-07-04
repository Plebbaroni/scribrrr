# Scribrrr

Real-time AI transcription for meetings.

## Stack

- **Frontend:** Next.js, TypeScript, Tailwind, Zustand
- **Backend:** Fastify, TypeScript, Deepgram SDK, OpenAI SDK, Playwright
- **Storage:** In-memory (no database required)

## Repo structure

```
apps/
  client/     → Next.js frontend (port 3000)
  server/     → Fastify backend (port 3001)
```

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Set environment variables

**Backend** — copy and fill in `apps/server/.env`:

```bash
cp apps/server/.env.example apps/server/.env
```

```
PORT=3001
DEEPGRAM_API_KEY=your-deepgram-key
OPENAI_API_KEY=your-openai-key
FRONTEND_URL=http://localhost:3000
```

**Frontend** — copy and fill in `apps/client/.env.local`:

```bash
cp apps/client/.env.example apps/client/.env.local
```

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:3001
```

### 3. Run the backend

```bash
npm run dev:server
```

### 4. Run the frontend

```bash
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000).

## Testing the flow

1. Open the app → click **New Session**
2. Click **Start Recording** — transcript segments appear live as chat bubbles
3. Click **Summarize last 2 min** in the sidebar — calls OpenAI to summarize
4. Click **Generate PDF** in the sidebar — renders a report PDF via Playwright
5. Click **Stop Recording** when done

## Deepgram configuration

Audio format settings are in `apps/server/src/routes/stream.ts`. Look for `// TODO:` comments. You may need to adjust:

- `encoding` (e.g. `linear16`, `opus`)
- `sample_rate` (e.g. `16000`, `48000`)
- `channels`

The frontend sends audio via MediaRecorder (webm/opus by default). If Deepgram needs raw PCM, switch to an AudioWorklet-based recorder on the frontend.

## PDF generation

PDFs are saved to `/tmp/generated/` and served by the backend at `/files/`. On first run you may need to install Playwright browsers:

```bash
cd apps/server
npx playwright install chromium
```

## API routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Health check |
| POST | `/sessions` | Create a new session |
| GET | `/sessions/:id` | Get session details |
| GET | `/sessions/:id/transcript` | Get full transcript |
| POST | `/sessions/:id/summaries/recent` | Summarize last 2 minutes |
| POST | `/sessions/:id/pdf` | Generate PDF report |
| WS | `/sessions/:id/stream` | Live transcription WebSocket |

## What's not included yet

- Authentication
- Persistent database (everything is in-memory, resets on server restart)
- Speaker identification (just Speaker 0, Speaker 1, etc.)
- Production deployment config
