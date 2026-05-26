# ADR-0001: Web for onboarding/payment, mobile for sessions only

**Status:** Accepted
**Date:** 2026-05-26

## Context

The mobile app needs onboarding (account creation, Workout Template selection, customisation) and payment. Fitness apps typically bundle everything into one native app.

## Decision

Split into two client surfaces:

- **Web Client** — onboarding, payment, plan management, account settings
- **Mobile App** — Session execution only (connect to your Buddy, work out, done)

Mobile auth uses a QR code or deep link from the web client, avoiding a login form in the app.

## Consequences

- **Avoids app store payment fees** (30%) by handling payment on web
- **Mobile app stays single-purpose** — no UI for plan building, settings, or billing
- **Two clients to maintain** — but with very different complexity profiles (web is forms, mobile is real-time voice)
- **Auth must bridge web→mobile** without requiring the user to re-enter credentials in the app
