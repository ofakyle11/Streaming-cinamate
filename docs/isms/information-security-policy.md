# Information security policy (clause 5.2)

| Owner | Version | Date       | Review   | Status                   |
| ----- | ------- | ---------- | -------- | ------------------------ |
| Mark  | 0.1     | 2026-10-09 | Annually | Draft for owner approval |

## Purpose and commitment

Lastframe.tv keeps the smallest amount of personal data it can, protects it in transit and at rest, gives users control over it, and is honest about what it does. The owner, as top management, commits to meeting the requirements of ISO/IEC 27001:2022, applicable law (PIPEDA; GDPR and UK GDPR where users are in the EU/UK), provider terms, and the promises published on `/privacy`, `/terms` and `/security`, and to improving the ISMS continually.

This policy applies to the owner, any contractor, and any AI-agent session acting on the owner's behalf within the ISMS scope (`scope.md`).

## Principles

1. **Least data.** Collect only what a feature needs. No advertising, no tracking, no payment data.
2. **Least privilege.** Every account, token and key has the narrowest scope that works and is removed when no longer needed.
3. **Secrets never reach the browser.** Only `VITE_*` values are public; server secrets live in provider environments; `service_role` is never used by the app (`docs/KEYS.md`).
4. **Database enforces access.** Row Level Security on every table; the anon key reads nothing; CI proves it (`supabase/tests/rls_check.sql`).
5. **Every change is reviewed and tested.** Pull request, Council review, CI gates, no direct pushes to the production branch.
6. **Providers are chosen and monitored** for their security attestations, data location and contractual terms.
7. **Incidents are reported, contained and learned from**, and users are told when their data is affected.
8. **The service must survive the owner's absence.** Successor access and backups exist.

## Objectives (clause 6.2) — measured annually at management review

| #   | Objective                                   | Measure                                                                              | Target                               | Source                         |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------ |
| O1  | No unauthorised access to user data         | Confirmed incidents of cross-user data exposure                                      | 0 per year                           | Incident log                   |
| O2  | Production vulnerabilities fixed within SLA | % of critical/high advisories in production dependencies closed within 7/30 days     | 100 %                                | Dependabot alerts, PR dates    |
| O3  | Every production change passes the gate     | % of commits on the production branch that arrived via a PR with all CI checks green | 100 %                                | GitHub branch history          |
| O4  | Backups are proven restorable               | Restore tests completed and passed                                                   | 4 per year (quarterly)               | Restore-test log               |
| O5  | Reviews happen on schedule                  | Monthly log reviews and quarterly access reviews completed on time                   | ≥ 11 of 12 monthly, 4 of 4 quarterly | Review logs                    |
| O6  | Users' rights honoured                      | DSARs answered within 30 days; deletion completed within 24 h                        | 100 %                                | DSAR log; deletion-queue check |
| O7  | Disclosure reports acknowledged             | Time to acknowledge reports to `security@`                                           | ≤ 72 h, 100 %                        | Incident log                   |

## Roles and responsibilities (clause 5.3)

| Role                                            | Held by                                                                                                                               | Responsibilities                                                                                                                                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top management / Owner                          | Mark                                                                                                                                  | Approves policies, accepts risks, funds controls, chairs management review, owns every asset and every provider account                                                                                                                                                                        |
| Information security lead ("CISO")              | Mark                                                                                                                                  | Maintains the ISMS, risk register and SoA; runs reviews; decides incident severity                                                                                                                                                                                                             |
| Privacy lead ("DPO" function)                   | Mark                                                                                                                                  | Answers `privacy@`, handles DSARs, maintains records of processing, decides breach notification                                                                                                                                                                                                |
| Security owner for engineering ("Spencer" role) | The reviewer the owner designates for each release (currently the AI-agent reviewer named Spencer; may be a human peer or contractor) | Verifies that every PR satisfies `secure-development-and-change.md`; verifies claims in PR descriptions (tests run, audit clean) rather than accepting them; signs off before merge; verifies that each item in this ISMS marked "implemented" has evidence. Cannot approve their own changes. |
| Council reviewers (Correctness, Design, Safety) | AI-agent reviewers per `docs/AGENTS.md`, or human peers                                                                               | Change gate: 3/3 approval with no blocking findings before merge                                                                                                                                                                                                                               |
| Successor                                       | Named person in the sealed-credentials envelope (`backup-and-continuity.md`)                                                          | Takes over operation or performs orderly shutdown if the owner is incapacitated                                                                                                                                                                                                                |
| Contractors / AI-agent sessions                 | As engaged                                                                                                                            | Follow this policy, the AUP and the SDLC; use only scoped, time-limited credentials                                                                                                                                                                                                            |

Segregation of duties (A.5.3) in a one-person company is achieved by: the PR + independent review gate (the author never merges unreviewed), CI as an automated second check, and the Spencer role verifying rather than trusting.

## Supporting documents

Technical standards already in the repository are part of this ISMS and take precedence on technical detail:

- `docs/SECURITY.md` — security controls (CSP, headers, rate limit, Turnstile, callback hardening, audit, secret scan, disclosure).
- `docs/KEYS.md` — every environment variable, client vs server-only, where set, rotation.
- `docs/SUPABASE.md` — backend runbook: RLS, auth settings, Resend DNS, deletion cron, devices.
- `docs/AGENTS.md` — agent roles and the Council review rule.
- The operational policies listed in `README.md`.

## Consequences

A contractor or agent session that breaches this policy loses access immediately (`access-control-policy.md`, leaver). Breaches by the owner are recorded as nonconformities (`internal-audit-and-management-review.md`) and corrected.

## Communication

This policy is stored in the repository, referenced in `README.md`, and given to every contractor before access. The public summary is `/security`.

## Continual improvement (clause 10.1)

Sources of improvement: incident reviews, internal audit findings, management review actions, provider changes, technical findings from reviews (register references P-, F-, S-, D-, AU-, A-). Each becomes an entry in the corrective-action log with an owner and date.
