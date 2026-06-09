# Greymatter Frontend

Next.js frontend for Greymatter's patient portal and staff dashboard.

## Target MVP flow

The target patient experience is:

1. Eligibility intake
2. Account creation
3. Appointment selection
4. Stripe payment
5. Backend-created Ola booking
6. Confirmation and next steps

Patients should complete eligibility before creating an account. If eligible, they create or sign into a Greymatter account before scheduling. Payment happens before the backend creates the Ola schedule request.

Confirmation and next-step copy should stay conservative until Ola confirms the expected handoff. The UI should support booked, pending, action-required, and needs-follow-up states.

## Getting started

1. Copy `.env.example` to `.env.local` and set Supabase variables (see below).
2. Install dependencies: `npm install`
3. Run the dev server: `npm run dev`

## Auth (Supabase)

- `NEXT_PUBLIC_SUPABASE_URL` — project URL from Supabase **Settings → API**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **publishable** key (safe in the browser with RLS)

Current patient entry is `/` for pre-account eligibility. Eligible patients continue to account creation from there; `/login` redirects to sign-in. Email confirmation uses `/auth/callback`. After login, `/post-login` sends **staff/admin** → `/dashboard`, patients with incomplete member profiles → `/onboarding`, and patients with complete profiles → `/hub`.

Legacy `/intake` requests redirect signed-in patients to `/hub` and staff/admin users to `/dashboard`.

`GET /api/me` returns the signed-in user from the Supabase cookie session (same origin).

## Calling the backend with a session

Use `Authorization: Bearer <access_token>` from `supabase.auth.getSession()` when calling `NEXT_PUBLIC_API_BASE_URL` (e.g. `GET /api/me` on the Greymatter backend).

The frontend calls the Greymatter backend only. It must not call Ola directly or expose Ola credentials.
