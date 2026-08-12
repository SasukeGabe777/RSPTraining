/**
 * RSP TRAINING PORTAL — LOCAL CONFIGURATION (TEMPLATE)
 * ============================================================
 *
 * SETUP: copy this file to `config.local.js` in the same folder and fill in
 * the real values. `config.local.js` is git-ignored, so credentials stay out
 * of the repository.
 *
 *     cp config.example.js config.local.js
 *
 * Deploying: `config.local.js` must ship with the site. If you deploy by
 * dragging the portal folder onto Netlify, it is included automatically —
 * there is nothing extra to do. If you deploy from git, add the file in the
 * Netlify UI or generate it in a build step.
 *
 * Without a `config.local.js`, the portal still loads and runs in
 * localStorage-only mode: progress saves on the device but nothing syncs,
 * and the admin dashboard cannot be unlocked.
 *
 * ⚠ These values are NOT secrets in the cryptographic sense. Everything here
 * is served to the browser and can be read from the deployed site by anyone
 * who views source. Keeping the file out of git prevents automated credential
 * scanners from harvesting it, which is the realistic threat — it does not
 * make the portal private. The Supabase anon key currently grants full
 * read/write/delete on every table (see the RLS policies in
 * supabase-setup.sql), so treat it as sensitive and rotate it if it leaks.
 * ============================================================
 */
window.RSP_CONFIG = {
  // Supabase → Project Settings → API → Project URL
  supabaseUrl: "PASTE_YOUR_SUPABASE_URL_HERE",

  // Supabase → Project Settings → API → Project API keys → anon / public
  supabaseKey: "PASTE_YOUR_SUPABASE_ANON_KEY_HERE",

  // Gate for admin.html. Client-side only — a speed bump, not real security.
  adminPassword: "PASTE_YOUR_ADMIN_PASSWORD_HERE"
};
