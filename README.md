# Scribrrr

Real-time AI transcription for meetings. Hackathon project.

## Stack

- **Frontend:** Next.js, TypeScript, Tailwind, Zustand
- **Backend:** Fastify, TypeScript, Deepgram SDK, OpenAI SDK, Playwright
- **Database:** Supabase Postgres

## Repo structure

```
apps/
  web/        → Next.js frontend (port 3000)
  server/     → Fastify backend (port 3001)
```

## Quick start

### 1. Install dependencies

```bash
npm install
```

This installs both frontend and backend deps via npm workspaces.

### 2. Set environment variables

**Backend** — copy and fill in `apps/server/.env`:

```bash
cp apps/server/.env.example apps/server/.env
```

```
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEEPGRAM_API_KEY=your-deepgram-key
OPENAI_API_KEY=your-openai-key
FRONTEND_URL=http://localhost:3000
```

**Frontend** — copy and fill in `apps/web/.env.local`:

```bash
cp apps/web/.env.example apps/web/.env.local
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

## Mock mode

You can demo the app without Deepgram credentials. On the session page, toggle **Mock Mode** on before clicking Start Recording. The backend will emit fake transcript segments over the WebSocket so you can see the UI working.

## Testing the flow

1. Open the app → click **New Session**
2. Toggle **Mock Mode** on (or leave off if you have a Deepgram key)
3. Click **Start Recording** — transcript segments will appear live
4. Click **Summarize last 2 min** — calls OpenAI to summarize recent transcript
5. Click **Generate PDF** — renders a report PDF via Playwright
6. Click **Stop Recording** when done

## Deepgram configuration

Deepgram audio format settings are in `apps/server/src/routes/stream.ts`. Look for `// TODO:` comments. You may need to adjust:

- `encoding` (e.g. `linear16`, `opus`)
- `sample_rate` (e.g. `16000`, `48000`)
- `channels`

The frontend sends audio via MediaRecorder (webm/opus by default). If Deepgram needs raw PCM, you'll need to switch to an AudioWorklet-based recorder.

## PDF generation

PDFs are saved to `/tmp/generated/` and served by the backend at `/files/`. The backend uses Playwright's Chromium to render HTML → PDF. On first run, you may need to install Playwright browsers:

```bash
cd apps/server
npx playwright install chromium
```

## Backend API routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Health check |
| POST | `/sessions` | Create a new session |
| GET | `/sessions/:id` | Get session details |
| GET | `/sessions/:id/transcript` | Get full transcript |
| POST | `/sessions/:id/summaries/recent` | Summarize last 2 minutes |
| POST | `/sessions/:id/pdf` | Generate PDF report |
| WS | `/sessions/:id/stream` | Live transcription WebSocket |

## Supabase setup

Create these tables in your Supabase project:

- `sessions` (id uuid, title text, created_at timestamptz, ended_at timestamptz)
- `speakers` (id uuid, session_id uuid, deepgram_speaker_id text, display_name text, created_at timestamptz)
- `transcript_segments` (id uuid, session_id uuid, deepgram_speaker_id text, text text, start_time_ms int, end_time_ms int, confidence numeric, is_final bool, created_at timestamptz)
- `summaries` (id uuid, session_id uuid, summary_type text, start_time_ms int, end_time_ms int, content jsonb, created_at timestamptz)
- `generated_files` (id uuid, session_id uuid, file_type text, storage_path text, created_at timestamptz)

## What's not included yet

- Authentication
- Speaker identification (just Speaker 0, Speaker 1, etc.)
- Production deployment config
- Database migrations (set up tables manually in Supabase dashboard)
