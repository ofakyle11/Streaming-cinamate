# Incident response (A.5.24–5.28, 6.8)

| Owner | Version | Date       | Review   | Status                   |
| ----- | ------- | ---------- | -------- | ------------------------ |
| Mark  | 0.1     | 2026-10-09 | Annually | Draft for owner approval |

## Intake

| Channel                 | Where                                                                                 | Who monitors              | Commitment                                                    |
| ----------------------- | ------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------- |
| `security@lastframe.tv` | Google Workspace mailbox; published in `/.well-known/security.txt` and on `/security` | Owner, daily              | Acknowledge within 72 h (`/security` promise)                 |
| `privacy@lastframe.tv`  | Google Workspace                                                                      | Owner, daily              | Reply within 30 days (`/privacy`)                             |
| Provider alerts         | GitHub (Dependabot, secret scanning), Netlify, Supabase, Resend emails                | Owner                     | Triage within 7 days, same day for critical                   |
| Uptime monitor          | External monitor on `https://lastframe.tv/api/health`                                 | Owner (push notification) | Same day                                                      |
| User reports            | Any channel                                                                           | Owner                     | Treat as security report if it mentions access, data or email |

Until P-3 is fixed (apex MX/SPF/DMARC), `security@` may not be deliverable. Fixing it is a precondition of this procedure.

## Severity

| Level       | Definition                                                                                                                                   | Examples                                                                    | Response start         | Notification                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| S1 Critical | Confirmed or likely exposure of personal data of more than one user, or attacker control of a provider account, DNS or the production branch | Leaked JWT secret or service_role; RLS bypass; DNS hijack; malicious deploy | Immediately            | Users within 72 h of confirmation; regulators per decision below |
| S2 High     | Exposure limited to one user or one credential with no evidence of use; service down > 4 h                                                   | Leaked TMDB key; Netlify PAT leaked; Supabase paused                        | Within 4 h             | Affected user if any; regulator assessment                       |
| S3 Medium   | Vulnerability reported or found, not known exploited                                                                                         | Dependency CVE in production; XSS report with CSP blocking                  | Within 2 business days | None unless escalated                                            |
| S4 Low      | Policy or hygiene issue                                                                                                                      | Missing header, stale token                                                 | Next working cycle     | None                                                             |

## Response steps (all severities)

1. **Record**: open a row in the incident log; note time, source, what is known.
2. **Classify** severity; S1/S2 trigger the containment playbook now.
3. **Preserve evidence** (A.5.28) before rotating anything that would erase it: export Netlify function logs and deploy list, Supabase auth logs for the window, Resend send logs, GitHub audit log; save to `isms/evidence/incidents/<id>/` with timestamps. Never put secrets in the evidence folder.
4. **Contain** using the playbook below.
5. **Eradicate and recover**: fix root cause via the normal PR gate (expedited review allowed for S1/S2 but still reviewed); verify with CI and a manual check on production.
6. **Notify** per the decision section.
7. **Post-incident review** within 14 days; record in the log; open corrective actions.

## Containment playbook for this stack

