# Lastframe.tv ISMS — index

| Owner | Version | Date       | Review   | Status                   |
| ----- | ------- | ---------- | -------- | ------------------------ |
| Mark  | 0.1     | 2026-10-09 | Annually | Draft for owner approval |

This folder is the Information Security Management System (ISMS) for Lastframe.tv, written against ISO/IEC 27001:2022. Lastframe.tv is a streaming-catalogue web app run by one person, with no office, no employees and every component in a cloud provider. The documents are deliberately short: each states what is done, who does it, and where the proof is.

## Documents

| File                                      | Purpose                                                                | ISO clause / Annex A       |
| ----------------------------------------- | ---------------------------------------------------------------------- | -------------------------- |
| `scope.md`                                | What the ISMS covers and what it excludes                              | 4.1–4.4                    |
| `information-security-policy.md`          | Top-level policy, objectives, roles                                    | 5.1–5.3, 6.2, 10.1         |
| `risk-methodology-and-register.md`        | Risk method and the live risk register                                 | 6.1.2, 6.1.3, 8.2, 8.3     |
| `statement-of-applicability.md`           | All 93 Annex A controls, applicability, status                         | 6.1.3 d                    |
| `asset-inventory-and-classification.md`   | Data, accounts, secrets, devices                                       | A.5.9, 5.12, 5.13, 5.17    |
| `access-control-policy.md`                | Access principles, JML, quarterly review log                           | A.5.15–5.18, 8.2–8.5       |
| `supplier-register.md`                    | Providers, data, DPAs, certifications, exit plans                      | A.5.19–5.23                |
| `incident-response.md`                    | Intake, severity, containment, notification, log                       | A.5.24–5.28, 6.8           |
| `backup-and-continuity.md`                | RPO/RTO, backup choice, restore tests, successor access                | A.5.29, 5.30, 8.13, 8.14   |
| `secure-development-and-change.md`        | SDLC, CI gates, branch protection, dependency and vulnerability policy | A.8.8, 8.25–8.33           |
| `logging-and-monitoring.md`               | Logs per provider, retention, monthly review, alerts                   | A.8.15, 8.16               |
| `privacy-and-dsar.md`                     | Records of processing, retention, DSAR procedure, privacy-page fixes   | A.5.34, 5.31, 8.10         |
| `acceptable-use-and-endpoint.md`          | Operator AUP, endpoint rules, awareness and competence records         | A.5.10, 6.3, 6.7, 7.7, 8.1 |
| `internal-audit-and-management-review.md` | Audit checklist, management review, nonconformity log                  | 9.1–9.3, 10.1, 10.2        |

## How the documents map to clauses 4–10

- **4 Context**: `scope.md` (issues, interested parties, boundary).
- **5 Leadership**: `information-security-policy.md` (policy, roles). The owner is top management.
- **6 Planning**: `risk-methodology-and-register.md` (6.1), objectives in `information-security-policy.md` (6.2), `statement-of-applicability.md` (6.1.3 d).
- **7 Support**: competence and awareness records in `acceptable-use-and-endpoint.md`; documented information is this folder under git version control.
- **8 Operation**: the operational policies (access, suppliers, incidents, backup, development, logging, privacy) and the technical standards already in the repo under `docs/` (`SECURITY.md`, `KEYS.md`, `SUPABASE.md`).
- **9 Performance evaluation**: monthly log review (`logging-and-monitoring.md`), quarterly access review (`access-control-policy.md`), annual internal audit and management review (`internal-audit-and-management-review.md`).
- **10 Improvement**: nonconformity and corrective-action log in `internal-audit-and-management-review.md`; post-incident reviews in `incident-response.md`.

## Where evidence lives

| Evidence                                                                                   | Location                                                                                           |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Policies, procedures, registers (this folder)                                              | Repository, folder `docs/isms/`; git history is the version record                                 |
| Technical standards                                                                        | `docs/SECURITY.md`, `docs/KEYS.md`, `docs/SUPABASE.md`, `docs/AGENTS.md`                           |
| CI results (lint, typecheck, tests, e2e, RLS check, npm audit, gitleaks)                   | GitHub Actions run history for `.github/workflows/ci.yml`                                          |
| Code review decisions                                                                      | GitHub pull requests (Council review per `docs/AGENTS.md`)                                         |
| Branch protection, collaborators, 2FA, Dependabot and secret-scanning alerts, audit log    | GitHub repository and account settings                                                             |
| Deploys, rollbacks, environment variable scopes, function logs, team members               | Netlify site `lastframe-tv` (site id `bd791a0a-dcc5-46d3-8e59-8b91a115d929`)                       |
| Database schema, RLS, auth settings, auth logs, pg_cron runs, backups, region, org members | Supabase project `lastframe-tv` dashboard                                                          |
| Email sending logs, API keys, domain verification                                          | Resend dashboard                                                                                   |
| DNS records, registrar lock, account MFA                                                   | Spaceship                                                                                          |
| Turnstile widget (currently off)                                                           | Cloudflare dashboard                                                                               |
| Analytics configuration                                                                    | Plausible dashboard                                                                                |
| Mailboxes `security@`, `privacy@`, `legal@`                                                | Google Workspace admin                                                                             |
| Provider certifications (SOC 2 / ISO 27001 reports), signed DPAs                           | `docs/isms/evidence/suppliers/` (to create; store downloaded PDFs there, never in the public site) |
| Completed review logs (access, log review, restore tests, incidents)                       | Tables at the end of each policy in this folder, filled in and committed                           |

Evidence lives under `docs/isms/evidence/`. Evidence files that contain provider screenshots (console settings, member lists, log excerpts) must not be committed if the repository ever goes public; keep them in a private location and reference them from here.

## Review calendar

| Activity                                                | Cadence                                          | Due next   | Record                                               |
| ------------------------------------------------------- | ------------------------------------------------ | ---------- | ---------------------------------------------------- |
| Log review                                              | Monthly (first week)                             | 2026-11-01 | `logging-and-monitoring.md` review log               |
| Access review (every provider)                          | Quarterly                                        | 2027-01-01 | `access-control-policy.md` access-review log         |
| Dependabot / npm audit triage                           | Weekly (with Dependabot PRs)                     | Continuous | PR history                                           |
| Restore test                                            | Quarterly                                        | 2027-01-01 | `backup-and-continuity.md` restore log               |
| Risk register review                                    | Annually, and after any incident or major change | 2027-10-01 | `risk-methodology-and-register.md`                   |
| Internal audit                                          | Annually                                         | 2027-09-01 | `internal-audit-and-management-review.md`            |
| Management review                                       | Annually (after internal audit)                  | 2027-10-01 | Minutes in `internal-audit-and-management-review.md` |
| Awareness refresher and competence record               | Annually                                         | 2027-10-01 | `acceptable-use-and-endpoint.md`                     |
| Supplier register review (DPAs, certifications current) | Annually                                         | 2027-10-01 | `supplier-register.md`                               |
| `security.txt` `Expires` renewal                        | Before 2027-10-01                                | 2027-09-01 | `public/.well-known/security.txt`                    |
| Privacy and terms page effective date review            | Annually                                         | 2027-10-01 | `src/content/legal.ts`                               |

## Adoption steps

1. Owner reads every file, corrects anything wrong, and changes Status to "Approved" with a date.
2. Work through the "planned" and "not started" items in `statement-of-applicability.md`, highest risk first (see register scores).
3. Collect provider evidence into `docs/isms/evidence/suppliers/`.
4. Book the calendar entries above.
