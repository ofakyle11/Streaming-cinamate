# Internal audit, management review and corrective action (clauses 9.2, 9.3, 10.1, 10.2; A.5.35, 8.34)

| Owner | Version | Date       | Review   | Status                   |
| ----- | ------- | ---------- | -------- | ------------------------ |
| Mark  | 0.1     | 2026-10-09 | Annually | Draft for owner approval |

## Internal audit programme (9.2)

- Frequency: annually (next due 2027-09-01), plus after an S1 incident or a scope change.
- Auditor: someone independent of the work audited. For a one-person company this means an external peer (another developer or founder), a consultant, or a structured AI-agent audit whose findings the owner cannot edit before they are logged. The auditor must not have authored the controls in the period audited; the Spencer role may audit engineering controls only if a different reviewer audits the Spencer role's own sign-offs.
- Method: document review of this folder and `docs/`, read-only access to provider consoles (screen-share or exported screenshots), repository and CI history, interview with the owner. No testing against production data without written owner approval (A.8.34); any test accounts are deleted afterwards.
- Output: findings classified as major nonconformity (requirement not met and risk unmanaged), minor nonconformity (partially met), observation (improvement). Each nonconformity becomes a CAPA entry.

## Annual internal audit checklist

| Clause            | Check                                                                                                                              | Evidence to inspect                                               | Result (C / NC-major / NC-minor / Obs) | Notes |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- | ----- |
| 4.1–4.2           | Context and interested parties current; new providers or user regions reflected                                                    | `scope.md` version, supplier register                             |                                        |       |
| 4.3               | Scope statement matches reality (sites, projects, branches, mailboxes)                                                             | Console lists vs `scope.md`                                       |                                        |       |
| 5.1–5.2           | Policy approved, dated, communicated; objectives measurable                                                                        | `information-security-policy.md` status line                      |                                        |       |
| 5.3               | Roles assigned; Spencer and Council reviews actually occurred on PRs                                                               | Sample 5 merged PRs                                               |                                        |       |
| 6.1.2–6.1.3       | Risk method applied; register reviewed in last 12 months; score-6 risks have treatments started within 30 days; acceptances signed | Register dates, CAPA log                                          |                                        |       |
| 6.1.3 d           | SoA covers all 93 controls; statuses match evidence; N/A justifications sound                                                      | SoA vs sampled controls (pick 10)                                 |                                        |       |
| 6.2               | Objectives O1–O7 measured; results recorded                                                                                        | Management review minutes                                         |                                        |       |
| 7.2–7.3           | Competence and awareness records exist and are dated within 12 months                                                              | `acceptable-use-and-endpoint.md` logs                             |                                        |       |
| 7.5               | Documents versioned, approved, current; no conflicting copies                                                                      | Git history                                                       |                                        |       |
| 8.1               | Operational procedures followed: monthly log reviews, quarterly access reviews, restore tests                                      | Review logs                                                       |                                        |       |
| 8.2–8.3           | Risk assessment and treatment performed as planned                                                                                 | Register                                                          |                                        |       |
| A.5.17 / 8.2      | Secrets register rotation dates filled; no standing PATs; MFA on all providers                                                     | Consoles                                                          |                                        |       |
| A.5.18            | Access review done quarterly; removals actioned                                                                                    | Access-review log                                                 |                                        |       |
| A.5.19–5.23       | DPAs and certifications collected for every processor                                                                              | `isms/evidence/suppliers/`                                        |                                        |       |
| A.5.24–5.28       | Incident procedure tested (tabletop at least once a year); log maintained; `security@` deliverable                                 | Incident log; send a test mail                                    |                                        |       |
| A.5.29–5.30, 8.13 | Backup decision recorded; backups exist; restore test passed in last quarter                                                       | Backup log                                                        |                                        |       |
| A.5.31, 5.34      | Privacy page matches actual processing; A1–A13 fixes done; DSAR log maintained                                                     | `legal.ts`, DSAR log                                              |                                        |       |
| A.8.3             | RLS on every table; CI `db` job green on production branch head                                                                    | GitHub Actions                                                    |                                        |       |
| A.8.4, 8.32       | Branch ruleset active with required checks; no direct pushes in sample                                                             | GitHub rulesets, branch history                                   |                                        |       |
| A.8.8             | Vulnerability SLA met for alerts closed in the period                                                                              | Dependabot history                                                |                                        |       |
| A.8.15–8.16       | Monitors active; monthly reviews ≥ 11/12                                                                                           | Review log, monitor dashboard                                     |                                        |       |
| A.8.31            | Previews in mock mode; `TMDB_API_KEY` Production-only                                                                              | Netlify env var screenshot; open a preview and confirm guest mode |                                        |       |
| 9.1               | Metrics collected for objectives                                                                                                   | Minutes                                                           |                                        |       |
| 9.3               | Management review held, minutes exist, actions tracked                                                                             | Minutes                                                           |                                        |       |
| 10.1–10.2         | CAPA log: every nonconformity has root cause, action, verification                                                                 | CAPA log                                                          |                                        |       |

## Audit record

| Audit date | Auditor | Scope | Majors | Minors | Observations | Report location |
| ---------- | ------- | ----- | ------ | ------ | ------------ | --------------- |
|            |         |       |        |        |              |                 |

## Management review (9.3)

