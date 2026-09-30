# Phase 2: Settings and Secrets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-30
**Phase:** 2-Settings and Secrets
**Areas discussed:** Settings surface, Provider catalogue, Keys and detection, Test and indicator

---

## Settings surface

| Option | Description | Selected |
|--------|-------------|----------|
| New /settings page | Own route beside /you, linked from Home nav and learner menu; per-install config kept apart from per-learner prefs | ✓ |
| Section on /you | One page for everything about this learner's setup; mixes per-install keys with per-learner prefs | |
| Panel from learner menu | Slide-over reachable mid-lesson; a long form fits a panel poorly | |

**User's choice:** New /settings page

| Option | Description | Selected |
|--------|-------------|----------|
| Row per provider, one marked active | Status pill, key field, model picker and "Use this" per row; detection and configuration are one list | ✓ |
| One provider dropdown, then its fields | Shortest page; detected-but-unselected options hidden | |
| Two sections: Detected and Configure | Mirrors SET-03 literally; shows each provider twice | |

**User's choice:** Row per provider, one marked active

| Option | Description | Selected |
|--------|-------------|----------|
| Save as you go, per field | Persist on change with a saved tick, like /you; key saves on blur or Enter and becomes its hint | ✓ |
| Explicit Save button | One Save for settings and secrets; a forgotten Save loses the change | |

**User's choice:** Save as you go, per field

| Option | Description | Selected |
|--------|-------------|----------|
| Next turn of every lesson, fresh session if provider changed | Settings resolve per turn; model change resumes, provider change starts a new provider session; header updates next turn | ✓ |
| New lessons only | Each lesson pins the provider it started on | |
| Next turn, but block provider changes while a turn runs | Same as first plus a refusal while any turn is in flight | |

**User's choice:** Next turn of every lesson, fresh session if provider changed
**Notes:** None beyond the selection.

---

## Provider catalogue

| Option | Description | Selected |
|--------|-------------|----------|
| All planned providers now | Ten rows; keys, fetch and test work now; unwired rows cannot be made active until Phase 3 and 4 flip a flag | ✓ |
| Only what can teach today | Claude Code login and Codex login rows only | |
| API and gateway providers now, local later | Everything except Ollama, LM Studio, llama.cpp | |

**User's choice:** All planned providers now

| Option | Description | Selected |
|--------|-------------|----------|
| Catalogue module with an "as of" date | Server-side catalogue with default model id, models endpoint and a date; planner picks ids | ✓ |
| No default; the learner always picks | Model field starts empty | |

**User's choice:** Catalogue module with an "as of" date

| Option | Description | Selected |
|--------|-------------|----------|
| Combobox: fetched list plus free typing, always | One field; on fetch failure the list is empty, the sentence shows, typing still works | ✓ |
| Dropdown, with a "type a model id" link on failure | A select, and a text input only after failure | |

**User's choice:** Combobox: fetched list plus free typing, always

| Option | Description | Selected |
|--------|-------------|----------|
| Optional "model" field on /you | Per-learner override on the active provider; empty means install default; no keys on /you | ✓ |
| Toggle on the Settings row: "for this learner only" | Per-learner control on a per-install page | |
| Skip the override this phase | One install-wide model only | |

**User's choice:** Optional "model" field on /you
**Notes:** None beyond the selection.

---

## Keys and detection

| Option | Description | Selected |
|--------|-------------|----------|
| One JSON file, ~/.derive/secrets.json | Keyed by provider id, 0600, atomic write, read live, registered with the secrets module on load | ✓ |
| Dotenv-style ~/.derive/secrets.env | Hand-editable lines; own parser; blurs the env precedence rule | |
| One file per provider under ~/.derive/secrets/ | rm one key; more files to permission-check | |

**User's choice:** One JSON file, ~/.derive/secrets.json

| Option | Description | Selected |
|--------|-------------|----------|
| Last four characters | API answers { set: true, hint }; field shows dots plus hint until Replace | ✓ |
| Provider prefix only | Shows key type, not identity | |
| No hint, only "key set" | Cannot tell two keys apart | |

**User's choice:** Last four characters

| Option | Description | Selected |
|--------|-------------|----------|
| Locked row with "set from environment"; Remove deletes from file | Read-only field naming the variable to unset; Remove deletes from secrets.json; value stays redacted until restart | ✓ |
| Editable, with a warning that the environment wins | Store a file key while env is active | |

**User's choice:** Locked row with "set from environment"; Remove deletes from file

| Option | Description | Selected |
|--------|-------------|----------|
| On Settings open, plus a Rescan button | One pass: claude auth status, codex auth file, env vars, short-timeout probes of 11434, 1234, 8080; rows fill as results arrive | ✓ |
| Once at server boot, cached | Part of startup and /api/health | |
| Poll every few seconds while Settings is open | Live status at the cost of repeated spawns and probes | |

**User's choice:** On Settings open, plus a Rescan button
**Notes:** None beyond the selection.

---

## Test and indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Cheapest real request per provider | Models-list with the stored key; local models or health endpoint; auth check for logins | ✓ |
| A one-word completion on the selected model | Proves the model, costs tokens, spends a turn on logins | |
| Models list, then a completion only if the list succeeded | Two steps in one click | |

**User's choice:** Cheapest real request per provider

| Option | Description | Selected |
|--------|-------------|----------|
| Inline under the row, one line | Green success with model count and latency; red failure with the provider's verbatim sentence and a fix hint when recognised | ✓ |
| Toast notification | Transient; a long provider error is hard to read or copy | |

**User's choice:** Inline under the row, one line

| Option | Description | Selected |
|--------|-------------|----------|
| Small pill "provider · model", links to /settings | Muted pill in the 60px header beside the title; shows what the last turn ran on | ✓ |
| Text in the composer placeholder | Disappears while typing; not clickable | |
| Line in the phase bar | Mixes lesson progress with infrastructure | |

**User's choice:** Small pill "provider · model", links to /settings

| Option | Description | Selected |
|--------|-------------|----------|
| Driver name and "model set in your terminal" | "claude code · terminal model" or "codex cli · terminal model"; start message names the driver and the app's own tutor setting | ✓ |
| Show the install's active provider and model | Same pill as app lessons; wrong when the terminal runs another model | |
| No pill on terminal lessons | Only the start message names the driver | |

**User's choice:** Driver name and "model set in your terminal"
**Notes:** None beyond the selection.

---

## Claude's Discretion

- Where non-secret settings persist (settings table via the migration runner, or a JSON file beside secrets.json).
- Replacing the `backend()` memo with a per-turn resolver and reporting its source on /api/health and the startup line.
- API route shapes for settings, detection, model fetch and test.
- Probe timeouts and running detection in parallel without blocking first paint.
- OpenAI-compatible row's base URL validation relative to the Phase 1 SSRF rules.
- Codex model default display, doctor script reporting, and concrete catalogue model ids with the "as of" date.

## Deferred Ideas

- None raised outside the phase. Provider drivers, cost display, per-lesson model switching and an effort setting are already placed by the roadmap or out of scope.
