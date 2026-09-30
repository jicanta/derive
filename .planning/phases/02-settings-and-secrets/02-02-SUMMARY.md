---
phase: 02-settings-and-secrets
plan: 02
subsystem: settings
tags: [secrets, api-keys, 0600, atomic-write, redaction, env-lock, react, settings-page]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: registerSecret/redact chokepoint with the 16-character floor, credentials.ts (the 0600 read-live module this one copies), safeMessage
  - phase: 02-settings-and-secrets (plan 01)
    provides: the provider catalogue (optionalKey), settings table, lockedBy, GET/PUT /api/settings
  - phase: 02-settings-and-secrets (plan 06)
    provides: localBase, base URL storage and normalisation, the /settings page and ProviderRow
provides:
  - "~/.derive/secrets.json as { providerId: key }, mode 0600, written to a sibling temp file and renamed into place, read live behind a one-second cache, every loaded value registered for redaction"
  - "keys.ts: keyOf, hintOf, keyView, setKey, removeKey, secretsFileError, resetKeyCache, KEY_CACHE_MS"
  - "config.ts: SECRETS_PATH, ENV_KEYS (ANTHROPIC/OPENAI/GEMINI/GOOGLE/OPENROUTER), OLLAMA_HOST — the phase's only new environment reads"
  - "settings.ts: envKeyFor (Google before Gemini), effectiveKey, lockedBy key:<id> and base_url:ollama, localBase honouring OLLAMA_HOST, env keys registered at module load"
  - "PUT /api/settings/:provider accepts key; DELETE /api/settings/:provider/key; rows carry key { set, hint, locked }, key_optional, base_url_locked; the view carries secrets_error"
  - "ProviderRow key field with every UI-SPEC state (unset, saving, set, replacing, two-step remove, removed, env-locked, save failed) and the base URL input on key+url and local rows"
  - "Settings page secrets-file line above the keys group"
affects: [02-03 model lists and connection tests, 02-04 doctor and .env.example, 03 owned loop on API keys]

# Actuals (#2632) — chars/4 over the realized diff a91407f..HEAD across server/ and web/
actuals:
  tokens: 14746
  tasks: 2
  commits: 2
plan_head_before: a91407f3d1de9d6aba734042a17f80fce197db95

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "secrets file = credentials.ts shape: read live behind a 1 s cache, registerSecret on every loaded value, absent file silent, unreadable file loud and never overwritten"
    - "atomic 0600 write: sibling ${path}.${pid}.tmp created with mode 0o600, then renameSync over the target; cache dropped after every write"
    - "write-only credential API: the row answers { set, hint, locked }; hint is the last four of a key at least eight long, empty otherwise; no route reads a key back"
    - "environment outranks file: envKeyFor decides, PUT and DELETE answer 409 naming the variable, the file value is neither returned nor deleted"
    - "inline destructive step: `remove` → `remove the key · keep`, Escape or keep returns; no modal, no confirm()"
    - "keep-the-current-key button swallows mousedown so the password input does not blur-save on the way to the button that means do not save"

key-files:
  created:
    - server/src/keys.ts
  modified:
    - server/src/config.ts
    - server/src/settings.ts
    - server/src/index.ts
    - server/test/settings.test.ts
    - web/src/lib/types.ts
    - web/src/lib/api.ts
    - web/src/components/ProviderRow.tsx
    - web/src/pages/Settings.tsx

key-decisions:
  - "Per 02-02 keys live in one plaintext 0600 secrets.json beside derive.db, the same trust boundary as the install token: a same-uid process that can read it can read the database too, so encryption at rest would be theatre without a key it could not also read"
  - "Per 02-02 an environment key gets no hint (hint: null, locked: VAR): the hint exists for keys the learner pasted, and showing characters of an operator-set variable would reveal something the learner never typed"
  - "Per 02-02 a corrupt secrets.json is reported (secrets_error naming the path) and never overwritten; setKey refuses until the file is fixed or moved, so a bad edit costs nothing but a sentence"
  - "Per 02-02 remove flips the row locally to { set: false } and status not configured (only when the status was key set) rather than refetching, and the removed sentence says the process still redacts the value until restart (D-12)"
  - "Per 02-02 the base URL input shows OLLAMA_HOST's resolved address when the environment locks it, so the disabled field reads where the row is actually probed rather than a stored value it outranks"

