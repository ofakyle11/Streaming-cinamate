# ISMS scope statement (ISO/IEC 27001:2022 clause 4)

| Owner | Version | Date       | Review   | Status                   |
| ----- | ------- | ---------- | -------- | ------------------------ |
| Mark  | 0.1     | 2026-10-09 | Annually | Draft for owner approval |

## 4.1 Context

Lastframe.tv is a web application that helps people find films and series, see where they stream, and keep a personal list, viewing history and ratings that sync across devices. It is operated by one person (the owner) in Canada, with no office, no employees and no self-hosted infrastructure. Everything runs on third-party cloud services. The service is free; there is no payment processing.

External issues: dependence on a small number of cloud providers; personal data of users in Canada, the EU/UK and elsewhere; terms of the TMDB and YouTube APIs; magic-link sign-in that makes the user's inbox the credential. Internal issues: single-person operation; development largely performed through AI-agent sessions reviewed by the owner; limited time for manual operations.

## 4.2 Interested parties and their requirements

| Party                                                                                                 | Requirement                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users (account holders and guests)                                                                    | Confidentiality of email and viewing data; ability to export and delete; service availability; the promises on `/privacy`, `/terms`, `/security` kept |
| Owner                                                                                                 | Low operating cost; continuity if unavailable; no legal exposure                                                                                      |
| Regulators (OPC Canada under PIPEDA; EU/UK authorities under GDPR/UK GDPR where users are there)      | Lawful processing, breach notification, data subject rights                                                                                           |
| Providers (Supabase, Netlify, Resend, TMDB, Google/YouTube, Plausible, Cloudflare, Spaceship, GitHub) | Compliance with their terms and acceptable-use policies; API key protection                                                                           |
| Security researchers                                                                                  | A working disclosure channel (`security.txt`, `security@lastframe.tv`)                                                                                |

## 4.3 Scope

**The ISMS covers the design, development, deployment and operation of the Lastframe.tv service and the information it processes.**

### Boundary

The scope boundary is the set of accounts and configurations the owner controls at each provider, the source repository, and the owner's endpoint devices. Provider infrastructure below the service boundary (data centres, hypervisors, networks, managed Postgres) is outside the scope and is relied upon through supplier controls (A.5.19–5.23).

### Assets in scope

- Source code and configuration: repository `github.com/ofakyle11/Streaming-cinamate`, production branch `claude/modest-johnson-ugzfhg`, `netlify.toml`, `supabase/config.toml`, `supabase/migrations/*`, CI workflows.
- Production site: `https://lastframe.tv` and `www.lastframe.tv` on Netlify (site `lastframe-tv`), including Netlify Functions `tmdb` and `health`, deploy previews and branch deploys.
- Supabase project `lastframe-tv` (US East): Postgres database (tables `profiles`, `watchlist`, `history`, `ratings`, `devices`, `account_deletion_requests`, `admin_users` from `supabase/migrations/20261007000000_admin_users.sql`), auth (`auth.users`), auth configuration, pg_cron jobs.
- Email sending: Resend domain `mail.lastframe.tv`, SMTP credentials, magic-link templates.
- DNS zone `lastframe.tv` at Spaceship.
- Cloudflare Turnstile widget (configured, currently off).
- Plausible analytics site `lastframe.tv`.
- TMDB API credential and proxy.
- Google Workspace mailboxes `security@`, `privacy@`, `legal@lastframe.tv` (and the owner's admin mailbox).
- Secrets: all API keys, tokens and passwords listed in `asset-inventory-and-classification.md`.
- Owner endpoint devices used to administer any of the above.
- Documented information: this ISMS folder and `docs/`.

### Interfaces and dependencies

| Interface                                                    | Direction                         | Data                                                            |
| ------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------- |
| Browser ↔ Netlify CDN                                        | Inbound                           | Static assets, server logs (IP, UA)                             |
| Browser ↔ Netlify Function `/api/tmdb` ↔ TMDB API            | Outbound                          | Catalogue queries (no user identity); TMDB key server-side only |
| Browser ↔ Supabase (auth, PostgREST)                         | Both                              | Email, session tokens, synced user data, under RLS              |
| Supabase ↔ Resend (SMTP) ↔ user inbox                        | Outbound                          | Sign-in emails containing the magic link                        |
| Browser ↔ image.tmdb.org, youtube-nocookie.com, plausible.io | Outbound                          | Artwork, trailers, cookieless page views                        |
| Browser ↔ challenges.cloudflare.com                          | Outbound (only when Turnstile on) | Bot-check token                                                 |
| GitHub ↔ Netlify                                             | Outbound                          | Build trigger on push to the production branch                  |
| Owner laptop ↔ provider consoles and CLIs                    | Admin                             | Credentials, configuration                                      |
| AI-agent sessions ↔ GitHub (and historically Netlify CLI)    | Admin, scoped tokens              | Code changes via PR                                             |

### Exclusions and justification

| Excluded                         | Justification                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Physical security of premises    | No premises; all compute and storage is at providers who hold SOC 2 / ISO 27001 attestations. Annex A 7.x controls are marked not applicable or provider-inherited in the SoA. |
| HR processes for employees       | No employees. Controls 6.1, 6.2, 6.4–6.6 are applied in reduced form to contractors and to the owner only.                                                                     |
| Provider internal infrastructure | Outside the owner's control; managed by supplier assurance.                                                                                                                    |
| Billing and payments             | Billing is mock-only; no Stripe or payment data exists. If payments are introduced the scope and SoA must be revised first.                                                    |
| Google OAuth sign-in             | Code exists but is disabled (`VITE_AUTH_GOOGLE` unset, `[auth.external.google] enabled = false`). In scope only once enabled; see risk R-23.                                   |
| Users' own devices and inboxes   | Outside the owner's control; addressed through user guidance on `/security`.                                                                                                   |

## 4.4 The management system

The ISMS consists of the documents listed in `README.md`, the technical controls in the repository, the provider configurations, and the recurring activities in the review calendar. Changes to scope are recorded in this file's version history and reflected in the SoA and risk register.
