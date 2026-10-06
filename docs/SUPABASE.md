# Supabase: switching the login backend on

The app runs in guest (mock) mode until two public variables reach the production build. This
is the runbook for turning the real backend on, in order. Everything the code needs is in the
repo; the steps marked **hands** need an account only the owner has.

## What is in the repo

| Piece                                                      | Where                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| Tables, RLS policies, triggers, deletion queue + processor | `supabase/migrations/*.sql` (`supabase/schema.sql` mirrors the sync tables) |
| Devices table ("where you are signed in")                  | `supabase/migrations/20261006000000_devices.sql`                            |
| Auth settings, redirect allow-list, email template, SMTP   | `supabase/config.toml` (`[auth]` section)                                   |
| Branded magic-link email                                   | `supabase/templates/magic-link.html` (+ `.txt`)                             |
| RLS check (two users, anon, cascade)                       | `supabase/tests/rls_check.sql`, `npm run db:check`, CI job `db`             |
| Client adapters                                            | `src/services/auth/live.ts`, `src/services/db/live.ts`                      |

Every table has Row Level Security with own-row policies for `authenticated` and nothing for
`anon`. The anon key is public by design; the policies are the gate. The service role key is
never used by the app and must never be put in Netlify.

## 1. Create the project (hands)

1. <https://supabase.com/dashboard> → **New project**. Organisation: yours. Name: `lastframe-tv`.
   Region: **US East (N. Virginia)** (the privacy page says US East). Database password: generate
   one and keep it in a password manager; the app never uses it.
2. **Project Settings → API**: copy the **Project URL** (`https://<ref>.supabase.co`) and the
   **anon public** key. Ignore `service_role`.

## 2. Apply the schema and settings

The repo is not linked to the Supabase project (and does not need to be). Either run the
CLI from any machine with the repo, or paste the SQL by hand (below).

From a machine with the repo and the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npx supabase login                      # opens the browser once (or export SUPABASE_ACCESS_TOKEN=sbp_...)
npx supabase link --project-ref <ref>   # the <ref> from the project URL
npx supabase db push                    # applies supabase/migrations/*.sql
export RESEND_API_KEY=re_...            # from step 4; any value works before Resend exists
npx supabase config push                # applies [auth] from supabase/config.toml
```

`config push` sets: Site URL `https://lastframe.tv`; redirect allow-list
`https://lastframe.tv/auth/callback`, `https://www.lastframe.tv/auth/callback` and the two
localhost entries; magic links valid 15 minutes and single use; one link per address per 45 s;
sign-ups on; email change confirmed from both addresses; the Lumen magic-link template with the
subject `Your Lastframe.tv sign-in link`; Resend as SMTP sender. The CLI shows the diff and asks
before applying.

Two settings are dashboard-only; set them once under **Authentication → Attack Protection** /
**Sign In / Providers**:

- **Prevent email enumeration** (email enumeration protection): **on**.
- **Confirm email**: leave **off** (magic links are their own confirmation; the config already
  says so).

Then schedule the deletion processor, which erases accounts queued from the account page
(**SQL Editor**, run once):

```sql
create extension if not exists pg_cron;
select cron.schedule('lf-process-account-deletions', '*/15 * * * *',
                     $$select public.lf_process_account_deletions()$$);
```

Without the CLI, the same can be done by hand: paste each file in `supabase/migrations/` into
the **SQL Editor** in file-name order, then set the values above in **Authentication → URL
Configuration**, **Email Templates → Magic Link** (body from `supabase/templates/magic-link.html`)
and **SMTP Settings**.

## 3. Add the two variables in Netlify (hands)

Site `lastframe-tv` → **Site configuration → Environment variables → Add a variable**:

| Key                      | Value                       | Scopes     | Deploy contexts     |
| ------------------------ | --------------------------- | ---------- | ------------------- |
| `VITE_SUPABASE_URL`      | `https://<ref>.supabase.co` | **Builds** | **Production** only |
| `VITE_SUPABASE_ANON_KEY` | the anon public key         | **Builds** | **Production** only |

Production only means deploy previews and branch deploys keep mock mode. Both values are
public; do not mark them as secret (Netlify would then refuse to inline them into the bundle).

The next production build picks them up: `src/services/index.ts` switches auth and the
database to the live adapters, and `scripts/security-headers.mjs` pins the Content Security
Policy's `connect-src` to `https://<ref>.supabase.co` and `wss://<ref>.supabase.co` instead
of the `*.supabase.co` wildcard. Nothing else changes.

