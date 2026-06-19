## 1. Monorepo scaffolding

- [x] 1.1 Add `packages/contracts` workspace (TypeScript + Zod); export an empty barrel and wire it into the root npm workspaces.
- [x] 1.2 Add `apps/web` workspace: Vite + React + TS, TanStack Router/Query/Form, Tailwind, shadcn/ui init, `supabase-js`. Add `.env.example` (Supabase URL/anon key, API base URL).
- [x] 1.3 Confirm root `npm install` hoists and both new workspaces typecheck/build from a clean checkout.

## 2. Supabase configuration

- [x] 2.1 Enable Supabase Auth providers: email/password (confirmation OFF) and Google OAuth.
- [x] 2.2 Create the `goal-images` Storage bucket (private; access via signed URLs only).
- [x] 2.3 Record required env: server `SUPABASE_PROJECT_REF`/JWKS URL + `SUPABASE_SERVICE_ROLE_KEY`; document in `server/.env.example` and `apps/web/.env.example`.

## 3. Database schema & seed (Template catalog)

- [x] 3.1 Add catalog tables to `server/src/db/schema.sql`: `program_templates`, `template_workouts`, `template_exercises`, and template schedule entries (no `user_id`; `type` CHECK static/rotation).
- [x] 3.2 Seed the catalog in `seed.sql` with at least one static and one rotation Template (reuse the existing PPL shapes).
- [x] 3.3 Re-provision Supabase (`npm run provision`) and confirm the catalog loads.

## 4. Shared contracts (Zod)

- [x] 4.1 Define request/response schemas in `packages/contracts`: auth/session DTOs, profile, template list, adopt, workout/exercise/schedule intents, type-switch, signed-upload request/response.
- [x] 4.2 Export inferred TS types for both server and web consumption.

## 5. Server — authenticated API foundation (`web-authentication`)

- [x] 5.1 Add an HTTP API layer alongside the token server (routing + JSON + CORS locked to the web origin).
- [x] 5.2 Add JWKS verification middleware (`jose`): verify signature + `iss`/`aud`/`exp`, extract `sub`; return 401 with no DB access on failure. (TDD)
- [x] 5.3 Add identity provisioning: idempotent `users` upsert keyed by `sub` on first authenticated request; helper to scope all queries to the caller's `users.id`. (TDD)
- [x] 5.4 Wire Zod validation (from `packages/contracts`) on every request body; reject invalid payloads before DB access.

## 6. Server — onboarding & profile (`account-onboarding`)

- [x] 6.1 `db/index.ts`: functions to read/update the profile fields (name, persona_id, goal_description, training_style, goal_image_url). (TDD)
- [x] 6.2 Endpoints: get/update profile; validate `persona_id` references an existing persona; enforce required fields.
- [x] 6.3 Signed-upload endpoint: mint a short-lived `goal-images` upload URL (service-role); follow-up endpoint to set `users.goal_image_url` from the returned object path. (TDD)

## 7. Server — templates & adoption (`workout-templates`)

- [x] 7.1 `db/index.ts`: list catalog Templates (name, type, workouts/exercises). (TDD)
- [x] 7.2 `db/index.ts`: `adoptTemplate(userId, templateId)` — transactional clone (`sql.begin`) into user-owned program/workouts/workout_exercises/schedule; mark single active Program. (TDD)
- [x] 7.3 Rotation adoption: null `day_of_week`, contiguous `sort_order`, create `rotation_state(current_index=0)`; static adoption retains `day_of_week`, no rotation_state. (TDD)
- [x] 7.4 Assert no propagation: catalog edits do not affect adopted Programs (independent rows, no FK back to template). (TDD)
- [x] 7.5 Endpoints: list templates, adopt template.

## 8. Server — program configuration (`program-configuration`)

- [x] 8.1 `db/index.ts`: Workout CRUD on the active Program (add/remove/rename/reorder; removal cascades exercises + schedule entries). (TDD)
- [x] 8.2 `db/index.ts`: Exercise CRUD within a Workout (name/sets/reps/rest_seconds/sort_order). (TDD)
- [x] 8.3 `db/index.ts`: schedule intent — static (day_of_week + scheduled_time) and rotation (order + scheduled_time); server derives stored columns. (TDD)
- [x] 8.4 `db/index.ts`: `switchProgramType` transform with invariants (rotation: null days + sort_order + rotation_state@0; static: require days + delete rotation_state). (TDD)
- [x] 8.5 Endpoints for all of the above (intent-based; never store raw schedule/rotation values verbatim); enforce single-active-Program + caller ownership.

## 9. Web client flows

- [x] 9.1 Auth: sign-up / sign-in (email/password + Google) via `supabase-js`; session persistence; attach Bearer token to all API calls (TanStack Query client).
- [x] 9.2 Onboarding wizard (TanStack Form + shared Zod): name, Buddy picker (from personas), optional goal text, optional goal image (request signed URL → upload → submit path), training_style dropdown.
- [x] 9.3 Template selection: list catalog Templates and adopt one.
- [x] 9.4 Program editor: Workouts, Exercises, Schedule, and static↔rotation switch — all via intent endpoints; optimistic/refetch via TanStack Query.
- [x] 9.5 Profile view/edit screen reusing the same operations.

## 10. Verify

- [x] 10.1 Server suite green against the ephemeral Docker Postgres, including new auth/adoption/config tests.
- [x] 10.2 End-to-end (manual): sign up → onboard → adopt → customise; assert agent-compatible rows in DB (programs/workouts/workout_exercises/schedule/rotation_state).
- [x] 10.3 Dev-only check: point the existing agent/mobile at the new user's `id`; confirm `getCurrentWorkout` resolves the configured plan and a session runs.
- [x] 10.4 Update `README.md` (add `apps/web` + `packages/contracts` run instructions) and `server/AGENTS.md` (new API surface + env).

## 11. Launch prerequisites (flagged, not blocking this slice)

- [x] 11.1 Document that configuring an SMTP provider is required before enabling email confirmation and password reset (both currently unavailable).
