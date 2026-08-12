/**
 * RSP TRAINING PORTAL — CLOUD SYNC LAYER
 * ============================================================
 *
 * This file talks to Supabase. Every other file in the portal
 * goes through window.RSPCloud helpers below.
 *
 * SETUP (one time):
 *   1. Create a Supabase project (free tier).
 *   2. Run supabase-setup.sql in the SQL Editor.
 *   3. Project Settings → API → copy your URL + anon key.
 *   4. Paste them between the quotes below.
 *
 * If the keys are left as the placeholders, the portal still works
 * — it just stays in localStorage-only mode (no team/kudos features).
 * ============================================================
 */

// ============================================================
// Credentials come from config.local.js at the portal root
// (git-ignored) — see config.example.js. This archived v1 portal is
// still served via the /modules/* redirect, so it reads the same file.
// ============================================================
const RSP_CFG = (typeof window !== 'undefined' && window.RSP_CONFIG) || {};
const SUPABASE_URL = RSP_CFG.supabaseUrl || "PASTE_YOUR_SUPABASE_URL_HERE";
const SUPABASE_KEY = RSP_CFG.supabaseKey || "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";

// Optional: also forward kudos to Pumble (uses your existing webhook)
const KUDOS_TO_PUMBLE = true;
// ============================================================