### Deploying so the variables are inlined

Netlify builds production from git (branch `claude/modest-johnson-ugzfhg`, `npm run build`),
and every git build runs with the site's **Production** variables. So after adding the two
variables, either trigger a build (**Deploys → Trigger deploy → Deploy site**) or merge the
next PR; nothing else is needed. The deploy log prints
`security-headers: ... supabase https://<ref>.supabase.co` when the pin took; `supabase off`
means the variables did not reach the build (wrong scope or context) and that deploy still
serves guest mode.

A build made elsewhere (a laptop, a cloud session) does not see the Netlify variables. If the
CLI is ever used for a production deploy again, build through it so they are injected:
`npx netlify build --context production --site bd791a0a-dcc5-46d3-8e59-8b91a115d929` and then
`npx netlify deploy --prod --site bd791a0a-dcc5-46d3-8e59-8b91a115d929`. A plain
`npm run build` followed by `netlify deploy` would ship guest mode.

## 4. Email sender: Resend (hands)

Supabase's built-in mailer sends at most 2 emails an hour, enough to test, not to launch.

1. <https://resend.com> → sign up → **API Keys → Create** (permission _Sending access_, domain
   _all_). Copy the key (`re_...`); it is shown once.
2. **Domains → Add domain**: `mail.lastframe.tv`, region **North Virginia (us-east-1)**.
   Resend then lists DNS records. Add them at **Spaceship → lastframe.tv → DNS**:

   | Type | Host (at Spaceship)      | Value                                                | Purpose          |
   | ---- | ------------------------ | ---------------------------------------------------- | ---------------- |
   | MX   | `send.mail`              | `feedback-smtp.us-east-1.amazonses.com`, priority 10 | bounces (SPF)    |
   | TXT  | `send.mail`              | `v=spf1 include:amazonses.com ~all`                  | SPF              |
   | TXT  | `resend._domainkey.mail` | `p=MIGf...` (the long key Resend shows)              | DKIM             |
   | TXT  | `_dmarc.mail`            | `v=DMARC1; p=none;`                                  | DMARC (optional) |

   Spaceship wants the host relative to `lastframe.tv`; if the editor expects the full name use
   `send.mail.lastframe.tv` and `resend._domainkey.mail.lastframe.tv`. Copy the exact values
   from Resend's page, the DKIM key is unique to the domain. Click **Verify** in Resend; it
   usually passes within a few minutes.

3. Put the key where the config is pushed from (`export RESEND_API_KEY=re_...`) and run
   `npx supabase config push` again if it was pushed with a placeholder. Sender address is
   `no-reply@mail.lastframe.tv`, display name `Lastframe.tv` (both in `config.toml`).

## 5. Check it

1. Open <https://lastframe.tv/sign-in>, request a link, open the email (light and dark mail
   clients), click it: `/auth/callback` signs you in and returns to the page you came from.
2. **Account**: this browser appears under devices; open the site in a second browser, sign in,
   forget it from the first: the second signs itself out within a few minutes (on tab focus).
3. **Sign out everywhere** signs out both.
4. The RLS check already ran in CI against the migrations. To run it against a local
   PostgreSQL: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run db:check`
   (never against the real project; the script refuses Supabase hosts).

## Later switches

- **Turnstile** (bot check on the sign-in form): set `VITE_TURNSTILE_SITE_KEY` in Netlify and,
  in the same release, `[auth.captcha] enabled = true` with `TURNSTILE_SECRET_KEY` exported
  before `config push`. One without the other breaks sign-in (see `docs/KEYS.md`).
- **Google**: create the OAuth client with the Supabase callback URL
  (`https://<ref>.supabase.co/auth/v1/callback`) as its redirect, export
  `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`, set `[auth.external.google] enabled =
true`, push, then `VITE_AUTH_GOOGLE=1` in Netlify.
- **Paid tier** (25 USD a month) only for daily backups or to stop the free project pausing
  after a week without traffic.

## How the devices list works

Supabase does not expose a user's sessions to the browser, so the app keeps `public.devices`:
one row per browser (random id in localStorage `lf.device`), written on sign-in and refreshed on
tab focus and every 5 minutes. "Forget this device" sets `revoked_at`; the forgotten browser
sees that on its next check, deletes its row and signs itself out locally. "Sign out
everywhere" is Supabase's global sign-out, which revokes every refresh token; access tokens
expire within 30 minutes (`jwt_expiry`). A device can only ever write its own user's rows, and
a revoked row cannot be un-revoked by the client (trigger).
