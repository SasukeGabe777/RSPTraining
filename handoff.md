# RSP Training Portal â€” Live Session Handoff

This is a living document. Update the **Current task** and **Open conversation threads** sections before starting each new task in this session, so context for the next prompt is always one paste away.

---

## TL;DR

The workspace now contains:

- **Live portal:** the original dark/navy portal shell and hub experience, with module cards still driven by `manifest.js`, but each live card now opens a **generic training launcher / quiz / results flow** instead of the old in-place lesson module. The live flow uses the original local/cloud data model (`rsp_user`, `rsp_ledger`, `window.RSPCloud`) so badges, mastery, team, and prerequisites stay on the same rails.
- **Archived v1 portal snapshot:** the full lesson-module experience preserved at `legacy/portal-v1/` with its original module pages, shared framework, and editor intact for comparison or fallback.

The original module editor still exists in the archived v1 copy: it lives in `legacy/portal-v1/shared/module.js` (with styles in `legacy/portal-v1/shared/module.css`) and activates when any archived module URL has `?edit=true` plus the admin password (`adminPassword` from `config.local.js`).

---

## Current task

> _Update this before each new prompt — one sentence on what's about to be worked on._

**Ready for the next prompt — PDF → flipbook training support has shipped. Admins can upload a PDF on `training.html` (admin panel) or in `admin.html` module cards; it is converted to page images in-browser, stored in Supabase Storage, and rendered as a StPageFlip page-turn booklet for employees, with page-progress tracking and a "Complete Training" gate on the final page. Run `supabase-migration-v5.sql` once before using it.**

Next logical task: after running migration v5, upload a real PDF for one module (e.g. Enclosure Mastery) and do a live browser pass of the flipbook viewer + completion flow once the sandbox/browser tooling is available. Flipsnack embeds still work as a fallback when no flipbook is present.

### Standing rule for this project
**Update `handoff.md` before AND after each task** so we can pick up cleanly across usage limits. Pattern: before starting → write what we're about to do and the locked-in plan; after finishing → log what shipped under "What's been built this session" with a Feature N heading.

**Module-format rule (locked by user feedback):** future modules should keep the older page-2 / page-3 structure (`THE PROMISE` then `HOW TO PLAY`) instead of the newer `MODULE MAP` variant, and should avoid tear-out-card / trainer-crib-sheet result pages.

---

## What's where

**Workspace folder:** `C:\Users\sasuk\OneDrive\Desktop\portal\`

### Key files
| File | Purpose |
|------|---------|
| `shared/training-shell.js` | Shared helper layer for the live training launcher / quiz / results flow. Uses the original `rsp_user` / `rsp_ledger` keys and `window.RSPCloud` sync path. |
| `shared/training-shell.css` | Shared styles for the live training, quiz, and results pages while matching the legacy portal look. |
| `index.html` | Live legacy-style hub. Cards still use `manifest.js`, badges/mastery/team remain intact, and prerequisite/admin behavior stays on the original rails. |
| `training.html` | Generic training launcher page driven by `manifest.js`, designed to host Flipsnack embeds and fallback resources. |
| `quiz.html` | Generic one-question-at-a-time quiz page driven by `manifest.js`, writing results into the original learner ledger shape. |
| `results.html` | Generic results / explanation page driven by saved quiz attempts in the legacy learner ledger. |
| `manifest.js` | Live module manifest in the old structure, with each module card routed to `training.html?id=...` and archived lesson fallbacks preserved. |
| `legacy/portal-v1/` | Archived copy of the old lesson-based portal, including `modules/`, `shared/`, and top-level pages. |
| `modules/enclosure-types.html` | Module 03 (sky theme) |
| `modules/enclosure-accessories.html` | Module 04 (teal theme) |
| `modules/motor-mastery.html` | Module 05 (violet theme) |
| `modules/contactors-overloads.html` | Module 06 (rose theme) |
| `index.html` | Hub. Manifest-driven module cards. Admin master-login (`AdminAccess` / `admin` / `rsp-admin`) bypasses prereq locks. |
| `manifest.js` | Module metadata (id, name, icon, path, prereq, xp, estTime, published) |
| `admin.html` | Admin dashboard â€” learner ledger, "Module Content Editor" launcher with Preview / Edit draft links per module. |
| `.backups/portal-backup-*.zip` | Codex's initial backup. |

### Current cache version on all modules
`?v=editor-blocks-2-page-delete` on modules 01–09. All modules including `vfd-mastery.html` (08) and `reactor-mastery.html` (09) use this version string.

---

## What's been built this session

### Feature 23 — PDF → flipbook training (Flipsnack-style page-turn viewer) (June 2026 session)
- **Goal:** let admins upload a PDF and have it become a page-flip training booklet (page-curl, shadows, prev/next, two-page desktop spread, single-page mobile, fullscreen, progress tracking, completion on the last page) — mimicking the Flipsnack experience without embedding a PDF viewer or copying Flipsnack branding.
- **Architecture decision (important):** the portal is a **static site + Supabase REST**, with no app server, so there is nowhere to run a traditional server-side conversion job. The clean fit is **convert-once in the admin's browser at upload time** with pdf.js, store the rendered page images in **Supabase Storage**, and have employees load only the finished images (they never render the PDF). This is the server-less equivalent of "server-side conversion." A Supabase Edge Function could do true server-side conversion later if desired — noted as a future option, not built.
- **New / changed files:**
  - `supabase-migration-v5.sql` *(new)* — adds a `flipbook JSONB` column to `module_config` and creates a **public `training-flipbooks` Storage bucket** (75 MB/object cap) with permissive anon read/write RLS matching the existing honor-system model. **Must be run once in the Supabase SQL editor before the feature works.**
  - `cloud.js` — added Storage helpers: `flipbookPublicUrl`, `uploadFlipbookAsset` (POST to `/storage/v1/object/...` with `x-upsert`), `setFlipbook` / `getFlipbook`, and `flipbook` passthrough in `setModuleConfig`. All exposed on `window.RSPCloud`.
  - `shared/flipbook-convert.js` *(new, admin)* — `RSPFlipbookConvert.convertAndUpload(moduleId, file, opts)`. Validates the bytes really start with `%PDF-` (doesn't trust the extension), caps size at 60 MB and 120 pages, lazy-loads pdf.js (cdnjs 3.11.174), renders each page to a max-1600px canvas → **WebP (JPG fallback for Safari)** at ~0.82 quality, makes a ~320px thumbnail per page, uploads the original PDF + page images + thumbs to Storage under `<moduleId>/v<version>/…`, and writes a `module_config.flipbook` record with `status: pending→processing→ready|failed`, `page_urls`, `thumb_urls`, `page_count`, `aspect`, `version`, `error`. Reports progress via an `onProgress(stage,pct,msg)` callback and persists partial progress every 5 pages.
  - `shared/flipbook.js` + `shared/flipbook.css` *(new, viewer)* — `RSPFlipbook.mount(container, opts)`. Lazy-loads **StPageFlip** (`page-flip.browser.js` from jsDelivr, global `St.PageFlip`), preloads all page images, builds leaves (first/last are `data-density="hard"` covers), and mounts with `size:'stretch'`, `usePortrait:true` (auto single-page on mobile), `showCover:true`, `drawShadow:true`. Controls bar = Prev / page counter / progress track / Next / Fullscreen / **Complete Training** (disabled until the last page is reached). Tracks the "furthest visible page" via `getCurrentPageIndex()` + orientation. If StPageFlip can't load, it **degrades to a simple prev/next image reader** so training still works.
  - `training.html` — loads `flipbook.css`, `flipbook.js`, `flipbook-convert.js`. New `renderStudy()` decides what fills the Study panel with priority **prereq-lock → ready flipbook → building/failed states → Flipsnack embed → placeholder**. `mountFlipbook()` mounts the viewer once per `flipbook.version` (guarded against re-mount on repeated `render()` calls). `recordFlipbookPage()` writes `flipbookPage` / `flipbookHighest` and mirrors `viewedPages = [1..highest]` into the existing synced `viewed_pages` column (cross-device resume), with a 4 s throttled `syncUp`. `completeFlipbook()` sets `completedAt` + `totalXP` (gold tier) and syncs — same shape the quiz path uses, so badges/mastery/hub completion all work unchanged. Admin panel gets a **PDF drop zone** (`#flipbookBar`) with live status + an instant pre-publish preview; admins always see the viewer (with the Complete button hidden) regardless of prereq lock.
  - `admin.html` — loads `flipbook-convert.js`; each module card gets a **PDF FLIPBOOK** drop zone + status badge (reusing `convertAndUpload`), and a flipbook tag in the card header. Quiz drop selector tightened to `.quiz-drop:not(.pdf-drop)` since the PDF drop reuses `.quiz-drop` styling.
