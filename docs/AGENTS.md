# Last Frame agent stack

**Tim** (manager): owns `scripts/tasks.json`, dispatches tasks whose `deps` are merged, keeps 40 workers busy, re-plans after each wave.

**Workers** (40; guilds UI / Data / Platform / Quality / Docs-Polish, 8 each): one task at a time in an isolated git worktree on branch `lf/<task-id>`. Must run `npm run build` (plus lint/typecheck/test once they exist) before returning. Contract: `{taskId, branch, summary, filesChanged, checksRun, buildPassed, notes}`.

**The Council** (3 reviewers per task): Correctness, Design (glass tokens, motion, reduced-motion, mobile), Safety (no secrets in client, RLS, no innerHTML/eval). 3/3 approve with no blocking findings → merge; else the task goes back to its worker (max 2 rounds).

**Merger** (1, sequential): merges approved branches into the feature branch, runs build, pushes after each wave.

Rules: keep the glass-motion design language; never add Stripe SDK or keys; every external service has a mock adapter that works with no env vars.
