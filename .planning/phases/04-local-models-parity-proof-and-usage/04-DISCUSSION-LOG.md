# Phase 4: Local Models, Parity Proof and Usage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-16
**Phase:** 04-local-models-parity-proof-and-usage
**Areas discussed:** num_ctx posture, Conformance harness reach, Tool-rejection telemetry surface, "Test teaching" isolation, Local rows vs generic row, Capability probe definition, Compact prompt for local

---

## num_ctx posture

### Q1 — Default num_ctx
| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 16k floor | Derive requests 16384 on every local model; predictable, small footprint; matches the roadmap floor | ✓ |
| Model's full maximum | Read `/api/show` max and request it; uses model fully but huge KV cache / OOM risk | |
| Mid default, model max as cap | Default e.g. 32768 capped at the model's max | |

**User's choice:** Fixed 16k floor

### Q2 — Learner control of num_ctx
| Option | Description | Selected |
|--------|-------------|----------|
| Learner-editable field | num_ctx field on the local row, default 16384; matches the UI-SPEC refusal copy | ✓ |
| Automatic, hidden | Derive manages it; refusal points outside Derive; contradicts UI-SPEC copy | |
| Auto with advanced override | Auto 16384 with an optional field only when needed | |

**User's choice:** Learner-editable field

### Q3 — Model maximum below the floor
| Option | Description | Selected |
|--------|-------------|----------|
| Refuse at config/probe time | Row refuses and model cannot be selected; symmetric with capability refusal | ✓ |
| Allow; refuse per-lesson | Let it be chosen, refuse mid-lesson when it can't fit | |
| Warn on the row, allow | Warn but allow; per-lesson refusal as backstop | |

**User's choice:** Refuse at config/probe time

### Q4 — LM Studio / llama.cpp context handling
| Option | Description | Selected |
|--------|-------------|----------|
| Ollama sets; others read & refuse | Native num_ctx only for Ollama; others read reported context and refuse per-lesson | ✓ |
| Set for all three, fall back | Try to push a context for all three, fall back to read-and-refuse | |

**User's choice:** Ollama sets; others read & refuse

---

## Conformance harness reach

### Q1 — Where the harness runs
| Option | Description | Selected |
|--------|-------------|----------|
| Both: CI cron + local script | GitHub Actions cron for cloud (secrets) + local script for local models | ✓ |
| Local script only | Only a local `pnpm` script, cron-able on the learner's machine | |
| CI cron only | Only a scheduled CI job; can never reach local models | |

**User's choice:** Both: CI cron + local script

### Q2 — Real models or stub
| Option | Description | Selected |
|--------|-------------|----------|
| Real models | Replay against real configured models — the only proof a model follows the method | ✓ |
| Stub model only | Model-free structural harness; real conformance is separate | |
| Both: structural in CI, real-model nightly | Stub in CI every push, real-model nightly | |

**User's choice:** Real models

### Q3 — What the harness produces
| Option | Description | Selected |
|--------|-------------|----------|
| Report file + exit code | JSON + Markdown per run; CI artifact / `~/.derive`; non-zero on failure | ✓ |
| Report + learner-visible status | Also show a status to the learner | |
| Exit code only | Log and exit; no artifact | |

**User's choice:** Report file + exit code

### Q4 — Which providers each run
| Option | Description | Selected |
|--------|-------------|----------|
| All available, explicit skips | Exercise every configured provider; record `skipped` with reason for the rest | ✓ |
| Fixed required set | Required providers fail the run if missing | |
| Active model only | Only the currently active provider/model | |

**User's choice:** All available, explicit skips

---

## Tool-rejection telemetry surface

### Q1 — Learner visibility
| Option | Description | Selected |
|--------|-------------|----------|
| Internal only | Ledger + conformance report only | ✓ |
| On the local row | Show a signal on the Settings local row | |
| On the Usage page | Show per provider/model on Usage | |

**User's choice:** Internal only

### Q2 — What counts as a rejection
| Option | Description | Selected |
|--------|-------------|----------|
| Schema-rejected calls only | Calls whose args fail the full server-side zod schema (Phase 1 D-06) | ✓ |
| Rejected calls + missing required calls | Also count turns where a required tool call never came | |
| All non-ok tool outcomes | Every non-ok outcome as one rate | |

**User's choice:** Schema-rejected calls only

### Q3 — Grain
| Option | Description | Selected |
|--------|-------------|----------|
| Per provider + model | The model is the unit of reliability; provider = sum | ✓ |
| Per provider only | Roadmap-literal, coarser | |
| Per provider + model + tool | Most detail, largest footprint | |

**User's choice:** Per provider + model

### Q4 — Runtime effect
| Option | Description | Selected |
|--------|-------------|----------|
| Record only, no runtime effect | Evidence only; never changes mid-lesson behavior | ✓ |
| Soft status nudge | Ephemeral nudge above a threshold | |
| Drives the capability refusal | Treat high rate as not tool-capable and refuse | |

**User's choice:** Record only, no runtime effect

---

## "Test teaching" isolation