| Scenario                                             | Steps                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TMDB key exposed or abused                           | TMDB → Settings → API → regenerate; Netlify → Environment variables → replace `TMDB_API_KEY` (Functions scope, Production context only, secret flag); Deploys → Trigger deploy; cache clears within 10 min (`docs/KEYS.md`). Check Netlify function invocations for the abuse window.                             |
| Resend key exposed, or sign-in emails abused         | Resend → API Keys → create new key, delete old; Supabase → Authentication → SMTP → update password; test a sign-in; check Resend logs for unexpected recipients.                                                                                                                                                  |
| Suspected account or session compromise (one user)   | Supabase → Authentication → Users → select user → sign out user (revokes refresh tokens); ask the user to secure their inbox; review `public.devices` rows for the user.                                                                                                                                          |
| Suspected mass session compromise or JWT secret leak | Supabase → Project Settings → API → JWT settings → generate new secret (invalidates all sessions; anon key also changes); update `VITE_SUPABASE_ANON_KEY` in Netlify; redeploy; announce on the site if needed. Alternative for lesser cases: Supabase "sign out all users" via dashboard or admin API.           |
| RLS bypass or bad migration exposing rows            | Netlify → Deploys → roll back to the last good deploy if the client is involved; in Supabase SQL editor apply a corrective migration (also commit it); run `rls_check.sql` logic against a dump; if data was exposed, treat as S1.                                                                                |
| Malicious or accidental production deploy            | Netlify → Deploys → select previous good deploy → Publish deploy (instant rollback); lock the site ("Lock to stop auto publishing"); identify the commit; revoke the token or collaborator that pushed; keep the branch ruleset (F2).                                                                             |
| GitHub token or collaborator compromise              | GitHub → Settings → Developer settings → revoke tokens; remove collaborator; rotate repository secrets (none used by CI today); audit log review; force-push protection must remain on.                                                                                                                           |
| Netlify account or PAT compromise                    | Netlify → User settings → Applications → revoke all PATs; change password; re-check MFA; audit env vars and build settings for tampering; redeploy from a known-good commit.                                                                                                                                      |
| DNS hijack or registrar compromise                   | Spaceship → change password and MFA; re-enable registrar lock; restore DNS records from the documented set (`docs/SUPABASE.md` plus apex records); check Resend domain verification; check certificates on Netlify; contact Spaceship support and, if the domain was transferred, open an ICANN transfer dispute. |
| Supabase account compromise                          | Supabase → account security → change password, MFA, revoke access tokens; rotate JWT secret and database password; check auth settings and `admin_users`; review auth logs.                                                                                                                                       |
| Supabase project paused (free tier)                  | Dashboard → Restore project; confirm pg_cron job still scheduled; run deletion processor by hand (`select public.lf_process_account_deletions()`); consider Pro (R-08).                                                                                                                                           |
| Phishing campaign imitating sign-in emails           | Confirm DMARC enforcement on `mail.lastframe.tv` and apex (P-3, D9); report the sending domain to its provider; post a notice on `/security`; do not change the template.                                                                                                                                         |
| Dependency compromise (malicious npm version)        | Identify version via lockfile; `npm audit` and advisory; roll back deploy; pin or remove package via PR; rotate any secret reachable from the build (TMDB key, since builds see Functions-scope vars only if misconfigured).                                                                                      |
| Owner device lost or stolen                          | Remote wipe; rotate every credential the device held (password manager master, provider sessions); revoke sessions in each console; see `acceptable-use-and-endpoint.md`.                                                                                                                                         |

## Notification decision

**PIPEDA (Canada)**: notify the Office of the Privacy Commissioner and affected individuals as soon as feasible when a breach of security safeguards creates a _real risk of significant harm_ (consider sensitivity: email address plus viewing habits is low-to-moderate; combined with sign-in capability it is significant). Keep a record of every breach for 24 months regardless of notification.

**GDPR / UK GDPR** (users in the EEA or UK): notify the lead supervisory authority within 72 hours of becoming aware unless the breach is unlikely to result in a risk to individuals; notify individuals without undue delay when the risk is high. With no EU establishment, notify the authority of the member state of the affected users (default: Irish DPC or the ICO for UK users) and document the reasoning.

**Public promise** (`/security`): tell affected users by email within 72 hours of confirming exposure.

Decision record goes in the incident log row (decision, reasoning, who was notified, when).

Authority contacts (A.5.5): OPC Canada — https://www.priv.gc.ca (breach report form); ICO — https://ico.org.uk/for-organisations/report-a-breach/; Irish DPC — https://www.dataprotection.ie; Canadian Centre for Cyber Security — https://www.cyber.gc.ca; local police for theft or extortion.

## Post-incident review template

- Incident id, dates (detected, contained, closed), severity.
- What happened (timeline).
- Root cause and contributing factors.
- What worked, what did not.
- Data affected, users affected, notifications made.
- Corrective actions (CAPA ids) with owners and dates.
- Changes to risk register, SoA, runbooks.

## Incident log

| ID  | Detected | Source | Severity | Summary | Containment done | Notification decision | Closed | Post-incident review | CAPA |
| --- | -------- | ------ | -------- | ------- | ---------------- | --------------------- | ------ | -------------------- | ---- |
|     |          |        |          |         |                  |                       |        |                      |      |
