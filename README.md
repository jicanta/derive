<p align="center">
  <img src="docs/logo.svg" width="72" alt="Derive" />
</p>

<h1 align="center">Derive</h1>

<p align="center">
  <strong>Learn anything from first principles.</strong><br/>
  An AI tutor that finds the edge of what you know, draws the dependency map from unconditional truths to your goal,<br/>
  then teaches one node at a time and refuses to move on until each one locks.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#your-first-lesson">First lesson</a> ·
  <a href="#your-library">Library</a> ·
  <a href="#inside-claude-code">Inside Claude Code</a> ·
  <a href="#how-a-lesson-works">How a lesson works</a> ·
  <a href="#what-makes-it-smart">What makes it smart</a> ·
  <a href="#architecture">Architecture</a>
</p>

---

Most "AI tutors" are a chat box with a system prompt. They explain things well and you forget them in a week, because explanation is not the bottleneck. **Connection is.** A fact you can derive from things you already believe is a fact you keep. A fact you were merely told is a fact you lose.

Derive is built around that one idea. Every lesson is a **dependency graph**: a few unconditional truths at the roots, derived steps hanging off them, your goal at the top. The tutor cannot teach a node until its dependencies are locked, and cannot lock a node until you have passed a fresh question on it. You watch the graph light up as your understanding is actually built.

<p align="center">
  <img src="docs/screenshot-lesson.png" alt="A Derive lesson: the transcript with a quiz card, and the live dependency map lighting up on the right" width="960" />
</p>

It runs two ways, and they share one record:

