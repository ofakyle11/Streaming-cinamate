# Secure development and change management (A.8.8, 8.25–8.33)

| Owner | Version | Date       | Review   | Status                   |
| ----- | ------- | ---------- | -------- | ------------------------ |
| Mark  | 0.1     | 2026-10-09 | Annually | Draft for owner approval |

## Branch model

| Branch                                          | Purpose                                            | Deploys to                                                                             |
| ----------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `claude/modest-johnson-ugzfhg`                  | Production branch; Netlify auto-deploys every push | `https://lastframe.tv`                                                                 |
| `lf/<task-id>`, `lf-stream/*`, feature branches | Work branches, one task each (`docs/AGENTS.md`)    | Netlify deploy previews / branch deploys, always in mock mode (no Production env vars) |
| Dependabot branches                             | Dependency updates                                 | Deploy preview                                                                         |

Direct commits to the production branch are not permitted. All changes arrive by pull request.

## Pull request and review rule

1. One task per PR; PR description states what changed, what was run (`npm run build`, lint, typecheck, test, e2e where relevant) and the result. Claims are verified by the reviewer, not accepted.
2. **Council review** (`docs/AGENTS.md`): Correctness, Design, Safety reviewers; 3/3 approve with no blocking findings; max two rounds before the task is re-planned.
3. **Safety reviewer checklist**: no secrets or `VITE_` misuse; no server-only variable read under `src/`; RLS present on any new table with own-row policies for `authenticated` and nothing for `anon`; no `innerHTML`, `eval`, `dangerouslySetInnerHTML`; URLs from upstream validated against allow-lists; CSP updated for any new origin and `csp.test.ts` extended; mock adapter exists for any new external service; privacy page updated for any new data or processor.
4. **Spencer (security owner) sign-off** on every PR touching `netlify/`, `supabase/`, `scripts/security-headers.mjs`, `netlify.toml`, `.github/`, auth code (`src/auth/`, `src/services/auth/`), `src/content/legal.ts`, or dependencies. Spencer verifies CI is green on the final commit and that the PR does what its description says.
5. The owner merges. Nobody merges their own unreviewed change.

## Required CI checks (`.github/workflows/ci.yml`)

| Job       | What it proves                                                                                                                   | Must pass to merge |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `verify`  | lint, typecheck, unit tests, production build, CSP present in `dist/_headers`                                                    | Yes                |
| `e2e`     | Playwright smoke and device matrix in mock mode                                                                                  | Yes                |
| `db`      | Migrations apply twice to a clean Postgres 17; `rls_check.sql` proves cross-user isolation, anon sees nothing, cascade on delete | Yes                |
| `audit`   | `npm audit --omit=dev --audit-level=high` clean                                                                                  | Yes                |
| `secrets` | gitleaks over full history and tree (pinned, checksum-verified)                                                                  | Yes                |

Workflow permissions are read-only; PR jobs use no secrets; third-party actions are pinned by SHA.

## Branch protection requirements (F2 — to configure by the owner)

GitHub → Settings → Rules → Rulesets → new ruleset for `claude/modest-johnson-ugzfhg`:

- Require a pull request before merging; 1 approval; dismiss stale approvals on new commits.
- Require status checks: `verify`, `e2e`, `db`, `audit`, `secrets`; require branches up to date.
- Block force pushes; block deletion; require linear history (optional).
- Restrict who can push: owner only. Bypass list: empty.
- Add `.github/CODEOWNERS` with `* @ofakyle11` (and Spencer's handle if human) so review requests are automatic.
- Evidence: screenshot or `gh api repos/ofakyle11/Streaming-cinamate/rulesets` output stored in `isms/evidence/github/` and refreshed at each quarterly access review.

Until this is in place, the review rule is procedural only and R-06 stays at score 6.

## Dependency update policy (A.8.8, 5.21)

- Dependabot opens PRs for npm and GitHub Actions; add `cooldown: default-days: 7` (F5) so freshly published versions are not pulled before the ecosystem has seen them.
- Every dependency PR is reviewed like any other: changelog read, lockfile diff inspected for unexpected new packages or registries (only `registry.npmjs.org`), CI green.
- `npm ci` only; no `npm install` in CI or builds; lockfile committed.
- New runtime dependencies need a justification in the PR and a check of maintainer activity and download volume.
- Major upgrades of dev tooling (Vite, Vitest, Playwright) are batched into their own PR.

## Vulnerability SLA (A.8.8)

| Severity (npm/GitHub advisory or reported finding) | Fix or mitigate within   | Notes                                                                      |
| -------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| Critical                                           | 7 days                   | If exploitable in production, treat as incident S2 and consider rollback   |
| High                                               | 30 days                  | Production dependencies gate CI already; dev-only advisories still tracked |
| Medium                                             | 90 days                  |                                                                            |
| Low / informational                                | Next planned maintenance | Record decision                                                            |

Findings from the 2026-10 review (P-, F-, S-, D-, AU-, A-) are tracked in the risk register with the same clocks starting at policy approval. Dependabot alerts and `npm audit` output are checked weekly; status reported at monthly log review.

## Secrets rules (A.5.17, 8.4)

- No secret in the repository, PR descriptions, issues, commit messages, CI logs, chat or AI prompts. gitleaks runs on every push; a hit means rotate first, then remove (`docs/SECURITY.md`).
- `.env`, `.env.*` must be gitignored (F1); `.env.example` may exist with placeholder values only.
- Client code reads only `VITE_*` (enforced by `src/test/envNames.test.ts`). Server secrets only under `netlify/functions/` via `process.env`.
- `supabase/config.toml` references secrets as `env(NAME)` only (test-guarded).
- Production env vars: `TMDB_API_KEY` Functions scope, Production context, secret flag (F3); Supabase public vars Builds scope, Production context.
- AI-agent sessions never receive provider secrets; steps that need them are "hands" steps done by the owner (`docs/SUPABASE.md`).

## Environment separation (A.8.31)

- **Production**: production branch, Production-context env vars, live Supabase, live TMDB proxy.
- **Previews and branch deploys**: no Production env vars, so every service uses its mock adapter; previews must never carry a Supabase URL or TMDB key (F3 closes the remaining gap).
- **Local development**: mock mode by default; `.env.local` opt-in; `npm run db:check` refuses Supabase hosts so RLS tests never touch production.
- **Supabase**: single project; schema changes are migrations applied by `supabase db push` after CI has applied them to a clean Postgres. No ad-hoc SQL in production except documented runbook steps, each recorded in the change log.

## Test data policy (A.8.33)

- Tests and e2e use mock adapters and synthetic fixtures; no production data is ever copied to a test environment or a laptop.
- RLS checks create throwaway users on a disposable Postgres.
- Screenshots or logs attached to issues must not contain real user emails.
- If a production dump is ever needed for debugging, it is a backup copy handled under `backup-and-continuity.md` rules, anonymised (emails replaced) before use, and deleted after.

## Change log for production configuration (non-code changes)

| Date | Who | System | Change | Reason | Verified by |
| ---- | --- | ------ | ------ | ------ | ----------- |
|      |     |        |        |        |             |

## Release checklist (for changes touching auth, headers, env or DNS)

- [ ] CI green on the merge commit; Council 3/3; Spencer sign-off.
- [ ] Deploy log shows `security-headers: ... supabase https://<ref>.supabase.co` (live mode) and the CSP line.
- [ ] Smoke test on production: home, search, sign-in link received and works, account page loads, `/api/health` 200.
- [ ] Rollback point noted (previous Netlify deploy id).
- [ ] Docs updated (`docs/KEYS.md`, `docs/SECURITY.md`, privacy page if data flows changed).
