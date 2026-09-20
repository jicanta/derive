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
  <a href="#the-math-academy-way-inside-derive">The Math Academy way</a> ·
  <a href="#your-library">Library</a> ·
  <a href="#how-you-learn">How you learn</a> ·
  <a href="#inside-claude-code">Inside Claude Code</a> ·
  <a href="#what-makes-it-smart">What makes it smart</a>
</p>

<p align="center">
  <a href="https://github.com/jicanta/derive/actions/workflows/ci.yml"><img src="https://github.com/jicanta/derive/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
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
pnpm start         # prints a http://localhost:4310/?token=… link — open it once; that browser stays signed in for 30 days
```

`pnpm check` names anything missing and how to fix it. Hacking on it? `pnpm dev` runs the web app on :5173 with hot reload and the API on :4310, no build needed.

Optional settings live in a `.env` file in the repo root; copy [`.env.example`](.env.example) to start. Everything is stored in one SQLite file under `~/.derive`.

## Your first lesson

1. Open the `http://localhost:4310/?token=…` link `pnpm start` printed — the token drops out of the address bar and a cookie keeps that browser signed in for 30 days; to sign in again, or in another browser, open the same link, which is printed every time the server starts — then type what you want to understand (*why does gradient descent work*, *what is a monad, really*), press Enter.
2. **Warm-up.** If nodes from earlier lessons are due, the ones you are most likely to have forgotten come first: a fresh question each, before anything new. A miss sends the node back to the review queue; it is not re-taught here.
3. **Probe.** The tutor asks what you are after, then quizzes you until it finds where your understanding ends. Pick an option with `1` `2` `3`, confirm with `Enter`, or `Shift+Enter` if you are not sure. `?` is "I don't know". Wrong answers here are the point: they tell it where to start.
4. **Plan.** It shows the dependency map, ground truths at the bottom and your goal at the top. `Enter` approves it, or type one line of what should change.
5. **Teach.** One node at a time: you guess first, it explains, it checks with a fresh question, and the graph on the right lights up as nodes lock. A node does not lock on the steps alone: you also have to pass a question on *why* it must be so, or use it on a kind of problem the lesson never showed.
6. **Cumulative quiz.** When the goal locks, every node comes back once more in a mixed order, most of them as problems you have not seen. Only when all of them hold do you get the compressed version of the whole thing and a first review date.
7. Come back when the home page says nodes are due. A review asks a new question on each one; a miss is re-derived, not re-told.

Type in the box at any time to ask something, push back, or steer. Attach course material with the paperclip, or switch on *voice* in the header to be talked through it.

## The Math Academy way, inside Derive

