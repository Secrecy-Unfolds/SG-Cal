# SG Calendar

A private calendar for a small trusted group (login required — no public
sign-up). Every entry is either a **Meeting** or a **Task**, with a
description/agenda, and it emails every user automatically:

- **Immediately** when a meeting or task is created, updated, or canceled
- **Every Saturday at 8:00 AM (Asia/Muscat)** — a "get ready" digest of every
  upcoming meeting and task (skipped if there are none)
- **Every day at 12:00 AM (Asia/Muscat)** — a digest of that day's meetings
  and tasks (skipped if there are none)
- **1 hour before a meeting starts**
- **3 hours before a task's due time**

Also has a dark mode toggle and a profile page for changing your password.

### Roles

Meetings stay open to everyone to create/edit/delete. Roles control two
things: the **Manage Users** page (`/users`), and who a task can be
assigned to / who can edit an assigned task:

- **User** — no access to Manage Users. Can only assign a task to
  themselves (or leave it unassigned), and can only edit/delete a task
  that's assigned to them or still unassigned.
- **Admin** — everything a User can do, plus: can open Manage Users and add
  new **User** accounts (not Admin/Super Admin), can assign a task to
  *anyone*, and can edit/delete any task regardless of who it's assigned to.
- **Super Admin** — same task powers as Admin, plus can add User or Admin
  accounts. There can only ever be one Super Admin in the system (currently
  MUTahir); it isn't an assignable role in the Add User form at all — the
  API rejects it outright.

New accounts are added from the Manage Users page now, not through `.env`
seed values (those only bootstrap the first account or two — see SETUP.md).

### Task assignment & status

Every task has an assignee (or none — **Backlog**) and a status:
Backlog → Pending → In Progress → Review Needed → Closed. Assigning a task
moves it out of Backlog into Pending automatically; unassigning it drops it
back to Backlog. Only Admin-level accounts can move a task's status to
**Closed** — anyone who can edit the task can move it through every other
status. Task creation/update/cancellation emails include the current
assignee and status.

### Procurement Planning (Admin-level only)

A `/procurement` section for tracking purchases: each **product** has a
picture, description, purpose ("required for"), a needed-by date, quantity,
customs notes, and expected purchase/arrival dates, plus its own status —
Planning → Ordered → In Transit/Customs → Received (or Cancelled). Its
**vendor comparisons live inside the product** — each product can have
several possible vendors compared side by side (niche, country, pricing,
payment terms, a 1-5 quality rating, delivery period, warranty), with one
markable as **preferred**, plus free-text preference remarks explaining the
choice. Capital needed isn't typed in directly — it's calculated from
**unit price × quantity + shipping cost + customs cost**, shown live as you
fill in the form.
Product pictures upload to Vercel Blob storage — see SETUP.md Part 11.
Plain `user` accounts can't see or access this section at all. Every
create/update/delete on a product or vendor emails all Admin-level accounts
(Admin + Super Admin) — separate from the calendar's notifications, and
also respecting `EMAIL_TEST_MODE` (only Super Admin while testing).

## Stack

Next.js (App Router) on Vercel, Postgres for storage, a Google Apps Script
web app as the email relay. Vercel Cron handles the two daily/weekly
digests; the two time-before reminders are driven by a free external
scheduler (cron-job.org) hitting a protected endpoint every 10-15 minutes,
since Vercel's free plan only allows daily-or-less-frequent crons.

## 1. One-time setup

### a) Email relay token

Email is sent by POSTing `{ token, to, subject, body, name }` to your
Google Apps Script web app
(`https://script.google.com/macros/s/.../exec`, already wired in as the
default). You just need:

- `EMAIL_TOKEN` — the token your script checks before sending
- `EMAIL_SENDER_NAME` — the `name` field it expects (e.g. your company/site name)

Only set `EMAIL_ENDPOINT_URL` in `.env` if you redeploy the script to a new URL.

### b) Postgres database

Easiest path: create a free Vercel project (step 3 below), then in the
Vercel dashboard go to **Storage → Create Database → Postgres** (Neon) and
connect it to the project. Vercel will give you a `DATABASE_URL` — copy it.

(Any other Postgres works too — Supabase, Neon directly, etc. — just paste
its connection string.)

### c) Configure `.env`

```
cp .env.example .env
```

Fill in:

- `DATABASE_URL` — from step (b)
- `SESSION_SECRET` / `CRON_SECRET` — generate each with:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `EMAIL_TOKEN` / `EMAIL_SENDER_NAME` — from step (a)
- `SEED_USER1_*` / `SEED_USER2_*` — pick a username + password for you and
  your friend, and each person's real email address (where the reminders go)

### d) Create tables + accounts

```
npm install
npm run setup
```

This creates the `users`/`events` tables and upserts your two accounts. You
can re-run it any time (e.g. to change a password) — it's safe to repeat.

## 2. Run locally

```
npm run dev
```

Open http://localhost:3000, log in with one of the seeded accounts, and
create a test event — you should get an email within a few seconds.

To test the digest emails locally without waiting for Saturday/midnight:

```
curl -H "Authorization: Bearer <your CRON_SECRET>" http://localhost:3000/api/cron/saturday-digest
curl -H "Authorization: Bearer <your CRON_SECRET>" http://localhost:3000/api/cron/midnight-digest
```

## 3. Deploy to Vercel

```
npm i -g vercel
vercel link
vercel env add DATABASE_URL production
vercel env add SESSION_SECRET production
vercel env add EMAIL_TOKEN production
vercel env add EMAIL_SENDER_NAME production
vercel env add CRON_SECRET production
vercel --prod
```

(`SEED_USER*` vars are only needed locally for `npm run setup` — no need to
add them to Vercel.)

`vercel.json` already declares the two cron schedules; they activate
automatically once deployed. On Vercel's free (Hobby) plan, cron jobs may
fire up to roughly an hour after the scheduled time rather than exactly on
the minute.

## Notes

- All times in the UI and emails are shown in **Asia/Muscat**. If either of
  you is often in a different timezone, say so and the app can be adjusted.
- Either account can create/edit/delete any event — there's no per-user
  ownership restriction, since this is just for the two of you.
- Both of you always get every email, regardless of who created the event.