- **Data model added** (`module_config.flipbook` JSONB): `status` (pending/processing/ready/failed), `pdf_url`, `pdf_name`, `page_count`, `page_urls[]`, `thumb_urls[]`, `aspect`, `version`, `error`, `updated_at`, `updated_by`. Learner progress (in `rsp_ledger`): `flipbookPage`, `flipbookHighest`, `flipbookTotal`, plus existing `viewedPages` / `completedAt` / `totalXP`.
- **Non-PDF safety:** trainings without a flipbook fall straight through to the existing Flipsnack/placeholder path; quiz-based completion is untouched; legacy modules under `legacy/portal-v1/` are not affected.
- **Fullscreen fit fix (follow-up):** StPageFlip 'stretch' fits the book to its PARENT element's width and derives height from that — it never caps by height — so in fullscreen on a wide screen the book grew until its height overflowed and clipped pages. Note: **StPageFlip exposes no `update()` method** (confirmed from its README API list); it only recalculates on a window `resize` (autoSize). `shared/flipbook.js`'s `applyFsFit()` (on `fullscreenchange` + `resize`) therefore, while fullscreen, gives the **stage an explicit pixel width** = `availHeight * aspect * pagesAcross` (clamped to available width; spread vs single decided by what fits), centers it, then **dispatches a synthetic `resize`** (guarded by an `adjusting` flag to avoid a loop) so the library re-fits to the new stage width. On exit it clears the inline width. Two earlier mistakes that are now fixed: relying on a non-existent `update()`, and using `max-width` + `margin:auto` on a flex child (which collapsed the stage to StPageFlip's 280px minimum and shrank the book). Listeners are torn down in `destroy()`.
- **Verification:** the in-browser sandbox was unavailable this session (HYPERVISOR_VIRT_DISABLED), so JS could not be `node --check`'d or live-rendered here. Verified by close reading: CDN reachability for both `page-flip.browser.js` (jsDelivr) and `pdf.min.js` (cdnjs) was confirmed via fetch; StPageFlip API names (`loadFromHTML`, `flipNext/flipPrev`, `getCurrentPageIndex`, `getOrientation`, `turnToPage`, `on('flip')`, `destroy`) match the library; page leaves are appended to the mount before `loadFromHTML`; the `.quiz-drop` selector collision in `admin.html` was fixed. **Owed:** a live browser pass once tooling is back — upload a PDF, confirm pages render, flipping works, progress saves, and Complete marks the module done. Live portal restored to legacy shell with shared training / quiz / results pages (May 2026 session)
- The live portal was corrected back to the **original home-page look and learner data model** after the broader v2 redesign proved too disruptive.
- `index.html` remains the original dark hub with the original badges / mastery / team nav, XP banner, category sections, and module cards. The only behavior change is that live cards now route to `training.html?id=...` instead of opening a lesson module directly.
- `manifest.js` was restored to the old module-oriented structure and now carries:
  - live card destinations (`training.html?id=...`)
  - `legacyPath` fallbacks to archived lesson modules
  - `study` metadata for Flipsnack / fallback behavior
  - `quiz` metadata and question-bank data for the first pilot
- `training.html`, `quiz.html`, and `results.html` were rebuilt to match the old portal’s visual language while using the shared helper layer in `shared/training-shell.js` and `shared/training-shell.css`.
- The shared helper layer now uses the original storage and sync rails:
  - `rsp_user`
  - `rsp_ledger`
  - `window.RSPCloud.syncDown(...)`
  - `window.RSPCloud.syncUp(...)`
- `cloud.js` was adjusted so local-only quiz-result metadata such as attempt history, best score, and last-attempt review details survive a normal sync-down from the legacy Supabase schema instead of getting wiped.
- The unused `shared/portal-v2.js` and `shared/portal-v2.css` files were removed so the repo no longer presents two competing live architectures.
- **Enclosure Mastery remains the first wired pilot**:
  - archived lesson link available as fallback study material
  - quiz ready with `12` randomized questions drawn from a `15`-question bank
  - `80%` pass threshold
  - `340 XP` on pass
- **Verification:** `manifest.js`, `shared/training-shell.js`, `cloud.js`, and the inline scripts in `index.html`, `training.html`, `quiz.html`, and `results.html` all parsed cleanly. A simulated perfect Enclosure attempt:
  - respected the `electrical-fundamentals` prerequisite
  - unlocked Enclosure once the prerequisite was marked complete
  - saved a passing attempt into the original learner ledger
  - awarded `340 XP`
  - marked the module complete on the same status logic the hub uses

### Feature 21 — Quiz-first portal v2 pilot + archived lesson portal snapshot (May 2026 session)
- The live portal root was reworked into a **quiz-first v2 architecture**:
  - `index.html` is now a cleaner catalog-style hub grouped by category, with list rows instead of lesson-module cards.
  - `training.html` is a generic training-detail page that acts as the bridge between study material and assessment.
  - `quiz.html` is a generic one-question-at-a-time quiz experience with randomized question pulls and saved session progress.
  - `results.html` is a dedicated pass/fail, XP, badge, and explanation page.
- `shared/portal-v2.js` now owns the new learner/session layer:
  - separate v2 local storage keys (`rsp_v2_user`, `rsp_v2_ledger`)
  - prerequisite locking
  - quiz-attempt creation and grading
  - results persistence
  - XP award on pass only
- `shared/portal-v2.css` establishes the new visual system for the v2 catalog / training / quiz / results flow.
- `legacy/portal-v1/` was created as a full archive snapshot of the old lesson-based portal, including:
  - `modules/`
  - `shared/`
  - top-level pages like `index.html`, `badges.html`, `mastery.html`, `team.html`, and `admin.html`
- `manifest.js` was repurposed into a v2 training manifest:
  - all current published topics now point to `training.html?id=...`
  - each topic includes an archived lesson fallback path
  - only `enclosure-mastery` is fully quiz-ready in this pilot pass
- **Enclosure Mastery pilot details:**
  - built from `C:/Users/sasuk/Downloads/Enclosure Mastery Training.docx`
  - `15`-question bank with `12` randomized questions per attempt
  - `80%` pass threshold
  - `340 XP` awarded on pass
  - Flipsnack placeholder state is wired, with the archived lesson exposed as a temporary fallback until Carley provides the real embed/open URL
- **Important scope note:** root `badges.html`, `mastery.html`, and `team.html` were left untouched and are not linked from the new v2 nav yet. The live learner experience is currently the new hub + training + quiz + results flow.
- **Verification:** helper logic parses cleanly, a simulated perfect Enclosure attempt successfully awards completion and `340 XP`, and local HTTP checks returned `200` for:
  - `index.html`
  - `training.html?id=enclosure-mastery`
  - `quiz.html?id=enclosure-mastery`
  - `results.html?id=enclosure-mastery`
  - `legacy/portal-v1/index.html`

### Feature 20 — Reactor Mastery refreshed from the new Line & Load Reactor doc pack (May 2026 session)
- `modules/reactor-mastery.html` was rebuilt as a source-faithful refresh using:
  - `C:\Users\sasuk\RSP Supply\RSP Supply - Documents\@RSP Files\Mastery Product Training\Line & Load Reactors\Line-Load Reactor Mastery Training.docx`
  - `C:\Users\sasuk\RSP Supply\RSP Supply - Documents\@RSP Files\Mastery Product Training\Line & Load Reactors\Line-Load Reactor Quiack Reference Sheet.docx`
  - `C:\Users\sasuk\RSP Supply\RSP Supply - Documents\@RSP Files\Mastery Product Training\Line & Load Reactors\Line-Load Reactors Loom Video.docx`
- `modules/reactors-mastery-old.html` was saved as a comparison snapshot of the prior reactor module before the rebuild. It is not wired into `manifest.js`; the live module path remains `modules/reactor-mastery.html`.
- **Format preserved, content tightened:** the 27-page house structure, boss flow, and XP system stayed intact, but pages 5–17 and 25 were rewritten to mirror the new source pack more directly instead of relying on older embellished copy.
- **Source-driven content changes:** line-reactor triggers now explicitly cover unstable/generator power, multiple VFDs, sensitive facilities, nuisance tripping, and large transformers close to the VFD; cable-length guidance now includes the 230V / 480V / 600V rule-of-thumb table plus the four safe-length factors (voltage, motor type, carrier frequency, cable type); the line-vs-load chart, seven qualifying questions, common sales mistakes, upsell cues, and one-line sales explanations now map closely to the training and quick-reference docs.
- **Support material restored:** the Loom link from the new doc pack is now embedded on the final takeaways page for follow-up review.
- **Quiz alignment:** the 30-question boss fight kept its structure but removed older unsupported specifics (exact reflected-wave voltages, exact harmonic-reduction percentages, unrelated single-phase-input logic) so the test now tracks the refreshed source pack.
- **Verification:** structural checks passed (`27` pages, `30` quiz cards, `30` answer-key cells, `2` mini-boss gates, `8` LEARN XP pages, `6` APPLY XP pages), the inline `RSPModule.init(...)` config parsed cleanly, `manifest.js` still parses cleanly, and a temporary local HTTP server returned `200` for `modules/reactor-mastery.html`, `shared/module.js`, and `shared/module.css`.

### Feature 19 — Soft Starter Mastery module (Module 11) (May 2026 session)
- `modules/soft-starter-mastery.html` is a new self-contained 27-page module built from `SOFT STARTER MASTERY TRAINING .docx`, `SOFT STARTER MASTERY CERTIFICATION EXAM.docx`, and `SOFT STARTER QUICK REFERENCE GUIDE.docx` in `C:\Users\sasuk\OneDrive\Desktop\Mastery Product Training\Soft Starter Mastery Training\`.
- **Theme:** crimson (`--theme-primary:#DC2626`, deep `#7F1D1D`, accent `#FCA5A5`). Distinct from the earlier amber / blue / sky / teal / violet / rose / emerald / orange / indigo / lime set. Icon `📈` to tie the module to startup ramping and smoother acceleration.
- **Manifest entry** added to `manifest.js`: `id:"soft-starter-mastery"`, `category:"Motors & Motor Control"`, `xp:280`, `estTime:60`, `prerequisite:"motor-starter"`, `published:true`.
- **Page layout (27 pages):** cover/promise/how-to-play 1–3 · LEARN 4–11 (what a soft starter does · ATL vs soft starter · soft starter vs VFD · SCR / bypass operation · best applications · start methods · sizing + starts/hour + heat · bypass/protection + **Inrush Ogre** mini-boss gate) · APPLY 12–17 (ATL pain signals · six qualifying questions · customer-language translation · soft starter vs VFD sales logic · substitution rules / mistakes · decision path + scenario matrix + **Speed Specter** mini-boss gate) · Boss 18–23 (intro + 5 rounds × 6 questions) · Results 24–27 (answer key · final takeaways · trophy case · closing).
- **XP math:** 8 LEARN × 10 + 6 APPLY × 15 = 170 + 2 mini-boss × 25 = 50 + 30 quiz × 2 = 60 → **280 total** ✓
- **Mini-bosses:** `inrush-ogre` 🧌 ("Breaker of the Line", 5q on fundamentals, methods, and sizing) and `speed-specter` 👻 ("Whisperer of the Wrong Quote", 5q on VFD upsell logic, substitutions, and quoting calls). Both pass at 4/5, +25 XP each.
- **Final boss:** "THE RAMP CHAMBER". Tier badges: gold = SOFT STARTER MASTER, silver = RAMP-READY, bronze = BACK TO THE SCRs. 30 questions in 5 themed rounds: Basics · Comparison Logic · Methods & Sizing · Protection & Applications · Sales & Decisions.
- **Key content highlights:** soft starter = startup / stop voltage control, not speed control · ATL vs soft-starter vs VFD framing · voltage ramp / current limit / kick start / soft stop methods · size by FLA, starts/hour, inertia, and enclosure heat · internal vs external bypass · fixed-speed startup pain vs real VFD territory · substitution rules and the "never replace a VFD when speed control is needed" line.
- **Verification:** structural checks passed (`27` pages, `30` quiz cards, `30` answer-key cells, both mini-boss gate IDs match config, inline module JS parses cleanly). Local HTTP verification returned `200` for the module HTML plus `shared/module.js` and `shared/module.css`. The in-app browser in this thread refused localhost navigation due Browser Use URL policy / error-page behavior, so full visual browser validation was not available here even after the local server was made reachable.

### Feature 18 — Reactor Mastery normalized back to house format (May 2026 session)
- `modules/reactor-mastery.html` was revised to match the same stronger series structure restored in Harmonic, so the newer Module 09 no longer feels like a format outlier beside the earlier portal modules.
- **Front matter restored:** page 2 is now `THE PROMISE` with six concrete learner outcomes and a right-side XP reward visual; page 3 is now `HOW TO PLAY` with the standard three level cards (`LEARN` / `APPLY` / `TEST`) and the two-mini-boss explainer. The cover tagline also now includes the missing `RSP · PROD 09` product marker.
- **Weaker result pages removed:** page 25 no longer uses the tear-out / pocket-cheat-sheet page, and page 26 no longer uses the trainer crib sheet. They were replaced with an in-series `FINAL TAKEAWAYS` page (`THE PLAYBOOK`) and a standard `TROPHY CASE` XP summary page.
- **Content polish:** the new Reactor endcap now emphasizes the actual sales/listening logic the rep should hear on the next VFD call: input-side clues, output-side clues, the cable-length ladder, and the line-reactor / load-reactor distinction in plain English.
- **Verification:** in-app browser reloaded `http://127.0.0.1:4173/modules/reactor-mastery.html` and confirmed page count = `27`, page 2 = `▸ THE PROMISE`, page 3 = `▸ HOW TO PLAY`, page 25 = `▸ FINAL TAKEAWAYS`, page 26 = `▸ FINAL XP / TROPHY CASE`, with the `RSP · PROD 09` marker present, no remaining `TEAR HERE`, `Tear-out card`, `TRAINER CRIB SHEET`, or `MODULE MAP` text, and no warnings/errors beyond the normal Supabase connection info log.

### Feature 17 — Harmonic Filter Mastery normalized back to house format (May 2026 session)
- `modules/harmonic-filter-mastery.html` was revised after user review to match the stronger established module structure used by the earlier series entries.
- **Front matter restored:** page 2 is now `THE PROMISE` with six concrete learner outcomes and a right-side XP reward visual; page 3 is now the original `HOW TO PLAY` format with the three level cards (`LEARN` / `APPLY` / `TEST`) and the two-mini-boss explainer. The cover tagline also now includes the `RSP · PROD 10` product marker like the rest of the track.
- **Weaker result pages removed:** page 25 no longer uses a tear-out / pocket-cheat-sheet format, and page 26 no longer uses a trainer crib sheet. They were replaced with an in-series `FINAL TAKEAWAYS` page (`THE PLAYBOOK`) and a standard `TROPHY CASE` XP summary page.
- **Verification:** in-app browser reloaded `http://127.0.0.1:4173/modules/harmonic-filter-mastery.html` and confirmed page 2 = `▸ THE PROMISE`, page 3 = `▸ HOW TO PLAY`, page 25 = `▸ FINAL TAKEAWAYS`, page 26 = `▸ FINAL XP / TROPHY CASE`, with no remaining `TEAR HERE`, `Tear-out card`, or `TRAINER CRIB SHEET` text and no console warnings/errors.

### Feature 16 — Harmonic Filter Mastery module (Module 10) (May 2026 session)
- `modules/harmonic-filter-mastery.html` is a new self-contained 27-page module built from `HARMONIC FILTER MASTERY TRAINING.docx`, `HARMONIC FILTER MASTERY QUIZ.docx`, `HARMONIC FILTER QUICK REFERENCE.docx`, and the Loom link doc in `C:\Users\sasuk\OneDrive\Desktop\Mastery Product Training\Harmonic Filter Mastery Training\`.
- **Theme:** lime (`--theme-primary:#65A30D`, deep `#365314`, accent `#D9F99D`). Distinct from the earlier amber / blue / sky / teal / violet / rose / emerald / orange / indigo set. Icon `🌀` to tie the module to waveform distortion and cleanup.
- **Manifest entry** added to `manifest.js` directly after `reactor-mastery`: `id:"harmonic-filter-mastery"`, `category:"Motors & Motor Control"`, `xp:280`, `estTime:60`, `prerequisite:"reactor-mastery"`, `published:true`.
- **Page layout (27 pages):** cover/promise/how-to-play 1–3 · LEARN 4–11 (what harmonics are · why VFDs create them · why harmonics matter · reactors vs filters · passive filters · active filters · THD + IEEE-519 · when filters make sense + **Waveform Warlock** mini-boss gate) · APPLY 12–17 (reactor-enough logic · 8 questions to ask · real-world sales clues · mistakes + upsell triggers · decision path · scenario matrix + **Compliance Phantom** mini-boss gate) · Boss 18–23 (intro + 5 rounds × 6 questions) · Results 24–27 (answer key · final takeaways · trophy case · closing).
- **XP math:** 8 LEARN × 10 + 6 APPLY × 15 = 170 + 2 mini-boss × 25 = 50 + 30 quiz × 2 = 60 → **280 total** ✓
- **Mini-bosses:** `waveform-warlock` 🧙 ("Distorter of the Sine", 5q on harmonics, THD, and input-side logic) and `compliance-phantom` 👻 ("Warden of IEEE-519", 5q on applications, compliance triggers, and sales logic). Both pass at 4/5, +25 XP each.
- **Final boss:** "THE THD VAULT". Tier badges: gold = HARMONIC MASTER, silver = THD-READY, bronze = BACK TO THE WAVES. 30 questions in 5 themed rounds: Harmonic Basics · THD & Input Side · Filter Types · Compliance & Problems · Sales & Decisions.
- **Key content highlights:** reactor = basic smoothing vs harmonic filter = aggressive cleanup · harmonics originate from pulsed VFD rectifier draw on the input side · passive vs active filters · THD / IEEE-519 language for engineer + utility conversations · trigger questions for multiple drives, generators, sensitive facilities, transformer heat, and nuisance complaints.
- **Verification:** structural checks passed (`27` pages, `30` quiz cards, `30` answer-key cells, both mini-boss gate IDs match config). In-app browser opened `http://127.0.0.1:4173/modules/harmonic-filter-mastery.html`, confirmed page title / cover / side map / module heading, and the console showed no warnings or errors.

### Feature 15 — Portal hub rebucketed into curriculum tracks (May 2026 session)
- Read `C:\Users\sasuk\Downloads\Mastery Product Education Series cla - Sheet1.csv` and used its section headers as the new training-track source of truth for the home page.
- `manifest.js` category order now follows the curriculum roadmap (`Basics` → `Enclosures` → `Motors & Motor Control` → … → `Safety & Compliance`) instead of the old broad `Prerequisites` / `Products` / `Sales Skills` / `Safety` split. For future-proofing against the sheet, the category IDs match the CSV, while two rough labels are cleaned for display only: `Structual & Framing Systems` → "Structural & Framing Systems" and `Surge Protections` → "Surge Protection".
- Live modules were remapped into the new buckets: `electrical-fundamentals` → `Basics`; `enclosure-mastery`, `enclosure-types`, `enclosure-accessories` → `Enclosures`; `motor-mastery`, `contactors-overloads`, `motor-starter`, `vfd-mastery`, `reactor-mastery` → `Motors & Motor Control`.
- `index.html` now renders each category as a track panel with a color accent, icon tile, `TRAINING TRACK` eyebrow, and completion pill. The hub also filters category sections to `published` modules so future draft manifest entries don't leak onto the learner-facing home page.
- Verification: in-app browser opened `http://127.0.0.1:4173/index.html` and confirmed exactly **3 visible buckets** with the expected live card counts: `Basics` = 1, `Enclosures` = 3, `Motors & Motor Control` = 5.

### Feature 1 â€” `+ Page` toolbar button
- `addPage()` in `shared/module.js` line **1441**. Inserts a new `<section class="page rsp-editor-new">` with placeholder page-tag / h2 / lead / page-num content as a sibling right after `selectedPage` (or after the last page if no selection). Promotes the new page to `selectedPage`, wires it for editing, scrolls into view, marks dirty, snapshots undo.
- Toolbar button `+ Page` is the second action in the row (after Undo). `data-editor-action="add-page"`.

### Feature 2 â€” Block delete / copy / paste
- `let blockClipboard = ''` â€” single-string in-memory clipboard scoped to the editor session.
- `blockUnit(el)` at line **742** â€” the unit of action for delete/copy. Returns the smallest meaningful block: a known composite wrapper (`.factbox`, `.rsp-media-block`, `figure`, `.powerup`, `.callout`, `.img-peek`, `.tc-card`, `.prod-card`, `.mfr-card`) if `el` is inside one, otherwise the contenteditable element itself. Never walks past `.page`.
- `deleteSelectedBlock()` line **1637** â€” refuses `.page-tag` / `.page-num` / `.xp`. Snapshots undo, removes, flashes status.
- `copySelectedBlock()` line **1656** â€” stores outerHTML; doesn't dirty the draft.
- `pasteAfterSelectedBlock()` line **1666** â€” strips `rsp-editor-selected-*` classes, adds `rsp-editor-new`, routes through `insertNearSelection`.
- Toolbar buttons: ðŸ“‹ Copy, ðŸ“Œ Paste, ðŸ—‘ Delete (after `+ See it`, before Replace media).

**Important nuance:** the original handoff spec said delete should walk up to the direct child of `.page`. That was destructive for legacy pages (which wrap all their content in a single flex/grid `<div>` directly under `.page`) â€” one delete killed an entire page. `blockUnit` is the fix.

### Feature 3 â€” Between-block "+ Add block" affordances
- `injectInsertHandles()` line **969** â€” wipes existing handles, then for each `.page` inserts a `<button class="rsp-editor-insert-handle">` before each in-flow direct child (filtered by `isInFlowPageChild`: not chrome, not absolute/fixed-positioned) and after the last in-flow child. First-handle anchor falls back to `.page-tag` so first-gap inserts land at the top of the page, not the bottom.
- `makeInsertHandle()` line **1002** â€” builds the handle button.
- `showInsertMenu()` line **1016** â€” floating menu (Text / Callout / Image / Video / See It / Paste-if-clipboard-non-empty). **Portalled to `document.body`** (not nested in the handle) to escape sibling stacking contexts; positioned with `getBoundingClientRect()` + `window.scrollX/Y`. Outside-click closes; menu-button clicks set `selectedBlock` to the anchor and call the same `add*` plumbing.
- Re-injected after every structural mutation: end of `enterEditorMode` boot, `insertNearSelection`, `deleteSelectedBlock`, `addPage`, and `undo`.
- CSS in `shared/module.css` â€” `.rsp-editor-insert-handle` (thin sky-blue rule + uppercase pill) and `.rsp-editor-insert-menu`. `transform: translateX(-50%)` centers the menu on the trigger; `left`/`top` are set inline.

### Feature 4 — Multi-image See It pills
- `buildImgPeekHtml(srcs, label, alt)` in `shared/module.js` now accepts **1-6 image URLs** and renders multiple `<img>` tags inside `.img-peek-popup`, with `data-count="<n>"` on the popup.
- `addSeeIt()` switched from a single-image input to a **textarea, one URL per line** (`srcs`), while keeping editable button label + shared alt text.
- `replaceSelectedMedia()` routes `.img-peek` selections into `replaceSeeItImages(seeIt)`, which pre-fills the existing popup image URLs, lets the editor swap them in bulk, rebuilds the popup HTML, and updates `data-count`.
- `.img-peek-popup` CSS in `shared/module.css` now switches between **1 / 2 / 3-column** layouts based on `data-count`, with wider popup widths for multi-image sets. Existing legacy single-image See Its in module HTML still work even when they have no `data-count`.
- `openEditorDialog()` now autofocuses the first `input` **or** `textarea`, so the new multi-URL See It dialogs land focus where the editor expects.

### Feature 5 — Enclosure Mastery custom visuals as editable blocks
- `modules/enclosure-mastery.html` pages 2, 4, and 5 no longer rely on SVG-only text for the requested visuals. The XP target, the "Protected inside" diagram, and the three value cards are now HTML/CSS structures with editor-friendly child nodes.
- New module-local classes in `modules/enclosure-mastery.html`'s `<style>` block: `.xp-target-*`, `.protected-diagram-*`, and `.value-card*`. These recreate the original look while exposing editable text nodes.
- `shared/module.js` already has the matching editor selectors wired in from this session: `.xp-target-center`, `.xp-target-badge`, `.protected-diagram-label`, `.protected-diagram-item`, and `.value-card-icon` are all added to `editableSelector`, while `.xp-target-card` is treated as a composite/selectable block.
- Important behavior nuance: the nested `COMPLIANCE` text does **not** interfere with block selection. Clicking the heading/paragraph edits that specific text block; clicking card padding selects the whole `.factbox.value-card.compliance` wrapper for move/copy/delete.
- Verification was done in a headless Chrome fallback because the Codex in-app browser blocked both `file://` and local `http://127.0.0.1` targets in this thread. Confirmed: those new nodes become `contenteditable`, the protected-diagram lines area selects the enclosing factbox, and the compliance card supports both inner-text selection and wrapper selection.

### Feature 6 — Quiz question editing in draft mode
- Final boss `.qcard[data-q]` blocks are now editable inside `?edit=true` module draft mode. In edit mode, quiz cards get an "Edit question" affordance; clicking a card opens a modal editor instead of attempting the quiz.
- The new modal lives in `shared/module.js` and includes a prompt textarea plus four answer rows (`A`–`D`). Each answer row has a text input and a `✓ Correct` picker on the right so the admin can choose the right answer without touching raw HTML.
- Quiz edits are stored on the rendered card via `data-quiz-json`, synced back into `cfg.quiz`, and re-synced after `undo()` restores page snapshots. That keeps the question editor, undo history, and draft export pointed at the same question state.
- `cleanDraftClone()` now patches the module's inline `RSPModule.init({ quiz: [...] })` config before exporting, then clears the rendered quiz-card HTML as before. This is the critical persistence piece: edited quiz content survives `Copy HTML` / `Download draft` and is not lost on reload.
- Verification: headless Chrome opened `enclosure-mastery.html?edit=true`, unlocked the editor, clicked Q1, changed the prompt and answers, switched the correct answer to `C`, and triggered `Copy HTML`. The copied draft contained the updated `quiz` array (`"c": "C"` and the new prompt), while the exported `.qcard[data-q="1"]` HTML was still blanked for normal runtime re-render.

### Feature 8 — Module 07: Motor Starter Mastery (new module, emerald theme)
- `modules/motor-starter.html` is a new self-contained 27-page module that slots in as Module 07 after `contactors-overloads`. Built from two uploaded source docs (`MOTOR STARTER MASTERY TRAINING PROGRAM.md` and `MOTOR STARTER QUICK REFERENCE GUIDE.md`).
- **Theme:** emerald (`--theme-primary:#059669`, deep `#064E3B`, accent `#A7F3D0`). Distinct from the existing amber / blue / sky / teal / violet / rose palette. Icon `▶️` (motor START).
- **Manifest entry** added to `manifest.js` directly after `contactors-overloads`: `id:"motor-starter"`, `category:"Products"`, `xp:280`, `estTime:75`, `prerequisite:"contactors-overloads"`, `published:true`. The hub picks it up automatically.
- **Page layout (27 pages):** intro 1–3 · LEARN/Types 4–8 (DOL · Reversing · Manual & Magnetic · Combination & MCP · Soft/VFD) · LEARN/Protection 9–11 (Components · Overload sizing · Customer translation + **Inrush Imp** mini-boss gate) · APPLY/Sizing 12–13 (NEMA vs IEC · HP buckets) · APPLY/Protection 14–15 (Protection matrix · Accessories) · APPLY/Sales 16–17 (Decision path · 5 mistakes + **Bucket Banshee** mini-boss gate) · Boss 18–23 (intro + 5 rounds × 6 questions) · Results 24–27 (answer key · Pocket Cheat Sheet · Trophy case · Closing).
- **XP math:** 8 LEARN × 10 + 6 APPLY × 15 = 170 + 2 mini-boss × 25 = 50 + 30 quiz × 2 = 60 → **280 total** ✓.
- **Mini-bosses (invented this session, fit the existing thematic pattern):** `inrush-imp` ⚡ ("Guardian of the Across-the-Line", 5q on starter-type basics) and `bucket-banshee` 🪣 ("Keeper of the Combination", 5q on combination/MCP/accessories). Both pass at 4/5, +25 XP each.
- **Final boss:** "STARTER ARENA". Tier badges: gold = STARTER COMMANDER, silver = STARTER-CAPABLE, bronze = BACK TO THE STARTERS. 30 questions split into 5 themed rounds.
- **Module-specific CSS lives inline in the file** under `<style>` (after the theme tokens). Key custom classes: `.starter-card` (per-starter-type anatomy, replaces contactors-overloads' `.dev-card`), `.does-grid`, `.matrix`, `.aha-card`, `.callout`, `.translate-row .says/.means/.quote-it`, `.mistake`, `.decision-card`. Emerald palette overrides applied throughout.
- **Verification done structurally** (sandbox was down this session so no headless-Chrome run): 27 `<section class="page">` opens match 27 closes · 30 `qcard data-q` cells span Q1→Q30 exactly · 30 answer-key static cells (`<div class="key-cell">`) match each `c:` in the quiz array one-for-one (Q1=C, Q2=B, Q3=A, Q4=B, Q5=C, Q6=C, Q7=B, Q8=B, Q9=C, Q10=C, Q11=B, Q12=C, Q13=C, Q14=B, Q15=C, Q16=B, Q17=B, Q18=D, Q19=B, Q20=B, Q21=B, Q22=B, Q23=C, Q24=D, Q25=C, Q26=B, Q27=B, Q28=B, Q29=D, Q30=C) · `data-miniboss="inrush-imp"` and `data-miniboss="bucket-banshee"` both match `bossId` in `mapSections` and the `minibosses` object keys.
- **Standing rule established this session:** update `handoff.md` before AND after each task so we can pick up cleanly across usage limits.
- **No live render test yet.** When the Linux sandbox is back, the first verification step should be: `python -m http.server 4173 --bind 127.0.0.1`, then `http://127.0.0.1:4173/modules/motor-starter.html` for the published flow and `?edit=true` for the editor flow.

### Feature 9 — Block-editor expansion (May 2026 session)
- **Protected-diagram pieces are independent blocks now.** `compositeBlockSelector` in `shared/module.js` (~line 857) prepends `.protected-diagram-item`, `.protected-diagram-illustration`, `.protected-diagram-line`, `.protected-diagram-lines`, `.protected-diagram-list`. `el.closest(compositeBlockSelector)` returns the nearest match, so clicking a single hazard line ("⚡ Environmental hazards") selects just that line; clicking the illustration's slot box selects just the illustration. The outer `.protected-diagram` is deliberately NOT a composite so clicking grid gaps falls through to the surrounding `.factbox`.
- **See It (video) variant.** New `addSeeItVideo()` / `insertVideoPeek()` / `buildVideoPeekHtml()` in `shared/module.js` mirror the photo See It plumbing. The pill uses the same `.img-peek` chrome with a `.video-peek` modifier and a `▶ SEE IT` default label. Each cell in the popup renders as an `<iframe class="video-peek-frame">` (YouTube/Vimeo/embed) or `<video class="video-peek-frame" controls playsinline>` (direct media). Toolbar button `+ See it (video)` and insert-menu entry `▶ See It (video)` are both wired. `replaceSelectedMedia()` dispatches to a new `replaceSeeItVideos(seeIt)` based on the `.video-peek` class.
- **Image black bars fixed.** `.rsp-media-block img`, `.rsp-media-block video`, and `.rsp-video-block iframe` backgrounds switched from `#0F172A` to `#F8FAFC` in `shared/module.css` (~line 615) so the `object-fit:contain` letterbox blends with the surrounding panel instead of showing dark slate bars on portrait uploads.
- **Editable coverage broadened.** Added to `editableSelector`: `.prod-tag`, `.prod-use`, `.mfr-tag`, `.mfr-mat`, `.badge`, `.tagline > div`, `.level-card .num`, `.num-d`, `.obj-num`. Added to `compositeBlockSelector`: `.level-card`, `.decision-card`, `svg`. Net effect: every text bit on the cover and intro pages (ribbon pills, tagline, level-card numbers, decision-card numbers, objectives chips, card kickers/materials lines) is now click-to-edit, and decorative SVGs (cover cube, Ohm's-law triangle, circuit diagrams) select as movable/deletable units. SVGs inside `.qcard` quiz cards are unaffected because the quiz card's click handler in `wireQuizEditorCards` runs after selection and stops propagation.

### Feature 14 — Line & Load Reactor Mastery module (Module 09) (May 2026 session)
- `modules/reactor-mastery.html` is a new 27-page module that slots in as Module 09 after `vfd-mastery`. Built from `Line-Load Reactor Mastery Training.docx`, `Line-Load Reactor Mastery Test.docx`, and `Line-Load Reactor Quick Reference Sheet.docx`.
- **Theme:** indigo (`--theme-primary:#4F46E5`, deep `#1E1B4B`, accent `#C7D2FE`). Distinct from all prior palettes (amber/blue/sky/teal/violet/rose/emerald/orange).
- **Manifest entry** added to `manifest.js` directly after `vfd-mastery`: `id:"reactor-mastery"`, `category:"Products"`, `xp:280`, `estTime:60`, `prerequisite:"vfd-mastery"`, `published:true`.
- **Page layout (27 pages):** cover/map/intro 1–3 · LEARN 4–11 (what is a reactor · line reactor deep dive · load reactor deep dive · reflected wave explained · motor vulnerability · cable length zones · harmonic distortion & 3% vs 5% · both reactors together + **Harmonic Haunter** mini-boss gate) · APPLY 12–17 (dv/dt filters · sine wave filters · full comparison table · qualifying questions · decision path · application matrix + **Reflected Wave Wraith** mini-boss gate) · Boss 18–23 (intro + 5 rounds × 6 questions) · Results 24–27 (answer key · pocket cheat sheet · trainer crib sheet · closing).
- **XP math:** 8 LEARN × 10 + 6 APPLY × 15 = 170 + 2 mini-boss × 25 = 50 + 30 quiz × 2 = 60 → **280 total** ✓
- **Mini-bosses:** `harmonic-haunter` 👁️ ("Warden of the Input Side", 5q on reactor fundamentals and line vs load) and `reflected-wave-wraith` 👾 ("Specter of the Motor Lead", 5q on load reactors, reflected wave, and cable length thresholds). Both pass at 4/5, +25 XP each.
- **Final boss:** "THE REACTOR CORE". Tier badges: gold = REACTOR MASTER, silver = REACTOR-READY, bronze = BACK TO THE COILS. 30 questions in 5 themed rounds: Fundamentals · Line Reactors · Load Reactors & Reflected Wave · Accessories & Applications · Sales Mastery.
- **Answer key (Q1–Q30):** C,C,B,C,C,C,B,B,B,B,B,B,B,A,B,C,C,C,B,C,C,B,C,B,B,A,C,C,B,C
- **Key content highlights:** Line = input side, protects VFD; Load = output side, protects motor · Reflected wave physics (PWM → transmission line → impedance mismatch → 2× voltage) · Cable length zones: <50 OK, 100–250 load reactor, 250–500 dv/dt filter, 500+ sine wave filter · 3% vs 5% line reactor tradeoffs · Three-question customer qualifier (cable length, motor type, power source).
- **No live render test yet.** Run `python -m http.server 4173 --bind 127.0.0.1` then open `http://127.0.0.1:4173/modules/reactor-mastery.html`.

### Feature 13 — VFD Mastery module (Module 08) (May 2026 session)
- `modules/vfd-mastery.html` is a new 27-page module that slots in as Module 08 after `motor-starter`. Built from `VFD MASTERY TRAINING PROGRAM.docx`, `VFD MASTERY CERTIFICATION EXAM.docx`, and `VFD QUICK REFERENCE SHEET.docx`.
- **Theme:** orange (`--theme-primary:#EA580C`, deep `#7C2D12`, accent `#FDBA74`). Distinct from all existing module palettes (amber/blue/sky/teal/violet/rose/emerald).
- **Manifest entry** added to `manifest.js` directly after `motor-starter`: `id:"vfd-mastery"`, `category:"Products"`, `xp:280`, `estTime:75`, `prerequisite:"motor-starter"`, `published:true`.
- **Page layout (27 pages):** cover/mission/how-to-play 1–3 · LEARN 4–11 (what a VFD does · 3 non-negotiable questions · constant vs variable torque · input power & derating · motor compatibility · carrier frequency & enclosures · braking methods · protection & accessories + **Frequency Phantom** mini-boss gate) · APPLY 12–17 (accessories guide · 5 sales mistakes · substitution rules · customer translation · decision path · application matrix + **Derating Demon** mini-boss gate) · Boss 18–23 (intro + 5 rounds × 6 questions) · Results 24–27 (answer key · pocket cheat sheet · trophy case · closing).
- **XP math:** 8 LEARN × 10 + 6 APPLY × 15 = 170 + 2 mini-boss × 25 = 50 + 30 quiz × 2 = 60 → **280 total** ✓
- **Mini-bosses:** `frequency-phantom` 👻 ("Guardian of the Waveform", 5q on VFD basics/torque types/motor compatibility) and `derating-demon` 🔥 ("Keeper of the Current", 5q on derating/enclosures/braking/accessories). Both pass at 4/5, +25 XP each.
- **Final boss:** "VFD ARENA". Tier badges: gold = VFD COMMANDER, silver = VFD-CAPABLE, bronze = BACK TO THE DRIVES. 30 questions in 5 themed rounds: VFD Foundations · Motor & Compatibility · Braking, Protection & Accessories · Sizing & Technical · Sales Mastery.
- **Answer key (Q1–Q30):** C,C,C,B,C,B,C,B,C,C,D,C,B,B,B,B,B,B,C,C,B,B,B,B,C,B,C,C,C,C
- **Key content highlights per section:** Cube law energy savings (fan at 50% speed = 12.5% power) · Single-phase 1.73× derating rule · Inverter-duty vs TEFC vs ODP motor compatibility · Long-lead reflected-wave problem · Carrier frequency tradeoff (quiet vs cool) · Three braking methods (DC injection / dynamic / regenerative) · Six-accessory guide with "when to offer" triggers · Six-question decision path · Application matrix (fan/pump/conveyor/hoist/extruder).
- **No live render test yet.** Run `python -m http.server 4173 --bind 127.0.0.1` then open `http://127.0.0.1:4173/modules/vfd-mastery.html` for the published flow and `?edit=true` for the editor flow.

### Feature 12 — Whole-page delete with confirmation (May 2026 session)
- **Page-only selection is now a real state.** `setSelectedFromEvent()` in `shared/module.js` (~line 1200) now clears `selectedBlock` when the user clicks inside a `.page` but outside any selectable block. Before this, the old paragraph/image selection could linger invisibly behind the page highlight, so Delete kept acting on stale block state instead of the page the user thought they had selected.
- **Delete supports whole-page removal.** `deleteSelectedBlock()` in `shared/module.js` (~line 1787) now treats `selectedPage && !blockUnit(selectedBlock)` as a page-delete request and prompts with the exact confirmation text: `Are you sure you want to delete EVERYTHING on this page?`
- **Last-page safety guard added.** Whole-page delete refuses to remove the final remaining `.page` and flashes `Can't delete the last page` instead, so a draft cannot be left with zero renderable pages.
- **Selection stays stable after delete.** After a page is removed, selection moves to the next page if present, otherwise the previous one, then re-runs `refreshSelection()` and `injectInsertHandles()` so the editor highlight and `+ Add block` affordances stay coherent.
- **Cache bust included.** Every module HTML that loads `shared/module.js` now points at `?v=editor-blocks-2-page-delete` instead of `?v=editor-blocks-1` (`electrical-fundamentals`, `enclosure-accessories`, `contactors-overloads`, `enclosure-mastery`, `enclosure-types`, `motor-mastery`, `motor-starter`, plus the legacy enclosure-mastery copies). Reason: the in-app browser was still serving the old script URL on an ordinary reload, so without a version bump the new delete logic could appear broken simply because stale JS was still running.

### Feature 11 — YouTube embed reliability + error-fallback UI (May 2026 session)
- **Diagnosis follow-up (no code changes yet).** Reproduced the *current* Add Video path in-browser on both `http://127.0.0.1:4173` and `http://localhost:4173` using `modules/motor-starter.html?edit=true`. The live page definitely loads `shared/module.js?v=editor-blocks-1`, but the served file contents are the *new* build: newly inserted YouTube blocks render a `.rsp-video-facade`, their `data-embed-src` is `https://www.youtube.com/embed/<id>?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=<page-origin>`, and they include the canonical `Watch on YouTube` fallback link.
- **Important implication:** if the user is still seeing YouTube's native red **Error 153** iframe instead of our red **Watch on YouTube** fallback tile, they are probably **not testing a newly inserted main video block from the current editor path**. The most likely remaining explanations are now:
  1. The page is being opened on `file://` (origin `"null"`), which we could not browser-test here because the in-app browser blocks `file://`, but the code still omits `origin=` in that mode and the handoff hypothesis remains valid.
  2. Browser cache is serving an older `shared/module.js?v=editor-blocks-1` even though the workspace file is updated. The unchanged query-string means stale-cache risk is real on deployed/static copies.
  3. The failing block predates Feature 11 and is still raw `<iframe>` HTML without `enablejsapi=1`, so `attachYouTubeErrorHandler()` intentionally skips it (`shared/module.js` ~2456-2462) and it never becomes a facade/fallback tile automatically.
  4. The user is testing a **See It (video)** popup. `wireYouTubeIframes()` explicitly skips any iframe inside `.img-peek-popup` (`shared/module.js` ~2526-2535), so those previews still show YouTube's native error UI by design.
  5. The user replaced the URL on an existing iframe block via **Replace media**. `replaceSelectedMedia()` updates `src` but does **not** re-run `wireYouTubeIframes()` afterward (`shared/module.js` ~1840-1870), so the new YouTube iframe can still miss the fallback wiring.
- **Residual risk discovered during diagnosis:** in the Codex in-app browser, even a known-good public YouTube video (`dQw4w9WgXcQ`) swapped to the fallback tile after ~5 s on both `127.0.0.1` and `localhost`. That means the current 5 s "no onReady" heuristic is aggressive enough to false-positive in at least one environment. This does **not** match the user's reported symptom (they still see the raw YouTube error screen), but it means the fallback heuristic itself should be treated cautiously if we return to implementation.
- **Reproduced case.** A YouTube URL pasted via Add Video showed the standard facade thumbnail, but after click the swapped-in iframe rendered YouTube's branded "Error 153 — Video player configuration error" screen. Owner-disabled embedding can't be bypassed client-side, but the UX around it can be made far less confusing.
- **Embed host switched.** `buildYouTubeEmbed()` in `shared/module.js` (~line 1246) now builds against `https://www.youtube.com/embed/...` instead of `youtube-nocookie.com/embed/...`. The -nocookie variant is stricter about origin matching and rejects more "configuration error" cases for the same video. Privacy difference at our scale is negligible. The `isEmbedUrl()` regex was already `youtube(?:-nocookie)?\.com/embed/` so both hosts continue to parse identically — old saved drafts keep working.
- **`enablejsapi=1`** added to every YouTube embed URL so the iframe is reachable via the YouTube IFrame Player API. Together with the existing `rel=0`, `modestbranding=1`, `playsinline=1`, and `origin=<location.origin>`.
- **New `loadYouTubeAPI()`** lazy-loads `https://www.youtube.com/iframe_api` on first call and caches the promise. Preserves any pre-existing `window.onYouTubeIframeAPIReady`. Resolves to `null` (not reject) if the script fails so callers fall back gracefully.
- **New `attachYouTubeErrorHandler(iframe)`** wraps a YouTube iframe in a `YT.Player` instance, sets a 5 s `onReady`-timeout, and listens for `onError`. Codes 2 / 5 / 100 / 101 / 150 trigger `renderEmbedErrorFallback`; Error 153 (which YouTube renders inside the iframe and doesn't always report through the API) is caught by the timeout. **Safety guard:** the handler bails out unless the iframe's `src` contains `enablejsapi=1`, so older saved module drafts (which predate the param) keep playing untouched and the readyTimer doesn't false-fire on them. Idempotent via `data-yt-error-wired`.
- **`renderEmbedErrorFallback(iframe, videoId, watchUrl)`** replaces the broken iframe with an `<a class="rsp-video-embed-error">` tile: a darkened (`filter:brightness(.45)`) `hqdefault.jpg` thumbnail, a big red `▶ Watch on YouTube` badge, and a short "This video can't be embedded — click to open it on YouTube" subtitle. Whole tile is the click target → opens canonical YouTube URL in new tab.
- **`wireYouTubeIframes(root)`** scans a subtree for any `iframe[src*="youtube"]` and calls the error-handler on each. Called from `boot()` (every viewer), `undo()` (after page restores), `insertVideoBlock()` (editor adds a main video), `insertVideoPeek()` (editor adds a See It video — no-ops because of the popup skip below), and `insertNearSelection()` (paste path). **Skips iframes inside `.img-peek-popup`** on purpose: those carry `loading="lazy"` and live inside a `display:none` hover container until the user hovers the pill, so onReady/onError timing is unreliable and the 5 s timeout would false-positive on a video the viewer hasn't even seen. For See It video previews viewers get YouTube's native error UI, which is acceptable for a quick popup-only preview.
- **CSS additions** in `shared/module.css` (~line 700): `.rsp-video-embed-error{display:block;position:relative;width:100%;aspect-ratio:16/9;...}` plus overlay/badge/sub/hover rules. Matches the visual weight of the working `.rsp-video-facade` so the fallback doesn't feel like an error popup.
- **Dialog text updated** in `addVideo()` and `addSeeItVideo()` — both now mention the embed-disabled-by-owner case and point users at `portal/videos/<module>/` self-hosting (Feature 10's convention) as the guaranteed-inline-playback alternative.
- **Caveats logged for next session.** (i) The 5 s timeout is a heuristic — slow networks could trigger it on a working video. If users hit false positives, bump to 8 s or wait for `onStateChange` to fire instead. (ii) The YT API loads from `youtube.com` so a CSP that forbids `script-src https://www.youtube.com` would silently disable error detection (the iframe still renders, viewer still sees the YouTube error screen, no harm done). (iii) Error detection only fixes the *UX*; it does not bypass embed restrictions. Self-hosting in `portal/videos/` remains the only fix for stubbornly-non-embeddable clips.

### Feature 10 — See It popup escape-from-parent + local video folder convention (May 2026 session)
- **Popup escapes any clipping or stacking ancestor.** `.img-peek-popup` switched from `position:absolute` to `position:fixed` in `shared/module.css` (~line 526), z-index bumped to `12100`. Default top is `9999px` so the popup is parked off-screen until JS positions it. Reason: the `.level-card` on the intro page has `overflow:hidden`, which clipped the video popup inside the card border.
- **New top-level `wireImgPeekPopups(root)`** in `shared/module.js` (next to `wireVideoFacades`, ~line 2393). On `mouseenter`/`focus` it reads `btn.getBoundingClientRect()`, sets `popup.style.left = rect.left + rect.width/2` and `popup.style.top = rect.bottom + 10`, then sets inline `popup.style.display = 'grid'`. While the popup is visible it listens for capture-phase `scroll` and `resize` to reposition. `mouseleave`/`blur` runs a 150ms `setTimeout` that hides the popup by clearing the inline style (CSS default `display:none` takes back over). The popup itself ALSO listens for `mouseenter`/`mouseleave` — that's what lets the user cross the 10px gap from the pill into the popup without losing visibility (especially important for video peeks, where the user needs to click play/seek inside the popup). Idempotent — wired pills are flagged `data-popup-wired`.
- **Call sites:** `boot()` for every viewer (not just editors), `undo()` for restored pages, `insertNearSelection(node)` (covers paste + any block path), `insertImgPeek(target)`, and `insertVideoPeek(target)`.
- **Local video folder convention.** Added `portal/videos/` with a README and module-matched subfolders (electrical, enclosures, accessories, motor-mastery, motor-starter, contactors-overloads). Modules reference local videos with `../videos/<module>/<file>.mp4` — same shape as `../images/<module>/<file>.png`. MP4 (H.264 + AAC) is the recommended format; >2 min clips should still go on YouTube/Vimeo.

### Feature 7 — Admin session bypass for module editor gate
- `admin.html` now writes a shared session flag (`sessionStorage['rsp_admin_unlocked'] = 'true'`) after the dashboard password is accepted. The same page also auto-restores the dashboard within that tab/session if the flag already exists.
- `shared/module.js` now honors that same admin-session flag inside `openEditorLogin()`. If the user arrived from an authenticated admin session, the module draft editor enters immediately and also marks the module-specific editor session key as unlocked.
- If the user types the module editor password directly on a standalone `?edit=true` page, that path still works and now also establishes the shared admin session flag for subsequent module edits in the same browser session.
- The separate per-module admin dashboard inside `shared/module.js` (`?admin=true`) also sets the same session flag on successful login so admin-authenticated module flows stay consistent.
- Verification: the in-app browser unlocked `admin.html`, clicked `Edit draft` for `enclosure-mastery`, and landed directly in edit mode with `#moduleEditorToolbar` present and `#moduleEditorGate` absent. A fresh headless Chrome context opened `modules/enclosure-mastery.html?edit=true` directly and still saw the gate (`#moduleEditorGate` present, no toolbar), so the bypass is scoped to authenticated admin sessions rather than removed globally.

### Undo button
- `undoStack` capped at 50 entries; each entry is `[...page outerHTMLs in DOM order]`.
- `pushUndo()` line **904** â€” call BEFORE each block-level mutation. Snapshot captures whatever text edits the user made since the previous snapshot, so undoing a block op preserves their typing.
- `undo()` line **911** â€” pops the latest snapshot, replaces current pages, re-wires `makeEditable`, re-injects handles, re-syncs quiz-card data, resets selection, marks dirty, flashes "Undid last change".
- Snapshot-points: `insertNearSelection` (covers paragraph / callout / image / video / paste), `addPage`, `insertImgPeek`, `deleteSelectedBlock`, `replaceSelectedMedia` onSubmit, drag-drop in-place image replacement.
- Toolbar button `â†¶ Undo` is the FIRST action in the row.
- **Scope:** structural undo only. Text edits inside a focused contenteditable use the browser's native Ctrl+Z.

### Status toast
- `flashStatus(text)` line **800** â€” transient message in `#rspEditorStatus`, auto-reverts after 1.5s to "Unsaved draft changes" / "No changes" based on the `changed` flag.

### Inline â†‘/â†“ block reorder controls
- `blockControls` element created on editor boot, appended to `document.body` (portalled to avoid stacking-context traps). Two-button vertical column with â–²/â–¼ glyphs.
- `getMovableSiblings(block)` filters `block.parentNode.children` to skip insert-handles and page chrome. Works whether the block is a direct `.page` child or nested inside a layout wrapper â€” siblings come from the block's own parent.
- `moveSelectedBlock(direction)` resolves the unit via `blockUnit(selectedBlock)`, looks up movable siblings, swaps positions via `insertAdjacentElement('beforebegin' | 'afterend')`. Snapshots undo, marks dirty, re-injects handles, flashes "Moved up/down" or "Already at the top/bottom".
- `positionBlockControls()` runs inside `refreshSelection()`: places the controls 6px right of the selected block's top-right corner, in page coords (so they scroll with the page), and disables the up/down arrows when at first/last sibling. Hides entirely when no valid block is selected. Window resize re-positions.
- Stripped from `cleanDraftClone` so exports stay clean.

### Bug fixes shipped this session
1. **Overly-aggressive deletion** â€” replaced `topLevelBlock` (walked to `.page` child) with `blockUnit` (smallest meaningful block).
2. **Insert-menu z-index trap** â€” every handle had `position: relative; z-index: 5` which made each one its own stacking context. The menu, nested in handle A with `z-index: 11050`, was *locally* on top inside handle A but *globally* still in handle A's z-index 5 slot â€” so handle B (later in DOM, same z-index 5) painted over the menu's contents and stole hover. Fix: portal the menu to `document.body`.
3. **Page content clipping when too many blocks added** â€” `.page` was `height:11in;overflow:hidden`, so content past 11in was silently cut off. Switched to `min-height:11in` and dropped `overflow:hidden` in `shared/module.css` line ~71. Pages now grow vertically to fit content; absolute-positioned `.page-tag` / `.page-num` / `.xp` re-anchor to the new edges automatically.
4. **YouTube embeds loading but not playing** â€” silently disallowed playback when the embed had no `origin` param. Refactored `normalizeVideoUrl` â†’ `parseVideoUrl` which returns `{embedSrc, watchUrl, videoId, kind}`. Embed URL now includes `?rel=0&modestbranding=1&playsinline=1&origin=<location.origin>`. `referrerpolicy` relaxed from `strict-origin-when-cross-origin` to `origin-when-cross-origin`. `normalizeVideoUrl` kept as a back-compat shim for `replaceSelectedMedia`.

5. **YouTube Error 153 ("Video player configuration error") on embed-disabled videos** â€” even with `origin` set, YouTube's server-side embed-permission check refuses some videos entirely (owner setting). Switched YouTube video blocks to a **thumbnail facade** pattern: render `<button class="rsp-video-facade" data-embed-src="â€¦"><img â€¦/hqdefault.jpg><span class="rsp-video-play">â–¶</span></button>` plus the existing "Watch on YouTube â†—" fallback link plus the editable caption. `wireVideoFacades(root)` (top-level in `shared/module.js`, NOT inside `enterEditorMode`) attaches click handlers that replace the facade with a real `<iframe>` carrying `autoplay=1` â€” so the viewer's click is the user gesture that authorises playback. Called from `boot()` (every published page), from `insertVideoBlock` (editor previews), and from `undo()` (after pages get restored). Vimeo and direct `.mp4`-style media keep their direct rendering paths. The earlier parked Error 153 item is now resolved: viewers always get a working thumbnail; embed-disabled videos surface YouTube's error only after the user explicitly clicks play, with the fallback link as the obvious recovery. CSS additions: `.rsp-video-facade`, `.rsp-video-facade img`, `.rsp-video-play` (YouTube-style rounded play pill, turns red on hover).

6. **`.powerup` not registering as a block** â€” `.powerup` was already in `compositeBlockSelector` so `blockUnit()` knew about it, but it wasn't in `editableSelector`, so the div never became `contenteditable` and `setSelectedFromEvent` (which keys off contenteditable / media) couldn't pick clicks up. Added `.powerup` to `editableSelector` so the div is contenteditable on click â†’ click registers as selection â†’ block controls light up. The lightbulb emoji and `<b>POWER-UP:</b>` label live inline in the powerup's HTML content; editable mode lets users change the text, with the small downside that the icon/label can be deleted accidentally (recoverable via undo). Other flat content containers can be added to the same list if more come up.

7. **See It pills couldn't have their image replaced via the toolbar** â€” clicking a See It pill didn't make it `selectedBlock` because `.img-peek` wasn't in `setSelectedFromEvent`'s closest() selector. Added `.img-peek` to that selector. `replaceSelectedMedia` already does `selectedBlock.querySelector('img,video,iframe')` as a fallback when `selectedBlock` itself isn't a media element, so it now finds the hidden popup image inside the pill and the Replace media dialog works out of the box. `blockUnit()` already had `.img-peek` in `compositeBlockSelector`, so delete/copy/move arrows also operate on the whole pill as a unit.

---

## How edits get saved

**The editor does NOT auto-save.** No backend, no localStorage of edits. Saving is a manual handoff via one of two toolbar exports, both built by `cleanDraftClone()` at line **1782**:

`cleanDraftClone` clones `document.documentElement`, strips the editor's own UI (`.rsp-module-editor`, `.module-editor-gate`, `.rsp-editor-insert-handle`, `.rsp-editor-insert-menu`), removes `contenteditable`/`spellcheck` attributes and editor-only classes, empties the dynamically-populated `.qcard[data-q]` cards, strips edit-mode body classes, and returns `<!DOCTYPE html>\n` + the cleaned outerHTML.

- **Copy HTML** â†’ `copyDraft()` writes the cleaned doc to the system clipboard. Paste into the source `.html` and save.
- **Download draft** â†’ `downloadDraft()` triggers a `<moduleId>-draft-YYYY-MM-DD.html` download. Drop into `modules/` replacing the original.

Then bump the `?v=` cache version on that module's `<link>` and `<script>` tags.

`sessionStorage` only keeps the unlocked editor session (`rsp_editor_unlocked_<moduleId>`); it does NOT store edit content. `beforeunload` warns about unsaved changes but can't actually save.

---

## Useful pointers in `shared/module.js`

| Line | What's there |
|---|---|
| 699 | `enterEditorMode()` â€” main editor activation |
| 703â€“709 | `selectedPage`, `selectedBlock`, `changed`, `blockClipboard` state |
| 713â€“714 | `undoStack`, `UNDO_LIMIT` |
| 718 | `editableSelector` array (which CSS selectors get contenteditable) |
| 735â€“764 | Toolbar HTML build â€” **add new buttons here** |
| 790 | `markChanged()` |
| 800 | `flashStatus(text)` |
| 835 | `blockUnit(el)` |
| 904 | `pushUndo()` |
| 911 | `undo()` |
| 969 | `injectInsertHandles()` |
| 1002 | `makeInsertHandle()` |
| 1016 | `showInsertMenu()` (portalled to body) |
| 1156 | `insertNearSelection(html)` â€” central insertion plumbing |
| 1252 | `openEditorDialog()` |
| 1306 | `wireQuizEditorCards()` |
| 1337 | `openQuizQuestionDialog()` |
| 1441 | `addPage()` |
| 1637 | `deleteSelectedBlock()` |
| 1656 | `copySelectedBlock()` |
| 1666 | `pasteAfterSelectedBlock()` |
| 1756 | `patchQuizConfigInClone()` â€” writes edited quiz data back into the inline `quiz` array during export |
| 1782 | `cleanDraftClone()` |
| 1867 | Drag-drop image/video onto a page |
| 1895 | Editor boot â€” `makeEditable(document)` + `wireQuizEditorCards(document)` + `injectInsertHandles()` |
| 1900 | `beforeunload` warning |

---

## How to test the editor

1. Run a local server in the portal folder: `python -m http.server 4173 --bind 127.0.0.1`.
2. Open `http://127.0.0.1:4173/admin.html?admin=true` and unlock with the password from `config.local.js`.
3. Hit "Edit draft" on any module â€” navigates to e.g. `modules/enclosure-types.html?edit=true`.
4. Unlock with the same password.
5. Toolbar appears across the top of the page. Click into text to edit. Use toolbar buttons or hover between blocks for the gap "+ Add block" handle.

---

## Known issues / parked

1. **Mastery Product Education series** — More modules queued (~80 total per the CSV). Motors track now shipped: Motor Mastery, Contactors & Overloads, Motor Starter Mastery (07), VFD Mastery (08), Line & Load Reactor Mastery (09), Harmonic Filter Mastery (10), and Soft Starter Mastery (11). The next new build can come from the remaining training folders outside this now-filled motor-control run.
2. **VFD Mastery live-render verification owed** — Module 08 still has not had a clean live browser pass in the current tooling state. Same local server, `http://127.0.0.1:4173/modules/vfd-mastery.html`.
3. **Motor Starter live-render verification still owed** — `modules/motor-starter.html` was only structurally verified.

---

## Open conversation threads

> _Update this before each new prompt â€” bullet anything the user mentioned but isn't yet resolved._

- None.

---

## Source files the user has uploaded over the project

- Each module came from a `MASTERY TRAINING.md` + `QUIZ.md` (+ sometimes a cheat-sheet PDF). The training doc maps to LEARN pages, the quiz maps to the 30-question Boss Fight. Mini-bosses I've invented per-module (Frost Imp, Sales Goblin, Cable Kraken, Heat Hydra, Frame Phantom, Substitution Specter, Coil Phantom, Overload Oracle, Type Troll, Scope Wraith, Material Mauler, Spec Sphinx).
- Quick-reference / cheat-sheet docs now get distilled into the page-25 `FINAL TAKEAWAYS` / playbook page rather than a tear-out loot-drop format.