Derive's teaching discipline follows [Justin Skycak](https://www.justinmath.com)'s **[The Math Academy Way](https://www.justinmath.com/files/the-math-academy-way.pdf)**, the book behind [Math Academy](https://www.mathacademy.com): a knowledge graph, mastery learning at the edge of what you know, tiny scaffolded steps, spaced repetition with credit that flows through the graph, interleaved review, and remediation aimed at the exact prerequisite that failed. Derive keeps its derivation-graph essence and adds these mechanics on top, one per rule:

| Skycak's principle | What Derive does |
|---|---|
| **Knowledge frontier.** Only ever teach a topic whose prerequisites are mastered; never assume one. | The probe finds a floor and a ceiling on every strand the lesson rests on, prerequisites included, and the plan starts at the bottom of the lowest hole. A pass on a claim counts as evidence for what it rests on; a miss, against everything above it. |
| **Mastery learning.** Prove proficiency before advancing; never lower the bar, add scaffolding instead. | Every quiz says what it tests: `intuition` (why it must be so), `procedure` (the steps) or `transfer` (a kind of problem the lesson never showed). The server refuses to lock a derived node until an intuition or transfer question on it has passed. Steps alone never lock anything. |
| **Minimal cognitive load, explicit instruction.** One idea per step, worked example then problems, fade the scaffolding. | One node at a time, a pretest attempt then the explanation, a worked example on strands the probe showed were weak and a bare problem on strands it showed were solid. |
| **Layering.** Build on a skill the moment it is mastered; building on it is the best rehearsal of it. | Nodes are taught in dependency order, and locking a node credits the nodes it was derived from with part of a review. |
| **Fractional implicit repetition (FIRe).** Practising an advanced topic is partial practice of its prerequisites; a failure below makes everything above suspect. | A confident lock gives its direct dependencies half of a review's credit and their dependencies a quarter, discounted the way an early review is: a claim locked minutes ago gains almost nothing, a claim from a lesson weeks ago gains most of it. A node going shaky pulls the review of everything built directly on it closer. Reviews propagate to the original nodes across lessons. |
| **Spaced repetition on the forgetting curve.** Review when memory is fuzzy, not when it is fresh. | FSRS schedules every node. A new lesson opens with a warm-up of the due nodes you are most likely to have forgotten (lowest retrievability first, topics interleaved), retrieved before anything new is taught. |
| **Interleaving and non-interference.** Block while learning, mix while reviewing; keep confusable things apart. | The teach loop is blocked; the cumulative quiz and every review mix the order and the framing, and the tutor is told not to teach two confusable claims back to back. |
| **Quizzes over everything learned.** Frequent, unscaffolded, covering all topics, with every miss triggering remediation. | Locking the goal opens the cumulative quiz: one fresh question per node, at least half transfer, mixed order. A miss marks the node shaky on the spot and reschedules it. |
| **Targeted remediation.** On repeated failure, review the key prerequisites of the exact sticking point. | Marking a node shaky returns the nodes it rests on with the record of every check on each; the tutor re-checks the weakest one first and re-derives from there instead of explaining the same thing again. |
| **Intuition and transfer, not pattern-matching.** You cannot teach jumping further, only build bridges to jump from. | Most checks are intuition questions, geometric where geometry applies, and transfer questions are how the tutor finds out whether you can only solve what you have seen. |

Credit where it is due: the mechanics in this section are Skycak's, described in the book and in his [writing on the Math Academy blog](https://www.justinmath.com/); Derive is an independent open-source project that adopts them and is not affiliated with Math Academy. Read the book; it is free.

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

## How you learn

The method this comes from was written for one person. Derive has many, so each learner writes their own version. *How you learn* (in the header, or from the learner menu) is a page the tutor reads before every lesson:

- **Language.** Be taught in Spanish, Portuguese, whatever you write in. Prose, quiz options, the plan, the cards.
- **Style.** Adaptive, Socratic (questions first, the click is yours) or narrated (told cleanly, then tested).
- **Pace.** Brisk, standard or thorough.
- **Background, how you learn, examples from.** Free text, in your words: what you already hold, what works for you and what does not, and the domains to pull analogies from.

The method does not bend to any of it: it still probes, still makes you try first, still checks every node and hints before re-deriving. The delivery does. You can also just tell the tutor mid-lesson (*en español por favor*, *stop quizzing me through every step, just explain it*, *I'm a musician, use music*) and it saves it for next time. The page also shows the notes the tutor kept about you; what you write wins over them.

## Settings

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
- the **`teach` skill**: the full method, written for Claude Code
- an **MCP server** with the tutor's tools: the cards (`quiz`, `ask`, `set_plan`, `explain_back`), the graph, the learner's memory and preferences, course material, and the library
- **hooks** that mirror every terminal turn into the lesson log, so the browser shows the prose, the cards and the graph as one record

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

The dependency graph is still the whole idea: ground truths at the roots, derived claims hanging off what they rest on, your goal at the top, nothing taught before its dependencies and nothing locked without a fresh question. The Math Academy mechanics sit on top of that loop; they do not replace it.

1. **Warm-up.** If nodes from earlier lessons are due, the ones you are most likely to have forgotten come first, one fresh question each, before anything new. A lock reschedules the original; a miss sends it back to the review queue.
2. **Probe.** The tutor asks what you actually want (an open question), then quizzes you, adapting each question to the last answer, until it can say concretely what you have and where it ends. Every strand the lesson rests on gets a floor and a ceiling; no prerequisite is assumed. All-correct means the questions were too easy; it escalates.
3. **Plan.** It writes a short paragraph on the approach and submits the dependency map, starting from the lowest hole the probe found. You approve it or send it back with one line of feedback.
4. **Teach.** For every node: motivate it, make you *attempt* it before it is explained (a pretest, where a miss is expected and never counts against you), establish it from its dependencies, connect it explicitly, then check it with a different question. Each check says what it tests: intuition, procedure or transfer, and a derived node locks only once an intuition or transfer question has passed. You say how sure you are before the reveal. A miss gets a hint and a fresh question before any re-derivation; a confident miss gets the belief you held named and taken apart. Miss twice and the node goes shaky and the tutor re-checks the weakest of the nodes it depends on before re-deriving.
5. **Cumulative quiz.** When the goal locks, every node comes back once in a mixed order, mostly as problems the lesson never showed. A miss marks the node shaky and triggers the same targeted remediation. The closing comes only when everything has held.
6. **Review.** Locked nodes come back when due, mixed across topics, with a new question each time. A miss is re-derived from the node's dependencies, not re-told. Locking a node built on others counts as part of a review of them.

## What makes it smart

- **Honest grading.** Quizzes are a real tool, not a chat convention. The server grades your pick and reveals the explanation only afterwards. The model never grades its own questions and never sees your answer before the card is scored.
- **Understanding is the lock.** Each question says whether it tests intuition, procedure or transfer, and a derived node cannot lock on procedure alone: the server refuses until you have passed a question on why the claim must be so or on a kind of problem the lesson never showed. Memorizing the steps gets you nowhere.
- **Review first, on the forgetting curve.** A new lesson opens by retrieving the due nodes you are most likely to have forgotten, so old material is refreshed before new material is stacked on it.
- **A cumulative quiz closes every lesson.** When the goal locks, every node comes back once, in a mixed order, mostly as transfer questions. A miss marks it shaky and sends the tutor to the prerequisite that failed.
- **Credit flows through the graph.** Locking a node counts as part of a review of what it was derived from (Skycak's fractional implicit repetition), and a node going shaky brings the review of what was built on it closer.
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
- **Taught your way.** Each learner tells the tutor, once, how they learn: the language, how Socratic, how long, their background, where to take examples from. The method stays fixed; the delivery follows it, and a request made mid-lesson is kept for the next one.
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

The method comes from [amosblomqvist/learn](https://github.com/amosblomqvist/learn) and the talk [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU); the discipline around it (mastery, the knowledge frontier, implicit repetition, interleaving, targeted remediation, the cumulative quiz) is Justin Skycak's, from [The Math Academy Way](https://www.justinmath.com/files/the-math-academy-way.pdf). Derive turns that terminal workflow into a product, keeps the terminal, and holds itself to Skycak's bar.

## Development

```bash
pnpm dev          # web on :5173 with hot reload, API on :4310
pnpm typecheck    # both packages
pnpm test         # the server's tests: scheduling, terminal replies, and the API driven end to end without a model
pnpm build
```

CI runs typecheck, build and the tests on every push and pull request ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Pushing a tag `vX.Y.Z` builds a release with the plugin and the built server attached ([`.github/workflows/release.yml`](.github/workflows/release.yml)).

## License

MIT