### Q1 — Trace in the learner's record
| Option | Description | Selected |
|--------|-------------|----------|
| Ephemeral scratch, then deleted | Hidden lesson, deleted transactionally; no Home/Atlas/usage trace | ✓ |
| Real throwaway lesson, kept | A normal lesson the learner can inspect; pollutes Home/usage | |
| No persisted lesson | Drive the loop with no lesson persisted | |

**User's choice:** Ephemeral scratch, then deleted

### Q2 — What it runs
| Option | Description | Selected |
|--------|-------------|----------|
| Fixed scripted tool round-trip | Force a plan/quiz tool call and grade it; deterministic | ✓ |
| Real one-node mini-lesson | Plan, teach, quiz, lock a node; slower, variable | |
| Share the harness's script | Reuse the conformance harness script | |

**User's choice:** Fixed scripted tool round-trip

### Q3 — Placement
| Option | Description | Selected |
|--------|-------------|----------|
| All teachable provider rows | Cloud, gateway and local alike (PROV-11 "any chosen model") | ✓ |
| Local rows only | Only Ollama / LM Studio / llama.cpp, per the UI-SPEC inventory | |

**User's choice:** All teachable provider rows — widens the UI-SPEC, which needs a small update

### Q4 — Test token usage
| Option | Description | Selected |
|--------|-------------|----------|
| Discard with the lesson | Nothing reaches the ledger or Usage total | ✓ |
| Record, but exclude from totals | Keep usage rows flagged out of totals | |

**User's choice:** Discard with the lesson

---

## Local rows vs generic row

### Q1 — Relationship to the generic OpenAI-compatible row
| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated rows canonical; generic is remote-only | Local rows carry discovery/probe/num_ctx; generic stays remote/proxied | ✓ |
| Rows are presets over one mechanism | Local rows fill the same underlying config as the generic row | |
| Generic row rejects local hosts | Only dedicated rows may hold a local address | |

**User's choice:** Dedicated rows canonical; generic is remote-only

### Q2 — Addressable by the learner
| Option | Description | Selected |
|--------|-------------|----------|
| Editable base URL, prefilled | Prefill from detection; learner can point at a non-default port / LAN / proxy | ✓ |
| Fixed default port only | Bound to the server's default port | |

**User's choice:** Editable base URL, prefilled

---

## Capability probe definition

### Q1 — How capability is determined
| Option | Description | Selected |
|--------|-------------|----------|
| Metadata + round-trip fallback | `/api/show`, `/props` where present; one tool round-trip where absent (LM Studio) | ✓ |
| Always a tool round-trip | Uniform but costs a request/model load per probe | |
| Assume OpenAI-compatible = capable | Zero probe cost; fails into the lesson error path | |

**User's choice:** Metadata + round-trip fallback

### Q2 — When the probe runs
| Option | Description | Selected |
|--------|-------------|----------|
| Metadata on open, round-trip on selection | Whole-list metadata on Settings open; round-trip for the chosen model | ✓ |
| Probe every model on open | Definitive for all, but N model loads on one page open | |
| Defer to first lesson turn | No up-front probe; lesson refusal is the only signal | |

**User's choice:** Metadata on open, round-trip on selection

---

## Compact prompt for local

### Q1 — What compaction keys on
| Option | Description | Selected |
|--------|-------------|----------|
| Keyed on local provider | Every local model gets compact tools + outline-only, any size | ✓ |
| Keyed on window/fit | Large local models keep the full prompt | |

**User's choice:** Keyed on local provider

### Q2 — "Material-outline-only" meaning
| Option | Description | Selected |
|--------|-------------|----------|
| Outlines now, full text on demand | Outlines in the prompt; full text via read_material/search_material | ✓ |
| Full material, compact tools only | Keep full material section, save only on tool descriptions | |
| No material for local | Drop the material section entirely | |

**User's choice:** Outlines now, full text on demand

### Q3 — Learner visibility of compaction
| Option | Description | Selected |
|--------|-------------|----------|
| Silent implementation detail | No learner-facing note | ✓ |
| One quiet note on the row | A note explaining the compact prompt | |

**User's choice:** Silent implementation detail

---

## Claude's Discretion

The user did not open these; the planner decides them:

- Where the local wiring lives (adapter rows in `server/src/drivers/adapters.ts`; probe helpers beside `probe.ts`).
- The scripted-lesson script and its assertions; the report JSON schema; the report filename under `~/.derive`.
- Concrete `num_ctx` field bounds and row shape.
- The compact/local `ToolSurface` name and where the material-outline render is produced.
- The ephemeral scratch lesson's creation/cleanup marker.
- Whether the local rows extend `ProviderRow` verbatim or use a sibling component.

## Deferred Ideas

None raised outside the phase boundary. Items already placed elsewhere: Copilot/Gemini CLI drivers, per-lesson switching and tiered roles (v2); learning-experience changes (Phase 5); personalization (Phase 6); adoption (Phase 7); a learner-visible capability badge or cost analytics (v2 under the simplicity rule).
