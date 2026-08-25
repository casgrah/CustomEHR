# EHR — working sandbox

A real, empty, multi-tenant application. Vite + React + TypeScript on Supabase.
No dummy clients: you add the first one yourself and it's still there tomorrow.

**Nothing real goes in here.** This is a free-tier Supabase project with no BAA, so
it can hold invented data indefinitely and not one real client record.

---

## Setup, once

### 1. Database

In your Supabase project → **SQL Editor** → paste the whole of
`supabase/migrations/0001_init.sql` → **Run**.

That creates the schema, the row-level-security policies, the audit triggers, and the
signup trigger. It should finish with no errors. If it complains that a type or table
already exists, you've run it before — drop the tables or start a fresh project.

### 2. Turn off email confirmation (sandbox only)

Supabase → **Authentication → Sign In / Providers → Email** → turn **Confirm email**
off. Otherwise every test account needs a real inbox. Turn it back on before this is
ever real.

### 3. Environment

```bash
cp .env.example .env
```

Fill in from Supabase → **Project Settings → API**:

- `VITE_SUPABASE_URL` — the project URL
- `VITE_SUPABASE_ANON_KEY` — the **anon / public** key

The anon key belongs in the browser; that's what it's for. The **service_role** key
must never appear in this repo, in `.env`, or in any file under `src/`. If it ever
does, rotate it immediately — it bypasses every policy below.

### 4. Run

```bash
npm install
npm run dev
```

---

## First five minutes

1. **Sign up.** Give your name and an agency name. You become the **owner** of a new
   tenant, and it gets seeded with four value lists and one facility.
2. **Add a client.** Census is empty — it says so, and offers the button. Fill in the
   form; leave "open an episode now" ticked and pick a level of care.
3. **Look at the chart.** Header, episodes, and the settled section list with
   everything else marked *not built*.
4. **Discharge and re-admit.** The episode table has a discharge dropdown fed by the
   Discharge reasons value list. Discharging doesn't delete anything.
5. **Invite yourself again.** Users → invite a second email → sign out → sign up with
   that address. You land in the *same agency* with the role you chose. That's the
   multi-tenant model working.
6. **Retire a value.** Configure → Discharge reasons → retire one. It vanishes from
   the picker; episodes already using it still read correctly.

---

## What's here

| Area | State |
|---|---|
| Auth, signup, invitations | Working |
| Tenants, RLS isolation | Working, enforced in the database |
| Users — roles, deactivate | Working |
| Clients — add, list, chart header | Working |
| Episodes — admit, discharge, history | Working |
| Value lists — retire/reinstate/add | Working |
| Audit log | Written by triggers; no UI yet |
| Everything else | Prototypes, not ported |

## Architecture, briefly

**Tenant isolation lives in the database.** Every table carries `tenant_id`, RLS is on,
and policies compare against `current_tenant_id()` — a `SECURITY DEFINER` function that
reads the caller's profile. No query in `src/` filters by tenant, because it doesn't
have to and shouldn't be trusted to.

**Nothing is deleted.** Users deactivate, value list items retire, episodes discharge.
Anything already referencing them keeps resolving.

**References bind to IDs and codes, never labels.** Renaming "Left against advice" does
not orphan the episodes that used it.

**No server.** Invitations are rows, and the signup trigger reads them — which is why
no service-role key is needed in the browser. When you need real server work (document
generation, scheduled jobs, sending invitation emails), that's a Supabase Edge Function,
not a rewrite.

**Half-open date intervals.** `[admit_date, discharge_date)`. Two episodes overlap when
`A.admit < B.discharge AND B.admit < A.discharge` — strictly less-than, never `<=`.
Same rule as group time boxes.

## Deploying

Static build; both configs are already here.

- **Netlify** — build `npm run build`, publish `dist`. `public/_redirects` handles routing.
- **Vercel** — framework Vite, `vercel.json` handles routing.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the host.

## Layout

```
supabase/migrations/0001_init.sql   schema, RLS, triggers — the whole database
src/lib/supabase.ts                 client
src/lib/session.tsx                 session, profile, tenant, role
src/components/Shell.tsx            chrome and nav
src/components/ui.tsx               Card, Field, Tag, Avatar, date helpers
src/pages/Auth.tsx                  sign in / sign up
src/pages/Census.tsx                client list
src/pages/ClientNew.tsx             add client + optional admission
src/pages/ClientChart.tsx           chart header, episodes, section map
src/pages/Users.tsx                 people, roles, invitations
src/pages/Configure.tsx             value lists
src/styles.css                      the prototypes' design system
src/types.ts                        row types and the role table
```

## Next slices

Roughly in order of how much they unblock:

1. **Group note** — the highest-traffic screen, and the one with the most settled behavior.
2. **Individual progress note** with objective ratings — needs problems/objectives tables first.
3. **Authorizations / coverage** — needs its own tables; the rules are fully specified.
4. **Schedule and rotation** — self-contained, and it's what the QA rules read.
5. **Chart Check** — falls out once documents exist to be due.

The prototypes remain the spec. They are not the source.
