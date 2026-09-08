## Why

Today a user only exists if the team hand-seeds them; there is no way for a real person to create an account or set up their training plan. Before the mobile session experience can reach anyone outside the founder's seeded data, we need a self-serve **web client** where someone signs up and configures the Program their Buddy will hold them to. Web also keeps onboarding/plan-building off the mobile app (per [ADR-0001](../../../docs/adr/0001-web-onboarding-mobile-session.md)) and, later, off the 30%-fee app-store payment path.

## What Changes

- Add a new **`apps/web`** client (Vite + React SPA: TanStack Router/Query/Form, Tailwind + shadcn/ui, `supabase-js`) and a shared **`packages/contracts`** workspace (Zod schemas → server-side validation + inferred types on both sides).
- Introduce **Supabase Auth as an identity provider only** (email/password + Google). The Node **server remains the sole database client**: it verifies the Supabase access token via **JWKS**, maps the `sub` claim to `users.id`, and provisions the domain `users` row on first authenticated call. **No RLS.** (See [ADR-0002](../../../docs/adr/0002-web-client-via-server-api.md).)
- Add an **authenticated REST API** on the server (alongside the existing token server) exposing onboarding, template, and program-configuration operations, reusing the async `db/index.ts` layer.
- Add a **team-curated Workout Template catalog** (new tables, no `user_id`) and an **adoption** operation that **clones** a Template into a new user-owned active Program (+ `rotation_state` for rotation programs). Adoption is one-time: no propagation in either direction.
- Add a **Program configuration editor**: full CRUD on Workouts/Exercises/Schedule and a static↔rotation **type switch**, with the **server enforcing all invariants** (one active Program per user, `rotation_state` lifecycle, `day_of_week` rules, `sort_order` consistency). The web sends intent; it never writes raw schedule rows.
- Capture onboarding profile fields: name, **Buddy** (`persona_id`), optional `goal_description`, optional **goal image** (Supabase Storage via a server-minted **signed upload URL** → `goal_image_url`), and `training_style` (dropdown, one option for now).

Out of scope (deferred to later changes): payment/subscription, the web→mobile QR-bridge login, Apple Sign-In, Telegram/Messaging-Channel linkage, re-adopting or running multiple Programs, and email confirmation / password reset (both gated on configuring an SMTP provider — Supabase's built-in email is rate-limited and not for production). This change does **not** make a freshly signed-up user reachable from the mobile app (that needs the deferred auth bridge); it is a web-only vertical slice.

## Capabilities

### New Capabilities
- `web-authentication`: How web requests are authenticated and identity is resolved — Supabase Auth (email/password + Google) issues the session; the server verifies the access token via JWKS, rejects missing/invalid tokens, maps `sub` → `users.id`, and provisions the domain user row on first authenticated request. No RLS; authorization stays in server query logic.
- `account-onboarding`: The first-run flow and profile — capturing name, Buddy, optional goal text, optional goal image (signed-URL upload to Supabase Storage), and training style; creating and later editing the profile.
- `workout-templates`: The team-curated Template catalog (program/workout/exercise templates + default schedule), listing available Templates, and adoption = a one-time clone into a new user-owned active Program with no propagation.
- `program-configuration`: Editing the active Program via intent endpoints — Workout and Exercise CRUD, schedule editing, and static↔rotation switching — with the server maintaining every scheduling invariant.

### Modified Capabilities
<!-- None. `rotation-scheduling` and `schedule-type-resolution` requirements (the data model,
     rotation advancement, and Smart Workout Resolution) are unchanged; this change writes and
     configures that model from a new surface but does not alter its runtime behavior. -->

## Impact

- **New workspaces**: `apps/web` (web SPA + deps), `packages/contracts` (Zod + inferred types). Monorepo grows from `{server, apps/mobile}` to also include these.
- **Server**: new HTTP API module (routing, CORS, JWKS-verification middleware via `jose`); new `db/index.ts` functions for template listing, adoption (transactional clone), and configuration writes; identity provisioning. New deps: `jose`, `zod`.
- **Database**: new template-catalog tables (`program_templates`, `template_workouts`, `template_exercises`, template schedule); seed the catalog. New users' `users.id` holds the Supabase auth UUID (column type unchanged).
- **Supabase**: Auth enabled (email/password + Google provider); a `goal-images` Storage bucket; project URL + anon key (web) and JWKS URL + service-role key (server).
- **Env/config**: web `.env` (Supabase URL/anon key, API base URL); server `.env` additions (Supabase project ref/JWKS URL, service-role key for signed uploads).
- **Docs**: realized by ADR-0001 (web/mobile split) and ADR-0002 (web-via-server-API); `CONTEXT.md` already updated with Program / Workout Template / Template Adoption.
