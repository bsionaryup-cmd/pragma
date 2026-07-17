# OCP Baseline — AI Concierge Native Integration

**Date:** 2026-07-17  
**Domain:** AI Concierge — native PRAGMA UX / extension linking  
**State:** OPEN (audit only)  
**HEAD:** `76493cf`

## Scope

- Native `/ai-concierge` operational module in PRAGMA.
- Secure first-time link between authenticated PRAGMA and the Chrome extension.
- Move operational configuration and mode authority from extension to PRAGMA.
- Extension remains a channel connector only.

## Stop criteria

- Schema, authentication contract, extension-to-PRAGMA linking contract, or architecture change.
- Any required modification to frozen PMS domains.

## Current implementation baseline

- Extension configuration is entered through `popup.html` and persisted with
  `chrome.storage.sync`: `apiBase`, `secret`, `orgId`, `userId`, `mode`.
- Extension authenticates with a global `CONCIERGE_EXTENSION_SECRET` plus a
  client-supplied user ID.
- Operation mode is client-supplied in `x-concierge-mode`.
- Health, sessions, tool audits, learning proposals, and metrics are currently
  process-memory data exposed by `/api/concierge/health`.
- Transport is HTTPS REST; no WebSocket implementation exists.
- There is no native `/ai-concierge` dashboard route, navigation permission,
  persistent organization configuration, device link, or server-side heartbeat.

## Repository state before this domain

- Working tree is intentionally dirty with prior AI Concierge LAT/readiness
  changes and many unrelated audit artifacts.
- Relevant uncommitted pre-existing changes include:
  - `src/proxy.ts`
  - `src/app/api/concierge/**`
  - `src/modules/ai-concierge/channel/auth.ts`
  - `src/modules/ai-concierge/channel/session-store.ts`
  - Phase 13/LAT audit documents and evidence
- These changes predate this native-integration domain and must not be
  overwritten or conflated with its implementation.

## Baseline gates (latest preceding LAT)

- Typecheck: PASS.
- Build: PASS (107 routes/pages; four Concierge API routes).
- AI Concierge tests: 21/21 PASS.
- Scenario audit: `allOk: true`.
- OpenAI use in supported deterministic scenarios: 0 calls / 0 tokens.

## Audit status

No implementation is authorized inside this domain until the architecture,
schema, authentication, and extension-linking audit is closed.
