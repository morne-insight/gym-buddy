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