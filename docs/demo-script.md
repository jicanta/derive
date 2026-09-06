# Derive in two minutes: demo script

A shot list for the application video. Voice-over lines are suggestions; say them your way. Total runtime 2:00. Record everything in one sitting, then cut: a real lesson takes 8 to 12 minutes and the video shows about 70 seconds of it.

## Setup, before recording

```bash
# 1. Fresh data so the app looks lived-in but not cluttered
export DERIVE_DATA_DIR=~/derive-demo
pnpm build && pnpm demo:seed          # three past lessons, one shaky node, one open misconception, reviews due
pnpm start                            # http://localhost:4310

# 2. In a second terminal, for the companion shot
claude --plugin-dir ~/derive/plugin
```

- Browser at 1440 x 900, one tab, no bookmarks bar, 100% zoom. Dark OS theme.
- Terminal at the same height, 16 px font, dark theme, next to the browser for the companion shot.
- Topic to use: **Why does gradient descent work?** It renders math and inline SVG, and the tutor's plan for it is nine nodes deep. When the probe asks which step size maximizes the guaranteed decrease, pick **2/L** (wrong on purpose). Later, when asked what happens at η = 1.9/L, pick "decreases by more per step" (also wrong). Those two misses are the best 15 seconds of the video.
- Keyboard: `1` `2` `3` pick, `Enter` answers, `?` is "I don't know", `Enter` approves the plan. No mouse hunting on camera.

## Shot list

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:12 | Home page. Cursor in the input. Type the topic slowly. | Most AI tutors are a chat box. They explain well, and you forget it in a week, because explanation was never the bottleneck. Connection is. I built Derive to teach the way understanding actually forms. |
| 0:12–0:30 | Probe. Two quiz cards answered with the keyboard, the third answered wrong (2/L). The "Not quite" reveal and explanation. | It does not start teaching. It probes, escalating until something breaks, so it knows exactly where my understanding ends. That miss is the point: I had memorized a number without knowing where it came from. |
| 0:30–0:45 | Plan card slides in. Graph draws on the right. Press Enter to approve. | Then it draws the map. Unconditional truths at the roots, my goal at the top, every step hanging off what it depends on. I approve it before anything is taught. |
| 0:45–1:15 | Teach. One node with the derivation and the SVG figure. Quiz, correct, the node turns gold in the graph. Then the second deliberate miss, the re-teach, the second question, the lock. | One node at a time. It cannot teach a node until its dependencies are locked, and it cannot lock a node until I pass a fresh question on it. Grading is not a chat convention: the question is a tool call, the server grades my pick, and the model never sees my answer before the verdict. Miss twice and it backs up to what the node rests on. |
| 1:15–1:35 | Cut to the terminal: `/derive:learn how does TCP make an unreliable network reliable`. Claude Code writes, a quiz card appears in the browser beside it, answer it there, the answer flows back into the terminal. | It is also a Claude Code plugin. Claude Code teaches in my terminal; the browser renders the cards and the graph. Same record, same atlas. |
| 1:35–1:50 | Atlas. Pan across three lessons. The shared root drawn between two of them. The due list and the open misconception in the panel. | Everything I have ever derived lands in one atlas. The same truth in two topics is drawn as a shared root. Misconceptions are stored as the exact wrong claim I picked, and every node comes back when it is due, with a new question each time. |
| 1:50–2:00 | Back on the lesson: the receipt card ("The click"). Then the README on GitHub. | It runs on your Claude subscription, everything in a SQLite file on your machine. Open source. I'm Ignacio, and this is Derive. |

## Cuts that keep it honest

- Do not speed up the model's writing more than 3x. Real streaming reads as real. Cut the waits between tool calls instead.
- Keep the wrong answers in. A tutor that only ever says "correct" looks fake.
- The graph lighting up is the single most legible moment. Make sure the right panel is on screen every time a node locks.
- If a step takes longer than 30 seconds to arrive, cut to the terminal or the atlas and come back.

## Recording the companion shot

Start the app lesson first and get it to the teach phase, then open the terminal and run `/derive:learn`. The plugin creates its own lesson; the browser tab for it opens automatically. You want one frame where the terminal shows the tool call blocking ("Quiz") and the browser shows the card, then your answer appearing in the terminal transcript.

## Resetting between takes

```bash
rm -rf ~/derive-demo && pnpm demo:seed
```