Held annually after the internal audit (next 2027-10-01), chaired by the owner, ~90 minutes, minutes stored below. Additional review after any S1 incident.

### Agenda

1. Status of actions from the previous review.
2. Changes in external and internal issues (providers, law, user base, owner availability).
3. Performance against objectives O1–O7 (table with actuals).
4. Nonconformities and corrective actions (CAPA log status).
5. Monitoring and measurement results: uptime, log-review findings, access-review findings, restore tests, vulnerability SLA compliance.
6. Internal audit results.
7. Interested-party feedback: user reports, researcher reports, provider notices.
8. Risk assessment results and risk treatment plan status; new risks.
9. Supplier performance and DPA/certification currency.
10. Opportunities for improvement; resource needs (e.g. Supabase Pro, monitoring tool, hardware key).
11. Decisions: policy changes, objective changes, scope changes, risk acceptances.

### Minutes template

```
Management review — Lastframe.tv ISMS
Date:            Chair: Mark            Attendees:
1. Previous actions: [id, status]
2. Context changes:
3. Objectives:
   O1 cross-user exposures: __ (target 0)
   O2 vuln SLA: __% (target 100)
   O3 gated changes: __% (target 100)
   O4 restore tests: __/4
   O5 reviews on time: monthly __/12, quarterly __/4
   O6 DSAR/deletion within clock: __%
   O7 disclosure acks ≤72h: __%
4. CAPA status: open __, closed __, overdue __
5. Monitoring summary:
6. Internal audit: majors __, minors __, obs __
7. Feedback:
8. Risks: new __, re-scored __, accepted __
9. Suppliers:
10. Improvements / resources:
11. Decisions and actions: [id, action, owner, due]
Signed: Mark, date
```

### Management review minutes

| Date | Minutes (link or inline) | Decisions | Actions (CAPA ids) |
| ---- | ------------------------ | --------- | ------------------ |
|      |                          |           |                    |

## Nonconformity and corrective action log (10.2)

A nonconformity is any failure to meet a requirement of ISO 27001, this ISMS, a legal obligation, or a published promise. Sources: audits, reviews, incidents, failed restore tests, missed reviews, technical findings.

| CAPA id  | Date raised | Source (audit / review / incident / finding id) | Description                                               | Root cause                                | Correction (immediate)                        | Corrective action (prevent recurrence)                      | Owner          | Due        | Closed | Verified by / date |
| -------- | ----------- | ----------------------------------------------- | --------------------------------------------------------- | ----------------------------------------- | --------------------------------------------- | ----------------------------------------------------------- | -------------- | ---------- | ------ | ------------------ |
| CAPA-001 | 2026-10-09  | Finding F2                                      | No branch protection on the auto-deploy production branch | Repo set up quickly; process-only control | —                                             | Ruleset + CODEOWNERS per `secure-development-and-change.md` | Mark           | 2026-11-08 |        |                    |
| CAPA-002 | 2026-10-09  | Finding F4                                      | Netlify PATs used from agent sessions, never rotated      | No token lifecycle rule                   | Revoke all PATs                               | Access policy rule 7; secrets register                      | Mark           | 2026-11-08 |        |                    |
| CAPA-003 | 2026-10-09  | Finding P-3                                     | No SPF/DMARC/MX on apex; `security@` undeliverable        | Only `mail.` subdomain configured         | Add records at Spaceship; Google Workspace MX | Access review step 5 checks DNS                             | Mark           | 2026-11-08 |        |                    |
| CAPA-004 | 2026-10-09  | Finding A1                                      | Search terms sent to Plausible against privacy page       | Event prop added without privacy check    | Code fix                                      | Safety checklist item: privacy page updated for new data    | Spencer        | 2026-11-08 |        |                    |
| CAPA-005 | 2026-10-09  | Findings A2, D5                                 | No evidence deletion cron runs                            | Manual dashboard step                     | Run verification query                        | Ship schedule as migration; monthly review query            | Spencer        | 2026-12-09 |        |                    |
| CAPA-006 | 2026-10-09  | SoA 8.13                                        | No backup                                                 | Free tier, no decision taken              | Take one dump now                             | Record decision; quarterly restore tests                    | Mark           | 2026-12-09 |        |                    |
| CAPA-007 | 2026-10-09  | Finding F3                                      | `TMDB_API_KEY` readable by deploy previews                | Scope set by function not context         | Set Production-only context                   | KEYS.md updated; access review checks                       | Mark           | 2026-11-08 |        |                    |
| CAPA-008 | 2026-10-09  | Finding F1                                      | `.env*` not gitignored                                    | Oversight                                 | Add to `.gitignore`                           | —                                                           | Spencer        | 2026-11-08 |        |                    |
| CAPA-009 | 2026-10-09  | Findings A3–A13                                 | Privacy page inaccuracies                                 | Page written ahead of procedures          | —                                             | Fix list in `privacy-and-dsar.md`                           | Mark / Spencer | 2026-12-09 |        |                    |
| CAPA-010 | 2026-10-09  | Risk R-09                                       | No successor access                                       | Single operator                           | —                                             | Sealed envelope and emergency access                        | Mark           | 2026-12-09 |        |                    |

Verification of closure must be by someone other than the person who did the action where possible (Spencer verifies owner actions; owner verifies Spencer actions).
