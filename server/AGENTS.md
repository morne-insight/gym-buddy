# AGENTS.md

This is a LiveKit Agents project. LiveKit Agents is a Node.js SDK for building voice AI agents. This project is intended to be used with LiveKit Cloud.

The following is a guide for working with this project.

## Project structure

This Node.js project uses the `npm` package manager. You should always use `npm` to install dependencies, run the agent, and run tests.

All app-level code is in the `src/` directory. In general, simple agents can be constructed with a single `main.ts` file. Additional files can be added, but you must retain `main.ts` as the entrypoint (see the associated Dockerfile for how this is deployed).

Be sure to maintain consistent code formatting. (No eslint/prettier config is committed yet — match the style of the surrounding files.)

## Database (Supabase / Postgres)

All domain data lives in a **Supabase-hosted Postgres** database. The LiveKit server is the **sole** database client — web and mobile reach data through the server, never directly. There is no Auth/RLS/Realtime yet.

- **Data-access layer:** `src/db/index.ts`. Every function is **async** (returns a `Promise`) and takes the shared pool handle (`DB`) as its first argument. It uses the [`postgres`](https://github.com/porsager/postgres) (porsager) client with tagged-template parameterization; `completeSession` runs its multi-write logic in a `sql.begin(...)` transaction.
- **Connection pool:** `src/db/pool.ts`. `getPool()` builds one shared pool from `DATABASE_URL` and **fails fast** if it is missing; `closePool()` shuts it down. `TIMESTAMPTZ` columns are parsed back to ISO-8601 strings so result shapes match the TypeScript interfaces.
- **Schema & seed:** `src/db/schema.sql` (Postgres DDL, idempotent) and `src/db/seed.sql` (`ON CONFLICT DO NOTHING`). Flag columns (`active`, `completed`, `skipped`, `delivered`) stay `INTEGER` 0/1.

### Required environment variables

- `DATABASE_URL` — Supabase **session pooler** connection string (port 5432). See `.env.example` for the format. Never commit the real value (`.env` is gitignored).

### Scripts

- `npm run provision` — apply the schema, truncate, and re-seed a fresh database (greenfield).
- `npm run seed` — apply schema + seed without truncating.
- `npm run smoke` — end-to-end smoke test against the live `DATABASE_URL` (creates a throwaway session, asserts rotation advancement, cleans up).

### Tests

Tests run against an **ephemeral Docker Postgres** container (not the cloud DB), started automatically by `jest.global-setup.cjs` on `localhost:5433`. **Docker must be running.** Override with `TEST_DATABASE_URL` to target a different test database. The suite runs serially (`maxWorkers: 1`) and truncates between tests for isolation.

## Web REST API (`src/api/`)

Alongside the LiveKit token server, the agent process starts an **authenticated REST API**
(`startApiServer()` in `src/api/server.ts`, default port **3002**) consumed by `apps/web`. It is
the only web-facing data surface; the single-DB-client invariant is preserved (the browser never
touches Postgres or Storage directly).

- **Auth (`src/api/auth.ts`):** Supabase Auth is identity-only. Every data route requires an
  `Authorization: Bearer <supabase access token>` and verifies it against the project's **JWKS**
  endpoint with `jose` (signature + `iss`/`aud`/`exp`). The `sub` claim is the caller's identity.
  Missing/invalid tokens get **401 with no DB access**. No signing secret lives in env; no RLS.
- **Identity provisioning:** on the first authenticated request for a `sub`, the server idempotently
  upserts the domain `users` row (`provisionUser`) — never a DB trigger. `users.id` stores the `sub`.
- **Validation:** every request body is validated against the matching Zod schema from
  `@gym-buddy/contracts` (`packages/contracts`) **before** any DB access; failures return 400.
- **Authorization:** all reads/writes are scoped to the caller's `users.id` in query logic; another
  user's resource is treated as not-found (404).
- **Endpoints:** `GET /api/me`, `GET|PUT /api/profile`, `GET /api/personas`,
  `POST /api/profile/goal-image/upload-url` + `POST /api/profile/goal-image` (signed-URL upload, D6),
  `GET /api/templates`, `GET /api/program`, `POST /api/program/adopt`, and intent routes under
  `/api/program/{workouts,exercises,schedule,type,...}`. The editor sends **intent**; the server
  owns every scheduling invariant (single active Program, `rotation_state` lifecycle, `day_of_week`
  rules, contiguous `sort_order`). New `db/index.ts` functions back these: `listTemplates`,
  `adoptTemplate` (transactional clone), `getActiveProgramDetail`, workout/exercise CRUD,
  `setSchedule`, `switchProgramType`. Errors use typed classes (`NotFoundError` → 404,
  `DomainValidationError` → 400).

### Additional environment variables

- `SUPABASE_URL` (or `SUPABASE_PROJECT_REF`) — used to derive the JWKS URL / issuer. Optional
  overrides: `SUPABASE_JWKS_URL`, `SUPABASE_JWT_AUD` (default `authenticated`).
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key used **only** to mint signed `goal-images` upload
  URLs. Never exposed to the browser.
- `WEB_ORIGIN` (default `http://localhost:5173`) — CORS allow-origin for the API.
- `API_PORT` (default `3002`).

Catalog tables (`program_templates`, `template_workouts`, `template_exercises`,
`template_schedule`) have **no `user_id`** and are seeded in `seed.sql`. Adoption clones them into
user-owned rows with no FK back to the template (no propagation). The contracts package is consumed
as built output — run `npm run build -w @gym-buddy/contracts` after installing/changing it (tests
resolve it from source via a jest module mapper, so TDD needs no prebuild).

## LiveKit Documentation

LiveKit is a fast-evolving project. Always refer to the latest documentation. Run `lk docs --help` to see available commands. Key commands: `lk docs overview`, `lk docs search`, `lk docs get-page`, `lk docs code-search`, `lk docs changelog`, `lk docs pricing-info`. Run `lk docs <command> --help` before using a command for the first time. Prefer browsing (`overview`, `get-page`) over search, and `search` over `code-search`, as docs pages provide better context than raw code.

### LiveKit CLI

The [LiveKit CLI](https://docs.livekit.io/intro/basics/cli/) `lk docs` subcommand gives full access to LiveKit documentation from the terminal. Requires CLI version 2.15.0+. Check with `lk --version`.

Install or update the CLI:

- **macOS:** `brew install livekit-cli` (update: `brew update && brew upgrade livekit-cli`)
- **Linux:** `curl -sSL https://get.livekit.io/cli | bash`
- **Windows:** `winget install LiveKit.LiveKitCLI` (update: `winget upgrade LiveKit.LiveKitCLI`)

Run `lk docs --help` to see all available commands. Key commands: `lk docs overview`, `lk docs search`, `lk docs get-page`, `lk docs code-search`, `lk docs changelog`, `lk docs submit-feedback`. Run `lk docs <command> --help` before using a command for the first time, as the help text includes advice on usage and interpreting results. Prefer browsing (`overview`, `get-page`) over search, and prefer `search` over `code-search`, as docs pages are more up-to-date and provide better context than raw code.

### LiveKit Docs MCP Server

For deeper IDE integration, LiveKit also offers an [MCP server](https://docs.livekit.io/reference/developer-tools/docs-mcp/) with the same documentation access. It uses Streamable HTTP transport at `https://docs.livekit.io/mcp`. Refer to your IDE's documentation for how to add it.

### Submit docs feedback to LiveKit

If you use the LiveKit CLI or MCP Server to search or browse documentation, also submit constructive feedback to LiveKit with `lk docs submit-feedback` or the MCP `submit_docs_feedback` tool. Add this to your to-do list when planning work, to ensure you file feedback after completing your other tasks. Useful feedback includes incomplete documentation, broken examples, missing steps or any other documentation gap or issue.

## Handoffs ("workflows")

Voice AI agents are highly sensitive to excessive latency. For this reason, it's important to design complex agents in a structured manner that minimizes the amount of irrelevant context and unnecessary tools present on requests to the LLM. LiveKit Agents supports handoffs (one agent hands control to another) to support building reliable workflows. You should make use of these features, instead of writing long instruction prompts that cover multiple phases of a conversation. Refer to the [documentation](https://docs.livekit.io/agents/build/workflows/) for more information.

## Testing

When possible, add tests for agent behavior. Read the [documentation](https://docs.livekit.io/agents/start/testing/), and refer to existing test files with the `.test.ts` extension. Run tests with `npm test`.

Important: When modifying core agent behavior such as instructions, tool descriptions, and tasks/workflows/handoffs, never just guess what will work. Always use test-driven development (TDD) and begin by writing tests for the desired behavior. For instance, if you're planning to add a new tool, write one or more tests for the tool's behavior, then iterate on the tool until the tests pass correctly. This will ensure you are able to produce a working, reliable agent for the user.

## Feature parity with Python SDK

The Node.js SDK for LiveKit Agents has most, but not all, of the same features available in Python SDK for LiveKit Agents. You should always check the documentation for feature availability, and avoid using features that are not available in the Node.js SDK.

## LiveKit CLI

Beyond documentation access, the LiveKit CLI (`lk`) supports other tasks such as managing SIP trunks for telephony-based agents. Run `lk --help` to explore available commands.