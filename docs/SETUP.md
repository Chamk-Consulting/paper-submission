# Hyper Papers — setup and configuration

Everything needed to run the site, in the order to do it. Settings the app reads live in `.env.example` (one line
each, with where to get the value). Switches that admins change live in **Admin › Venues** inside the app.

---

## 1. Run it on your computer

1. Install Node.js 22 and Git.
2. `git clone https://github.com/Chamk-Consulting/paper-submission.git && cd paper-submission`
3. `npm install`
4. `cp .env.example .env.local` and fill in the blank secrets (see section 3). The public values are already filled.
5. `npm run dev` → open http://localhost:3000
6. Checks before pushing: `npx tsc --noEmit`, `npm test`, `npx next build`.

Pushing to `main` deploys to production on Vercel automatically.

## 2. Accounts and where things live

| Service | What for | Where |
|---|---|---|
| GitHub | Code | `Chamk-Consulting/paper-submission` |
| Vercel | Hosting, scheduled jobs, LaTeX build sandboxes | Project `paper-submission` (team nessim-teams) |
| Supabase | Database, sign-in, files | Project `wxhtcbqtnugniivkbseu` (Frankfurt) |
| Resend | Sending email | Domain `resend.ghazirabeh.com` |

Database changes are in `supabase/migrations/` (applied in name order).

## 3. Secrets to set (Vercel › Settings › Environment Variables, marked Sensitive)

| Name | Status | How to get it |
|---|---|---|
| `PLENARY_SIGNING_SECRET` | Set | Long random string; must equal the database value `private.app_secrets('signing')` |
| `RESEND_API_KEY` | Set — **rotate** | resend.com › API Keys. It was once pasted in chat: make a new key, update Vercel, delete the old one |
| `SEND_EMAIL_HOOK_SECRET` | Set — **rotate** | Supabase › Authentication › Hooks › Send Email. Regenerate there and update Vercel at the same time |
| `SUPABASE_SECRET_KEY` | Missing | Supabase › Project Settings › API › Secret keys. Only the nightly jobs need it |
| `CRON_SECRET` | Missing | Any long random string. Only the nightly jobs need it |
| Turnstile, Stripe, Anthropic, similarity keys | Optional | Each feature stays off until its keys are set |

After changing environment variables in Vercel, redeploy (Deployments › … › Redeploy) so they take effect.

## 4. Supabase settings (dashboard)

**Authentication › URL Configuration**
- Site URL: `https://paper-submission-nessim-teams.vercel.app` (your own domain later).
- Redirect URLs: add `https://paper-submission-nessim-teams.vercel.app/**` and `http://localhost:3000/**`.

**Authentication › Providers › Email**
- Email OTP length: **6** (matches the six code boxes).
- Minimum password length: **8 or lower** — the app's own rules (Admin › Password rules) do the real check.

**Authentication › Hooks**
- Send Email hook → `https://paper-submission-nessim-teams.vercel.app/api/auth/send-email`, with the secret above.

**Passkeys** (only if you turn passkey sign-in on)
- Authentication › Passkeys › Enable.
- Relying Party ID: `paper-submission-nessim-teams.vercel.app` · Origin: `https://paper-submission-nessim-teams.vercel.app`.
- Moving to your own domain later means people add their passkeys again, so set the domain first if you can.

**ORCID** (sign-in switch is on by default)
1. Register an app at https://orcid.org/developer-tools → client ID and secret.
2. Supabase › Authentication › Providers › New Provider → OIDC, identifier `custom:orcid`, issuer `https://orcid.org`,
   scopes `openid`, turn on **email optional**, paste the client ID and secret.
3. Copy the callback URL Supabase shows into the ORCID app's redirect URIs.
4. Authentication › Settings: turn on **manual linking** (used by "Connect ORCID" on the profile page).
   Until this is done, the ORCID button says it isn't available yet.

**Google** (switch off by default): Authentication › Providers › Google, with a Google Cloud OAuth client.
**Institution sign-on** (switch off by default): SAML SSO, needs a paid Supabase plan.

## 5. Switches inside the app (Admin › Venues)

| Box | Setting | Now |
|---|---|---|
| Public site and sign-in | Home event | `codit-2027` |
| | Events-only site (home opens the events list, organizer/pricing links hidden) | On |
| | Ways to sign in: Password · Email link or code · ORCID | On |
| | Ways to sign in: Passkey · Google · Institution | Off |
| | New accounts confirm their email with a code | Off |
| | Languages (language picker) | On |
| Password rules | Shortest length | 8 |
| | Must contain | Letters and a number |
| | Or a phrase of at least | 12 |
| | Refuse leaked passwords | On |

Changes show on the site within a minute.

## 6. Per event (Manage › event › Setup)

- **Basics:** name, short name, website, **Submissions on another site** (paste a PaperCept or other link and every
  Submit button for that event opens it instead of the form here).
- **Dates, paper types, fees, venue & travel, program** in their own setup pages.
- On the public event page, sections hidden for now (Policies, Publication, Attending, Venue & travel, Program,
  Organizers) are listed in `components/venues/venue-page.tsx` → `HIDDEN_SECTIONS`; remove a name to show it again.

## 7. Before going live on your own domain

1. Add the domain in Vercel › Domains; set `NEXT_PUBLIC_SITE_URL` to it.
2. Supabase Site URL and Redirect URLs → the new domain.
3. Resend: verify the domain, then change `EMAIL_FROM_*` and `NEXT_PUBLIC_NO_REPLY_EMAIL`.
4. Passkeys: update the Relying Party ID and origin (before people start adding passkeys).
5. ORCID / Google: add the new callback URLs.
6. Rotate any secret that was ever shared in chat.
