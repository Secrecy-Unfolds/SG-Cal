# Setup Guide (for total beginners)

This walks you through everything, in order, assuming you've never used a
terminal or deployed a website before. Follow it top to bottom — don't skip
ahead. Each step says exactly what to type and what you should see.

A few words you'll see a lot:

- **Terminal** — a black/white window where you type commands instead of
  clicking. On Windows this is PowerShell (or the "Bash" tool if you're
  reading this inside Claude Code).
- **Environment variable (`.env` file)** — a plain text file that holds
  secret settings (passwords, keys) so they're never typed into the code
  itself.
- **Repo / project folder** — this `Calender` folder. Everything you need
  is already inside it.

---

## Checklist (what you'll have by the end)

- [ ] Node.js installed on your computer
- [ ] Project dependencies installed (`npm install`)
- [ ] A free Postgres database (via Vercel)
- [ ] Your `.env` file filled in with real values
- [ ] Two logins created (yours + your friend's)
- [ ] The app tested locally on your computer
- [ ] The app deployed live on Vercel, with the two scheduled digest emails active
- [ ] A free cron-job.org account pinging the reminder-sweep endpoint every
      10-15 minutes (for the 1-hour/3-hour-before reminders)

---

## Part 1 — Install Node.js

Node.js is the program that runs this website's code.

1. Go to https://nodejs.org
2. Download the button labeled **LTS** (Long Term Support — the stable one).
3. Run the installer, click Next through all the defaults, finish.
4. Open a terminal and check it worked:

   ```
   node -v
   npm -v
   ```

   You should see version numbers (e.g. `v22.20.0` and `10.9.3`). If you see
   an error instead, restart your computer and try again — Windows
   sometimes needs a restart to pick up new programs.

> If you're working inside Claude Code, you can skip this — it already
> checked and Node.js is installed.

---

## Part 2 — Open a terminal in the project folder

1. Open File Explorer and navigate to this `Calender` folder.
2. Click the address bar at the top, type `powershell`, press Enter. A
   terminal window opens already pointed at this folder.

Everything below assumes your terminal is sitting in this folder. If a
command says "file not found", you're probably in the wrong folder — type
`ls` (or `dir`) and check you see `package.json` in the list.

---

## Part 3 — Install the project's dependencies

Dependencies are pre-built pieces of code this project relies on (the
website framework, database driver, etc). Install them with:

```
npm install
```

This downloads everything into a `node_modules` folder. It can take a
minute or two, and prints some warnings — that's normal. You only need to
re-run this if you ever see an error mentioning a missing package.

---

## Part 4 — Create your `.env` file

This file holds all your secret settings. A starter copy already exists as
`.env.example`. Make your own real copy:

```
Copy-Item .env.example .env
```

(If `.env` already exists in the folder, skip this — it means it's already
been started for you; just open it and fill in the blanks below.)

Open `.env` in any text editor (Notepad, VS Code, etc.) — you'll fill in
its values step by step in the next parts. It currently looks like this,
and every blank (`=` with nothing after it) needs a value before this app
will work:

```
DATABASE_URL=
SESSION_SECRET=
EMAIL_ENDPOINT_URL=
EMAIL_TOKEN=
EMAIL_SENDER_NAME=
CRON_SECRET=
SEED_USER1_USERNAME=
SEED_USER1_PASSWORD=
SEED_USER1_EMAIL=
SEED_USER2_USERNAME=
SEED_USER2_PASSWORD=
SEED_USER2_EMAIL=
```

**Never share this file or paste its contents anywhere public** — it's
already excluded from git via `.gitignore`, so it won't accidentally get
uploaded.

### 4a. Generate the two secret keys

`SESSION_SECRET` keeps logins secure; `CRON_SECRET` stops strangers from
triggering your scheduled emails manually. Generate a random value for each
by running this command twice (once per key):

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Each time it prints a long random string like
`715c18631d194826d79e1b26e2fb02ae0dccfc4cf12446d6aa09074898baa18f`. Copy the
first result after `SESSION_SECRET=` and the second after `CRON_SECRET=` in
your `.env` file. They must be **different** values.

### 4b. Fill in the email settings

This app sends email through a Google Apps Script you already have running
at a `script.google.com/.../exec` address (it's built into the code as the
default, so you don't need to paste the URL anywhere unless you redeploy
that script to a new address — in which case put the new URL in
`EMAIL_ENDPOINT_URL`).

You just need two values that your script expects:

- `EMAIL_TOKEN` — the secret token your script checks before it will send
  mail (open your Apps Script project and look for where it compares an
  incoming `token` value — copy that exact value here).
- `EMAIL_SENDER_NAME` — the sender/company name your script expects in the
  `name` field (e.g. `My Company Name`).

### 4c. Choose your two logins

Pick a username and password for yourself and your friend, plus each
person's real email address (this is where the reminder emails go — it can
be different from your Gmail/Google account). Fill in:

