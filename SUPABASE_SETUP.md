# Supabase Setup — RSP Training Portal

This adds a tiny cloud database so reps can see each other's progress,
send kudos, view a leaderboard, and have their progress sync across devices.

**Cost:** $0. Supabase's free tier covers thousands of users — you'd
never come close to hitting limits with a sales team.

**Time:** 15 minutes once. After this, every new module just works
with the social features automatically.

---

## Step 1 — Create a Supabase account & project (5 min)

1. Go to **https://supabase.com** → click **Start your project**.
2. Sign in with GitHub (easiest) or email.
3. Click **New project**. Pick:
   - **Name:** `rsp-training` (or whatever you like)
   - **Database password:** generate a strong one — Supabase has a button.
     **Save this password somewhere safe** even though we won't use it directly.
   - **Region:** pick whatever's geographically closest (e.g., US East / US West).
   - **Plan:** Free.
4. Click **Create new project**. Supabase spins up your database
   (~2 minutes — you can grab a coffee).

---

## Step 2 — Run the table-creation SQL (2 min)

1. Once your project is ready, click the **SQL Editor** icon (left sidebar,
   looks like `<>`).
2. Click **New query**.
3. Open the file `supabase-setup.sql` (it lives next to this README) in a
   text editor and **copy its entire contents**.
4. Paste it into the SQL editor.
5. Click **Run** (or hit Ctrl/Cmd + Enter). You should see
   "Success. No rows returned." — that means all four tables were created.
6. Click the **Table Editor** icon (left sidebar, looks like a grid).
   You should see four tables: `users`, `progress`, `kudos`, `presence`.

---

## Step 3 — Get your project URL and anon key (1 min)

1. In Supabase, click the **gear icon** (Project Settings, bottom-left).
2. Click **API** in the left submenu.
3. You'll see two values you need:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon / public key** — a long string starting with `eyJ...`
4. Keep this tab open — you'll paste both values into the portal in the next step.

> **Note on the anon key:** despite the name, this key is safe to
> include in client-side code. It's the public-facing key. The actual
> security comes from the row-level security (RLS) policies the SQL
> script set up. We're using a permissive policy because this is an
> internal training tool — fine for an honor-system setup.

---

## Step 4 — Plug the URL and key into the portal (1 min)

1. Open `cloud.js` (in the portal folder) in any text editor.
2. At the top you'll see:
   ```js
   const SUPABASE_URL  = "PASTE_YOUR_PROJECT_URL_HERE";
   const SUPABASE_KEY  = "PASTE_YOUR_ANON_KEY_HERE";
   ```
3. Paste your values from Step 3 between the quotes. Save the file.

That's it. Reload the portal and the social features come online.

---

## Step 5 — Test it (3 min)

1. **Hard refresh** the portal (Ctrl+F5).
2. Sign in as yourself, pick an avatar.
3. Open `https://supabase.com/dashboard` → your project →
   **Table Editor** → `users`. You should see one row with your name.
4. Click into the Electrical Fundamentals module, answer a few questions.
5. Back in Supabase, look at the `progress` table — you should see a row
   for your user with the module's progress.
6. **Open the portal in an incognito window** (or another browser).
   Sign in with the **exact same name**. You should see your progress
   restored — that's cross-device sync working.
7. From the portal hub, click the new **🤝 Team** tab. You'll see
   yourself on the leaderboard. As more reps sign in, they'll appear
   here too.

---

## What you get once it's live

- **Cross-device progress.** Every rep's data lives in the cloud. They
  can sign in from their laptop, tablet, phone — same progress everywhere.
- **Team page.** Live leaderboard sorted by lifetime XP. See everyone's
  avatar, current tier, modules completed.
- **Click any rep's name** → see their profile (avatar, tier, badges
  earned, modules completed).
- **Send kudos.** "🎉 Kudos to Sara for finishing Ice Cube Breakers!"
  posts to a feed everyone sees + (optionally) to your Pumble channel.
- **"Currently working on" presence.** When a rep is in a module, a tiny
  green dot shows up on that module's card so others know who's active.
- **Admin sees everything** without having to be on each rep's device.

---

## Multi-hub training portal (REQUIRED — run before deploying this update)

The portal now supports two training hubs — **New Employee Onboarding** and
**Product Training Mastery** — and every progress save / module save now
includes a `hub` field.

1. In Supabase → **SQL Editor** → **New query**, paste the contents of
   `supabase-migration-v9.sql` and **Run**. This adds a `hub` column
   (defaulting existing rows to `product_mastery`) to both `module_config`
   and `progress`, plus indexes for filtering by hub.
2. **This is not optional like the flipbook migration above.** Until it's
   run, Supabase will reject the `hub` field on every progress/module save
   with a "column does not exist" error — meaning normal quiz completions
   for the existing Product Mastery modules will fail to sync to the cloud
   (they still save locally; nothing is lost, but cross-device sync and
   admin visibility will lag until you run this).
3. Deploy the updated `.html`/`.js` files at the same time you run this
   migration — don't run one without the other.
4. Also run `supabase-migration-v10.sql` at the same time. It adds a
   `sort_order` column to `module_config` — this is what lets admins
   reorder modules (▲/▼ buttons on the Modules tab) and is what drives
   Onboarding's sequential lock chain (each module stays locked until the
   one before it, in admin-defined order, is completed). Safe/additive,
   same as v9.

## PDF flipbook trainings (optional, one-time)

To let admins upload a PDF and turn it into a page-flip training booklet:

1. In Supabase → **SQL Editor** → **New query**, paste the contents of
   `supabase-migration-v5.sql` and **Run**. This adds a `flipbook` column to
   `module_config` and creates a public **`training-flipbooks`** Storage bucket
   with the page images.
2. That's it. On any training page (or in `admin.html`) the admin panel now has
   a **"Drop a PDF to build the flipbook"** zone. The PDF is converted to page
   images right in the admin's browser, uploaded to Storage, and shown to
   employees as a flip-through booklet. Employees never have to render the PDF.

Notes:
- Max upload is 60 MB / 120 pages; pages are stored as optimized WebP (JPG on
  Safari) at up to 1600px.
- If a module has no flipbook, it falls back to the existing Flipsnack embed.
- The bucket is public-read (same trust model as the rest of this internal
  tool). Tighten with Supabase Auth later if needed.

---

## Troubleshooting

**"Failed to fetch" errors after pasting the keys.**
Double-check the URL has `https://` and no trailing slash, and the
anon key is the full string (it's long — make sure nothing was cut off).

**Reps can't see each other.**
They need to be using the **same Supabase project** — i.e., the same
`cloud.js` config. Make sure everyone's deployed copy of the portal
has the same keys.

**Want to reset all the data?**
In Supabase → SQL Editor → run:
```sql
TRUNCATE users, progress, kudos, presence CASCADE;
```

**Worried about the anon key being public?**
This is normal for client-side Supabase apps — the anon key is intended
to be public. Real security comes from RLS policies. Our policies are
permissive because this is an internal honor-system tool. If you ever
want stricter security (e.g., real authenticated logins), we can add
Supabase Auth in a follow-up session.

— RSP Training Portal · Supabase setup
