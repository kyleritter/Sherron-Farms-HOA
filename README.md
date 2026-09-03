# Sherron Farms HOA Document Assistant

A $0-cost, auth-gated RAG chatbot that lets approved residents ask natural-
language questions about the HOA's governing documents (CC&Rs, Bylaws, ARC
Guidelines, Amendments, meeting minutes) and get answers with exact
document/section/page citations.

Stack: Next.js (App Router) on Vercel, Supabase (Postgres + pgvector +
Auth), Google Gemini (`gemini-2.0-flash` + `text-embedding-004` via AI
Studio). See `HOA_AI_Assistant_Architecture_Spec.md` (in the project's
Google Drive folder) for the full design.

## Project layout

```
src/app/
  login/              Google OAuth sign-in
  auth/callback/       Supabase OAuth redirect handler
  pending/             "awaiting admin approval" screen
  access-denied/       rejected-user screen
  chat/                the resident-facing chat UI
  admin/               approve/reject pending residents
  api/chat/route.ts    embeds question -> vector search -> Gemini, streamed
src/lib/supabase/      server/browser Supabase clients + middleware helper
src/middleware.ts       route gating (/chat, /admin)
supabase/migrations/    SQL schema, RLS policies, vector match RPC
scripts/ingest.py       local PDF -> chunks -> embeddings -> Supabase
documents_raw/          drop source PDFs here before running ingest.py
.github/workflows/      keep-alive ping so Supabase free tier doesn't pause
```

## One-time setup

1. **Supabase**
   - Create a project.
   - Open the SQL Editor and run `supabase/migrations/0001_init.sql`.
   - In Authentication → Providers, enable Google and configure the OAuth
     client (Google Cloud Console → Credentials). Add
     `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`
     for local dev) as an authorized redirect URI.

2. **Google AI Studio**
   - Grab a Gemini API key.

3. **Environment variables**
   - Copy `.env.local.example` to `.env.local` and fill in the Supabase
     URL/anon key/service role key and the Gemini API key.
   - Add the same variables in Vercel → Project Settings → Environment
     Variables for the deployed app (service role key stays server-only —
     do not prefix it with `NEXT_PUBLIC_`).

4. **Bootstrap the first admin**
   - Sign in once through the deployed (or local) app with your own
     Google account — this creates your `profiles` row with
     `status = 'pending'`.
   - In the Supabase Table Editor, manually set your row to
     `role = 'admin', status = 'approved'`. There's no other way to reach
     `/admin` the first time.

5. **Ingest the governing documents**
   - `pip install -r scripts/requirements.txt`
   - Drop the HOA's PDFs into `documents_raw/`.
   - `python scripts/ingest.py`
   - Re-run whenever a document is added, replaced, or amended.

6. **Keep-alive workflow**
   - Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as GitHub Actions repo
     secrets so `.github/workflows/keep-alive.yml` can ping the project
     every 4 days (Supabase free tier pauses after 7 days idle).

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploying

Push to `main` with the Vercel GitHub integration connected, or
`vercel --prod`. Set the environment variables in the Vercel dashboard
first (step 3 above).