patterns-established:
  - "KeyField / BaseUrlField are local (non-exported) components inside ProviderRow.tsx: one exported component per file, helpers stay private"
  - "useTick(): the 1800 ms saved tick as a small hook shared by the key and base URL fields; the model field keeps plan 06's inline timer"

requirements-completed: [SET-02, SET-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A key pasted through PUT /api/settings/:provider lives in a 0600 secrets.json as { providerId: key }, is answered as { set: true, hint } and appears in no response body"
    requirement: SET-02
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#stores a key and answers { set, hint } only, never the value"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#writes the file 0600 as { providerId: key }"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#gives a short key an empty hint, so the hint never reveals most of it"
        status: pass
    human_judgment: false
  - id: D2
    description: "Empty, over-long and whitespace-bearing keys, keys on login rows and on the Ollama row are refused with the row sentence"
    requirement: SET-02
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#refuses an empty, an absurdly long, and a whitespace-bearing key with the row sentence"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#refuses a key on a login row and on the Ollama row"
        status: pass
    human_judgment: false
  - id: D3
    description: "DELETE /api/settings/:provider/key removes the file entry, says the process still hides the value until restart, and unlinks the file with the last key"
    requirement: SET-02
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#removes a key, says the process still hides it, and removes the file with the last key"
        status: pass
    human_judgment: false
  - id: D4
    description: "A key variable in the environment locks the row (set from environment, variable named, Google before Gemini), PUT and DELETE answer 409, no env value is echoed or copied into the file, and OLLAMA_HOST locks the Ollama address"
    requirement: SET-03
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#reads set from environment with the variable named, Google before Gemini, and OLLAMA_HOST on the Ollama row"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#answers 409 naming the variable on a key write and on a key removal"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#answers 409 on the Ollama address while OLLAMA_HOST is set"
        status: pass
      - kind: integration
        ref: "server/test/settings.test.ts#never echoes an environment value and never copies one into the file"
        status: pass
    human_judgment: false
  - id: D5
    description: "An unreadable secrets.json is loud on GET /api/settings, refuses a key write, and is left byte-for-byte as it was"
    requirement: SET-02
    verification:
      - kind: integration
        ref: "server/test/settings.test.ts#is loud on the settings view, refuses a key, and leaves the file exactly as it was"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every key is registered with the redaction chokepoint the moment it is known: on setKey before the write, and on load of a file written by hand"
    requirement: SET-02
    verification:
      - kind: unit
        ref: "server/test/settings.test.ts#registers a key with the redaction chokepoint before it is written"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#registers every key it loads from a file written by hand"
        status: pass
      - kind: unit
        ref: "server/test/settings.test.ts#hints with the last four characters of a key at least eight long, and nothing of a shorter one"
        status: pass
    human_judgment: false
  - id: D7
    description: "The ProviderRow key field renders every UI-SPEC state (unset placeholder, saving, masked hint with replace · remove, replace with keep the current key and Escape, inline two-step remove, the five-second removed sentence, the env-lock sentence, save failed with the typed value kept) and round-trips through the API"
    requirement: SET-02
    verification:
      - kind: other
        ref: "pnpm --filter web build (tsc -b, noUnusedLocals) + acceptance greps for every state's copy"
        status: pass
    human_judgment: true
    rationale: "No web test runner exists in the repo; the state transitions, the Escape handling and the five-second sentence are seen only in a browser. Human check recorded in the plan's <human-check>."
  - id: D8
    description: "The base URL input on key+url and local rows: placeholder is the catalogue default, empty means default, the server's sentence on a bad scheme with the typed value kept, disabled with the OLLAMA_HOST sentence when locked"
    requirement: SET-03
    verification:
      - kind: other
        ref: "pnpm --filter web build + acceptance grep for `Unset it to change the address here.` and the base URL aria-label"
        status: pass
    human_judgment: true
    rationale: "Rendering and the disabled-when-locked behaviour need a browser with OLLAMA_HOST exported; no web tests."
  - id: D9
    description: "The settings page shows one rust line above the keys group when secrets.json cannot be read; rows still render"
    requirement: SET-02
    verification:
      - kind: other
        ref: "pnpm --filter web build + acceptance grep for `nothing here was overwritten` in web/src/pages/Settings.tsx"
        status: pass
    human_judgment: true
    rationale: "Placement above the keys group and the reason-stripping are visual; no web tests."

# Metrics
duration: 3 min (this continuation; Task 1 was committed in a prior session at 2026-09-30T19:45:11Z)
completed: 2026-09-30
status: complete
---

# Phase 2 Plan 02: Keys in a 0600 secrets.json, answered as { set, hint }, outranked by the environment Summary

**Provider keys land in one 0600 `~/.derive/secrets.json` written atomically and registered for redaction the moment they are known; the API answers `{ set, hint }` and nothing else, an environment variable locks its row with a 409 naming it, and the provider row's key field walks every state of the UI contract without ever showing the value again.**

## Performance

- **Duration:** 3 min for this continuation (Task 2 + SUMMARY); Task 1 was executed and committed by a previous executor at 2026-09-30T19:45:11Z before the session was interrupted
- **Started:** 2026-09-30T22:20:48Z (continuation)
- **Completed:** 2026-09-30T22:23:40Z
- **Tasks:** 2
- **Files modified:** 9 (1 created)

## Accomplishments

- `server/src/keys.ts` copies `credentials.ts`: read live behind a one-second cache, every loaded value passed to `registerSecret`, an absent file is the fresh install, an unreadable or non-object file is reported through `secretsFileError()` and never overwritten. Writes go to `${SECRETS_PATH}.${pid}.tmp` created `mode: 0o600` then `renameSync` over the target; a crash mid-write leaves the old file or the whole new one. `hintOf` gives the last four characters of a key at least eight long and `''` otherwise.
- `config.ts` reads `SECRETS_PATH`, the five `ENV_KEYS` and `OLLAMA_HOST` once; no other module reads `process.env` (verified by grep over keys.ts, settings.ts, probe.ts).
- `settings.ts`: `envKeyFor` (Google before Gemini on the gemini row), `effectiveKey`, `lockedBy('key:<id>')` and `lockedBy('base_url:ollama')`, `localBase` honouring `OLLAMA_HOST` with scheme and port defaults; every set environment key is registered at module load.
- `PUT /api/settings/:provider` takes `key` (login rows: `runs on its login and takes no key`; Ollama: `takes no key`; env-locked: 409 naming the variable); `DELETE /api/settings/:provider/key` with the D-12 note; rows carry `key { set, hint, locked }`, `key_optional`, `base_url_locked`; `settingsView` carries `secrets_error`. Key-row status reads `set from environment` / `key set` / `not configured` in that order.
- 17 new cases in `server/test/settings.test.ts` (HTTP suite, environment suite, corrupt-file suite, in-process suite); the whole suite is 259 tests, `# fail 0`.
- `ProviderRow.tsx`: a local `KeyField` with the unset password input (saves on blur or Enter, sends nothing for an empty value), the `saving` line, the `•••• •••• {hint}` mask with `replace · remove`, the replacing input with `keep the current key` (button and Escape), the inline `remove the key · keep` second step with no dialog, the five-second `Removed. It stays hidden from logs and events until Derive restarts.`, the `set from environment` pill with `Set by {VAR} in your environment. Unset it to store a key here.`, and the server's sentence in rust with the typed value kept on failure. `optional key` eyebrow on LM Studio and llama.cpp. No reveal toggle.
- A local `BaseUrlField` on `key+url` and local rows: full width under the pair, placeholder the catalogue default, empty means default, the same gold tick, the server's sentence on refusal, disabled with `Set by OLLAMA_HOST in your environment. Unset it to change the address here.` when locked.
- `Settings.tsx`: one rust line at the top of the `keys` group when `secrets_error` is set — `secrets.json could not be read: {reason}. Fix or move the file; nothing here was overwritten.` — with the path prefix stripped from the server's sentence; rows render underneath.

## Task Commits

Each task was committed atomically:

1. **Task 1: secrets.json — 0600, atomic, read live, registered; env keys outrank it** - `56ba658` (feat) — committed by the previous executor; verified in this continuation (`git show --stat 56ba658` lists the five files; every Task 1 acceptance grep passes; `renameSync` ×2, `mode: 0o600` ×1, no `process.env` outside config.ts)
2. **Task 2: The key field states and the base URL input on the row** - `f702fa1` (feat)

**Plan metadata:** see the docs commit that carries this file.

## Files Created/Modified

- `server/src/keys.ts` - the secrets file module: `keyOf`, `hintOf`, `keyView`, `setKey`, `removeKey`, `secretsFileError`, `resetKeyCache`, `KEY_CACHE_MS`
- `server/src/config.ts` - `SECRETS_PATH`, `ENV_KEYS`, `OLLAMA_HOST`
- `server/src/settings.ts` - `envKeyFor`, `effectiveKey`, key and Ollama-address locks, `localBase` on `OLLAMA_HOST`
- `server/src/index.ts` - key on PUT, the DELETE route, `keyOfRow`, `statusOf`, `secrets_error`
- `server/test/settings.test.ts` - the four new suites
- `web/src/lib/types.ts` - `ProviderView.key`, `key_optional`, `base_url_locked`; `Settings.secrets_error`
- `web/src/lib/api.ts` - `setProvider` body takes `key`; `removeKey`
- `web/src/components/ProviderRow.tsx` - `KeyField`, `BaseUrlField`, `useTick`, `blurOnEnter`
- `web/src/pages/Settings.tsx` - `secretsReason`, the line above the keys group

## Decisions Made

- Plaintext 0600 is the deliberate posture (same trust boundary as the token and the database); documented in the keys.ts header.
- Environment keys carry `hint: null` — the hint is for keys the learner pasted.
- A corrupt file is loud and untouched; `setKey` refuses until it is fixed or moved.
- On the confirmed remove the row is updated locally (`key.set: false`; status to `not configured` only when it read `key set`, so the optional-key local rows keep their port status) rather than refetching the page.
- The `keep the current key` button swallows `mousedown` so the password input does not blur-save the typed value on the way to the button whose meaning is "do not save". Save-on-blur is the contract; this keeps the one button that must not trigger it honest.
- The base URL input shows the resolved `OLLAMA_HOST` address when locked (plan 06's `rowView` already returns `localBase(spec)` in that case).

## Deviations from Plan

None - plan executed exactly as written. Task 1's acceptance criteria were re-verified in this continuation and all pass; no fix was needed.

## Issues Encountered

- The session was interrupted between Task 1's commit and Task 2. This continuation verified the Task 1 commit and its acceptance criteria before starting Task 2, per the dispatch instructions; nothing from Task 1 was redone.

## Verification

- `pnpm --filter web build` → exit 0, no `error TS`
- `grep -c "keep the current key" web/src/components/ProviderRow.tsx` → 2
- `! grep -q "confirm(" web/src/components/ProviderRow.tsx` → pass (no browser dialog)
- `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` → exit 0, `# tests 259 / # pass 259 / # fail 0`
- `git diff --quiet -- server/test/wire-surface.json` → unchanged
- Task 1 verify (re-run): `grep -c renameSync server/src/keys.ts` → 2; `grep -c "mode: 0o600"` → 1; `! grep -q process.env server/src/keys.ts server/src/settings.ts server/src/probe.ts` → pass

## Human check (harvested at end of phase)

On `/settings` paste a throwaway string into the Anthropic key field and tab out: dots plus its last four characters appear with `replace · remove`; press `remove`, see `remove the key · keep`, press Escape and it returns; press `remove` twice and the removed sentence shows for about five seconds; with `OPENAI_API_KEY` exported before `pnpm start`, the OpenAI row shows `set from environment` and no input; the Ollama row shows a base URL input with the default as placeholder.

## Threat Flags

None beyond the plan's register. The four boundaries it names (browser → PUT key, server → secrets.json, environment → server, server → every egress) are the ones touched; T-02-07..T-02-13 mitigations are in place and tested (echo assertions, registration on load and on set, temp-file rename, 0600 mode, 409 on env-locked rows).

## Known Stubs

None. Every field is wired to the API; no placeholder data.

## User Setup Required

None - no external service configuration required. The doctor line and `.env.example` entries for `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY` and `OLLAMA_HOST` land with plan 04, as the plan states.

## Next Phase Readiness

- Plan 03 (model lists and connection tests) can read `effectiveKey(id)` for the key to send and `localBase(spec)` for the address; the row already carries `key.set` to gate `test connection`.
- Plan 04 documents the six environment variables and the 0600 file in the doctor and `.env.example`.
- Phase 3's drivers read keys through `effectiveKey`, never the file directly.

## Self-Check: PASSED

- `server/src/keys.ts` exists; `web/src/components/ProviderRow.tsx` contains `keep the current key`
- Commits `56ba658` and `f702fa1` are in `git log`
- `commits: 2` measured as `git rev-list --count a91407f..HEAD`

---
*Phase: 02-settings-and-secrets*
*Completed: 2026-09-30*
