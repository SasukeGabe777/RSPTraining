# RSP Industrial — Training Portal

A single-deployment training portal that hosts all 63 RSP training modules
under one roof. Reps log in once, see their cross-module progress and lifetime
XP, and click into any module. Trainers get a single admin dashboard with
all learner data, filterable by module and exportable to CSV.

## Folder structure

```
portal/
├── index.html          ← Portal hub (the homepage learners visit)
├── admin.html          ← Trainer dashboard, ?admin=true to access
├── manifest.js         ← Module registry — edit this to add modules
├── modules/
│   └── electrical-fundamentals.html   ← The first module
└── README.md           ← You're reading it
```

## Deploying

Drag the entire `portal/` folder onto **Netlify Drop** (app.netlify.com/drop)
or push to a GitHub repo with Pages enabled. Done. The portal is live.

You can also point a custom domain like `training.rspsupply.com` at the
Netlify deployment.

## How learners use it

1. Visit the portal URL → sign in (just name + optional employee ID).
2. They land on a hub with cards for every published module.
3. Click a card → they take the training (gamified, side map, mini-bosses,
   final boss, all of it).
4. When they finish, results auto-submit to your Pumble channel and they
   come back to the portal hub.
5. Hub now shows their progress on that module, and updates lifetime XP.
6. Modules with prerequisites stay locked until the prereq is completed.

## How trainers use it

1. Visit `portal/admin.html?admin=true`
2. Enter the admin password. It is read from `config.local.js`
   (`adminPassword`) — see `config.example.js` to set it up.
3. See:
   - 4 stat cards (total learners, modules published, completions, avg score)
   - Filter bar (search by name/ID, filter by module, filter by status)
   - Sortable learner ledger (click any column header to sort)
   - Module completion heatmap

You can:
- **Export CSV** of the entire portal data
- **Copy JSON** to paste into a spreadsheet or send to your team
- **Wipe all data** if you want to reset (irreversible — be careful)

## Draft content editor

From the admin dashboard, use **Module Content Editor -> Edit draft** on any
module. This opens the module with `?edit=true`, where admins can click text to
edit it, add text/callout/image/video blocks, preview the result in place, then
copy or download a draft HTML file. Static pages cannot publish themselves over
the live module file, so publishing is still a manual file replacement until a
backend save flow is added.

## Adding a new module

Step-by-step for module #2 onward:

1. **Build the module HTML** (we'll work together on this — you give me the
   training material, I generate the HTML following the same gamified template).

2. **Set the module's identity constants at the top of the JS:**
   ```js
   const MODULE_ID   = "ice-cube-breakers";   // unique slug, no spaces
   const MODULE_NAME = "Ice Cube Breakers";   // display name
   const MODULE_ICON = "🧊";                   // emoji
   ```
   Each module must use these same three constants. The shared storage
   (`rsp_user`, `rsp_ledger`) is identical across modules.

3. **Save the module HTML at** `portal/modules/<module-id>.html`.

4. **Register the module in `manifest.js`:** add an entry to the `modules` array:
   ```js
   {
     id: "ice-cube-breakers",          // must match MODULE_ID
     name: "Ice Cube Breakers",
     icon: "🧊",
     path: "modules/ice-cube-breakers.html",
     description: "Compact, resettable supplementary protectors for control panels.",
     category: "Products",
     xp: 235,
     estTime: 60,
     prerequisite: "electrical-fundamentals",  // optional
     published: true                            // false = hidden from portal
   }
   ```

5. **Re-deploy** (drag the updated `portal/` folder onto Netlify, or push
   to your repo). The new module appears in the portal hub instantly.

## Learner paths (tags & roles)

A **path** is a named, ordered set of modules that cuts across hubs — the way
to build an "AR Role Path" out of onboarding lessons plus a product module.

Three independent switches decide how a path behaves:

| Switch | Effect |
|---|---|
| **Show on home** | Gets its own card on the portal home screen |
| **Assignable role** | Can be assigned to learners on the Learners tab |
| **Step by step** | Its modules unlock in path order |

A path can be any combination. A role path is usually all three; a browsable
collection is just "Show on home".

**A path is a view, never a hub.** Every module keeps exactly one home hub,
and that hub is what scores its XP, tiers, and badges. Putting a module in
five paths never multiplies the XP it is worth — a path only *reports*
progress over the modules it points at. Don't give paths their own XP; it
would double-count against the mastery ladders.

