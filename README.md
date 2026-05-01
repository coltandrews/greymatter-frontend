# Greymatter Frontend

Minimal Next.js frontend scaffold for the Greymatter app.

## Target MVP flow

The target patient experience is:

1. Eligibility intake
2. Account creation
3. Pharmacy selection
4. Appointment selection
5. Insurance and review
6. Stripe payment
7. Backend-created Ola booking
8. Confirmation and next steps

Patients should complete eligibility before creating an account. If eligible, they create or sign into a Greymatter account before pharmacy search. Payment happens before the backend creates the Ola schedule request.

Confirmation and next-step copy should stay conservative until Ola confirms the expected handoff. The UI should support booked, pending, action-required, and needs-follow-up states.

## Getting started

1. Copy `.env.example` to `.env.local` and set Supabase variables (see below).
2. Install dependencies: `npm install`
3. Run the dev server: `npm run dev`

## Auth (Supabase)

- `NEXT_PUBLIC_SUPABASE_URL` — project URL from Supabase **Settings → API**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **publishable** key (safe in the browser with RLS)

Current auth entry is `/` (signup default; `/login` redirects to sign-in). Email confirmation uses `/auth/callback`. After login, `/post-login` sends **patient** → `/intake`, **staff/admin** → `/dashboard`.

Target flow change: move account creation after eligibility and before pharmacy selection. Anonymous/pre-auth intake must be attached to the Supabase user after signup/signin.

`GET /api/me` returns the signed-in user from the Supabase cookie session (same origin).

## Calling the backend with a session

Use `Authorization: Bearer <access_token>` from `supabase.auth.getSession()` when calling `NEXT_PUBLIC_API_BASE_URL` (e.g. `GET /api/me` on the Greymatter backend).

The frontend calls the Greymatter backend only. It must not call Ola directly or expose Ola credentials.
