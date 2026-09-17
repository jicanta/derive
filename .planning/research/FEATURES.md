# Feature Research

**Domain:** Local-first, provider-agnostic AI tutor (mastery learning + spaced repetition) with a web UI and terminal plugins
**Researched:** 2026-09-17
**Confidence:** MEDIUM (official docs cross-checked with community sources; no hands-on trials of competitor products)

This file covers only the five target areas of the milestone. The mechanics already validated in `PROJECT.md` (dependency graphs, understanding gate, FSRS review, materials, library, multi-learner, Obsidian mirror) are treated as existing and are not re-researched.

## One finding that changes the plan

**Anthropic forbids Claude Free/Pro/Max OAuth tokens in third-party tools and in the Claude Agent SDK.** The compliance page (formalised February 2026, quoted by The Register) says: "Using OAuth tokens obtained through Claude Free, Pro, or Max accounts in any other product, tool, or service — including the Agent SDK — is not permitted." Enforcement is server-side, reported from 4 April 2026, up to account suspension. Claude Code itself and API keys remain allowed. OpenCode removed its Claude Pro/Max login plugin before 1.3.0 for this reason.

Derive's in-app Claude backend (`server/src/agent.ts`, Agent SDK on the Claude Code login) is on the wrong side of that line for Pro/Max users. The plugin path (`/derive:learn` inside Claude Code) is fine. Consequences for this milestone:

- "Detect a login" as a settings-page feature applies to **Codex/ChatGPT** (OpenCode offers "ChatGPT Plus/Pro" login), **GitHub Copilot** (Copilot SDK, GA June 2026, requires a Copilot subscription) and **Gemini CLI** (ACP mode, Gemini Code Assist licence). For Claude it should mean "you have Claude Code; use the plugin", and the in-app Claude path should ask for an API key.
- The Validated line "no API key, no per-token bill on the subscription paths" holds for the plugin and Codex paths, not for the in-app Claude path.
- Confidence: MEDIUM (The Register quoting Anthropic's page, corroborated by OpenCode's docs and several secondary write-ups). Verify against Anthropic's current legal page before planning the provider phase; the fix is small if done early and painful if discovered after the settings page ships.

## Feature Landscape

### Area 1: Provider layer

What Open WebUI, LibreChat, Jan, Cherry Studio, Continue, Cline, OpenCode, Zed and Obsidian Copilot have converged on.

#### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Settings page listing providers, one key field each, masked, saved locally | Every tool surveyed has it; env-only config is the author's workflow, not a user's | LOW | Store in `~/.derive/auth.json` with mode 0600 (OpenCode pattern), separate from `derive.db` so a shared database dump never carries keys. Keychain storage is Zed's edge; it belongs to a desktop app, out of scope |
| One generic "OpenAI-compatible" provider: base URL + key + model id | Covers OpenRouter, Groq, Together, vLLM, LM Studio, llama.cpp in one form; Open WebUI, LibreChat, Zed and Cherry Studio all do it | LOW | The URL field should autosuggest known endpoints (Open WebUI does). Also accept an Anthropic-compatible base URL (Zed added this) for gateways that proxy `/v1/messages` |
| Local providers with prefilled URLs and no key | Zed auto-discovers Ollama/LM Studio models; Obsidian Copilot ships self-host templates | LOW | Ollama `:11434`, LM Studio `:1234/v1`, llama.cpp `:8080/v1`. Show "offline, $0" |
| Model list fetched from the provider (`/models`, Ollama `/api/tags`) with a manual model-id fallback | Open WebUI, LibreChat (`fetch: true`), Zed; every tool also lets you type an id because gateways and Anthropic endpoints do not list | MEDIUM | Keep a small curated default list per first-class provider so the page works before the fetch returns |
| "Test connection" button with a plain-language result | Cherry Studio "check", Obsidian Copilot "Test Connection", Open WebUI verify-on-save | LOW | Must report the actual failure sentence (401 vs. wrong URL vs. model not found). Derive's `codex.ts` `friendly()` is the pattern |
| Default model per provider, persisted, plus a model picker | Zed favourites, OpenCode `/models` | LOW | One setting per install with a per-learner override is enough (PROJECT.md defers per-lesson switching) |
| Detect existing CLI logins where it is allowed | OpenCode (ChatGPT, Copilot), Cline (Claude Code path, Gemini CLI) | MEDIUM | Codex login: already detected. Copilot SDK and Gemini CLI ACP are new drivers, each HIGH on its own; the detection itself is LOW. Claude: see the finding above |
| Environment-variable fallback for every key | Standard in all tools; CI and dotfile users rely on it | LOW | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_HOST`; settings page shows "set from environment" |
| Which provider and model is running, visible in the lesson | Trust: learners paying per token want to see what they are talking to | LOW | Status line in the lesson header and in the terminal plugin's start message |
| Clear error surface when a turn fails for a provider reason | Rate limit, quota, invalid key, context overflow | LOW | Map to fix hints; `turn_end {ok:false}` already exists |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Test teaching", not just "test connection" | Local and gateway models often fail at tool calling (community tests: 7B models produce valid tool JSON well under 90% of the time; Ollama's OpenAI-compatible layer lags). A one-turn smoke test that requires the model to call `quiz` and get a graded result proves the method will work before a learner invests a session | MEDIUM | Reuses the driver-independent actions; the test is a mini-lesson with one node. Nobody in the survey does this |
| Capability badges on models: tool calling, context window, price per 1M | Learners cannot know which local model will survive a 14-tool loop; Zed shows context window, OpenCode leans on models.dev | MEDIUM | Source from models.dev or LiteLLM's cost map (both maintained JSON); cache it |
| A free path in the quickstart | Ollama, Gemini free tier or OpenRouter free models mean "try Derive" needs no card and no subscription. Directly drives adoption | LOW once providers exist | Documented recipe, not code |
| Provider parity report in CI | The method is measured against the Claude Code path (PROJECT constraint); a recorded-turn parity suite per driver makes "nothing lost between providers" a claim you can show | HIGH | Belongs with the tool-contract consolidation |
| Search provider slot (Brave, Tavily, SearXNG, none) | Claude Code and Codex bring web search; Derive's own loop must supply one for parity | MEDIUM | One interface, two adapters at launch |

#### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Reusing the Claude Code login inside Derive's own loop | It works today and costs nothing | Violates Anthropic's consumer terms; enforced server-side; can get a learner's account disabled | In-app Claude = API key. Subscription users use the Claude Code plugin, which is the sanctioned harness |
| 75-provider catalogue (OpenCode/models.dev scale) | "Support everything" | Catalogue maintenance, per-provider quirks, and a settings page nobody can scan | Three first-class (Anthropic, OpenAI, Gemini) + OpenAI-compatible + Anthropic-compatible + three local presets covers the long tail |
| Per-lesson model switching | Power users like it (Zed, Cline) | Corrupts cost attribution (Roo issue #7755), forks the experience, already out of scope | One default plus per-learner override |
| Storing keys in SQLite next to learner data | Simplest | Database is the thing people back up and share for bug reports | Separate 0600 auth file |
| Building a proxy/gateway (LiteLLM-style) into Derive | Would unify billing | It is a product of its own; OpenRouter already exists | Point the OpenAI-compatible provider at any gateway |
| Custom system-prompt field per provider | LibreChat and Open WebUI offer it | Lets learners edit the method away; method fidelity is a hard constraint | Bounded preference fields (background, examples, tone) |

### Area 2: Cost and usage transparency

What Cline, Roo Code, Aider and OpenCode show, and what their users keep asking for.

#### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-turn tokens (input, output, cache read, cache write, reasoning) and an estimated cost, updated after each request | Cline's task header; Roo shows it next to each message; Aider prints it per message | MEDIUM | Requires Derive's own loop to return usage per request. The Claude SDK path already puts cost on `turn_end` |
| Per-lesson total | Cline per task, Roo per task | LOW | Sum of turns; show in the lesson header and on the lesson row on Home |
| A maintained pricing table, not hand-typed numbers | Cline and Roo compute from provider pricing; LiteLLM's `model_prices_and_context_window.json` is fetched at startup by LiteLLM itself | MEDIUM | Fetch and cache LiteLLM's JSON (or models.dev); ship a snapshot so offline works. OpenRouter returns cost in every response, so use that directly there |
| "Estimate" wording | Both Cline and Roo docs caveat provider rounding | LOW | Say "about $0.42"; never "$0.4213" |
| Subscription and local paths show tokens, not dollars | A dollar figure on a Codex or Ollama lesson is false | LOW | "Covered by your ChatGPT plan · 41k tokens" / "Local · $0" |
| Cost recorded per turn with the model id and price at that time | Roo's totals break when the model changes mid-task because cost is recomputed from the current model | LOW | Persist `{model, in, out, cache_r, cache_w, reasoning, usd}` on `turn_end`; never recompute |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Usage page: running total per learner, this month, by provider and model, by lesson | Open requests in Cline (#4540) and Roo (#6822, #7755); none of the surveyed tools ships it; third-party dashboards exist to fill the gap | MEDIUM | One SQL view over the persisted turn usage; the page is a table and one chart |
| Learning-native unit economics: cost per node locked, cost per review, cost per hour of study | No coding tool can say this; a tutor can. "This lesson: 7 nodes, 38 minutes, about $0.60" reframes spend as learning bought | LOW once totals exist | Also the honest way to compare a cheap model that needs more remediation against an expensive one that does not |
| Soft monthly budget with a warning at 80% and a pause at the next turn boundary at 100% | Roo's "Max Requests" is the closest thing anyone has; learners on API keys ask for exactly this | MEDIUM | Pause between turns, never inside a card, so the understanding gate is not left half-open |
| Cost preview before starting: "your last ten lessons averaged $0.30" | Sets expectations for new key users | LOW | Depends on totals |
| Prompt-cache savings shown | Cline tracks it; Derive's system prompt is large and stable, so caching is worth a lot on Anthropic and OpenAI | LOW to show, MEDIUM to earn | The saving is an architecture item (stable prefix ordering) |

#### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Hard stop mid-lesson at budget | Feels safe | Kills a node between teach and check; the learner loses the turn they paid for | Pause at the turn boundary and ask |
| Exact-bill accounting | "Match my invoice" | Providers round, gateways add fees (OpenRouter 5.5% on credits), pricing changes | Estimate, and link to the provider's own usage page |
| Cost tracking as a reason to pick cheaper models automatically | "Save me money" | Tiered roles are deferred (PROJECT.md); auto-downgrading changes what the tutor does | Show the numbers; let the learner choose the default model |
| Sending usage anywhere (telemetry, leaderboards) | "Compare with others" | Local-first promise | Local page only; optional CSV export |

### Area 3: Learning experience

What Math Academy, Anki, RemNote, Brilliant, Duolingo, Khan Academy and Quantum Country/Orbit do about method quality, friction, progress, motivation and "least effort".

#### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| The system decides what is next; one primary action on Home | Anki's "Study Now"; Math Academy's algorithm unlocks a short list of tasks the student picks from; Duolingo's single big button. Today Derive's Home leads with "type a topic" | MEDIUM | Home shows at most three: "Review (6 due)", "Continue <lesson>", "Start something new". Due reviews first when retrievability of any node is below the threshold |
| Keyboard-first answering | Anki: Space reveals, 1-4 grades; the community's top speed tip is "learn Space and 1-4" | LOW-MEDIUM | A-D or 1-4 select, Enter submits, `?` toggles "not sure", Esc cancels voice; no card needs the mouse |
| Due count visible everywhere | Anki deck list, Duolingo badges | LOW | Badge on the Review action, in the plugin's session start message, and a `derive due` CLI line |
| Retention statistics that are honest | Anki FSRS stats: true retention vs desired retention, average retrievability, "estimated knowledge" (cards reviewed times average retrievability), future-due forecast, review calendar | MEDIUM | Derive already stores stability/difficulty/reps/lapses and computes retrievability; the page is arithmetic over existing rows. "Estimated knowledge: 143 of 180 nodes" is the headline number |
| A forgiving streak | Duolingo's own research: streaks tied to hard daily goals left almost 40% of intense-goal users with no streak; easier streaks raised engagement and learning. Khan Academy uses a weekly streak (level up one skill per week) | LOW | Streak = days with any review or lock; one automatic "freeze" per week; never a lost-streak modal. Prefer a weekly streak if in doubt |
| Adjustable daily goal in a learning unit | Math Academy: XP roughly one minute of focused effort, goal adjustable; Duolingo daily goals | LOW | Unit = nodes locked + reviews passed; default small (3); shown as a ring on Home |
| Review reminders that work without a server | Quantum Country emails; Duolingo pushes; Derive has no hosted infra | MEDIUM | Realistic set: due badge; plugin/skill session-start nudge ("6 nodes due, `/derive:review`"); desktop notification from the running server (node-notifier) when due count crosses a threshold; browser Notification API while the tab is open; `.ics` export of the next review dates. Email is out (no infrastructure) |
| Fast turns and visible waiting | Every chat tool streams; Cline shows a status line; learners abandon a spinner | MEDIUM | Streaming already exists on the Claude path; the own loop must stream too. Show "thinking / calling quiz / grading" status, and prefetch the next card while the learner reads |
| Remediation that names the prerequisite | Math Academy: fail → more questions, switch away, then remedial review of a prerequisite further back in the graph | MEDIUM | Derive's `dependencyRecord` exists; "tighter" means: pick the weakest dependency, re-quiz it, return to the node, and show that path on the graph |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Atlas coloured by stability, with growth over time | Math Academy colours topics darker as knowledge stabilises; nobody offers it on an open, cross-topic graph. "This month: 23 nodes locked, 4 lapsed" | MEDIUM | Colour = retrievability now; a month slider replays `locked_at` and `lapses` |
| Bounded sessions: "I have 10 minutes" | Math Academy sizes tasks in XP-minutes; Anki caps new cards per day | MEDIUM | The tutor picks a subset of due nodes or one small node cluster that fits |
| Focus mode | One card, nothing else, keyboard only. Anki's reviewer is the reference; chat-style tutors hide the card in a timeline | LOW-MEDIUM | Also a personalization item; the same toggle |
| Warm-up and cumulative quiz as visible mechanics | Already exist; naming them in the UI ("Warm-up: 3 nodes on the edge of forgetting") turns machinery into motivation | LOW | Copy and a small header, no new logic |
| Graph reuse across lessons | Math Academy's graph is one engineered graph; Derive builds one per lesson. Reusing already-locked Atlas nodes as roots of a new lesson makes prior learning count and shortens lessons | HIGH | Method-quality item; needs matching of node labels across lessons, a planning-phase prompt change, and a test |
| Quiz sharpness: distractors from recorded misconceptions | Derive stores misconceptions; using them as distractors makes checks bite where the learner actually slipped | MEDIUM | Prompt-side plus a tool-result hint |
| Voice mode that listens after it asks | Current voice mode reads and listens; auto-arm the microphone after a question and allow barge-in | MEDIUM | Browser-only; Chrome has both engines |

#### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Leagues and leaderboards | Math Academy and Duolingo have them and they work there | Need peers and a server; a local install with a few learners has neither; out of scope by constraint | Personal bests: best week, longest streak, estimated knowledge over time |
| XP, gems, hearts, currencies | Duolingo's economy is famous | XP in a tutor where the model sets difficulty is fake; it rewards output, not retention | Count nodes locked and reviews passed; show retention |
| Punitive streaks and escalating notifications | Retention numbers | Duolingo's data says harsh streaks reduce learning; local-first cannot and should not nag across devices | Forgiving streak, one quiet reminder |
| Skipping due reviews for free / editing the schedule by hand | "I know this one" | Undermines FSRS; the whole method rests on fresh questions | "Bury until tomorrow" for one node, at most; the quiz is the way to prove it |
| Exposing FSRS parameters and optimisers in the UI | Anki power users tune them | Expert territory; wrong values silently degrade every learner | Fixed desired retention (0.9); at most one "desired retention" slider later, per learner |
| A flashcard editor | Anki and RemNote are card editors | Derive's cards derive from the graph; an editor forks the product into a worse Anki | Library notes plus "remember" already capture learner-authored facts |
| Auto-advance timers on cards | "Move faster" | Turns a tutor into a slot machine; hurts confidence reporting | Keyboard-first answering is the speed feature |

### Area 4: Personalization (style only)

Theme, typography, density, focus mode, tutor tone and voice, per learner. The method stays fixed.

#### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Theme: light / dark / system | Universal; `prefers-color-scheme` | LOW | Apply from `localStorage` before first paint to avoid a flash, then reconcile with the learner's server-side prefs |
| Accent palettes | Obsidian, Zed, Linear all offer a few | LOW | Four to six accents as Tailwind 4 CSS variables; contrast-checked on both themes |
| Font size | Reader apps (Kindle, Obsidian) | LOW | Base size scale, 14–20 px, everything in rem |
| Font family with a dyslexia-friendly option | Kindle ships OpenDyslexic; Obsidian lets you set any family; accessibility guidance recommends offering a choice | LOW-MEDIUM | Offer System, a serif, **Atkinson Hyperlegible** (legibility: I/l/1, O/0, rn/m), **Lexend** (reading fluency; Vanderbilt-validated speed gains) and **OpenDyslexic** (evidence is thin, one controlled study found no gain in rate or accuracy, but learners ask for it by name). All three are free/OFL; bundle them locally, never from a CDN |
| Respect `prefers-reduced-motion` | Accessibility baseline | LOW | Graph animations and streaming effects off |
| Density: comfortable / compact | Gmail pattern; Obsidian and Linear have it | LOW-MEDIUM | Card padding, timeline spacing, graph label size |
| Tutor language and tone | Derive already has `language`, `style` (adaptive/socratic/narrated) and `pace` (brisk/standard/thorough); ChatGPT has base style presets and Claude has Styles (Concise, Explanatory, Formal) | LOW | Add `tone` (plain / warm / dry) as a prompt block. "Terse vs chatty" is already `pace`; do not duplicate it |
| Voice selection and rate | Any TTS UI; Derive uses the browser's `speechSynthesis` | LOW | Picker over `getVoices()` filtered by the learner's language, plus rate; persist per learner |
| Preferences persisted per learner, server-side, so terminal and browser agree | Derive's `LearnerPrefs` already live in SQLite | LOW | Add a `ui` block (theme, accent, font, size, density, focus, voice) next to the teaching prefs; mirror the visual ones into `localStorage` for first paint |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Focus mode | Hides timeline, graph and rails; one card; keyboard only. Turns a chat UI into a reviewer | LOW-MEDIUM | Same toggle as the learning-experience item |
| Graph panel position | Left / right / bottom / hidden; wide vs. tall screens | MEDIUM | Layout refactor of `Lesson.tsx` |
| Everything themeable through CSS variables, documented | Obsidian's community themes are a large part of its adoption; a documented variable set lets people ship themes as CSS snippets without a theme engine | LOW | A docs page listing the variables is the feature |
| Tone parity in the terminal | The plugin and Codex skills read the same prefs, so tone carries over | LOW | Already true for the existing prefs; extend to `tone` |

#### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| "Easy mode": skip quizzes, no warm-up, fewer checks | Learners under time pressure | Changes the method; explicitly out of scope | Bounded sessions and brisk pace |
| Free-text system prompt override | Power users | Breaks method fidelity and parity | Bounded fields: background, how you learn, examples, tone |
| In-app theme editor or theme marketplace | Looks like polish | Weeks of UI for a feature CSS variables already give | Variables + a docs page |
| Per-lesson style overrides | "This lesson in Spanish" | Multiplies state; the terminal path cannot see it | Per-learner settings; make a second learner if needed |
| Custom fonts loaded from Google Fonts at runtime | Easy | Leaks the learner's usage to a third party; fails offline | Bundle the fonts |

### Area 5: Adoption

What open-source, developer-facing tools need to be installed, found and contributed to.

#### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One-command install | Visitors decide in under 30 seconds; the first screen of the README must show `npx derive` (or equivalent) and a demo | MEDIUM | Publish an npm package with a `bin` that starts the server, serves the built web app and opens the browser. The workspace is `private: true` today, so this means packaging `server/dist` + `web/dist` together. Node ≥ 22.5 (for `node:sqlite`) is a real friction point; state it in the first screen and keep the doctor's message actionable |
| A `derive` CLI with the obvious verbs | Every tool in the survey has `doctor`/`auth`/`models` equivalents | LOW-MEDIUM | `derive` (start), `derive doctor` (exists as `pnpm check`), `derive due`, `derive learners`, `derive auth <provider>` |
| Claude Code marketplace listing | Discovery inside Claude Code is `/plugin marketplace add owner/repo` then `/plugin install derive@…`. Needs `.claude-plugin/marketplace.json` at the repo root (name, owner, plugins[{name, source}]) and a versioned `plugin/.claude-plugin/plugin.json` (exists, v0.4.0); `claude plugin validate .` | LOW | Submit to the community directory (automated security scan) and the official directory (review checks manifest spec, files present, no access outside the plugin dir, clear skill instructions, README with install/usage) via clau.de/plugin-directory-submission. Bump `version` on every release or updates never reach users |
| Codex skills that Codex can actually find | Codex reads `.agents/skills/<name>/SKILL.md` (frontmatter `name`, `description`) from repo, `~/.agents/skills`, `/etc/codex/skills`; plugins add `.codex-plugin/plugin.json` + `skills/` and install with `codex plugin marketplace add owner/repo` | LOW-MEDIUM | `codex/skills/*` today has `agents/openai.yaml` but no `SKILL.md` body (per the codebase map); the method text must not become a third copy, so generate `SKILL.md` from the single method source |
| README as a landing page | Title, one line, why, install, a 20-second GIF, requirements, licence, contributing link, all above the fold | LOW | The current README is close; add the install command and the demo |
| Docs site | Quickstart, providers (one page each, including the free path), the method, the plugin, the Codex skills, FAQ, troubleshooting | MEDIUM | Static site from the repo, deployed by CI to GitHub Pages; tool choice is a STACK decision |
| Landing page | One page: what, the method in three pictures, install, demo, links | LOW-MEDIUM | Can be the docs site home |
| CONTRIBUTING.md, issue and PR templates, `good first issue` labels, code of conduct | Standard maintainer checklist | LOW | Include "how to run the API test suite without a model" since that is Derive's cheapest contribution path |
| Public roadmap and changelog | People adopt tools that visibly move | LOW | `ROADMAP.md` or a GitHub Project mirroring `.planning/ROADMAP.md`; releases already exist |
| Examples | A PDF course, a repo as material, a vault export, a terminal lesson transcript | LOW | Small sample files in `examples/` and asciinema recordings |
| Explicit "no telemetry, keys stay local" statement | The local-first pitch (Jan, Zed, OpenCode all state it) | LOW | README and docs; make it true |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Try it free in five minutes | Quickstart on Ollama or a free-tier key with no subscription and no card; the single biggest funnel fix for a tool that currently needs Claude Code or Codex | LOW (docs) after providers | Depends on Area 1 |
| Listed in skills and plugin directories beyond the two official ones | skills.sh, agentskillshub, awesome-claude-code lists; `npx skills add` compatibility via the agentskills.io spec | LOW | Same `SKILL.md`; submission is manual |
| Parity badge in CI ("every driver passes the method suite") | Signals that "any model, same method" is tested, not promised | HIGH (the suite), LOW (the badge) | Ties to the provider parity report |
| A hosted-free demo: recorded lesson replays | The event log is replayable; a static replay of a real lesson on the landing page needs no server | MEDIUM | Export events to JSON, replay in the web app in read-only mode |

#### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Docker-first install | Open WebUI and LibreChat are Docker-first | Those are multi-user servers; Derive is a personal tool with `node:sqlite` and a browser to open. Docker adds a step and hides the terminal plugins | `npx`; a Dockerfile can come later if self-hosters ask |
| Desktop app, Homebrew cask, hosted demo | Familiar | All out of scope by decision; each is a release pipeline of its own | Clone-and-run and `npx` |
| Discord/community server at launch | "Community" | Empty rooms hurt more than none | GitHub Discussions until there is traffic |
| Requiring Claude Code or Codex to try Derive | Works for the author | Blocks everyone else | The free path |

## Feature Dependencies

```
Derive-owned agent loop (Area 1)
    └──requires──> Tool contract + method text defined once (PROJECT active req.)
    └──enables───> API-key providers, OpenAI-compatible, local, search-provider slot
                       └──enables──> Per-turn usage capture (Area 2)
                                         └──requires──> Pricing table (LiteLLM/models.dev)
                                         └──enables──> Per-lesson totals
                                                           └──enables──> Usage page, cost per node, budget, cost preview
    └──enables───> "Test teaching" smoke test (Area 1)
    └──enables───> Free-path quickstart (Area 5)

Settings page (Area 1)
    └──requires──> Local auth store (~/.derive/auth.json)
    └──requires──> Model list fetch + manual fallback

Copilot SDK driver / Gemini CLI ACP driver (Area 1)
    └──requires──> Derive-owned loop's tool contract (same actions layer)

Activity log (quiz_results, node_status timestamps; exist)
    └──enables──> Streak, daily goal, retention stats, Atlas growth (Area 3)

Due-count endpoint (exists)
    └──enables──> Home "what next", due badge, plugin nudge, desktop notification, .ics (Area 3)

Learner UI prefs block (Area 4)
    └──enables──> Theme, accent, font, density, focus mode, voice choice
    └──shared-by──> Focus mode (Area 3) and layout position (Area 4)

Single method source (PROJECT active req.)
    └──enables──> Codex SKILL.md generation (Area 5) without a third copy

npm package with bin (Area 5)
    └──requires──> Bundling web/dist into the server package
    └──enables──> `npx derive`, `derive` CLI verbs, docs quickstart

plugin.json version bumps in the release workflow (Area 5)
    └──enables──> Marketplace updates reaching users

Per-lesson model switching ──conflicts──> Accurate cost attribution (Area 2)
Hard budget stop ──conflicts──> Understanding gate (Area 3)
Custom system prompt ──conflicts──> Method fidelity (constraint)
```

### Dependency Notes

- **Cost transparency requires the Derive-owned loop:** on the Claude SDK path cost arrives on the `result` message; on Codex it does not arrive at all. Only Derive's own loop sees provider usage fields per request, so Area 2 cannot land before Area 1.
- **Budgets require totals, totals require per-turn rows:** persist usage with the model id at the time of the turn; recomputing later from current prices is the Roo Code bug.
- **"Test teaching" requires the consolidated tool contract:** the smoke test exercises `quiz` and `node_status` through the same actions layer as a real lesson; if the contract is still written three times, the test proves the wrong thing.
- **Free-path quickstart requires local or free-tier providers:** the docs claim only becomes true after Ollama and Gemini/OpenRouter work end to end, including tool calling.
- **Codex `SKILL.md` requires the single method source:** otherwise the adoption phase adds the fourth copy the PROJECT decisions warn about.
- **Streak and retention stats require no new data:** `quiz_results`, `node_status` and FSRS fields already exist; these are read-side features and can ship in the learning-experience phase without schema work beyond a daily-goal setting.
- **Focus mode is one toggle used by two areas:** put it in the UI prefs block once.

## MVP Definition

### Launch With (v1 of this milestone)

- [ ] Settings page: Anthropic, OpenAI, Gemini keys; OpenAI-compatible base URL + key; Ollama/LM Studio/llama.cpp presets; model list with manual fallback; test connection; default model; env fallback; local 0600 auth store — the milestone's first key decision
- [ ] Derive-owned agent loop with the shared tool contract and a pluggable search provider — parity is the product
- [ ] Claude in-app via API key; Claude subscription via the plugin only — policy compliance
- [ ] Per-turn usage persisted with model and price; per-lesson total in the lesson header; tokens-only on subscription and local paths — pay-per-use learners need it on day one
- [ ] "Test teaching" smoke test on the settings page — the cheapest way to make parity visible
- [ ] Home leads with what to do next (review due / continue / new) and keyboard-first cards — least-effort learning
- [ ] Retention stats page: estimated knowledge, true vs desired retention, due forecast, calendar — honest progress from data that already exists
- [ ] Theme light/dark/system, font size and family (Atkinson Hyperlegible, Lexend, OpenDyslexic bundled), reduced motion, tone, voice picker, all per learner
- [ ] `npx derive` package, `derive doctor`, README first screen, marketplace.json + versioned plugin.json, Codex `SKILL.md` generated from the method source, CONTRIBUTING.md, docs quickstart with the free path

### Add After Validation (v1.x)

- [ ] Usage page with running totals and cost per node — once per-turn rows accumulate
- [ ] Soft monthly budget with pause at the turn boundary — once the usage page shows people care
- [ ] Forgiving streak and daily goal — after the "what next" flow has real use, so the goal unit is grounded
- [ ] Reminders: plugin nudge, desktop notification, `.ics` — after due counts are visible on Home
- [ ] Focus mode, density, graph panel position, accent palettes
- [ ] Copilot SDK and Gemini CLI (ACP) drivers — after the own loop is stable; each is a driver of its own
- [ ] Atlas coloured by stability with a month slider
- [ ] Docs site and landing page beyond the README; official-directory submissions; examples and recordings

### Future Consideration (v2+)

- [ ] Graph reuse across lessons (locked Atlas nodes as roots) — HIGH complexity method change; needs its own research
- [ ] Bounded "10-minute" sessions — depends on session-planning prompt work
- [ ] Recorded-lesson replay on the landing page — nice, not needed for adoption
- [ ] Parity suite badge in CI — after the parity suite exists
- [ ] Per-learner desired-retention slider — only if learners ask

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Settings page with keys, base URL, local presets, model list, test connection | HIGH | MEDIUM | P1 |
| Derive-owned loop with shared tool contract and search slot | HIGH | HIGH | P1 |
| API-key Claude in-app; subscription via plugin only | HIGH (risk removal) | LOW | P1 |
| Per-turn usage persisted; per-lesson cost | HIGH | MEDIUM | P1 |
| "Test teaching" smoke test | HIGH | MEDIUM | P1 |
| Home "what next" + keyboard-first cards | HIGH | MEDIUM | P1 |
| Retention stats page | HIGH | MEDIUM | P1 |
| Theme, font (incl. dyslexia options), size, reduced motion, tone, voice | MEDIUM | LOW | P1 |
| `npx derive`, CLI verbs, README first screen | HIGH | MEDIUM | P1 |
| marketplace.json + versioned plugin.json; Codex SKILL.md from one source | HIGH | LOW | P1 |
| CONTRIBUTING, templates, roadmap, free-path quickstart | MEDIUM | LOW | P1 |
| Usage page, cost per node | MEDIUM | LOW | P2 |
| Soft budget with pause | MEDIUM | MEDIUM | P2 |
| Forgiving streak, daily goal | MEDIUM | LOW | P2 |
| Reminders (nudge, desktop, .ics) | MEDIUM | MEDIUM | P2 |
| Focus mode, density, accent palettes, graph position | MEDIUM | MEDIUM | P2 |
| Copilot SDK driver | MEDIUM | HIGH | P2 |
| Gemini CLI ACP driver | LOW-MEDIUM | HIGH | P2 |
| Atlas growth over time | MEDIUM | MEDIUM | P2 |
| Docs site, landing page, directory submissions | HIGH | MEDIUM | P2 |
| Graph reuse across lessons | HIGH | HIGH | P3 |
| Bounded sessions | MEDIUM | MEDIUM | P3 |
| Lesson replay demo, parity badge | LOW | MEDIUM | P3 |

## Competitor Feature Analysis

| Feature | Coding/chat tools | Learning products | Our Approach |
|---------|-------------------|-------------------|--------------|
| Provider setup | Open WebUI: admin Connections, URL autosuggest, `/models` with allowlist fallback. Cherry Studio: key + check button, models added by hand. Zed: keychain keys, auto-discovered local models, favourites. OpenCode: `/connect`, `auth.json`, models.dev catalogue, OAuth for ChatGPT and Copilot | n/a | Open WebUI's form + Cherry's check + Zed's local discovery; OAuth only where sanctioned; keys in a 0600 file |
| Test connection | Cherry Studio, Obsidian Copilot, Open WebUI verify on save | n/a | "Test teaching": one tool-calling round trip |
| Cost display | Cline: header with cost, tokens, cache, context bar. Roo: per-message cost, Max Requests pause. Aider: per-message cost, `/tokens`. None ship a cross-task total | n/a | Per-turn, per-lesson, plus a usage page and cost per node they lack |
| What to do next | n/a | Math Academy: algorithm offers a short task list. Anki: Study Now. Duolingo: one button | Home offers review / continue / new, review first |
| Progress stats | n/a | Anki FSRS: true retention, retrievability, estimated knowledge, forecast, calendar. Math Academy: graph coloured by stability | Same numbers on Derive's data; Atlas coloured by stability |
| Streak / goal | n/a | Duolingo: daily, freezes, decoupled from goal. Khan: weekly. Math Academy: daily XP goal ~ minutes | Forgiving daily streak with a weekly freeze; goal in nodes/reviews |
| Reminders | n/a | Quantum Country: email. Duolingo: push, escalating | Badge, plugin nudge, desktop notification, .ics; no email, no escalation |
| Fonts / theme | Zed, Obsidian: font family and size, theme, accent | Kindle: OpenDyslexic option | Bundled Atkinson Hyperlegible, Lexend, OpenDyslexic; theme + accent + density per learner |
| Tone | ChatGPT base style + personality presets; Claude Styles | n/a | `tone` on top of existing `style`/`pace`/`language`; no free-text prompt |
| Distribution | OpenCode: curl/npm one-liner. Claude Code: marketplace.json + directories. Codex: `.agents/skills` + plugin marketplaces | n/a | `npx derive`, both marketplaces, skills directories |

## Sources

Confidence tiers from `classify-confidence`: web search cross-checked against official docs = MEDIUM; single community source = LOW.

Provider layer
- Open WebUI docs: connect-a-provider (OpenAI, OpenAI-compatible), direct connections — https://docs.openwebui.com/getting-started/quick-start/connect-a-provider/starting-with-openai-compatible/ (MEDIUM)
- Cherry Studio docs: model service settings, custom provider — https://docs.cherry-ai.com/docs/en-us/cherry-studio/preview/settings/providers (MEDIUM)
- LibreChat docs: custom endpoints, `fetch` — https://www.librechat.ai/docs/quick_start/custom_endpoints (MEDIUM)
- Zed docs: agent settings, LLM providers, local models — https://zed.dev/docs/ai/llm-providers , https://zed.dev/docs/ai/use-a-local-model (MEDIUM)
- OpenCode docs: providers — https://opencode.ai/docs/providers/ (MEDIUM, fetched)
- Obsidian Copilot docs: settings, local copilot — https://www.obsidiancopilot.com/en/docs/settings (MEDIUM)
- Cline docs: Claude Code provider — https://docs.cline.bot/provider-config/claude-code (MEDIUM)
- Gemini CLI ACP mode — https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/acp-mode.md (MEDIUM)
- GitHub Copilot SDK GA changelog — https://github.blog/changelog/2026-06-02-copilot-sdk-is-now-generally-available/ (MEDIUM)
- Anthropic subscription policy: The Register, 20 Feb 2026 — https://www.theregister.com/software/2026/02/20/anthropic-clarifies-ban-on-third-party-tool-access-to-claude/5014546 (MEDIUM; corroborated by OpenCode docs and secondary coverage; verify against Anthropic's legal page)
- Local tool-calling reliability (community tests) — https://theneuralbase.com/ollama/learn/intermediate/reliability-of-local-tool-calling/ , https://localaimaster.com/blog/best-ollama-models-tool-calling (LOW)

Cost transparency
- Cline docs: task management — https://docs.cline.bot/core-workflows/task-management (MEDIUM, fetched)
- Cline issue #4540 (usage analytics page) — https://github.com/cline/cline/issues/4540 (MEDIUM)
- Roo Code docs: rate limits and costs — https://roocodeinc.github.io/Roo-Code/advanced-usage/rate-limits-costs (MEDIUM, fetched)
- Roo Code issues #6822, #7755 (totals, multi-model breakdown) — https://github.com/RooCodeInc/Roo-Code/issues/6822 , https://github.com/RooCodeInc/Roo-Code/issues/7755 (MEDIUM)
- Aider issue #257 (session cost) — https://github.com/Aider-AI/aider/issues/257 (MEDIUM)
- LiteLLM cost map — https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json , https://docs.litellm.ai/docs/completion/token_usage (MEDIUM)
- OpenRouter usage accounting — https://openrouter.ai/docs/cookbook/administration/usage-accounting (MEDIUM)

Learning experience
- Math Academy: how it works — https://www.mathacademy.com/how-it-works (MEDIUM, fetched); Justin Skycak on the knowledge graph — https://www.justinmath.com/how-math-academy-creates-its-knowledge-graph/ (MEDIUM)
- Anki manual: statistics, studying — https://docs.ankiweb.net/stats.html , https://docs.ankiweb.net/studying.html (MEDIUM, fetched)
- Expertium, "Understanding retention in FSRS" — https://expertium.github.io/Retention.html (MEDIUM)
- Duolingo streak research (secondary write-ups of Duolingo's published findings) — https://www.thepmrepo.com/articles/how-duolingo-gamified-monthly-active-users-lessons-in-habit-formation , https://uxmag.com/articles/the-psychology-of-hot-streak-game-design-how-to-keep-players-coming-back-every-day-without-shame (LOW)
- Khan Academy streaks and levels — https://support.khanacademy.org/hc/en-us/community/posts/28945393485581-Update-Introducing-Streaks-and-Levels (MEDIUM)
- Orbit — https://github.com/andymatuschak/orbit (MEDIUM, fetched); Quantum Country retention notes — https://notes.andymatuschak.org/z93QR51f6HAUPLVDxE6KT1T (MEDIUM)
- MDN Notifications API; Chrome Notification Triggers status — https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API , https://developer.chrome.com/docs/web-platform/notification-triggers (MEDIUM)

Personalization
- Wery & Diliberto, OpenDyslexic study — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5629233/ (MEDIUM)
- Font comparisons (Lexend, Atkinson Hyperlegible, OpenDyslexic) — https://lexifont.com/blog/best-fonts-for-dyslexia-2026 , https://focusflowapp.in/blog/best-dyslexia-fonts-for-web (LOW)
- ChatGPT personality / Claude Styles — https://promptoptimizer.tools/blog/how-to-change-chatgpt-personality , https://www.ai-toolbox.co/claude-management-and-productivity/how-to-set-up-claude-custom-instructions-2026 (LOW)

Adoption
- Claude Code plugin marketplaces — https://code.claude.com/docs/en/plugin-marketplaces (MEDIUM, fetched); discover plugins — https://code.claude.com/docs/en/discover-plugins (MEDIUM)
- anthropics/claude-plugins-official and claude-plugins-community (submission at clau.de/plugin-directory-submission) — https://github.com/anthropics/claude-plugins-official , https://github.com/anthropics/claude-plugins-community (MEDIUM)
- Codex skills and plugins — https://learn.chatgpt.com/docs/build-skills (MEDIUM, fetched); community install guides — https://agentskillshub.dev/guides/codex-skills/ (LOW)
- README adoption audit — https://dev.to/mt211211/your-readme-is-a-landing-page-a-10-minute-adoption-audit-for-developer-tools-250f , https://github.com/ddbeck/readme-checklist (LOW)

---
*Feature research for: local-first, provider-agnostic AI tutor (Derive, milestone 2)*
*Researched: 2026-09-17*