Assigning a role never hides anything. Modules on a learner's path are marked
**★ REQUIRED** on the hub pages and get a progress card on the home screen;
everything else stays fully browsable. A learner may hold several roles, and
their required set is the union of those paths.

### Managing paths

1. Run `supabase-migration-v11.sql` once (creates `paths`, adds `users.roles`).
   Four empty role paths — SDR, AR, OPS, Admin — are created ready to fill.
2. Admin dashboard → **🎯 Paths** tab → create a path, add modules from any
   hub, drag the order with ▲▼, flip the switches, **Save path**.
3. Admin dashboard → **👥 Learners** → click a learner → **ROLE / LEARNER
   PATH** → tick their roles → **Save roles**.

Deleting a path also unassigns it from every learner holding it. Module
progress and XP are never affected.

Files: `paths.js` (rules), `path.html` (learner page), plus the Paths tab in
`admin.html`.

## Security model

Run `supabase-migration-v12.sql` once. After it, the two keys split cleanly:

**The anon key** (in `config.local.js`, served to every browser) is public by
design and is constrained by row-level security to the learner surface:
read the portal, save progress, send kudos, heartbeat presence. It is granted
**no DELETE on anything**, cannot write `module_config` (quiz banks, answer
keys, codewords, publish flags) or `paths`, cannot read admin columns
(`employee_id`, `notes`, `status`), and cannot self-assign roles. Someone who
extracts it from the site can read names/XP and write progress — not destroy
or tamper.

**The service_role key** (Supabase → Project Settings → API) bypasses all
policies. The admin dashboard prompts for it at unlock; `training.html`'s
inline editors prompt when needed. It is held in memory only and dies with
the tab — never committed, never in local/session storage. The dashboard
shows 🔓 Full access / 🔒 Read-only so you always know which mode you're in.
Don't paste it on a machine you don't trust.

Verify the lockdown end to end with `node tests/rls-verify.js` — it proves
17 destructive/tampering operations are denied while the learner flow works.

Known gaps (accepted until real per-learner auth):
- Learner names and XP are readable via the anon key (the leaderboard needs
  them), and a learner can write progress under another name.
- A quiz being taken has its answers in the browser — grading is client-side.
  v12 stops bulk-downloading every module's answer key, not this. Fixing it
  means server-side grading (Supabase Edge Function).

## How storage works

All modules share the same `localStorage` keys so the portal can read
everyone's progress:

```
rsp_user → {name, id, startedAt}
rsp_ledger → {
  "Gabe Ebmeyer": {
    name, id, startedAt,
    modules: {
      "electrical-fundamentals": {answered, correct, viewedPages, bossesDefeated, totalXP, completedAt, ...},
      "ice-cube-breakers": {...}
    }
  }
}
```

This means:
- **One login** unlocks all modules — no re-typing.
- **Lifetime XP** = sum of every module's XP.
- **Admin sees everything** in one dashboard.

⚠ **Heads-up:** This is *device-local* storage — a rep's progress on their
work laptop doesn't sync to their tablet. If you want true cross-device
tracking, see "Phase 2 upgrade" below.

## Pumble integration

Each module already has a Pumble webhook URL baked in. When a rep finishes a
module, results auto-post to your Pumble channel. The message includes the
module name, so multiple modules naturally differentiate.

If Pumble's CORS keeps blocking direct submissions (likely — see browser
console errors), set up the **Google Apps Script proxy** I generated at
`Pumble_Proxy_AppsScript.gs` (in the parent folder). 5-minute one-time setup,
then auto-submit works reliably across every module.

## Phase 2 upgrade (later)

When you outgrow device-local storage, the upgrade is **Supabase free tier**:

- Replace the `lsGet`/`lsSet` calls with calls to a Supabase table.
- Now every rep sees the same progress on every device.
- Admin dashboard reads from Supabase = real-time across the whole org.
- Adds maybe a day of work; subscription cost = $0 until you hit 50K+ rows.

We can do this whenever you're ready. The architecture is already designed
to make this swap painless — only one helper file changes.

## Editing this portal

Same as editing a module: open the file in any text editor, search for
what you want to change, edit, save. The portal hub layout is in
`index.html`, admin is in `admin.html`, and the module list is in
`manifest.js`.

Most-edited spots:
- **Add a module** → `manifest.js`
- **Change branding** (portal title, tagline, colors) → top of `index.html`
- **Change admin password** → `adminPassword` in `config.local.js`
- **Add a new category** (e.g. "Vendor Trainings") → `manifest.js` → `categories` array

Always **save a backup before editing** in case you break something.

— RSP Industrial · Training Portal · v1
