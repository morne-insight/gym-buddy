## Context

The Node/LiveKit server persists all domain data to Supabase Postgres and is the **sole database client**; the mobile app is a thin client that only runs Sessions. There is no web client, no authentication, and no way for a real user to exist — users are hand-seeded. This change adds the web onboarding/configuration surface called for in [ADR-0001](../../../docs/adr/0001-web-onboarding-mobile-session.md).

Constraints carried in from the existing system:
- The server must stay the only thing that writes Postgres (the `migrate-to-supabase` change deliberately deferred Auth/RLS/Realtime). See [ADR-0002](../../../docs/adr/0002-web-client-via-server-api.md).
- The data model (`programs`/`workouts`/`workout_exercises`/`schedule`/`rotation_state`) and its runtime behavior (Smart Workout Resolution, rotation advancement) are defined by the `rotation-scheduling` and `schedule-type-resolution` specs and must remain unchanged — the web configures this model but does not alter how the agent resolves or advances it.
- ESM + `Node16` resolution on the server (`.js` import extensions on `.ts`); npm workspaces with deps hoisted to the root.

## Goals / Non-Goals

**Goals:**
- A real person can self-serve: sign up, build a profile, adopt a Workout Template, and freely customise the resulting Program — producing **agent-compatible** domain rows.
- Preserve the single-DB-client invariant; introduce only Supabase Auth (identity), no RLS.
- A typed, drift-proof contract between web and server (one Zod definition drives server validation, client form validation, and TS types).

**Non-Goals:**
- Payment/subscription, the web→mobile QR-bridge login, Apple Sign-In, Telegram linkage, multiple/re-adopted Programs — all deferred to later changes.
- Making a new web user reachable from the mobile app (blocked on the deferred auth bridge).
- Changing rotation/resolution runtime behavior.

## Decisions

### D1 — Web is a thin SPA; data flows through a server REST API (not Supabase-direct)
`apps/web` is a Vite + React SPA. All domain reads/writes go through a new authenticated REST API on the existing Node server, reusing `db/index.ts`. **Why over Supabase-direct + RLS:** keeps one data authority and one set of domain rules in code; avoids RLS drift and the reversal of the migration's "no client→DB" stance. Full rationale and the rejected alternative are in ADR-0002. *Trade-off:* the server gains real HTTP-API surface and becomes web-facing.

### D2 — Supabase Auth is identity-only; the server verifies via JWKS
Supabase issues the session (email/password + Google). The browser sends `Authorization: Bearer <access token>` on every API call. Server middleware verifies the JWT against Supabase's **JWKS** endpoint (asymmetric keys, cached; `jose`), checking signature + `iss`/`aud`/`exp`, and extracts `sub`. **Why JWKS over the legacy shared HS256 secret:** supports key rotation without redeploying and keeps no signing secret in server env. The domain `users` row is **provisioned by the server** on the first authenticated request (idempotent upsert keyed by `sub`), not by an `auth.users` trigger — a trigger would be a write path that bypasses the server, contradicting D1. `users.id` stores the `sub` UUID in the existing TEXT column (1:1 User↔identity). Email stays in Auth; not denormalised.

### D3 — Workout Templates are a separate team-owned catalog; adoption clones
New catalog tables with **no `user_id`** — `program_templates → template_workouts → template_exercises` plus default schedule rows. **Adoption** is a single server transaction that clones the chosen Template into a new user-owned `programs` row (+ `workouts`, `workout_exercises`, `schedule`, and a `rotation_state` row at index 0 for rotation templates), then marks it the user's one active Program. No foreign key from the user's Program back to the Template; **no propagation** in either direction. **Why over system-owned Programs (templates as `programs` rows with a sentinel user):** that approach leaks into every `WHERE user_id = …` query and mixes catalog with live plans. A clean catalog keeps curation and user data fully decoupled — which is what makes unrestricted customisation safe.