(function(){
  const isConfigured = SUPABASE_URL && SUPABASE_URL.indexOf('http') === 0
                    && SUPABASE_KEY && SUPABASE_KEY.length > 20
                    && SUPABASE_URL.indexOf('PASTE_') === -1;

  // Normalize the URL — accept it with or without trailing /rest/v1[/]
  // so users can paste either the project URL or the "API URL" from Supabase.
  const BASE_URL = (SUPABASE_URL || '')
    .replace(/\/+$/, '')         // trailing slashes
    .replace(/\/rest\/v1$/, ''); // accidentally pasted /rest/v1

  // Tiny REST wrapper — no need to load the full Supabase JS client.
  async function sb(path, opts){
    if(!isConfigured) throw new Error('Supabase not configured');
    opts = opts || {};
    const headers = Object.assign({
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=representation'
    }, opts.headers || {});
    const url = BASE_URL + '/rest/v1' + path;
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if(!res.ok){
      const txt = await res.text();
      console.warn('Supabase error', res.status, txt);
      throw new Error('Supabase ' + res.status + ': ' + txt);
    }
    if(res.status === 204) return null;
    return res.json();
  }

  // ============================================================
  // USERS
  // ============================================================
  async function upsertUser(user){
    // PATCH-then-INSERT rather than a merge-duplicates upsert: after the v12
    // RLS lockdown the public key has no UPDATE grant on `name` (so it cannot
    // rename user records) and cannot write employee_id, and ON CONFLICT DO
    // UPDATE needs both. `select=name` keeps RETURNING inside the granted
    // columns. Mirrors the current portal's cloud.js.
    const patch = { last_active: new Date().toISOString() };
    // Only include avatar in the upsert when the user has actually picked one.
    // If we always sent a default like 'sparky', the column-default would mask
    // the "brand new user, no avatar picked yet" state for the avatar prompt
    // logic on the portal hub.
    if(user.avatar) patch.avatar = user.avatar;
    const updated = await sb('/users?name=eq.' + encodeURIComponent(user.name) + '&select=name', {
      method: 'PATCH',
      body: patch
    });
    if(Array.isArray(updated) && updated.length) return updated;
    try{
      return await sb('/users?select=name', {
        method: 'POST',
        body: Object.assign({ name: user.name }, patch)
      });
    }catch(e){
      if(/409|23505|duplicate/i.test(String(e && e.message))){
        return sb('/users?name=eq.' + encodeURIComponent(user.name) + '&select=name', {
          method: 'PATCH',
          body: patch
        });
      }
      throw e;
    }
  }

  async function listUsers(){
    return sb('/users?select=id,name,avatar,started_at,last_active,created_at,earned_tiers,earned_badges,roles&order=last_active.desc');
  }

  async function getUser(name){
    const result = await sb('/users?select=id,name,avatar,started_at,last_active,created_at,earned_tiers,earned_badges,roles&name=eq.' + encodeURIComponent(name));
    return result && result[0];
  }

  // ============================================================
  // PROGRESS
  // ============================================================
  async function upsertProgress(userName, moduleId, data){
    const row = {
      user_name: userName,
      module_id: moduleId,
      module_name: data.moduleName || moduleId,
      module_icon: data.moduleIcon || '⚡',
      answered: data.answered || {},
      correct: data.correct || 0,
      total: data.total || 40,
      viewed_pages: data.viewedPages || [],
      bosses_defeated: data.bossesDefeated || {},
      total_xp: data.totalXP || 0,
      tier: data.tier || null,
      completed_at: data.completedAt ? new Date(data.completedAt).toISOString() : null,
      last_update: new Date().toISOString(),
      submitted_to_webhook: !!data.submittedToWebhook
    };
    return sb('/progress?on_conflict=user_name,module_id', {
      method: 'POST',
      prefer: 'return=representation,resolution=merge-duplicates',
      body: row
    });
  }

  async function getProgressFor(userName){
    return sb('/progress?select=*&user_name=eq.' + encodeURIComponent(userName));
  }

  async function getAllProgress(){
    return sb('/progress?select=*');
  }

  async function getProgressByModule(moduleId){
    return sb('/progress?select=*&module_id=eq.' + encodeURIComponent(moduleId) + '&order=total_xp.desc');
  }

  // ============================================================
  // KUDOS
  // ============================================================
  async function sendKudos(from, to, moduleId, message, emoji){
    const row = {
      from_user: from,
      to_user: to,
      module_id: moduleId || null,
      message: message || null,
      emoji: emoji || '🎉'
    };
    return sb('/kudos', { method:'POST', body: row });
  }

  async function listKudos(limit){
    limit = limit || 25;
    return sb('/kudos?select=*&order=created_at.desc&limit=' + limit);
  }

  async function listKudosFor(userName){
    return sb('/kudos?select=*&to_user=eq.' + encodeURIComponent(userName) + '&order=created_at.desc');
  }

  // ============================================================
  // ADMIN — user management
  // ============================================================
  async function updateUserStatus(userName, status, notes){
    const body = { status: status };
    if(notes !== undefined) body.notes = notes;
    return sb('/users?name=eq.' + encodeURIComponent(userName), {
      method: 'PATCH',
      body: body
    });
  }

  async function getUserDetail(userName){
    if(!isConfigured) return null;
    const [user, progress, kudosReceived, kudosSent, grants] = await Promise.all([
      sb('/users?select=*&name=eq.' + encodeURIComponent(userName)).then(r => r && r[0]).catch(()=>null),
      sb('/progress?select=*&user_name=eq.' + encodeURIComponent(userName) + '&order=last_update.desc').catch(()=>[]),
      sb('/kudos?select=*&to_user=eq.' + encodeURIComponent(userName) + '&order=created_at.desc').catch(()=>[]),
      sb('/kudos?select=*&from_user=eq.' + encodeURIComponent(userName) + '&order=created_at.desc').catch(()=>[]),
      sb('/manual_grants?select=*&user_name=eq.' + encodeURIComponent(userName) + '&order=created_at.desc').catch(()=>[])
    ]);
    return { user, progress, kudosReceived, kudosSent, grants };
  }

  async function grantManualBadge(userName, badgeId, grantedBy, message){
    if(!isConfigured) throw new Error('Cloud not configured');
    // 1) Insert grant log
    await sb('/manual_grants', {
      method: 'POST',
      body: {
        user_name: userName,
        badge_id: badgeId,
        granted_by: grantedBy || 'Admin',
        message: message || null
      }
    });
    // 2) Append to user's earned_badges so it shows in their badge gallery
    await awardEarned(userName, [], [badgeId]);
    return true;
  }

  async function listAllManualGrants(limit){
    return sb('/manual_grants?select=*&order=created_at.desc&limit=' + (limit || 100));
  }

  // ============================================================
  // PRESENCE
  // ============================================================
  async function pingPresence(userName, moduleId){
    return sb('/presence?on_conflict=user_name', {
      method:'POST',
      prefer:'return=representation,resolution=merge-duplicates',
      body: {
        user_name: userName,
        module_id: moduleId || null,
        last_ping: new Date().toISOString()
      }
    });
  }

  async function getActivePresence(staleSeconds){
    staleSeconds = staleSeconds || 90;
    const cutoff = new Date(Date.now() - staleSeconds*1000).toISOString();
    return sb('/presence?select=*&last_ping=gt.' + encodeURIComponent(cutoff));
  }

  // ============================================================
  // EARNED TIERS / BADGES (the ratchet)
  // ============================================================

  /**
   * Append new tier/badge IDs to the user's permanent record.
   * Idempotent: skips IDs that are already there.
   * Pass arrays of IDs (strings) or full objects with .id.
   */
  async function awardEarned(userName, newTierIds, newBadgeIds){
    if(!isConfigured) return;
    if((!newTierIds || !newTierIds.length) && (!newBadgeIds || !newBadgeIds.length)) return;

    const cloudUser = await getUser(userName);
    if(!cloudUser) return;

    const now = new Date().toISOString();
    const existingTiers   = cloudUser.earned_tiers || [];
    const existingBadges  = cloudUser.earned_badges || [];
    const tierIdSet  = new Set(existingTiers.map(e => e.tier_id || e));
    const badgeIdSet = new Set(existingBadges.map(e => e.badge_id || e));

    const tiersToAdd = (newTierIds || [])
      .map(t => typeof t === 'string' ? t : t.id)
      .filter(id => id && !tierIdSet.has(id))
      .map(id => ({ tier_id: id, earned_at: now }));

    const badgesToAdd = (newBadgeIds || [])
      .map(b => typeof b === 'string' ? b : b.id)
      .filter(id => id && !badgeIdSet.has(id))
      .map(id => ({ badge_id: id, earned_at: now }));

    if(!tiersToAdd.length && !badgesToAdd.length) return;

    const body = {};
    if(tiersToAdd.length)   body.earned_tiers  = [...existingTiers,  ...tiersToAdd];
    if(badgesToAdd.length)  body.earned_badges = [...existingBadges, ...badgesToAdd];

    // select=name keeps RETURNING inside anon's granted columns — a bare
    // PATCH RETURNs *, including admin columns anon cannot read (v12).
    return sb('/users?name=eq.' + encodeURIComponent(userName) + '&select=name', {
      method: 'PATCH',
      body: body
    });
  }

  /**
   * Run the awarder against the local ledger — checks pending tier/badge
   * thresholds and locks in any new ones that the user has crossed.
   * Called automatically after every progress save.
   */
  async function evaluateAndAward(userName){
    if(!isConfigured) return;
    try{
      const ledger = JSON.parse(localStorage.getItem('rsp_ledger') || '{}');
      const learner = ledger[userName];
      if(!learner) return;
      const manifest = window.RSP_MANIFEST;
      if(!manifest) return;

      const cloudUser = await getUser(userName);
      const earnedTiers  = cloudUser ? (cloudUser.earned_tiers  || []) : [];
      const earnedBadges = cloudUser ? (cloudUser.earned_badges || []) : [];

      const lifetimeXP = Object.values(learner.modules || {}).reduce((s,m) => s + (m.totalXP || 0), 0);

      const pendingTiers  = window.pendingTierAwards  ? window.pendingTierAwards(lifetimeXP, earnedTiers) : [];
      const pendingBadges = window.pendingBadgeAwards ? window.pendingBadgeAwards(learner, manifest, earnedBadges) : [];

      if(pendingTiers.length || pendingBadges.length){
        await awardEarned(userName, pendingTiers, pendingBadges);
        // Cache locally so the UI shows them immediately
        cacheEarned(userName, pendingTiers, pendingBadges);
      }
    }catch(e){ console.warn('evaluateAndAward failed:', e); }
  }

  function cacheEarned(userName, newTiers, newBadges){
    try{
      const ledger = JSON.parse(localStorage.getItem('rsp_ledger') || '{}');
      if(!ledger[userName]) return;
      ledger[userName].earnedTiers  = ledger[userName].earnedTiers  || [];
      ledger[userName].earnedBadges = ledger[userName].earnedBadges || [];
      const tierIdSet  = new Set(ledger[userName].earnedTiers.map(e => e.tier_id));
      const badgeIdSet = new Set(ledger[userName].earnedBadges.map(e => e.badge_id));
      const now = new Date().toISOString();
      (newTiers || []).forEach(t => {
        const id = typeof t === 'string' ? t : t.id;
        if(id && !tierIdSet.has(id)) ledger[userName].earnedTiers.push({ tier_id: id, earned_at: now });
      });
      (newBadges || []).forEach(b => {
        const id = typeof b === 'string' ? b : b.id;
        if(id && !badgeIdSet.has(id)) ledger[userName].earnedBadges.push({ badge_id: id, earned_at: now });
      });
      localStorage.setItem('rsp_ledger', JSON.stringify(ledger));
    }catch(e){ /* ignore */ }
  }

  // ============================================================
  // DESTRUCTIVE — wipe everything (admin only)
  // ============================================================

  /**
   * Wipes all learner data from the cloud — users, progress, kudos,
   * presence, and any manual grants. Leaves config tables alone
   * (tier_settings, badge_definitions). Cannot be undone.
   */
  async function wipeAllCloud(){
    if(!isConfigured) throw new Error('Cloud not configured');
    // PostgREST requires a filter on every DELETE for safety.
    // Use a "name not equal to an impossible value" filter to match all rows.
    const NEVER = '__RSP_NEVER_USED__';
    const ops = [
      sb('/progress?user_name=neq.' + NEVER,   { method:'DELETE', prefer:'return=minimal' }),
      sb('/kudos?from_user=neq.' + NEVER,      { method:'DELETE', prefer:'return=minimal' }),
      sb('/presence?user_name=neq.' + NEVER,   { method:'DELETE', prefer:'return=minimal' }),
      sb('/manual_grants?user_name=neq.' + NEVER, { method:'DELETE', prefer:'return=minimal' }).catch(()=>null),
      sb('/users?name=neq.' + NEVER,           { method:'DELETE', prefer:'return=minimal' })
    ];
    await Promise.all(ops);
    return true;
  }

  // ============================================================
  // SYNC HELPERS — bridge between localStorage and the cloud
  // ============================================================

  /**
   * Push the entire local ledger entry for `userName` to the cloud.
   * Called after a quiz answer, mini-boss defeat, etc.
   */
  async function syncUpFromLocal(userName){
    if(!isConfigured) return;
    try{
      const user = JSON.parse(localStorage.getItem('rsp_user') || 'null');
      if(!user) return;
      await upsertUser(user);

      const ledger = JSON.parse(localStorage.getItem('rsp_ledger') || '{}');
      const learner = ledger[userName];
      if(!learner || !learner.modules) return;
      const promises = Object.entries(learner.modules).map(([modId, data]) =>
        upsertProgress(userName, modId, data).catch(e => console.warn('module sync failed:', modId, e))
      );
      await Promise.all(promises);

      // After progress is up, evaluate and lock in any new tiers/badges
      await evaluateAndAward(userName);
    }catch(e){ console.warn('syncUp failed:', e); }
  }

  /**
   * Pull the user's progress down from the cloud and merge into localStorage.
   * Call this on portal load (before rendering progress UI).
   */
  async function syncDownToLocal(userName){
    if(!isConfigured) return;
    try{
      const cloudUser = await getUser(userName);
      if(!cloudUser) return;
      // Update user record
      const localUserRaw = localStorage.getItem('rsp_user');
      const localUser = localUserRaw ? JSON.parse(localUserRaw) : {};
      localUser.name = cloudUser.name;
      localUser.id = cloudUser.employee_id;
      // Only adopt cloud's avatar if it has one — otherwise we mask the
      // "brand new user, no avatar picked yet" state from the picker logic.
      if(cloudUser.avatar) localUser.avatar = cloudUser.avatar;
      if(cloudUser.started_at) localUser.startedAt = new Date(cloudUser.started_at).getTime();
      localStorage.setItem('rsp_user', JSON.stringify(localUser));

      // Update ledger
      const cloudProgress = await getProgressFor(userName);
      const ledger = JSON.parse(localStorage.getItem('rsp_ledger') || '{}');
      if(!ledger[userName]) ledger[userName] = { name:userName, id:cloudUser.employee_id, modules:{} };
      if(!ledger[userName].modules) ledger[userName].modules = {};
      // Only update local avatar if cloud has one — preserves the new-user
      // prompt flow (otherwise the column default would mask "no avatar yet").
      if(cloudUser.avatar) ledger[userName].avatar = cloudUser.avatar;
      ledger[userName].earnedTiers  = cloudUser.earned_tiers  || [];
      ledger[userName].earnedBadges = cloudUser.earned_badges || [];
      cloudProgress.forEach(p => {
        const cloudLastUpdate = p.last_update ? new Date(p.last_update).getTime() : 0;
        const localModule = ledger[userName].modules[p.module_id];
        const localLastUpdate = (localModule && localModule.lastUpdate) || 0;
        // Only overwrite local with cloud if cloud is newer. This prevents the
        // portal's syncDown from wiping fresher in-module progress that hasn't
        // yet been pushed up. Cross-device case still works: the device with
        // the latest lastUpdate wins.
        if(localModule && cloudLastUpdate <= localLastUpdate) return;
        ledger[userName].modules[p.module_id] = {
          moduleId: p.module_id,
          moduleName: p.module_name,
          moduleIcon: p.module_icon,
          answered: p.answered,
          correct: p.correct,
          total: p.total,
          viewedPages: p.viewed_pages,
          bossesDefeated: p.bosses_defeated,
          totalXP: p.total_xp,
          tier: p.tier,
          completedAt: p.completed_at ? new Date(p.completed_at).getTime() : null,
          submittedToWebhook: p.submitted_to_webhook,
          lastUpdate: cloudLastUpdate || Date.now()
        };
      });
      localStorage.setItem('rsp_ledger', JSON.stringify(ledger));
    }catch(e){ console.warn('syncDown failed:', e); }
  }

  // ============================================================
  // PUBLIC API — everything the rest of the portal calls
  // ============================================================
  window.RSPCloud = {
    isConfigured: isConfigured,
    upsertUser: upsertUser,
    listUsers: listUsers,
    getUser: getUser,
    upsertProgress: upsertProgress,
    getProgressFor: getProgressFor,
    getAllProgress: getAllProgress,
    getProgressByModule: getProgressByModule,
    sendKudos: sendKudos,
    listKudos: listKudos,
    listKudosFor: listKudosFor,
    pingPresence: pingPresence,
    getActivePresence: getActivePresence,
    awardEarned: awardEarned,
    evaluateAndAward: evaluateAndAward,
    wipeAllCloud: wipeAllCloud,
    updateUserStatus: updateUserStatus,
    getUserDetail: getUserDetail,
    grantManualBadge: grantManualBadge,
    listAllManualGrants: listAllManualGrants,
    syncUp: syncUpFromLocal,
    syncDown: syncDownToLocal,
    KUDOS_TO_PUMBLE: KUDOS_TO_PUMBLE
  };

  if(!isConfigured){
    console.info('RSPCloud: Supabase not configured — running localStorage-only.');
  } else {
    console.info('RSPCloud: connected to ' + SUPABASE_URL);
  }
})();
