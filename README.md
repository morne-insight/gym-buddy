# Gym Buddy

A voice AI training partner. A [LiveKit Agents](https://docs.livekit.io/agents/) server (Node.js) drives the conversation and persists all data to **Supabase (Postgres)**; an [Expo](https://docs.expo.dev/) React Native app is the mobile client. The server is the sole database client — the app talks to the server, never to the database directly.

## Repository layout

```
gym-buddy/
├── server/        # LiveKit Agents server + token server + Supabase data layer
├── apps/mobile/   # Expo (React Native) voice client
├── openspec/      # Change proposals & specs
└── docs/          # Design notes & handoffs
```

This is an npm **workspaces** monorepo. Dependencies hoist to the root `node_modules`; run app-specific scripts from each package directory.

## Prerequisites

- **Node.js** 20+ and **npm** 10+
- **Docker** (running) — only needed to run the server test suite (ephemeral Postgres)
- A **Supabase** project (hosted Postgres) for the server's runtime database
- **LiveKit Cloud** project + **OpenAI** (and optionally Cartesia / Telegram / ExerciseDB) API keys
- For the mobile app: the **Expo** toolchain and a native build setup
  - iOS: macOS + Xcode
  - Android: Android Studio + SDK
  - The app uses LiveKit WebRTC native modules, so it needs a **development build** — it will **not** run in Expo Go.

## Install

From the repo root (installs both workspaces):

```bash
npm install
```

---

## Server (`server/`)

### 1. Configure environment

```bash
cd server
cp .env.example .env
```

Fill in `.env`:

- `DATABASE_URL` — Supabase **session pooler** connection string (port 5432). Format is in `.env.example`.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `OPENAI_API_KEY`
- `CARTESIA_API_KEY`, `TELEGRAM_BOT_TOKEN`, `EXERCISEDB_API_KEY` — optional (Telegram/voice extras)

### 2. Provision the database (first run / reset)

Applies the schema and loads seed data (greenfield — clears existing rows):

```bash
npm run provision
```

> Use `npm run seed` to apply schema + seed **without** truncating.

### 3. Run the server

```bash
npm run dev      # watch mode (recommended for development)
# or
npm start        # production mode
```

This starts:
- the **LiveKit agent worker** (registers as agent `gym-buddy`), and
- the **token server** at `http://0.0.0.0:3001/getToken` (used by the mobile app to join a room).

### Other server commands

```bash
npm test            # full suite against an ephemeral Docker Postgres (Docker must be running)
npm run smoke       # end-to-end smoke test against the live DATABASE_URL
npm run seed        # apply schema + seed without truncating
```

---

## Mobile client (`apps/mobile/`)

### 1. Point the app at your token server

The app fetches a LiveKit token from the server. Configure the endpoint per machine in
`apps/mobile/.env.local` (copy from `.env.example`):

```bash
cd apps/mobile
cp .env.example .env.local
```

Set `EXPO_PUBLIC_TOKEN_ENDPOINT` to a host the device/emulator can actually reach:

- **Android device over USB (recommended):** `http://localhost:3001/getToken`, tunneled over USB with `adb reverse` (see below). Immune to Wi-Fi firewalls and DHCP IP changes — the same mechanism the Metro bundler (port 8081) already uses.
- **Physical device over Wi-Fi:** your dev machine's **LAN IP** (same Wi-Fi), e.g. `http://192.168.1.66:3001/getToken`. Find it with `ipconfig` (Windows) / `ifconfig` (macOS/Linux). Requires your OS firewall to allow inbound TCP 3001 — Windows blocks this by default on **"Public"** networks, which shows up as the app **failing to connect almost instantly** (the token fetch is refused before LiveKit is ever contacted).
- **Android emulator:** `http://10.0.2.2:3001/getToken` (special host-loopback alias).
- **iOS simulator:** `http://localhost:3001/getToken`.

#### `adb reverse` for a USB Android device

For an Android phone/tablet connected over USB, forward the token-server port onto the device so it can reach the server at `localhost` — no LAN IP, no firewall rules:

```bash
adb devices                      # confirm the device is connected
adb reverse tcp:3001 tcp:3001    # device's localhost:3001 -> your machine's :3001
```

- **When:** run it once per USB session, after the device shows up in `adb devices`. **Re-run it** whenever you replug the device or restart the adb server (the tunnel is dropped on disconnect). Then set `EXPO_PUBLIC_TOKEN_ENDPOINT=http://localhost:3001/getToken`.
- **Why it's enough:** only the **token fetch** uses port 3001; the LiveKit voice/media connection goes to LiveKit **Cloud** and is unaffected by this tunnel.
- Verify the tunnel with `adb reverse --list` (you should see `tcp:3001` alongside Metro's `tcp:8081`).

Make sure the server (port 3001) is running. `EXPO_PUBLIC_` vars are inlined at bundle time — restart the bundler with `npm start -c` after changing `.env.local`.

### 2. Build & run a development build

Because of the native WebRTC modules, run a dev build on a simulator/emulator or a physical device:

```bash
cd apps/mobile

npm run ios        # build & run on iOS simulator/device (macOS only)
# or
npm run android    # build & run on Android emulator/device
```

After the first native build, you can iterate with the JS dev server:

```bash
npm start          # Expo dev server (then press i / a, or scan in your dev build)
```

> `npm run web` is available but the voice/WebRTC flow targets native iOS/Android.

### Native modules / "WebRTC native module not found"

The `android/` and `ios/` folders are **generated** (gitignored). If you add or change a native dependency or config plugin (e.g. the LiveKit / WebRTC plugins in `app.json`), regenerate the native project and do a full rebuild — a JS reload alone won't pick up new native modules:

```bash
cd apps/mobile
npx expo prebuild --clean        # regenerate android/ + ios/ applying config plugins
npm run android                  # (or npm run ios) full native rebuild
```

If you hit `WebRTC native module not found`, it almost always means the native build is stale — run the two commands above.

---

## Typical local workflow

1. Start Docker (only if you'll run server tests).
2. Server: `cd server && npm run provision` (first time), then `npm run dev`.
3. Mobile: set `EXPO_PUBLIC_TOKEN_ENDPOINT` (USB Android: `http://localhost:3001/getToken` + `adb reverse tcp:3001 tcp:3001`; Wi-Fi: your machine's LAN IP), then `cd apps/mobile && npm run ios` (or `android`).
4. The app requests a token from the server, joins the LiveKit room, and the `gym-buddy` agent connects.
