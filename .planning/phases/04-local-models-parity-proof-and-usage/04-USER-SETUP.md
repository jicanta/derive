# Phase 4: User Setup Required

**Generated:** 2026-10-22
**Phase:** 04-local-models-parity-proof-and-usage
**Status:** Incomplete

Every item here is **optional**, and the nightly conformance workflow is correct and useful before any of it is done. D-17 makes the harness record an explicit `skipped (no key)` line for each absent key, so the first green run can legitimately report every cloud provider skipped — that is a complete report, which is the point. Doing this is how those rows move from `skipped` to a real verdict.

Claude can set a secret with `gh secret set`; it cannot obtain a key. Only you can.

## Environment Variables

These are **GitHub Actions repository secrets**, not a local `.env` — they exist so the nightly run can reach cloud providers. (Locally, the same variables in `.env` are what `pnpm conformance` reads.)

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `ANTHROPIC_API_KEY` | console.anthropic.com → API keys | GitHub repository secrets |
| [ ] | `OPENAI_API_KEY` | platform.openai.com/api-keys | GitHub repository secrets |
| [ ] | `GOOGLE_API_KEY` | aistudio.google.com/apikey | GitHub repository secrets |
| [ ] | `OPENROUTER_API_KEY` | openrouter.ai/keys | GitHub repository secrets |

## Account Setup

None. Each item above is a key on an account you already decide whether to have.

## Dashboard Configuration

No dashboard work. Hand Claude the values and it runs `gh secret set <NAME>` for each; `gh` is already authenticated as jicanta. Nothing is written into the repository, and the harness registers every key with Derive's own redaction before the first request so no value reaches the uploaded report.

## Verification

After this phase has merged to the default branch — GitHub resolves both `schedule` and `workflow_dispatch` against the default branch only, so this is the earliest the dispatch can happen at all:

```bash
gh workflow run conformance.yml
gh run list --workflow conformance.yml --limit 1
gh run view --log
```

Expected results:

- The run completes and uploads a `conformance` artifact.
- `conformance.md` in that artifact lists **every** teachable provider exactly once: each with its three verdicts (pretest, understanding gate, cumulative quiz) or with an explicit `skipped` line naming the reason. Nothing is silently absent.
- Rows whose secret you set read a real verdict instead of `no key in the environment`.
- A row where a model actually failed a verdict makes the job red. That is the harness working: a weak model failing the gate is the expected, useful finding the roadmap predicts.

### The lesson refusal card wraps (added by 04-06)

The sixth item to see with your own eyes, beside the five `behavior_unverified` items in `04-VERIFICATION.md`. Plan 04-06 put `max-w-[62ch] break-words` on the refusal card; both classes are asserted statically, but whether the rendered card actually wraps is a layout fact no static read establishes.

- [ ] Open a lesson, trigger the `num_ctx` refusal on a read-only local row (llama.cpp or LM Studio) whose model id is a file path, and confirm the card wraps the id across lines with **no horizontal scrollbar** on the timeline.

Expected: the refusal sentence wraps inside roughly 62 characters — noticeably narrower than its neighbouring timeline items, which is the intended result of the locked UI-SPEC E2 contract, not a regression — and the injected `Settings` link still renders underlined and still navigates.

---

**Once all items complete:** Mark status as "Complete" at top of file.