```
SEED_USER1_USERNAME=alex
SEED_USER1_PASSWORD=something-only-you-know
SEED_USER1_EMAIL=alex@example.com

SEED_USER2_USERNAME=sam
SEED_USER2_PASSWORD=something-only-they-know
SEED_USER2_EMAIL=sam@example.com
```

(Real values, not literally `alex`/`sam` — just showing the shape.) These
four `SEED_USER*` lines are only used once, by the setup script in Part 6 —
after that you can leave them or delete them, doesn't matter.

`DATABASE_URL` is the one thing you can't fill in yet — that comes from
Part 5.

---

## Part 5 — Set up the database

The app needs somewhere to store events and logins — a Postgres database.
We'll get one for free from Vercel (the same place you'll host the site).

1. Go to https://vercel.com and click **Sign Up**. Sign up with GitHub,
   GitLab, or email — any option is fine.
2. Once logged in, click **Add New...** → **Project**.
   - If it asks to import from GitHub and you don't have this project on
     GitHub, that's fine — skip that for now, just click around until you
     land on your Vercel **Dashboard** (the main screen listing your
     projects). We'll deploy the actual code later in Part 8; right now we
     only need the database.
3. In the Vercel Dashboard, click the **Storage** tab (top navigation).
4. Click **Create Database**.
5. Choose **Postgres** (it may be labeled "Neon" — that's the company
   providing it, Vercel just resells it for free on small projects).
6. Give it any name (e.g. `squad-calendar-db`), pick a region close to you
   or your friend, click **Create**.
7. Once it's created, look for a **Connect** or **.env.local** tab showing
   connection strings. Find the one for a variable named **`DATABASE_URL`**
   (if instead you only see `POSTGRES_URL` or similar, that's fine — just
   copy that value, we'll rename it in the next step).
8. Copy that connection string (it looks like
   `postgres://user:password@host/dbname?sslmode=require`).
9. Paste it into your `.env` file after `DATABASE_URL=` (replacing anything
   already there).

Your `.env` file should now have every line filled in except
`EMAIL_ENDPOINT_URL` (which is optional — leave it blank).

---

## Part 6 — Create the database tables and your two accounts

Now that `.env` is fully filled in, run:

```
npm run setup
```

This does two things automatically:

1. Creates the two tables the app needs (`users` and `events`) in your new
   database.
2. Creates your two logins from the `SEED_USER1_*` / `SEED_USER2_*` values
   in `.env`.

You should see output like:

```
Creating tables (if they don't exist yet)...
Upserted user "alex" (alex@example.com)
Upserted user "sam" (sam@example.com)
Done.
```

If instead you see `DATABASE_URL is not set` or a connection error,
double check Part 5 — the value in `.env` needs to be the real connection
string, not the placeholder.

You can safely re-run `npm run setup` any time later (e.g. to change a
password) — it won't create duplicates or lose event data.

---

## Part 7 — Try it on your own computer

Start the app locally:

```
npm run dev
```

Leave this window open (it's running the server) and open your browser to:

```
http://localhost:3000
```

1. Log in with one of the `SEED_USER1`/`SEED_USER2` username/passwords you
   picked in Part 4c.
2. Click **+ Meeting** or **+ Task** (top of the page), fill in a title,
   date/time, and description, and save it. Tasks require a due time —
   meetings don't.
3. Check the recipient's inbox (both of you should get an email — check
   spam folders too the first time).

If the event saves but no email arrives, the site itself is working —
double-check `EMAIL_TOKEN` / `EMAIL_SENDER_NAME` in `.env` match exactly
what your Apps Script expects.

To test the two scheduled digest emails right now, without waiting for
Saturday or midnight, open a **second** terminal window (leave `npm run dev`
running in the first) and run:

```
curl.exe -H "Authorization: Bearer PASTE_YOUR_CRON_SECRET_HERE" http://localhost:3000/api/cron/saturday-digest
curl.exe -H "Authorization: Bearer PASTE_YOUR_CRON_SECRET_HERE" http://localhost:3000/api/cron/midnight-digest
```

Replace `PASTE_YOUR_CRON_SECRET_HERE` with the actual `CRON_SECRET` value
from your `.env`. Each command prints a small JSON result telling you
whether it sent an email (`"sent": true`) or skipped because there were no
matching events (`"sent": false`).

When you're done testing, go back to the first terminal window and press
`Ctrl + C` to stop the local server.

---

## Part 8 — Deploy it live, on the internet

This makes the site reachable from any device, and turns on the automatic
scheduled emails (they don't run while it's only on your laptop).

### 8a. Install the Vercel command-line tool

```
npm install -g vercel
```

### 8b. Log in

```
vercel login
```

This opens your browser to confirm — click through it, then return to the
terminal.

### 8c. Link this folder to a Vercel project

```
vercel link
```

It'll ask a few questions:

- "Set up and deploy?" → type `Y` and press Enter, or if it just asks to
  link, follow the prompts, accepting the defaults (press Enter) for
  project name and folder.
- If it asks to link to an existing project, choose the one you may have
  created in Part 5 step 2 (or let it create a new one — either is fine,
  just make sure the database from Part 5 stays connected to whichever
  project you deploy to; easiest is to reuse that same project).

### 8d. Add your secret values to Vercel

Every `.env` value your local machine has, Vercel's servers need too (your
`.env` file itself is never uploaded — you enter each value manually,
once). Run each of these, pasting the matching value from your `.env` file
when prompted:

```
vercel env add DATABASE_URL production
vercel env add SESSION_SECRET production
vercel env add EMAIL_TOKEN production
vercel env add EMAIL_SENDER_NAME production
vercel env add CRON_SECRET production
```

(Skip `EMAIL_ENDPOINT_URL` and the `SEED_USER*` ones — those aren't needed
in production; the seed values were only for the one-time `npm run setup`
you already ran locally against the same database.)

> If you created the database through this same Vercel project in Part 5,
> `DATABASE_URL` may already be added automatically — running
> `vercel env add DATABASE_URL production` again will just ask to
> overwrite; you can say no and skip it in that case.

### 8e. Deploy

```
vercel --prod
```

Wait for it to finish — it prints a URL at the end, something like
`https://squad-calendar.vercel.app`. That's your live site.

---

## Part 9 — Confirm the scheduled emails are active

1. Go to your project on https://vercel.com, open it, click the **Cron
   Jobs** or **Settings → Cron Jobs** tab.
2. You should see two entries:
   - `/api/cron/saturday-digest` — runs every Saturday
   - `/api/cron/midnight-digest` — runs every day at midnight
3. On Vercel's free (Hobby) plan, these fire once a day at most and may run
   up to roughly an hour later than the exact scheduled time — that's
   normal and not a bug.

You can trigger either one manually anytime (e.g. to double check it still
works after deploying) the same way as Part 7, just swap `localhost:3000`
for your live URL:

```
curl.exe -H "Authorization: Bearer PASTE_YOUR_CRON_SECRET_HERE" https://YOUR-SITE.vercel.app/api/cron/saturday-digest
```

---

## Part 10 — Set up the meeting/task reminder emails

Besides the Saturday and midnight digests, the app also sends:

- An email **1 hour before a meeting starts**
- An email **3 hours before a task is due**