### D4 — The editor sends intent; the server owns every scheduling invariant
The web never writes raw `day_of_week`, `sort_order`, or `rotation_state`. It calls intent endpoints (e.g. "set schedule", "switch type", "add/remove/reorder workout", "edit exercise"). The server maintains: at most one active Program per user; switching → rotation nulls all `day_of_week`, assigns contiguous `sort_order`, and creates `rotation_state(current_index=0)`; switching → static requires a `day_of_week` per entry and deletes `rotation_state`; adding/removing a Workout keeps its schedule entry and rotation ordering consistent. **Why:** these invariants are exactly what `rotation-scheduling`/`schedule-type-resolution` depend on; centralising them server-side is the only way "customise as they please" stays agent-compatible.

### D5 — One shared Zod contract package
`packages/contracts` exports Zod schemas per endpoint (request + response). The server validates incoming requests with them; TanStack Form validates the same shapes client-side; both sides import the inferred TS types. **Why over importing server types directly or hand-writing types:** single source of truth gives runtime validation *and* compile-time types, and avoids coupling the web build to the server's ESM/`Node16` internals.

### D6 — Goal image: Supabase Storage via server-minted signed upload URL
The browser requests a short-lived signed upload URL from the server (server mints it with the service-role key), `PUT`s the file straight to a `goal-images` bucket, then hands the object path back to the server, which writes `users.goal_image_url`. **Why over direct `supabase-js` Storage upload:** keeps every domain-row write flowing through the server and needs no Storage RLS — consistent with D1. It is the only file handling in the change.

### D7 — Web tech stack
Vite + React + TS; **TanStack Router** (routing), **TanStack Query** (server state), **TanStack Form** + Zod (forms), **Tailwind + shadcn/ui** (UI), `supabase-js` (auth only). Session persisted by `supabase-js` in `localStorage`. **Why Vite SPA over TanStack Start:** with the Node API as the data authority, Start's server functions/SSR go unused; the auth-gated config app has no SEO surface, so a second server runtime earns nothing here.

## Risks / Trade-offs

- **No SMTP provider yet** → email confirmation and password reset are both unavailable/unreliable (Supabase built-in email is rate-limited, non-production). *Mitigation:* ship with email confirmation **off** for the closed MVP test; flag "configure SMTP" as a launch prerequisite that gates both confirmation and reset.
- **Server becomes web-facing** (CORS, public API, browser-supplied JSON writing the DB). *Mitigation:* JWKS-verified auth middleware on all data routes; Zod validation on every request body (D5); CORS locked to the web origin.
- **Type-switching corrupts schedule invariants if done client-side.** *Mitigation:* intent-only endpoints with server-owned transforms (D4); behavior covered by `program-configuration` scenarios and a parity check against `getCurrentWorkout`.
- **Adoption clone is multi-table.** *Mitigation:* run it in a single `sql.begin(...)` transaction (matching `completeSession`'s pattern) so a partial Program can never exist.
- **Auth UUID vs seeded TEXT ids coexist** in `users.id`. *Acceptable:* greenfield; both are opaque TEXT keys, no logic depends on the format.

## Migration Plan

1. Add `apps/web` and `packages/contracts` workspaces; wire root npm workspaces.
2. Add catalog tables to `schema.sql`; seed the Template catalog. Re-provision Supabase.
3. Build the server API module (JWKS middleware, identity provisioning, template/adoption/config endpoints, signed-upload endpoint) + new `db/index.ts` functions, TDD against the ephemeral Docker Postgres.
4. Configure Supabase: enable email/password + Google, create the `goal-images` bucket.
5. Build the web client flows against the contracts.
6. Verify: sign up → onboard → adopt → customise; assert agent-compatible rows in DB; manual dev check that `getCurrentWorkout` resolves the new user's plan and a session runs.
- **Rollback:** the change is additive (new workspaces, new tables, new endpoints); reverting is dropping the catalog tables and not deploying the web app — existing server/mobile behavior is untouched.

## Open Questions

- API shape detail (REST resource layout vs RPC-style intent routes) — resolve during step 3; D4 only mandates intent-based writes, not the exact URL scheme.
- Hosting target for `apps/web` (e.g. Vercel/Netlify/EAS Hosting static) — out of scope for the slice; decided at deploy time.
