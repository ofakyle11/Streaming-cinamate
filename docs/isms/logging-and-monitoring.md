# Logging and monitoring (A.8.15, 8.16, 5.7)

| Owner | Version | Date       | Review   | Status                   |
| ----- | ------- | ---------- | -------- | ------------------------ |
| Mark  | 0.1     | 2026-10-09 | Annually | Draft for owner approval |

## Logs that exist

| Provider         | Log                                   | Contains                                                                | Retention (confirm in console and record here)                                                                   | Personal data                           | Where                     |
| ---------------- | ------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------- |
| Netlify          | Function logs (`tmdb`, `health`)      | Timestamp, path, status, error code, duration; never the key            | Default short retention (verify; typically 24 h on Free) — ______                                                | No (IP not in function logs by default) | Site → Logs → Functions   |
| Netlify          | Deploy logs and deploy history        | Build output incl. `security-headers:` line, commit, who triggered      | Lifetime of site                                                                                                 | No                                      | Site → Deploys            |
| Netlify          | Access/edge logs                      | IP, UA, path                                                            | Not available on Free plan (Log Drains are Enterprise); privacy page says "up to 30 days" — reword (A8) — ______ | Yes                                     | n/a on current plan       |
| Netlify          | Team audit log                        | Member, env var and setting changes                                     | Plan-dependent — ______                                                                                          | No                                      | Team → Audit log          |
| Supabase         | Auth logs                             | Sign-in events, email, IP, UA, errors                                   | Free: 1 day; Pro: 7 days (verify) — ______                                                                       | Yes                                     | Project → Logs → Auth     |
| Supabase         | Postgres logs, API (PostgREST) logs   | Queries by role, errors, status                                         | Free: 1 day (verify) — ______                                                                                    | Indirect                                | Project → Logs            |
| Supabase         | pg_cron run history                   | Job runs and outcomes (`cron.job_run_details`)                          | In database; prune                                                                                               | No                                      | SQL editor                |
| Supabase         | Project audit (org)                   | Member and setting changes                                              | Plan-dependent — ______                                                                                          | No                                      | Org → Audit               |
| Resend           | Email logs                            | Recipient, subject, status, timestamps                                  | Default (verify; shorten if setting exists) — ______                                                             | Yes                                     | Resend → Emails           |
| GitHub           | Actions run logs                      | CI output (secrets redacted)                                            | 90 days default                                                                                                  | No                                      | Actions tab               |
| GitHub           | Audit log (user/org), security alerts | Settings changes, token creation, Dependabot and secret-scanning alerts | 180 days (user)                                                                                                  | No                                      | Settings → Security log   |
| Spaceship        | Account activity                      | Logins, DNS changes                                                     | Verify — ______                                                                                                  | No                                      | Account                   |
| Google Workspace | Admin audit, login audit              | Admin actions, sign-ins to mailboxes                                    | 6 months                                                                                                         | Owner only                              | Admin console → Reporting |
| Plausible        | Analytics                             | Aggregate pageviews/events                                              | Lifetime                                                                                                         | No (after A1 fix)                       | Plausible                 |
| Browser (client) | None persisted                        | Errors shown via ErrorBoundary without stack traces                     | —                                                                                                                | —                                       | —                         |

Retention figures must be filled in from the consoles during the first monthly review and copied into `privacy-and-dsar.md` (A3, A8).

## Alerts and monitors

| Monitor                                                               | Source                                                      | Alert to           | Status                 |
| --------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------ | ---------------------- |
| Uptime on `https://lastframe.tv/api/health` (expects 200) every 5 min | External monitor (e.g. UptimeRobot, Better Stack free tier) | Owner email + push | To set up              |
| Uptime on `https://lastframe.tv/` (expects 200 and the `<title>`)     | Same                                                        | Owner              | To set up              |
| Supabase project status / paused                                      | Supabase emails; status.supabase.com subscription           | Owner              | Subscribe              |
| Netlify deploy failed / succeeded                                     | Netlify deploy notifications (email)                        | Owner              | Verify enabled         |
| Netlify usage approaching limits (bandwidth, function invocations)    | Netlify usage emails                                        | Owner              | Verify enabled         |
| Dependabot alerts and secret-scanning alerts                          | GitHub email                                                | Owner              | Verify enabled on repo |
| CI failure on production branch                                       | GitHub Actions email                                        | Owner              | Default                |
| Resend domain verification or bounce spike                            | Resend emails                                               | Owner              | Verify                 |
| Domain expiry and DNS change                                          | Spaceship emails; auto-renew on                             | Owner              | Verify                 |
| `security.txt` expiry (2027-10-01)                                    | Calendar reminder 2027-09-01                                | Owner              | Add                    |

## Monthly review checklist (first week of each month, ~45 min)

1. Uptime monitor: review downtime events; cross-check with Netlify/Supabase status pages.
2. Netlify: deploy list — every production deploy maps to a merged PR (no unexpected deploys); function error rate for `tmdb` (counts of 403/429/502/503); usage against plan limits.
3. Supabase: auth logs — unusual volumes of sign-in requests, failed verifications, many requests for one address; project not paused; `select * from cron.job where jobname='lf-process-account-deletions'` exists; `select * from cron.job_run_details order by start_time desc limit 10` shows successful runs; `select count(*) from account_deletion_requests where processed_at is null and requested_at < now() - interval '24 hours'` is 0 (A2/D5).
4. Resend: send volume and bounces; no sends to unexpected domains.
5. GitHub: open Dependabot alerts with age vs SLA; secret-scanning alerts; security log for token creation or collaborator changes.
6. Spaceship: DNS records unchanged vs documented set.
7. Google Workspace: `security@` and `privacy@` inboxes checked; any open report or DSAR within its clock.
8. Threat intelligence (A.5.7): skim Supabase, Netlify, Resend changelogs/security notices and npm advisories relevant to the stack.
9. Record below; open CAPA for anomalies.

## Review log

| Month   | Date done | Reviewer | Uptime % | Unexpected deploys | Auth anomalies | Deletion queue overdue | Open vuln alerts (crit/high/med) | DSARs open | Findings / CAPA |
| ------- | --------- | -------- | -------- | ------------------ | -------------- | ---------------------- | -------------------------------- | ---------- | --------------- |
| 2026-11 |           | Mark     |          |                    |                |                        |                                  |            |                 |