These fire at arbitrary times of day, so they can't use Vercel's cron (the
free Hobby plan only allows once-a-day schedules). Instead, the app exposes
one more protected endpoint, `/api/cron/reminder-sweep`, that needs to be
pinged every 10-15 minutes by an outside service. We'll use
[cron-job.org](https://cron-job.org) — it's free, needs no credit card, and
takes about 2 minutes to set up.

1. Go to https://cron-job.org and click **Sign up** (top right). Confirm
   your email.
2. Once logged in, click **Create cronjob**.
3. Fill in:
   - **Title**: `Squad Calendar reminders` (anything you like)
   - **Address (URL)**: `https://YOUR-SITE.vercel.app/api/cron/reminder-sweep`
     (use your real Vercel URL from Part 8e)
   - **Schedule**: choose "Every 15 minutes" (under the "Custom" or common
     schedules — exact wording varies by their UI, just make sure it runs
     every 10-15 minutes, all day, every day)
4. Open the **Advanced** section (sometimes a small arrow/tab) and find
   **Request headers** (or "Custom headers"). Add one:
   - Name: `Authorization`
   - Value: `Bearer PASTE_YOUR_CRON_SECRET_HERE` (the same `CRON_SECRET`
     value from your `.env` / Vercel env vars — keep the word `Bearer` and
     the space before the value)
5. Save. cron-job.org will start pinging your endpoint automatically.

To confirm it's working, on cron-job.org's dashboard click into the job
after a few minutes and check the **execution history** — each run should
show HTTP status `200`. You can also trigger it manually anytime the same
way as the other two:

```
curl.exe -H "Authorization: Bearer PASTE_YOUR_CRON_SECRET_HERE" https://YOUR-SITE.vercel.app/api/cron/reminder-sweep
```

It responds with something like `{"ok":true,"meetingsNotified":0,"tasksNotified":0}`
— the counts are only nonzero when something actually crossed the 1-hour /
3-hour threshold since the last check, which is normal most of the time.

---

## Everyday use after this

- Visit your live URL, log in, add/edit/delete events from the calendar —
  each one is either a **Meeting** or a **Task** (toggle at the top of the
  new/edit form). Tasks require a due time; meetings don't.
- Both of you get an email the moment any meeting or task is created.
- Every Saturday morning you both get a "get ready" summary of everything
  upcoming (meetings and tasks together).
- Every midnight you both get that day's meetings and tasks — only if there
  are any.
- Every meeting also emails you both **1 hour before it starts**.
- Every task also emails you both **3 hours before its due time**.

You will not need to touch the terminal again unless you want to change
code, add a new account, or reset a password (`npm run setup` again).

---

## Troubleshooting

**`npm install` fails or hangs** — check your internet connection, then
try again. If it keeps failing, delete the `node_modules` folder and
`package-lock.json` and re-run `npm install`.

**`npm run setup` says `DATABASE_URL is not set`** — your `.env` file's
`DATABASE_URL` line is empty or still the placeholder text. Go back to
Part 5.

**Login fails with "Invalid username or password" locally or live** — the
username/password must exactly match what you put in `SEED_USER1_*` /
`SEED_USER2_*` when you last ran `npm run setup`. Passwords are
case-sensitive. To reset one, edit `.env` and re-run `npm run setup`.

**No email arrives after creating an event** — check spam first. Then
confirm `EMAIL_TOKEN` and `EMAIL_SENDER_NAME` in `.env` (and in Vercel's
environment variables for the live site) exactly match what your Google
Apps Script expects; a typo there fails silently on the app side but shows
up as an error if you look at the server logs (Vercel Dashboard → your
project → **Logs**).

**"Unauthorized" when testing a cron URL with `curl`** — the
`Authorization: Bearer ...` value must exactly match `CRON_SECRET` in that
same environment's `.env` (local vs. production have separate copies of
this value unless you set them to the same string in both places).

**Vercel deploy succeeds but the site errors on every page** — almost
always a missing environment variable. Go to your project on
vercel.com → **Settings → Environment Variables** and confirm all five from
Part 8d are present, then redeploy with `vercel --prod` again.

**The 1-hour/3-hour reminder emails never arrive, but the digests do** —
that means the Saturday/midnight crons are fine but the reminder-sweep
endpoint isn't being pinged. Check cron-job.org's dashboard → your job →
execution history. A `401` means the `Authorization` header value doesn't
match `CRON_SECRET`; no executions at all means the job isn't
enabled/saved correctly — redo Part 10.

**"Tasks need a due/end time" error when saving a task** — tasks require
the third time field (labeled "Due") since it's what the 3-hours-before
reminder is calculated from; fill it in and save again.
