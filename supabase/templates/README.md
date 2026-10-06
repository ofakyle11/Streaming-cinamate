# Auth email templates

Branded (Lumen) templates for the Supabase Auth emails.

The quick way: `supabase/config.toml` points `[auth.email.template.magic_link]` at
`magic-link.html` with the subject below, so `npx supabase config push` installs it (see
`docs/SUPABASE.md`). The dashboard steps are the fallback when the CLI is not at hand.

## Magic link (by hand)

1. Open **Authentication → Email Templates → Magic Link** in the Supabase dashboard.
2. Subject: `Your Lastframe.tv sign-in link`.
3. Paste `magic-link.html` into the body. The dashboard has one body field; it is sent as HTML.
   Keep `magic-link.txt` as the plain-text reference for a custom SMTP or Resend setup that
   supports a text part.
4. Save, then send yourself a link from `/sign-in` and check it in light and dark mail clients.

Variables used: `{{ .ConfirmationURL }}` (the link, which lands on `/auth/callback`),
`{{ .SiteURL }}` (set under **Authentication → URL Configuration**) and `{{ .Email }}`.
The mark is loaded from `{{ .SiteURL }}/apple-touch-icon.png`, so the Site URL must be the
production origin (`https://lastframe.tv`), never a deploy preview, or production mail would carry a
preview link and icon.

Email clients do not support CSS custom properties, so the Lumen tokens are inlined as literal
values in the template (they are copied from `src/styles/tokens.css`; update both together).
