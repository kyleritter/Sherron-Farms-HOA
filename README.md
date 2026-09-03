# Sherron Farms HOA Document Assistant

A $0-cost, auth-gated RAG chatbot that lets verified residents ask natural-
language questions about the HOA's governing documents (CC&Rs, Bylaws, ARC
Guidelines, Amendments, meeting minutes) and get answers with exact
document/section/page citations.

Stack: Next.js (App Router) on Vercel, Supabase (Postgres + pgvector +
Auth), Google Gemini (`gemini-2.0-flash` + `text-embedding-004` via AI
Studio). See `HOA_AI_Assistant_Architecture_Spec.md` (in the project's
Google Drive folder) for the full design.

## How access works

1. A resident signs in with Google (Supabase Auth). This creates their
   `profiles` row with `status = 'pending'`.
2. They're immediately sent to `/verify`, where they enter their street
   address and the shared community password (see "Bootstrap" below —
   default is `pool party`, but any admin can change it from `/admin`).
3. `/api/auth/verify` checks the password against `community_settings`
   (via the service-role client, never exposed to the browser) and, if it
   matches, flips their profile to `status = 'approved'` right away — no
   waiting on an admin. If their normalized address matches the seeded
   admin address, they're also made `role = 'admin'`.
4. From then on, signing in with Google is enough — `proxy.ts` reads their
   Supabase session and `profiles.status`/`role` on every request.

Admins can still manually approve/reject a resident from `/admin` (useful
if someone forgets the password), and can change the community password
there at any time.

## Project layout

```
src/app/
  login/               Google OAuth sign-in
  auth/callback/       Supabase OAuth redirect handler
  verify/              street address + community password form
  access-denied/       rejected-user screen
  chat/                the resident-facing chat UI
  admin/               change community password, approve/reject residents
  api/auth/verify/     checks address + password, approves the resident
  api/chat/route.ts    embeds question -> vector search -> Gemini, streamed
src/lib/supabase/      server/browser Supabase clients + middleware helper
src/lib/address.ts     normalizes a typed street address for comparison
src/proxy.ts           route gating (/chat, /admin)
supabase/migrations/   SQL schema, RLS policies, vector match RPC
scripts/ingest.py      local PDF -> chunks -> embeddings -> Supabase
documents_raw/         drop source PDFs here before running ingest.py
.github/workflows/     keep-alive ping so Supabase free tier doesn't pause
```

## One-time setup

1. **Supabase**
   - Create a project.
   - Open the SQL Editor and run, in order: `supabase/migrations/0001_init.sql`,
     `0002_address_password_auth.sql`, then `0003_seed.sql` (seeds the
     community password and the admin address).
   - In Authentication → Providers, enable Google and configure the OAuth
     client (Google Cloud Console → Credentials). Add
     `https://<your-project-ref>.supabase.co/auth/v1/callback` as the
     authorized redirect URI in Google Cloud Console, and add
     `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`
     for local dev) to Supabase's own Redirect URLs allowlist
     (Authentication → URL Configuration).

2. **Google AI Studio**
   - Grab a Gemini API key.

3. **Environment variables**
   - Copy `.env.local.example` to `.env.local` and fill in the Supabase
     URL/anon key/service role key and the Gemini API key.
   - Add the same variables in Vercel → Project Settings → Environment
     Variables for the deployed app (service role key stays server-only —
     do not prefix it with `NEXT_PUBLIC_`).

4. **Bootstrap**
   - `0003_seed.sql` already sets the community password to `pool party`
     and marks one address as the admin address — edit that migration
     before running it if you want a different starting password or
     admin address.
   - Sign in with Google, then verify with your address and the community
     password. If your address matches the seeded admin address, you land
     in `/admin` immediately — no manual database edit required.

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
