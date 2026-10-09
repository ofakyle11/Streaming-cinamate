# Backup and business continuity (A.5.29, 5.30, 8.13, 8.14)

| Owner | Version | Date       | Review   | Status                   |
| ----- | ------- | ---------- | -------- | ------------------------ |
| Mark  | 0.1     | 2026-10-09 | Annually | Draft for owner approval |

## Targets

| Component                           | RPO (max data loss)                             | RTO (max downtime)                | Basis                                                                                                  |
| ----------------------------------- | ----------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Static site and functions (Netlify) | 0 (rebuilt from git)                            | 1 h (rollback) / 1 day (new host) | Everything is in the repository                                                                        |
| Supabase database (user data)       | 24 h (Pro daily backup) or 7 days (weekly dump) | 1 day                             | Free service; users keep a local copy of their own list/history/ratings in the browser, which re-syncs |
| Auth users                          | Same as database                                | 1 day                             | Email-link sign-in recreates sessions; users table restored with database                              |
| DNS zone                            | 0 (documented records)                          | 4 h                               | Re-create from `docs/SUPABASE.md` plus apex records                                                    |
| Email sending                       | n/a                                             | 4 h                               | Re-verify domain or switch SMTP provider                                                               |
| Source code                         | 0                                               | 1 h                               | GitHub plus owner's local clone; mirror to a second host recommended                                   |
| ISMS and docs                       | 0                                               | 1 h                               | In repository                                                                                          |

## Backup decision

Two acceptable options; the owner must pick one and record the choice here.

| Option                       | Cost         | What you get                                                                                                                                                                                                                                                    | Residual gap                                                                                                     |
| ---------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A. Supabase Pro              | 25 USD/month | Daily automated backups (7-day retention), optional PITR add-on, no free-tier pausing (also closes R-08), support                                                                                                                                               | Backups live with the same provider; export a monthly dump off-platform as well                                  |
| B. Weekly `supabase db dump` | 0            | `npx supabase db dump --linked -f lf-YYYY-MM-DD.sql` (schema + data; add `--data-only` variant) run by the owner weekly; encrypted with `age` or GPG to the owner's key; stored in an encrypted cloud folder (not the repo) with 8 weekly and 12 monthly copies | RPO 7 days; manual discipline; free-tier pause still open (R-08); auth schema included only with `--schema auth` |

**Decision**: ______ (A or B), signed by owner, date ______. Until decided, option B is run once now so that at least one backup exists.

Rules for either option:

- Dumps contain personal data: encrypt at rest, never commit, never leave on a laptop unencrypted, delete beyond the retention above (the privacy page now says "Copies in database backups are kept for a limited time" (A8 wording shipped in PR #25); once option A or B is chosen the owner fills in the real retention here and, if a specific figure is wanted on the page, adds it there).
- The encryption key and the storage location are in the sealed envelope.
- Record each backup in the log below (date, size, checksum, location).

## Restore-test procedure (quarterly)

1. Start a throwaway Postgres 17 (Docker: `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17`) or a new empty Supabase project.
2. Restore the latest dump: `psql "$DATABASE_URL" -f lf-YYYY-MM-DD.sql` (or Supabase dashboard → Backups → Restore for option A, into a _new_ project, never over production).
3. Verify: row counts for `profiles`, `watchlist`, `history`, `ratings`, `devices`, `account_deletion_requests` match the counts recorded at backup time; RLS policies present (`select count(*) from pg_policies where schemaname='public'`); `lf_strip_password` trigger present.
4. Point a local build at the restored project (`VITE_SUPABASE_URL`/`ANON_KEY` in `.env.local`), sign in with a test address, confirm the test user's list loads.
5. Destroy the throwaway instance; delete local copies of the dump.
6. Record below. A failed restore is a nonconformity.

## Restore-test and backup log

| Date | Type (backup / restore test) | Source (dump date or Pro backup) | Result | Row counts | Time taken | Tester | Notes / CAPA |
| ---- | ---------------------------- | -------------------------------- | ------ | ---------- | ---------- | ------ | ------------ |
|      |                              |                                  |        |            |            |        |              |

## Continuity scenarios

| Scenario                        | Plan                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Netlify outage                  | Wait (status page). If > 24 h: deploy `dist/` to Cloudflare Pages or Vercel from the repository; move DNS A/CNAME at Spaceship; re-add env vars.                                                              |
| Supabase outage or project loss | Site keeps working in guest/mock mode? No — live mode errors on sign-in but browsing works. Restore from backup into a new project; update the two Netlify vars; redeploy; users sign in again by email link. |
| Resend outage                   | Sign-in links stop. Switch Supabase SMTP to a second provider (keep a Postmark or SES account pre-created with verified domain) or temporarily to Supabase's built-in mailer (2/h, emergencies only).         |
| GitHub outage                   | Netlify cannot build; current deploy keeps serving. Local clone can deploy with `netlify deploy --prod` built via `netlify build --context production` (`docs/SUPABASE.md`).                                  |
| Domain loss                     | Highest impact; prevention via registrar lock and MFA (R-11). Recovery via Spaceship support and ICANN dispute; interim site on `lastframe-tv.netlify.app`.                                                   |
| Free-tier pause                 | Restore in dashboard; run deletion processor by hand; decide on Pro.                                                                                                                                          |

## Single-person dependency (R-09)

**Sealed credentials / successor access.** The owner prepares and keeps current:

1. A password-manager **emergency access** grant to the successor (e.g. 1Password/Bitwarden emergency access with a 7-day wait), covering every provider login and MFA recovery codes.
2. A **sealed envelope** (physical, with a trusted person or lawyer) containing: successor's name; the password-manager emergency-access instructions; printed MFA recovery codes; the backup encryption key; this document's location.
3. A **successor instruction sheet** (one page, in the envelope and in the password manager) saying: what Lastframe.tv is; where the ISMS is; how to pay or cancel each provider; how to run the shutdown runbook; the legal obligations (answer DSARs, give 30 days notice before closing per `/terms`, keep breach records).
4. **Billing on auto-pay** with a card the successor can manage, so nothing lapses during an absence.
5. The envelope contents are refreshed at every quarterly access review (recovery codes change when regenerated).

**Shutdown runbook** (if the service must close): announce on the site and by email to account holders with ≥ 30 days notice and a reminder of the export feature; after the notice period export nothing, delete the Supabase project, delete Netlify site, delete Resend domain, keep the domain for 12 months with a static notice page, keep the breach-record file for 24 months, then close accounts.

## Review

RPO/RTO and the backup decision are reviewed annually and whenever the user count or the provider plan changes.
