# Phase 03 — deferred items

Discoveries outside the scope of the plan that found them. Logged rather than fixed.

| Found in | Item | Why it was left |
|---|---|---|
| 03-09 Task 1 | `web/src/pages/You.tsx:18` still declares its own `const field = …`, a fourth copy of the input class that `web/src/components/fields.ts` now owns. It differs from the shared one by one utility (`disabled:opacity-60`), so importing the shared constant would change what `/you` renders for a disabled input. | `web/src/pages/You.tsx` is not in 03-09's `files_modified`, the plan's lift names `ProviderRow.tsx` and `Settings.tsx` only, and the strings are not identical — so this is a change to another page's rendered output, not the move the plan asked for. Worth one line in a later plan that touches `/you`. |
