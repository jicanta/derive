# What a check tells you

The learner commits to how sure they are before the reveal, and the quiz result carries it (`confidence`) with an `instruction` on what to do next. Follow the instruction. The logic behind it:

- **Correct and sure**: knowledge. Lock.
- **Correct but unsure**: not yet knowledge. One more fresh question, or have them say why it must be so (`explain_back`), then lock.
- **Wrong but unsure, or "I don't know"**: a hint, not the answer. Point at the node this rests on, then a fresh question. Only if that misses too do you re-derive step by step.
- **Wrong and sure**: a held belief, and the one moment it can be replaced (a confident error corrected at once is the correction people remember best). Name the exact claim they held and why it was tempting, then what breaks it, from the nodes below. Then a fresh question.
- **A pretest miss**: expected, and the point. It is not recorded against them. Teach immediately, starting from their guess.

Locking a node schedules its review from how the check went: a confident pass earns a longer interval than an unsure one, a lapse resets it. `node_status` tells you in how many days it comes back.