- **The app.** A local web app with its own tutor, built on the Claude Agent SDK. Type a topic, get taught. Switch on voice mode and it talks you through it.
- **Inside Claude Code.** A plugin that adds `/derive:learn` and the teaching method to your terminal. Claude Code teaches; you answer the quizzes in the terminal or in the browser, and the browser renders the cards, the plan and the graph live, the way the original [learn](https://github.com/amosblomqvist/learn) tool mirrored a pi session into Obsidian.

Both run on your Claude subscription. No API key, no per-token bill, everything in a SQLite file on your machine. Several people can share one install: each learner has their own lessons, memory and review queue.

## Quick start

You need three things: **Node 22.5 or newer**, **pnpm** (run `corepack enable`, it ships with Node), and **[Claude Code](https://claude.com/claude-code)** installed and logged in. Derive runs on that login. There is no API key to paste and no per-token bill.

```bash
git clone https://github.com/jicanta/derive
cd derive
pnpm install
pnpm build
pnpm check         # checks Node, pnpm, the Claude Code login, the build, the port
pnpm start         # http://localhost:4310
```

`pnpm check` names anything missing and how to fix it. Hacking on it? `pnpm dev` runs the web app on :5173 with hot reload and the API on :4310, no build needed.

Optional settings live in a `.env` file in the repo root; copy [`.env.example`](.env.example) to start. Everything is stored in one SQLite file under `~/.derive`.

## Your first lesson

1. Open [http://localhost:4310](http://localhost:4310), type what you want to understand (*why does gradient descent work*, *what is a monad, really*), press Enter.
2. **Probe.** The tutor asks what you are after, then quizzes you until it finds where your understanding ends. Pick an option with `1` `2` `3`, confirm with `Enter`, or `Shift+Enter` if you are not sure. `?` is "I don't know". Wrong answers here are the point: they tell it where to start.
3. **Plan.** It shows the dependency map, ground truths at the bottom and your goal at the top. `Enter` approves it, or type one line of what should change.
4. **Teach.** One node at a time: you guess first, it explains, it checks with a fresh question, and the graph on the right lights up as nodes lock. When the goal locks you get the compressed version of the whole thing and a first review date.
5. Come back when the home page says nodes are due. A review asks a new question on each one; a miss is re-derived, not re-told.

Type in the box at any time to ask something, push back, or steer. Attach course material with the paperclip, or switch on *voice* in the header to be talked through it.

## Your library

The tutor teaches from what you keep. *Library* in the header is your shelf of articles, videos, books, papers, courses and plain notes, per learner, searchable, and in the tutor's context in every lesson.

**Adding things.** Paste a URL in the box at the top of the library and press Enter. The page is read once and its text kept, so nothing depends on the site staying up: an article's body, a paper's PDF (an arXiv abstract page fetches the PDF next to it), a YouTube video's title, channel and description. Add a sentence on why it is there and a few tags while you are at it. Type a title instead of a URL and it is a note. The kind (article, video, book, paper, course, note) is guessed from the URL and can be changed on the row; a page that could not be read is still saved as a link, with *fetch again* on hover.

**What the tutor does with it.** In every lesson it sees the entries relevant to the topic and the rules for using them:

- It searches the shelf before planning and, when an entry covers the lesson, reads it and borrows its framing and examples where they are good. The library is not a syllabus (attached course material is); the plan is still derived from first principles.
- When a node locks and an entry deepens it, or a source explains a step better than chat can, it points you there with a card in the lesson: which entry, why now, and where to look (a chapter, a section, a timestamp).
- When a web search turns up something worth keeping, it saves it to your shelf with a note on why, marked *saved by the tutor*. One or two per lesson, only sources it actually read.
- It says so when a saved source is wrong.

You can also just ask: *what do I have on this?*, *save that to my library*, *is there a video for this?* The same works from a Claude Code lesson, where the tutor gets the catalog from `start_lesson` and uses `search_library`, `read_resource`, `suggest_resource` and `add_resource`.

## Start from your course material

Preparing for a specific course? Attach its slides, a PDF or your notes (`.pdf`, `.pptx`, `.docx`, `.md`, `.txt`) under the topic box, or drop them on it. The lesson then prepares you for *that* course: the plan covers what the material covers, in its notation, the questions use its examples, and every node names the slides or pages it comes from. The method does not change. The tutor still derives every node from unconditional truths instead of walking you through the slides, and it says so when the material skips a step or gets something wrong.

Files are reduced to text on your machine at upload; nothing leaves it except what the tutor reads. Short material goes into the tutor's context whole. Longer material gets an outline, and the tutor reads pages or slides on demand (`read_material`, `search_material`) before planning and before teaching each node. You can attach more mid-lesson with the paperclip in the composer.

### Or from a codebase

A repository is a course too. Click *import a repo* and give it a folder on your machine, a GitHub URL (`https://github.com/owner/repo`, optionally `/tree/<branch>/<subdir>`) or any git URL; pasting one of those into the topic box does the same. Derive packs the readable files (README and docs first, then manifests, then source, tests last; `.gitignore` respected, lockfiles and binaries skipped) into one material with a directory outline. The tutor reads files by path as it plans and teaches, cites them (`see src/events.ts`), and treats the constraints the code cannot escape as the ground truths and the design decisions as the derived nodes. Ask it why the code had to be shaped this way, not just what it does. From the terminal, name the folder or the URL in the `/derive:learn` argument.

### Voice mode

Click *voice* in a lesson's header. The tutor's prose and every card are read aloud with the browser's speech engine, and when it stops talking the microphone opens for your reply. Say *B*, *the second one* or *I don't know* to answer a quiz (*probably B* answers it as unsure), *yes* to approve a plan, or anything longer to talk to the tutor. Explanations are read with a longer pause allowance so you can think between sentences. The tutor is told when voice is on and writes for the ear: shorter paragraphs, formulas said in words. Speech stays in the browser; Chrome has both engines, other browsers may only read aloud.

### Several learners

The name in the top right of the home page is who is learning. Add a learner, and they get their own lessons, library, Atlas, misconceptions, tutor notes and review queue; the tutor never mixes two people's memories. The choice is kept per browser. In the vault, the first learner's notes sit at the root and every other learner gets a folder. The plugin follows `DERIVE_LEARNER` or `--learner <name>` on the command.

### Settings

All optional. Put them in `.env` in the repo root (see [`.env.example`](.env.example)); `pnpm start`, `pnpm dev` and `pnpm check` read it.

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `4310` | The port for the app and the API |
| `DERIVE_MODEL` | your Claude Code default | Model override, e.g. `claude-opus-5` |
| `DERIVE_EFFORT` | `high` | Reasoning effort, `low` to `max` |
| `DERIVE_VAULT_DIR` | unset | Obsidian folder; every lesson is mirrored there live as it happens |
| `DERIVE_DATA_DIR` | `~/.derive` | Where the SQLite database lives |
| `DERIVE_LEARNER` | the first learner | Which learner profile the Claude Code plugin uses, by name |
| `DERIVE_ANSWER_IN` | `browser` | Where a Claude Code lesson is answered: `browser` or `terminal` |

## Inside Claude Code

The `plugin/` directory is a Claude Code plugin. It ships:

- **`/derive:learn <topic>`** and **`/derive:review`** commands
- the **`teach` skill**: the full method (below), written for Claude Code
- an **MCP server** exposing the tutor's tools: `quiz` (with a `purpose`: pretest, check, review), `ask`, `set_plan`, `node_status`, `explain_back`, `remember`, `learner_profile`, `learners`, `answer` / `answer_in` for terminal answers, `start_lesson` (also starts a review with `review: true`), `read_material` / `search_material` / `attach_material` for course material, and `search_library` / `read_resource` / `suggest_resource` / `add_resource` / `library` for the learner's library
- **hooks** that mirror every terminal turn into the lesson log, so the browser companion shows the prose, the cards and the graph as one record

Three steps, from the derive folder:

```bash
pnpm build                      # once; the plugin points at server/dist/mcp.js
pnpm start                      # keep this running in one terminal
claude --plugin-dir ./plugin    # in another terminal, from any project
```

Then, inside Claude Code:

```
> /derive:learn why does gradient descent work
> /derive:learn Fourier series, from ~/uni/signals/week3.pdf and week3-slides.pptx
> /derive:learn how does this codebase handle auth, from ~/code/api --terminal
> /derive:learn the event loop in https://github.com/owner/repo --learner Ana
> /derive:review
```

Name files, a folder, a repository or a GitHub URL in the argument and Claude Code attaches them to Derive as the lesson's course material. The plugin talks to the server on `http://localhost:4310`; if you changed `PORT`, change `DERIVE_URL` in `plugin/.mcp.json` to match.

<p align="center">
  <img src="docs/screenshot-companion.png" alt="Companion mode: Claude Code in the terminal, Derive rendering the quiz and graph in the browser" width="960" />
</p>

Claude Code runs the lesson in your terminal, and you choose where to answer:

- **In the browser** (the default). When Claude asks a graded question, the tool call blocks, the card appears in the browser, you answer there, and the answer flows back into the terminal conversation.
- **In the terminal** (`--terminal`, or `DERIVE_ANSWER_IN=terminal`). The card is printed in the conversation with its options lettered; you reply `B`, `2`, `?`, `a and c`, or a whole sentence if you would rather talk back. Claude hands your reply to Derive's `answer` tool, the server grades it, and only then does the explanation come back. The browser still shows the card live, and answering there works too: the result is picked up on your next message. Say "let me answer here" mid-lesson to switch.

Either way the model never grades its own question. The graph on the right lights up as nodes lock, and everything you learn this way lands in the same Atlas and the same review queue as app lessons.

To wire only the MCP server without the plugin:

```bash
claude mcp add derive -- node /absolute/path/to/derive/server/dist/mcp.js
```

## Troubleshooting

`pnpm check` catches most of these. Otherwise:

- **`pnpm start` fails with a module error about `node:sqlite`.** Your Node is older than 22.5. `node --version`, then upgrade.
- **The page loads but the first lesson errors out at once.** Claude Code is not logged in, or not on your PATH for the process running the server. Run `claude auth status` in the same terminal; if it says logged out, run `claude` and log in.
- **`/derive:learn` says the server is not running.** Start `pnpm start` in the derive folder and keep it open. If you set a different `PORT`, update `DERIVE_URL` in `plugin/.mcp.json`.
- **"port 4310 is in use".** Something else has it. Set `PORT` in `.env`, or stop the other program.
- **A link in the library shows "not fetched".** The site refused the request, needs a login, or is JavaScript-only. The link is saved anyway; hover the row and click *fetch again*, or add a note so the tutor knows what it is. The tutor can still open the URL itself while teaching.
- **The tutor never mentions my library.** It only sees the current learner's shelf (top right), and it suggests entries when they fit a node, not as a list. Ask it directly: *what do I have on this?*
- **Voice mode only reads aloud and never listens.** Dictation needs Chrome; other browsers ship the speech engine but not recognition.
- **A lesson is stuck on "thinking".** Press *stop* in the composer, then type to continue; nothing written so far is lost. Restarting the server closes stale turns too.

## How a lesson works

```mermaid
flowchart LR
  A[Probe] --> B[Plan] --> C[Teach] --> D{Quiz}
  D -->|pass| E[Lock]
  D -->|miss| C
  E -->|next node| C
  E -->|goal locked| G[The click]
```

1. **Probe.** The tutor asks what you actually want (an open question), then quizzes you, adapting each question to the last answer, until it can say concretely what you have and where it ends. All-correct means the questions were too easy; it escalates.
2. **Plan.** It writes a short paragraph on the approach and submits the dependency map. You approve it or send it back with one line of feedback.
3. **Teach.** For every node: motivate it, make you *attempt* it before it is explained (a pretest, where a miss is expected and never counts against you), establish it from its dependencies, connect it explicitly, then check it with a different question. You say how sure you are before the reveal. A miss gets a hint and a fresh question before any re-derivation; a confident miss gets the belief you held named and taken apart. Miss twice and the node goes shaky and the tutor backs up to what it depends on.
4. **Review.** Locked nodes come back when due, mixed across topics, with a new question each time. A miss is re-derived from the node's dependencies, not re-told.

## What makes it smart

- **Honest grading.** Quizzes are a real tool, not a chat convention. The server grades your pick and reveals the explanation only afterwards. The model never grades its own questions and never sees your answer before the card is scored.
- **Try before you are told.** Every derived node opens with a pretest: your best guess, from what is already locked, before the explanation. A real attempt before instruction is one of the best-replicated effects in memory research, and a miss there is expected, so it is never stored as a misconception.
- **You commit to how sure you are.** *Answer* or *Not sure* (Enter or Shift+Enter; `B?` in the terminal; "probably B" by voice). An unsure pass does not lock a node: the tutor asks for the why. A confident miss is a held belief, and the moment it can be replaced: the tutor names the claim you held and what breaks it, instead of restating the answer.
- **Hints before answers.** On a miss the tutor points at the node the claim rests on and asks a fresh question. Only a second miss earns a step-by-step re-derivation. Answers are never handed over.
- **A learner it remembers.** Every lesson starts with what Derive already knows about you: nodes locked in earlier topics, nodes that went shaky, misconceptions caught (the exact wrong claim you picked), and notes the tutor chose to keep. It builds on your floors and probes your ceilings first.
- **Misconception tracking.** A wrong answer is stored as the claim you chose versus the claim that was right. It stays open until you lock the node it belongs to, and it shows up in the Atlas.
- **Teach-back.** At least once per lesson, and after every pass you flagged as unsure, the tutor asks you to explain the node in your own words or say why it must be true, writing its rubric before it reads your answer.
- **Cross-lesson Atlas.** All your nodes across all lessons on one canvas. The same truth appearing in two topics is drawn as a shared root. Due and shaky nodes are highlighted; review starts from there.
- **Spaced repetition on nodes, not flashcards.** Each node is scheduled with FSRS, the scheduler behind modern Anki, from how the check went: a confident pass stretches the interval, an unsure pass barely moves it, a miss resets it. Reviews interleave topics, and a miss is re-derived from the node's dependencies, which come along into the session.
- **Verified facts.** The tutor is instructed to web-search anything it is even slightly unsure of before teaching it, and to say so if a check changed what it was about to say.
- **Your course, not the topic in general.** Attach slides, a PDF or notes and the plan is scoped to what that course covers, in its notation, with every node citing the slides or pages it rests on. The tutor reads the material page by page as it plans and teaches, and pushes back when the slides skip a step.
- **A library it reads and adds to.** Your shelf of links, videos, papers, books and notes is in every lesson's context. The tutor searches it, reads the entry that covers the topic, points you to the right chapter or timestamp when a node locks, and saves the sources it found on the web there for you, with a note on why.
- **A codebase as a course.** Import a repo (a folder, a GitHub URL, a git URL) and the tutor reads it file by file, cites paths, treats the invariants as ground truths and the design decisions as derived nodes, and quizzes you on what a change would break.
- **Voice.** The tutor is read aloud and listens for your reply, so a Socratic exchange can happen away from the keyboard. Quiz options are picked by letter, plans approved with a word.
- **One install, several learners.** Each learner has their own lessons, memory, misconceptions, Atlas and review queue. The tutor is told whose lesson it is and builds only on that person's floors.
- **Renders properly.** KaTeX math, Mermaid diagrams, and inline SVG for geometry, all streaming. Export any lesson as an Obsidian note with callouts, or point `DERIVE_VAULT_DIR` at your vault and every lesson is written there live, paragraph by paragraph, while it happens.
- **Keyboard first.** `1` `2` `3` pick an option, `Enter` answers or approves the plan, `Shift+Enter` answers as unsure, `?` is "I don't know". In the terminal, `B` answers, `B?` answers as unsure. A lesson never needs the mouse; from the terminal it never needs the browser.

## Why this works

Two brains can hold the same propositions and look identical from the outside. One holds a pile of disconnected facts. The other holds a few core truths from which those facts are derivable. Only the second one *understands*, and only the second one retains.

The brain will not fully commit to a fact it is not sure is safe to lock in. If something more fundamental might later contradict it, committing is risky, so it hedges and the fact never lands. Two moves remove that risk:

- **Unconditional truths first.** Facts with no caveats commit instantly and give solid ground to build on.
- **Make it feel discovered, not decreed.** A fact with a visible reason it *had* to be this way stops feeling arbitrary, and arbitrary-feeling facts are the ones that rot.

### The evidence

Two randomized trials from 2025 say the same thing from opposite directions: an AI tutor beats even the best classroom teaching, but only if it is built to make you derive instead of copy.

- **[Kestin et al., *Scientific Reports* 2025](https://www.nature.com/articles/s41598-025-97652-6).** About 180 Harvard physics students alternated weekly between best-practice active-learning classes and a purpose-built AI tutor at home. The AI condition learned more than twice as much in less time, with large effect sizes. The tutor kept replies short, revealed one step at a time, never gave the full solution, and made the student try first.
- **[Bastani et al., *PNAS* 2025](https://www.pnas.org/doi/10.1073/pnas.2422633122).** Nearly 1,000 high-school math students got no AI, plain GPT-4 chat, or a tutor version that gave hints and withheld answers. Plain chat looked great in practice (48% better) and then scored 17% *worse* than no-AI on the closed-book exam. The guarded tutor was 127% better in practice with no exam penalty.

Derive is the second design, pushed further: no node is taught before its dependencies, nothing is locked without a fresh question, and a miss is answered by re-deriving, not by handing over the answer.

The mechanics inside a lesson borrow from the memory literature directly:

- **Pretesting.** Attempting a question before the material is taught improves later recall by 12 to 16 points over reading alone, with immediate feedback best but the effect surviving a day's delay ([Pan & Sana and successors; 2025 replication](https://pmc.ncbi.nlm.nih.gov/articles/PMC12292081/)). Derive's per-node pretest is that attempt, and the explanation you wrote is the feedback.
- **Confidence and hypercorrection.** Errors made with high confidence are the easiest to correct once feedback arrives, and asking learners to rate confidence before feedback is what makes retrieval practice improve their own judgment of what they know ([Butterfield & Metcalfe; overview](https://www.improvewithmetacognition.com/hypercorrection-overcoming-overconfidence-metacognition/)). Hence *Answer* versus *Not sure*.
- **Self-explanation.** Prompting learners to explain why something is true has a mean effect of g = 0.55 across 64 studies ([Bisra et al. 2018](https://link.springer.com/article/10.1007/s10648-018-9434-x)); explaining one's own state of knowledge does not help, which is why confidence is a tap and the teach-back is about the claim.
- **Spacing, retrieval and interleaving.** The two techniques with the strongest evidence across 242 studies are practice testing and distributed practice ([Hattie & Donoghue 2021, replicating Dunlosky et al. 2013](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2021.581216/full)), and interleaving problems from different topics beats blocking them. Review sessions mix topics and test with a fresh question; intervals come from [FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/abc-of-fsrs), which reaches the same retention with 20 to 30 percent fewer reviews than fixed-multiplier schedules.
- **Hints, not answers; one step at a time.** In the 2025 UK classroom RCT with a pedagogy-tuned model, interactive Socratic support beat static hints on the next attempt (93 versus 65 percent) and transferred to new problems, and the most common human correction was slowing the tutor's pacing ([Jurenka et al. 2025](https://arxiv.org/abs/2512.23633)). Kestin's tutor kept replies to a few sentences and revealed one step at a time. Derive's miss handling is a hint ladder, and the teach loop reveals one step per check.
- **Faded guidance.** Worked examples help novices and hurt learners past them (the expertise-reversal effect), so the tutor works the first example on strands you missed in the probe and skips it on strands you already hold.

The method comes from [amosblomqvist/learn](https://github.com/amosblomqvist/learn) and the talk [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU). Derive turns that terminal workflow into a product and keeps the terminal.

## Architecture

```
derive/
├── server/   Node 22 · Hono · node:sqlite · Claude Agent SDK · MCP stdio server
├── web/      Vite · React 19 · Tailwind 4 · React Flow · KaTeX · Mermaid
├── plugin/   Claude Code plugin: commands, teach skill, hooks, .mcp.json
└── design/   Claude Design canvas the UI was built from
```

- **One set of tutor actions, two drivers.** `server/src/actions.ts` implements `quiz`, `ask`, `set_plan`, `node_status`, `explain_back`, `remember`, `read_material`, `search_material` and the library actions (`search_library`, `read_resource`, `suggest_resource`, `add_resource`). The in-process agent calls them through an SDK MCP server; a Claude Code session calls them through the HTTP API via `server/src/mcp.ts`.
- **Course material is text, segmented.** `server/src/materials.ts` reduces a PDF (via `unpdf`), a PPTX or DOCX (unzipped, XML runs joined per slide or paragraph, speaker notes included) or Markdown to a list of segments in SQLite. `server/src/repo.ts` does the same for a repository: one segment per file, from `git ls-files` for a local checkout, from the tarball for a GitHub URL (no git needed), from a shallow clone otherwise. The tutor's system prompt carries the full text when it is short and an outline otherwise; the material tools address segments by page, slide or file path.
- **The library is fetched text, per learner.** `server/src/library.ts` normalises a URL, guesses its kind, fetches it (HTML through a readability pass that drops navigation and sidebars, PDFs through `unpdf`, arXiv abstracts through their PDF, YouTube and Vimeo through oEmbed plus the description) and stores the text in segments. The tutor's system prompt carries the entries relevant to the topic; the tools search across titles, tags, notes and text.
- **Tools block on you, or hold for you.** A `quiz` call emits a card to the browser and waits until you answer. The server grades it, records it, and only then returns to the model. In a terminal-answered lesson the same call opens the card as *held*, returns it as text, and the model's `answer` call settles it with your reply; a held card survives the end of a turn, and a browser answer to it is delivered on the next prompt by the hook. Grading never moves to the model.
- **Voice is a browser feature.** `web/src/lib/voice.ts` wraps `speechSynthesis` and `SpeechRecognition`; `useVoiceMode` reads new prose and cards as they land and opens the microphone when the tutor goes quiet. The server only hears that voice is on, so the tutor can write for the ear.
- **Learners are a column.** Every lesson belongs to a learner; memory, misconceptions, nodes and the review queue are joined through it. The web app sends its selected learner in a header, the plugin by name; an install starts with one learner named after your OS user, and old lessons belong to it.
- **Event-sourced lessons.** Every turn is a stream of typed events appended to SQLite and fanned out over Server-Sent Events. The UI is a reducer over that stream, so reloads, reconnects, the Obsidian export and the terminal mirror all replay the same log.
- **Conversation continuity** uses Agent SDK session resume: one SDK session per lesson, resumed on every turn.
- **The mirror hook** (`plugin/hooks/mirror.mjs`) reads the Claude Code transcript on each turn and posts new prose to the active lesson, tracking what it has already sent per session.

## License

MIT
