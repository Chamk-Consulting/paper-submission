# Plenary — paper submission & review

Next.js 16 (App Router, Cache Components) · Supabase (Postgres, Auth, Storage, RLS) · Vercel · Resend.

## Run locally

```bash
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm install
npm run dev
```

Database changes live in `supabase/migrations` and are applied to staging/production only through migrations.
RLS smoke test: `supabase/tests/rls_smoke.sql` (runs in a transaction and rolls back).

## Layout

| Path | What |
|---|---|
| `proxy.ts` | Refreshes the session, redirects signed-out users from `/workspace`. Nothing else. |
| `lib/config/site.ts` | Everything that depends on the domain (`TODO(domain)`). |
| `lib/supabase/{server,browser,public,admin}.ts` | Clients. `admin` bypasses RLS — server-only, system jobs only. |
| `lib/auth/actions.ts` | Sign up / in / out, forgot + reset password (server actions, Zod-validated). |
| `app/auth/confirm` · `app/auth/callback` | Email links (token hash) and OAuth return. |
| `app/(auth)/*` | Sign-in, sign-up, check email, email verified, forgot/reset password, link error, account help. |
| `supabase/migrations` | Identity model: persons ≠ logins, multi-email, affiliations, venues, roles, audit log, RLS. |

## Environments

| | Supabase | App |
|---|---|---|
| Staging | `paper-submission-staging` (eu-central-1) | Vercel preview / staging |
| Production | TODO: create when staging is signed off | Vercel production |

## Open TODOs (search the code for `TODO(`)

**Domain (`TODO(domain)`)** — nothing blocks development; all of these read `NEXT_PUBLIC_SITE_URL` / env:
1. Set `NEXT_PUBLIC_SITE_URL` in Vercel (production + staging).
2. Supabase Auth → URL configuration: Site URL + redirect URLs.
3. Resend: add + verify `mail.<domain>` (SPF, DKIM, DMARC); switch `EMAIL_FROM_*`.
4. Attach domain + `staging.` subdomain in Vercel.
5. Legal entity/contact in legal pages and email footers; support address in Account help.

**Auth (`TODO(auth)`)**
- Custom SMTP (Resend) in Supabase dashboard — Supabase's built-in email is rate-limited (testing only).
- Email templates (dashboard) must link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…` — copies in `supabase/templates`.
- Turnstile CAPTCHA on sign-up / sign-in / reset.
- Google, Microsoft, ORCID (custom OIDC) providers.
- "Resend confirmation" button; "password changed" email; handle email change → `person_emails`.
- Account help flows: lost email (AH02), merge (AH03), claim paper (AH06). Require MFA for chairs.

**Database (pending)**
- `20261018000300_venues_single_select_policy.sql` — written, not yet applied to staging (needs approval).
- Run `supabase/tests/rls_smoke.sql` on staging (needs approval).
