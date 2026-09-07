# Squad Calendar

A private calendar for two people (login required). Add events with a
description/agenda, and it emails both of you automatically:

- **Immediately** when an event is created
- **Every Saturday at 8:00 AM (Asia/Muscat)** — a "get ready" digest of every
  upcoming event (skipped if there are none)
- **Every day at 12:00 AM (Asia/Muscat)** — a digest of that day's events
  (skipped if there are none)

## Stack

Next.js (App Router) on Vercel, Postgres for storage, a Google Apps Script
web app as the email relay, Vercel Cron for the two scheduled digests. Two
accounts only — no public sign-up.

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
