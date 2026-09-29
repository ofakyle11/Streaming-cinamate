# Last Frame agent stack

**Tim** (manager): owns `scripts/tasks.json`, dispatches tasks whose `deps` are merged, keeps 40 workers busy, re-plans after each wave.

**Workers** (40; guilds UI / Data / Platform / Quality / Docs-Polish, 8 each): one task at a time in an isolated git worktree on branch `lf/<task-id>`. Must run `npm run build` (plus lint/typecheck/test once they exist) before returning. Contract: `{taskId, branch, summary, filesChanged, checksRun, buildPassed, notes}`.

**The Council** (3 reviewers per task): Correctness, Design (glass tokens, motion, reduced-motion, mobile), Safety (no secrets in client, RLS, no innerHTML/eval). 3/3 approve with no blocking findings → merge; else the task goes back to its worker (max 2 rounds).

**Merger** (1, sequential): merges approved branches into the feature branch, runs build, pushes after each wave.

Rules: keep the glass-motion design language; never add Stripe SDK or keys; every external service has a mock adapter that works with no env vars.

## Task log — Quality & Polish stream

Branch: `lf-stream/polish`. Each task was built on `lf/<task-id>`, reviewed and merged in
order.

| Task        | Summary                                                                                                                                                                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `w3-brand`  | LF glass monogram `LogoMark` (`src/components/brand/`), Navbar brand mark, `favicon.svg`, `mask-icon.svg`, `icons/icon.svg`, PNG fallbacks through `scripts/generate-icons.mjs`, `theme-color` `#0b0b12`.                                                                          |
| `w3-errors` | In-layout `ErrorBoundary` plus router `RouteError` with a glass `ErrorCard` and retry, an `OfflineBanner` with `useOnlineStatus`, and `withRetry`/`fetchWithRetry` with exponential backoff (`src/services/retry.ts`).                                                             |
| `w3-seo`    | `useMeta` hook for per-page title, description, OpenGraph and Twitter tags on every page, default meta in `index.html`, `robots.txt`, and `sitemap.xml` through `scripts/generate-sitemap.mjs`.                                                                                    |
| `w3-a11y`   | Roving-focus card rows (`useRovingFocus`), focus-trapped `DetailModal` (`useFocusTrap`), skip link, ARIA landmarks and labels, and a contrast and reduced-motion audit, documented in `docs/A11Y.md`.                                                                              |
| `w3-docs`   | `README.md` (what it is, features, run, checks, Netlify deploy, mock mode), `docs/KEYS.md` (every env var, client vs server-only, where to get and set it, no Stripe keys), `docs/ARCHITECTURE.md` refresh (brand, errors/retry, `useMeta`, a11y hooks, deployment), and this log. |
