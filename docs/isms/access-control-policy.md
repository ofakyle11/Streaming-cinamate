# Access control policy (A.5.15–5.18, 8.2–8.5)

| Owner | Version | Date       | Review   | Status                   |
| ----- | ------- | ---------- | -------- | ------------------------ |
| Mark  | 0.1     | 2026-10-09 | Annually | Draft for owner approval |

## Principles

1. **Least privilege.** Every account, token and key carries the minimum scope and the shortest lifetime that does the job.
2. **MFA on every provider account** (GitHub, Netlify, Supabase, Resend, Spaceship, Cloudflare, Plausible, TMDB, Google Workspace). Hardware key preferred where supported; authenticator app otherwise; SMS never.
3. **No shared passwords.** One person, one account. Credentials live only in the owner's password manager.
4. **Admin allow-list by email.** Application admin rights come only from `public.admin_users` (`supabase/migrations/20261007000000_admin_users.sql`), read through `lf_is_admin()`; the list is changed by migration, reviewed quarterly.
5. **No `service_role` in the client or in Netlify.** The app uses the anon key with RLS only (`docs/KEYS.md`, `docs/SUPABASE.md`).
6. **Users access only their own rows.** RLS own-row policies on every table; `anon` has no grants; CI proves it on every push.
7. **No standing automation tokens.** CLI and agent tokens are created for a task and revoked when it ends.
8. **Production configuration is changed only by the owner** (Netlify env vars, Supabase dashboard, DNS) and recorded in the change log in `secure-development-and-change.md`.
9. **Sign-in to the product is email-link only.** The `lf_strip_password` trigger makes password sign-in impossible; re-check it after Supabase upgrades.

## Joiner / mover / leaver

Applies to any contractor, peer reviewer, auditor or AI-agent session.

### Joiner

| Step | Contractor / peer                                                                                                  | AI-agent session                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1    | Identity confirmed; NDA and this policy acknowledged (record in `acceptable-use-and-endpoint.md` competence table) | Session purpose recorded (task id or PR)                                                                     |
| 2    | GitHub collaborator with the lowest role that works (read for review, write for branches; never admin)             | Token scoped to the repository, write only if a branch is needed, expiry ≤ 30 days                           |
| 3    | No provider console access unless the task needs it; if granted, member role (never owner), removed at task end    | Never given Netlify, Supabase, Resend, DNS or Google credentials; any such step is done by the owner by hand |
| 4    | Access recorded in the access-review log below                                                                     | Session recorded by PR link                                                                                  |

### Mover

Role changes are treated as leaver then joiner. Scope creep ("while you have access") is not permitted.

### Leaver

1. Revoke GitHub collaborator access or token the same day; revoke any provider membership.
2. Rotate any secret the person or session could have seen (see secrets register) within 7 days.
3. Confirm no personal forks hold the private repository; ask for deletion.
4. Record the removal in the log below.

AI-agent sessions: tokens are revoked when the session ends; if a session had a Netlify or Supabase token for any reason, that token is revoked and the credential rotated immediately (F4).

## Privileged access (A.8.2)

| Privilege                                                  | Holder                                   | Control                                                                        |
| ---------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| Provider owner / super-admin roles                         | Mark only                                | MFA, recovery codes stored; successor access via sealed envelope               |
| Supabase SQL editor, `service_role`, database password     | Mark only                                | Used only for documented runbook steps; each use noted in the quarterly review |
| Netlify env vars, deploy triggers, rollbacks               | Mark only                                | Changes noted in change log                                                    |
| GitHub repository admin (rulesets, secrets, collaborators) | Mark only                                | Audit log reviewed quarterly                                                   |
| Merge to production branch                                 | Mark, after Council and Spencer approval | Branch protection (F2)                                                         |

## Authentication information (A.5.17)

- All credentials in the password manager; never in chat, tickets, email, AI prompts or repository files.
- Recovery codes stored in the password manager and a printed copy in the sealed envelope.
- Rotation cadence per secrets register; a rotation is logged by date in that register.
- Any credential suspected exposed is rotated first and investigated second (`docs/SECURITY.md`, `incident-response.md`).

## Quarterly access review procedure (A.5.18)

Due first week of January, April, July, October. Takes about one hour.

1. **GitHub**: Settings → Collaborators and teams; confirm the list; confirm 2FA required; review personal access tokens and deploy keys (delete unused); confirm ruleset on the production branch is active; skim the audit log for the quarter.
2. **Netlify**: Team members; personal access tokens and OAuth apps (revoke all not in active use); environment variables with scopes and contexts (`TMDB_API_KEY`: Functions + Production only; Supabase vars: Builds + Production); deploy notifications intact.
3. **Supabase**: Organisation members and MFA; project API keys unchanged; `admin_users` rows; access tokens (`sbp_`) revoked; auth settings unchanged (enumeration protection on, captcha state as expected); `lf_strip_password` trigger present; pg_cron job present and running.
4. **Resend**: team members; API keys (one active, named, dated); domain still verified.
5. **Spaceship**: account MFA; registrar lock; DNS records match the documented set (`docs/SUPABASE.md` plus apex SPF/DMARC/CAA); no unknown records.
6. **Cloudflare, Plausible, TMDB**: account MFA; no extra members; keys unchanged.
7. **Google Workspace**: users and admin roles; `security@`, `privacy@`, `legal@` route to a monitored inbox; no forwarding to external addresses; 2-step verification enforced.
8. **Password manager**: emergency access contact current; recovery codes present.
9. Record findings below; open corrective actions for anything unexpected.

## Access-review log

| Date       | Reviewer | Providers covered                                                                           | Accounts removed / tokens revoked | Findings | Actions (CAPA id) |
| ---------- | -------- | ------------------------------------------------------------------------------------------- | --------------------------------- | -------- | ----------------- |
| 2027-01-__ | Mark     | GitHub, Netlify, Supabase, Resend, Spaceship, Cloudflare, Plausible, TMDB, Google Workspace |                                   |          |                   |

## Contractor and agent access log

| Date granted | Who / session | System and role | Purpose | Date removed | Secrets rotated |
| ------------ | ------------- | --------------- | ------- | ------------ | --------------- |
|              |               |                 |         |              |                 |
