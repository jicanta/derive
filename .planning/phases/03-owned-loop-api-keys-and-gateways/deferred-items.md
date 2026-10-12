# Phase 03 — deferred items

Discoveries outside the scope of the plan that found them. Logged rather than fixed.

| Found in | Item | Why it was left |
|---|---|---|
| 03-09 close-out | PROV-09 names three fallback search providers — "Tavily, SearXNG, Ollama search" — and `SEARCH_PROVIDERS` carries the first two. The requirement is marked Complete on the substance (search and fetch work on every provider that teaches: native where it exists, pluggable otherwise) with the third backend absent. | Ollama's row does not teach until Phase 4 (PROV-06), so an Ollama-search backend today would be a code path no provider can reach. The seam it would plug into is `SEARCH_PROVIDERS` in `server/src/search.ts`, one entry plus one function; Phase 4 should add it with the Ollama driver, not before. |
| 03-09 Task 1 | `web/src/pages/You.tsx:18` still declares its own `const field = …`, a fourth copy of the input class that `web/src/components/fields.ts` now owns. It differs from the shared one by one utility (`disabled:opacity-60`), so importing the shared constant would change what `/you` renders for a disabled input. | `web/src/pages/You.tsx` is not in 03-09's `files_modified`, the plan's lift names `ProviderRow.tsx` and `Settings.tsx` only, and the strings are not identical — so this is a change to another page's rendered output, not the move the plan asked for. Worth one line in a later plan that touches `/you`. |
