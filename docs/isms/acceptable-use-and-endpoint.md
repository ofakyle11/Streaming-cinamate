# Acceptable use, endpoint security, awareness and competence (A.5.10, 6.3, 6.7, 7.7, 7.9, 7.14, 8.1)

| Owner | Version | Date       | Review   | Status                   |
| ----- | ------- | ---------- | -------- | ------------------------ |
| Mark  | 0.1     | 2026-10-09 | Annually | Draft for owner approval |

Applies to the owner and to any contractor or peer reviewer with access to Lastframe.tv systems. User-facing acceptable use is on `/terms`.

## Operator acceptable use policy

1. Use Lastframe.tv systems and data only to operate and improve the service. Never browse, export or share user data except to fulfil a DSAR, investigate an incident, or restore service, and record each such access in the quarterly review.
2. Keep company and personal accounts separate: provider accounts are registered to a `lastframe.tv` mailbox (or a dedicated owner address), not to a personal mailbox shared with other services. Recovery addresses are also under the owner's control with MFA.
3. Credentials live only in the password manager. Never paste secrets, tokens, user emails or database rows into chat tools, AI assistants, issues, pull requests, screenshots or email. AI-agent sessions receive repository access only.
4. Do not install unvetted browser extensions on the profile used for provider consoles; use a separate browser profile for administration.
5. Do not administer providers from shared or public computers. Public Wi-Fi only with the OS firewall on and HTTPS (all consoles are HTTPS).
6. Report any suspected compromise, lost device or mistaken disclosure immediately (`incident-response.md`), even if self-caused.
7. Do not test security against production with real user accounts other than your own; use mock mode or a throwaway Supabase project.

## Endpoint requirements (A.8.1, 6.7, 7.7, 7.9)

| Requirement                                                                            | Laptop      | Phone                               | How to evidence (annual self-check) |
| -------------------------------------------------------------------------------------- | ----------- | ----------------------------------- | ----------------------------------- |
| Full-disk encryption on (FileVault / BitLocker / LUKS)                                 | Required    | Required (default on modern phones) | Screenshot of setting               |
| OS and browser automatic updates on; updates applied within 14 days                    | Required    | Required                            | Version screenshot                  |
| Password manager with MFA, master password ≥ 16 chars, not reused                      | Required    | Required                            | Confirmed                           |
| MFA for every provider; authenticator app or hardware key; SMS off where possible      | Required    | Authenticator here                  | Per-provider list in access review  |
| Screen lock ≤ 5 minutes, password/biometric on wake                                    | Required    | Required                            | Setting                             |
| Remote wipe / Find My enabled                                                          | Required    | Required                            | Setting                             |
| OS firewall on; no inbound services                                                    | Required    | n/a                                 | Setting                             |
| Local admin rights used only for installs                                              | Recommended | n/a                                 | —                                   |
| No secrets in plain files; `.env.local` only for mock-safe values or deleted after use | Required    | n/a                                 | Spot check                          |
| Backups of the laptop exclude database dumps unless encrypted                          | Required    | n/a                                 | Backup config                       |
| Clear screen when away; no printed secrets except the sealed envelope                  | Required    | —                                   | —                                   |

## Lost or stolen device steps

1. Remote wipe / mark lost from another device.
2. Change the password-manager master password; revoke the lost device's session in the password manager.
3. Sign out all sessions and revoke tokens at GitHub, Netlify, Supabase, Resend, Spaceship, Cloudflare, Google Workspace; regenerate MFA on a new device using recovery codes.
4. Rotate any secret that was present on the device outside the password manager (`.env.local`, CLI tokens, Supabase access token).
5. Record as an incident (S2 if any credential may have been accessible).

## Disposal or reuse (A.7.14)

Before selling, recycling or passing on a laptop or phone: sign out of all accounts, remove from the password manager's device list, perform a full factory reset / cryptographic erase, confirm encryption was on throughout its life. Record the date in the competence/awareness log.

## Awareness and training (A.6.3)

Annual, ~1 hour, self-administered by the owner (and given to any contractor at joining):

1. Re-read `information-security-policy.md`, this AUP, `incident-response.md` and `privacy-and-dsar.md`.
2. Phishing refresher: the only legitimate Lastframe.tv email is the sign-in link from `no-reply@mail.lastframe.tv`; provider emails asking for passwords are phishing; verify by opening the console directly.
3. Secrets handling refresher: `VITE_` is public; `service_role` never leaves the dashboard; rotate-then-remove on any leak.
4. Review the current risk register top items and open corrective actions.
5. Run the endpoint self-check above.
6. Record in the log.

## Awareness log

| Date       | Person | Material covered    | Endpoint self-check passed | Notes |
| ---------- | ------ | ------------------- | -------------------------- | ----- |
| 2026-10-__ | Mark   | ISMS v0.1 induction |                            |       |

## Competence record (clause 7.2)

| Role                          | Person                              | Required competence                                                                                                                          | Evidence                                                    | Gaps / plan                                                                                              | Date |
| ----------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---- |
| Owner / security lead         | Mark                                | Operating the stack (Netlify, Supabase, Resend, DNS); reading CI output; incident containment steps; PIPEDA/GDPR basics; ISO 27001 structure | Built and operates the service; this ISMS; `docs/` runbooks | Consider a short ISO 27001 lead-implementer or PIPEDA course; name an external peer for the annual audit |      |
| Security owner (Spencer role) | AI-agent reviewer / designated peer | Secure code review, Supabase RLS, CSP, CI; verifying rather than trusting PR claims                                                          | Review history on PRs                                       | Written reviewer checklist in `secure-development-and-change.md`                                         |      |
| Council reviewers             | AI-agent reviewers / peers          | Per `docs/AGENTS.md`                                                                                                                         | PR approvals                                                | —                                                                                                        |      |
| Successor                     | Named in sealed envelope            | Can follow the successor sheet and shutdown runbook                                                                                          | Walk-through once                                           | Schedule a 30-minute walk-through                                                                        |      |
| Contractors (if any)          | —                                   | Per task                                                                                                                                     | Joiner record                                               | —                                                                                                        |      |
