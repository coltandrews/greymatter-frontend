# Greymatter Frontend

Minimal Next.js frontend scaffold for the Greymatter app.

## Getting started

1. Copy `.env.example` to `.env.local` and set Supabase variables (see below).
2. Install dependencies: `npm install`
3. Run the dev server: `npm run dev`

## Auth (Supabase)

- `NEXT_PUBLIC_SUPABASE_URL` — project URL from Supabase **Settings → API**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **publishable** key (safe in the browser with RLS)

Auth entry is `/` (signup default; `/login` redirects to sign-in). Email confirmation uses `/auth/callback`. `/dashboard` is protected.

`GET /api/me` returns the signed-in user from the Supabase cookie session (same origin).

## Calling the backend with a session

Use `Authorization: Bearer <access_token>` from `supabase.auth.getSession()` when calling `NEXT_PUBLIC_API_BASE_URL` (e.g. `GET /api/me` on the Greymatter backend).
