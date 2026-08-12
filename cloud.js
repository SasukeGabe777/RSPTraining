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
 *   3. Copy config.example.js to config.local.js.
 *   4. Project Settings → API → paste your URL + anon key into it.
 *
 * Credentials live in config.local.js (git-ignored), not in this file, so
 * they are never committed. Every page loads it before this script.
 *
 * If config.local.js is missing or still holds the placeholders, the portal
 * still works — it just stays in localStorage-only mode (no team/kudos
 * features).
 * ============================================================
 */

// ============================================================
// Credentials come from config.local.js — see config.example.js
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

  // ============================================================
  // ADMIN KEY — elevated credential, memory only
  // ============================================================
  // After supabase-migration-v12.sql the public anon key can read the learner
  // surface and write progress, but cannot delete anything or modify quizzes,
  // module config, or paths. Those operations need the service-role key, which
  // the admin dashboard prompts for once per session.
  //
  // It is deliberately held in a closure variable and NEVER written to
  // localStorage or sessionStorage: persisting it would leave an all-powerful
  // credential on disk for any later visitor to the same browser profile. It
  // dies with the tab.
  let adminKey = null;

  function setAdminKey(key){
    const trimmed = String(key || '').trim();
    adminKey = trimmed || null;
    return !!adminKey;
  }
  function hasAdminKey(){ return !!adminKey; }
  function clearAdminKey(){ adminKey = null; }

  /** The credential to send: the elevated key when set, otherwise the public one. */
  function activeKey(){ return adminKey || SUPABASE_KEY; }

  /**
   * Confirm an elevated key really is elevated before the UI trusts it.
   * Reads a column the anon role is not granted; anon gets a 401/403 while
   * the service role succeeds. Restores the previous key on failure so a bad
   * paste cannot leave the dashboard in a half-authenticated state.
   */
  async function verifyAdminKey(key){
    const previous = adminKey;
    if(!setAdminKey(key)) { adminKey = previous; throw new Error('No key provided'); }
    try{
      await sb('/users?select=notes&limit=1', { cache:'no-store' });
      return true;
    }catch(e){
      adminKey = previous;
      throw new Error('That key was rejected. Paste the service_role key from Project Settings → API.');
    }
  }

  // Tiny REST wrapper — no need to load the full Supabase JS client.
  async function sb(path, opts){
    if(!isConfigured) throw new Error('Supabase not configured');
    opts = opts || {};
    const key = activeKey();
    const headers = Object.assign({
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=representation'
    }, opts.headers || {});
    const url = BASE_URL + '/rest/v1' + path;
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: opts.cache || 'default'
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
    // NOT a PostgREST merge-duplicates upsert. That compiles to
    // INSERT ... ON CONFLICT DO UPDATE SET <every payload column>, which
    // needs UPDATE privilege on `name` — deliberately withheld from anon
    // (v12) so the public key cannot rename user records. Instead: PATCH
    // the granted columns first (the common, returning-user case), and only
    // INSERT when no row matched. `select=name` keeps RETURNING inside the
    // granted column list — a bare write RETURNs *, including admin columns
    // anon cannot read, and the whole request would 401.
    const patch = { last_active: new Date().toISOString() };
    // employee_id is an admin-managed column: the anon grant does not include
    // it (v12), so sending it from a learner session would reject the whole
    // write. Only include it when the elevated key is loaded.
    if(user.id && hasAdminKey()) patch.employee_id = user.id;
    // Only include avatar when the user has actually picked one. If we always
    // sent a default like 'sparky', the column-default would mask the "brand
    // new user, no avatar picked yet" state for the avatar prompt logic.
    if(user.avatar) patch.avatar = user.avatar;

    const updated = await sb('/users?name=eq.' + encodeURIComponent(user.name) + '&select=name', {
      method: 'PATCH',
      body: patch
    });
    if(Array.isArray(updated) && updated.length) return updated;

    // No existing row — create it.
    try{
      return await sb('/users?select=name', {
        method: 'POST',
        body: Object.assign({ name: user.name }, patch)
      });
    }catch(e){
      // Lost a create race (unique violation on name) — the row exists now,
      // so the PATCH that just found nothing will succeed.
      if(/\b409\b|23505|duplicate/i.test(String(e && e.message))){
        return sb('/users?name=eq.' + encodeURIComponent(user.name) + '&select=name', {
          method: 'PATCH',
          body: patch
        });
      }
      throw e;
    }
  }

  // Columns the public key is granted (see supabase-migration-v12.sql).
  // employee_id, notes and status are administrative and withheld from anon,
  // so learner-facing reads must name their columns rather than use `select=*`
  // — a narrowed grant makes `SELECT *` fail outright.
  const USER_PUBLIC_COLUMNS = 'id,name,avatar,started_at,last_active,created_at,earned_tiers,earned_badges,roles';

  /** `*` only when an elevated key is loaded; the public column list otherwise. */
  function userColumns(){ return adminKey ? '*' : USER_PUBLIC_COLUMNS; }

  async function listUsers(){
    return sb('/users?select=' + userColumns() + '&order=last_active.desc');
  }

  async function getUser(name){
    const result = await sb('/users?select=' + userColumns() + '&name=eq.' + encodeURIComponent(name));
    return result && result[0];
  }

  // ============================================================
  // PROGRESS
  // ============================================================
  async function upsertProgress(userName, moduleId, data){
    const history = Array.isArray(data.attemptHistory) ? data.attemptHistory : [];
    const latestAttempt = data.lastAttempt || (history.length ? history[history.length - 1] : null);
    const row = {
      user_name: userName,
      module_id: moduleId,
      module_name: data.moduleName || moduleId,
      module_icon: data.moduleIcon || '⚡',
      hub: data.hub || (window.RSP_MANIFEST ? window.RSP_MANIFEST.hubOf(moduleId) : 'product_mastery'),
      answered: data.answered || {},
      correct: latestAttempt && latestAttempt.score != null ? latestAttempt.score : (data.correct || 0),
      total: latestAttempt && latestAttempt.total != null ? latestAttempt.total : (data.total != null ? data.total : 0),
      viewed_pages: data.viewedPages || [],
      bosses_defeated: data.bossesDefeated || {},
      total_xp: data.totalXP || 0,
      tier: data.tier || null,
      completed_at: data.completedAt ? new Date(data.completedAt).toISOString() : null,
      last_update: new Date().toISOString(),
      submitted_to_webhook: !!data.submittedToWebhook,
      attempts: data.attempts || 0,
      best_pct: data.bestPct || 0,
      attempt_history: history
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

  /**
   * Permanently remove one learner and the records that would otherwise make
   * them reappear in admin reports. Dependencies are deleted first; the user
   * row is removed last so a partial failure remains visible and retryable.
   */
  async function deleteLearner(userName){
    if(!isConfigured) throw new Error('Cloud not configured');
    const encoded = encodeURIComponent(userName);
    await Promise.all([
      sb('/progress?user_name=eq.' + encoded, { method:'DELETE', prefer:'return=minimal' }),
      sb('/presence?user_name=eq.' + encoded, { method:'DELETE', prefer:'return=minimal' }),
      sb('/manual_grants?user_name=eq.' + encoded, { method:'DELETE', prefer:'return=minimal' }),
      sb('/kudos?from_user=eq.' + encoded, { method:'DELETE', prefer:'return=minimal' }),
      sb('/kudos?to_user=eq.' + encoded, { method:'DELETE', prefer:'return=minimal' })
    ]);
    await sb('/users?name=eq.' + encoded, { method:'DELETE', prefer:'return=minimal' });
    return true;
  }

  async function getUserDetail(userName){
    if(!isConfigured) return null;
    const [user, progress, kudosReceived, kudosSent, grants] = await Promise.all([
      sb('/users?select=' + userColumns() + '&name=eq.' + encodeURIComponent(userName)).then(r => r && r[0]).catch(()=>null),
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
   * Idempotent: skips IDs that are already there (within the same hub —
   * hub id and hub badge id are always distinct, but this stays hub-aware
   * so re-running for two hubs in the same batch never collides).
   * Pass arrays of IDs (strings, assumed product_mastery) or full objects
   * with .id/.hub (the shape pendingTierAwards/pendingBadgeAwards return).
   */
  async function awardEarned(userName, newTierIds, newBadgeIds){
    if(!isConfigured) return;
    if((!newTierIds || !newTierIds.length) && (!newBadgeIds || !newBadgeIds.length)) return;

    const cloudUser = await getUser(userName);
    if(!cloudUser) return;

    const now = new Date().toISOString();
    const existingTiers   = cloudUser.earned_tiers || [];
    const existingBadges  = cloudUser.earned_badges || [];
    const tierKey  = e => (e.hub || 'product_mastery') + ':' + (e.tier_id || e);
    const badgeKey = e => (e.hub || 'product_mastery') + ':' + (e.badge_id || e);
    const tierIdSet  = new Set(existingTiers.map(tierKey));
    const badgeIdSet = new Set(existingBadges.map(badgeKey));

    const tiersToAdd = (newTierIds || [])
      .map(t => typeof t === 'string' ? { id: t, hub: 'product_mastery' } : { id: t.id, hub: t.hub || 'product_mastery' })
      .filter(t => t.id && !tierIdSet.has(t.hub + ':' + t.id))
      .map(t => ({ tier_id: t.id, hub: t.hub, earned_at: now }));

    const badgesToAdd = (newBadgeIds || [])
      .map(b => typeof b === 'string' ? { id: b, hub: 'product_mastery' } : { id: b.id, hub: b.hub || 'product_mastery' })
      .filter(b => b.id && !badgeIdSet.has(b.hub + ':' + b.id))
      .map(b => ({ badge_id: b.id, hub: b.hub, earned_at: now }));

    if(!tiersToAdd.length && !badgesToAdd.length) return;

    const body = {};
    if(tiersToAdd.length)   body.earned_tiers  = [...existingTiers,  ...tiersToAdd];
    if(badgesToAdd.length)  body.earned_badges = [...existingBadges, ...badgesToAdd];

    // select=name keeps RETURNING inside anon's granted columns (see
    // upsertUser) — this PATCH runs from learner sessions after every quiz.
    return sb('/users?name=eq.' + encodeURIComponent(userName) + '&select=name', {
      method: 'PATCH',
      body: body
    });
  }

  /**
   * Run the awarder against the local ledger — checks pending tier/badge
   * thresholds PER HUB and locks in any new ones that the user has
   * crossed. Called automatically after every progress save. Onboarding
   * completion never awards Product Mastery tiers/badges and vice versa,
   * because each hub's XP/entitlement is computed from only that hub's
   * modules (see hubScopedXP / entitledBadges in badges.js).
   */
  async function evaluateAndAward(userName){
    if(!isConfigured) return;
    try{
      const ledger = JSON.parse(localStorage.getItem('rsp_ledger') || '{}');
      const learner = ledger[userName];
      if(!learner) return;
      const manifest = window.RSP_MANIFEST;
      if(!manifest) return;

      const awardInputs = await Promise.allSettled([getUser(userName), getAllModuleConfigs()]);
      if(awardInputs[0].status === 'rejected') throw awardInputs[0].reason;
      const cloudUser = awardInputs[0].value;
      const moduleConfigs = awardInputs[1].status === 'fulfilled'
        ? manifest.cacheModuleConfigs(awardInputs[1].value)
        : (manifest.readModuleConfigCache ? manifest.readModuleConfigCache() : {});

      const earnedTiers  = cloudUser ? (cloudUser.earned_tiers  || []) : [];
      const earnedBadges = cloudUser ? (cloudUser.earned_badges || []) : [];

      const allPendingTiers = [];
      const allPendingBadges = [];
      Object.keys(window.RSP_HUBS || { product_mastery: 1 }).forEach(hub => {
        const lifetimeXP = window.hubScopedXP(hub, learner.modules, moduleConfigs);
        if(window.pendingTierAwards)  allPendingTiers.push(...window.pendingTierAwards(hub, lifetimeXP, earnedTiers));
        if(window.pendingBadgeAwards) allPendingBadges.push(...window.pendingBadgeAwards(hub, learner, manifest, earnedBadges, moduleConfigs));
      });

      if(allPendingTiers.length || allPendingBadges.length){
        await awardEarned(userName, allPendingTiers, allPendingBadges);
        // Cache locally so the UI shows them immediately
        cacheEarned(userName, allPendingTiers, allPendingBadges);
      }
    }catch(e){ console.warn('evaluateAndAward failed:', e); }
  }

  function cacheEarned(userName, newTiers, newBadges){
    try{
      const ledger = JSON.parse(localStorage.getItem('rsp_ledger') || '{}');
      if(!ledger[userName]) return;
      ledger[userName].earnedTiers  = ledger[userName].earnedTiers  || [];
      ledger[userName].earnedBadges = ledger[userName].earnedBadges || [];
      const tierKey  = e => (e.hub || 'product_mastery') + ':' + e.tier_id;
      const badgeKey = e => (e.hub || 'product_mastery') + ':' + e.badge_id;
      const tierIdSet  = new Set(ledger[userName].earnedTiers.map(tierKey));
      const badgeIdSet = new Set(ledger[userName].earnedBadges.map(badgeKey));
      const now = new Date().toISOString();
      (newTiers || []).forEach(t => {
        const id = typeof t === 'string' ? t : t.id;
        const hub = typeof t === 'string' ? 'product_mastery' : (t.hub || 'product_mastery');
        if(id && !tierIdSet.has(hub + ':' + id)) ledger[userName].earnedTiers.push({ tier_id: id, hub, earned_at: now });
      });
      (newBadges || []).forEach(b => {
        const id = typeof b === 'string' ? b : b.id;
        const hub = typeof b === 'string' ? 'product_mastery' : (b.hub || 'product_mastery');
        if(id && !badgeIdSet.has(hub + ':' + id)) ledger[userName].earnedBadges.push({ badge_id: id, hub, earned_at: now });
      });
      localStorage.setItem('rsp_ledger', JSON.stringify(ledger));
    }catch(e){ /* ignore */ }
  }

  // ============================================================
  // MODULE CONFIG — admin-managed embed URLs and codewords
  // Requires supabase-migration-v4.sql to be run first.
  // ============================================================

  async function getModuleConfig(moduleId){
    if(!isConfigured) return null;
    const result=await sb('/module_config?select=*&module_id=eq.'+encodeURIComponent(moduleId),{cache:'no-store'});
    return result&&result[0]?result[0]:null;
  }

  async function getAllModuleConfigs(){
    if(!isConfigured) return [];
    // Do not turn a network/server failure into a valid empty result. Callers
    // use this distinction to retain their last-known-good module list rather
    // than flashing "0 modules / 0 quizzes" while the content still exists.
    const rows = await sb('/module_config?select=*&order=module_id.asc');
    if(!Array.isArray(rows)) throw new Error('Unexpected module configuration response');
    if(window.RSP_MANIFEST && window.RSP_MANIFEST.readModuleConfigCache){
      if(rows.length === 0) throw new Error('Module configuration response was unexpectedly empty');
      window.RSP_MANIFEST.cacheModuleConfigs(rows);
    }
    return rows;
  }

  async function setModuleConfig(moduleId,config){
    if(!isConfigured) throw new Error('Cloud not configured');
    const body={module_id:moduleId,updated_at:new Date().toISOString()};
    if(config.hub!==undefined)          body.hub=config.hub;
    if(config.sort_order!==undefined)   body.sort_order=config.sort_order;
    if(config.embed_url!==undefined)    body.embed_url=config.embed_url;
    if(config.codeword!==undefined)     body.codeword=config.codeword;
    if(config.quiz_bank!==undefined)    body.quiz_bank=config.quiz_bank;
    if(config.flipbook!==undefined)     body.flipbook=config.flipbook;
    if(config.video_pages!==undefined)  body.video_pages=config.video_pages;
    if(config.module_meta!==undefined)  body.module_meta=config.module_meta;
    if(config.xp!==undefined)           body.xp=config.xp;
    if(config.pass_pct!==undefined)     body.pass_pct=config.pass_pct;
    if(config.published!==undefined)    body.published=config.published;
    if(config.updated_by!==undefined)   body.updated_by=config.updated_by;
    return sb('/module_config?on_conflict=module_id',{
      method:'POST',
      prefer:'return=representation,resolution=merge-duplicates',
      body:body
    });
  }

  function cacheVerifiedModuleConfig(row){
    if(!row||!row.module_id||!window.RSP_MANIFEST||!window.RSP_MANIFEST.readModuleConfigCache)return;
    const cached=window.RSP_MANIFEST.readModuleConfigCache();
    cached[row.module_id]=Object.assign({},cached[row.module_id]||{},row);
    window.RSP_MANIFEST.cacheModuleConfigs(Object.keys(cached).map(function(id){return cached[id]}));
  }

  // Codeword changes control learner access, so unlike generic partial config
  // writes they are verified before the UI reports success. The POST response
  // is authoritative when present; a no-cache GET confirms unusual/empty
  // responses and prevents a stale local cache from showing a blank on reload.
  async function setModuleCodeword(moduleId,codeword,updatedBy){
    const normalized=String(codeword==null?'':codeword).trim().toUpperCase();
    const expected=normalized||null;
    const result=await setModuleConfig(moduleId,{codeword:expected,updated_by:updatedBy});
    let verified=Array.isArray(result)?result[0]:result;
    const matches=function(row){
      return !!row&&String(row.codeword==null?'':row.codeword).trim().toUpperCase()===normalized;
    };
    if(!matches(verified)){
      let lastError=null;
      for(let attempt=0;attempt<3;attempt++){
        try{
          verified=await getModuleConfig(moduleId);
          if(matches(verified))break;
        }catch(e){lastError=e}
        if(attempt<2)await new Promise(function(resolve){setTimeout(resolve,250*(attempt+1))});
      }
      if(!matches(verified)){
        throw new Error(lastError&&lastError.message
          ? 'Codeword save could not be verified: '+lastError.message
          : 'Codeword save was not confirmed by Supabase. Please try again.');
      }
    }
    cacheVerifiedModuleConfig(verified);
    return verified;
  }

  async function deleteModuleConfig(moduleId){
    return sb('/module_config?module_id=eq.'+encodeURIComponent(moduleId),{method:'DELETE'});
  }

  // ============================================================
  // PATHS — learner paths (tags + roles)
  // Requires supabase-migration-v11.sql to be run first.
  //
  // A path is a cross-hub view over modules, never a hub itself: no XP,
  // tier, or badge state is stored here. See paths.js for the rules.
  // ============================================================

  async function listPaths(){
    if(!isConfigured) return [];
    const rows = await sb('/paths?select=*&order=sort_order.asc.nullslast,label.asc', {cache:'no-store'});
    if(!Array.isArray(rows)) throw new Error('Unexpected path response');
    return rows;
  }

  async function getPath(pathId){
    if(!isConfigured) return null;
    const rows = await sb('/paths?select=*&id=eq.' + encodeURIComponent(pathId), {cache:'no-store'});
    return rows && rows[0] ? rows[0] : null;
  }

  /**
   * Create or update a path. Only the fields present on `patch` are written,
   * so callers can save a reorder without resending the whole record.
   */
  async function upsertPath(pathId, patch){
    if(!isConfigured) throw new Error('Cloud not configured');
    if(!pathId) throw new Error('A path id is required');
    const body = { id: pathId, updated_at: new Date().toISOString() };
    ['label','description','icon','accent','is_role','show_on_home','sequential','sort_order','module_ids','updated_by']
      .forEach(function(key){ if(patch[key] !== undefined) body[key] = patch[key]; });
    return sb('/paths?on_conflict=id', {
      method: 'POST',
      prefer: 'return=representation,resolution=merge-duplicates',
      body: body
    });
  }

  /**
   * Delete a path and withdraw it from every learner holding it as a role,
   * so no one is left assigned to a path that no longer exists. Role
   * withdrawal happens first: a partial failure then leaves the path intact
   * and the operation safely retryable.
   */
  async function deletePath(pathId){
    if(!isConfigured) throw new Error('Cloud not configured');
    const holders = await sb('/users?select=name,roles&roles=cs.' + encodeURIComponent(JSON.stringify([pathId])));
    await Promise.all((holders || []).map(function(u){
      const next = (Array.isArray(u.roles) ? u.roles : []).filter(function(id){ return id !== pathId; });
      return setUserRoles(u.name, next);
    }));
    await sb('/paths?id=eq.' + encodeURIComponent(pathId), { method:'DELETE', prefer:'return=minimal' });
    return true;
  }

  /** Replace a learner's assigned role ids (array of path ids). */
  async function setUserRoles(userName, roleIds){
    if(!isConfigured) throw new Error('Cloud not configured');
    const clean = Array.from(new Set((roleIds || []).filter(Boolean).map(String)));
    return sb('/users?name=eq.' + encodeURIComponent(userName), {
      method: 'PATCH',
      body: { roles: clean }
    });
  }

  // ============================================================
  // FLIPBOOKS — PDF-based training (Supabase Storage + module_config)
  // Requires supabase-migration-v5.sql to be run first.
  // ============================================================

  const FLIPBOOK_BUCKET = 'training-flipbooks';

  // Public URL for an object in the flipbook bucket. Public-read bucket means
  // employees fetch page images directly with no auth round-trip.
  function flipbookPublicUrl(path){
    return BASE_URL + '/storage/v1/object/public/' + FLIPBOOK_BUCKET + '/' + path;
  }

  /**
   * Upload a single binary asset (PDF or page image) to the flipbook bucket.
   * `body` is a Blob/File. Uses x-upsert so re-uploading the same path
   * (e.g. re-converting a module) overwrites cleanly. Returns the public URL.
   */
  async function uploadFlipbookAsset(path, body, contentType){
    if(!isConfigured) throw new Error('Supabase not configured');
    // Storage writes are service-role only after v12 — reads stay public.
    const key = activeKey();
    const url = BASE_URL + '/storage/v1/object/' + FLIPBOOK_BUCKET + '/' + path;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': contentType || (body && body.type) || 'application/octet-stream',
        'x-upsert': 'true',
        'cache-control': 'public, max-age=31536000'
      },
      body: body
    });
    if(!res.ok){
      const txt = await res.text().catch(()=> '');
      throw new Error('Storage ' + res.status + ': ' + txt);
    }
    return flipbookPublicUrl(path);
  }

  // Persist the flipbook record (status, page URLs, etc.) onto module_config.
  // Goes through the same upsert path setModuleConfig uses, but lets us write
  // just the flipbook JSON without disturbing embed_url / quiz_bank.
  async function setFlipbook(moduleId, flipbook){
    if(!isConfigured) throw new Error('Cloud not configured');
    return sb('/module_config?on_conflict=module_id', {
      method: 'POST',
      prefer: 'return=representation,resolution=merge-duplicates',
      body: {
        module_id: moduleId,
        flipbook: flipbook,
        updated_at: new Date().toISOString()
      }
    });
  }

  async function getFlipbook(moduleId){
    const cfg = await getModuleConfig(moduleId);
    return cfg && cfg.flipbook ? cfg.flipbook : null;
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
      // Roles are admin-assigned and flow one way: the cloud is authoritative
      // and upsertUser() never writes them back, so a learner page cannot
      // grant itself a role by editing local storage.
      localUser.roles = Array.isArray(cloudUser.roles) ? cloudUser.roles : [];
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
      function mergeAttemptHistory(localHistory, cloudHistory){
        const seen = new Set(), merged = [];
        [].concat(Array.isArray(localHistory) ? localHistory : [], Array.isArray(cloudHistory) ? cloudHistory : []).forEach(function(item){
          if(!item || typeof item !== 'object') return;
          const key = [item.finishedAt || item.finished_at || '', item.pct, item.score, item.total, item.passed].join('|');
          if(seen.has(key)) return;
          seen.add(key);
          merged.push(item);
        });
        merged.sort(function(a,b){ return Number(a.finishedAt || a.finished_at || 0) - Number(b.finishedAt || b.finished_at || 0); });
        return merged;
      }
      cloudProgress.forEach(p => {
        const cloudLastUpdate = p.last_update ? new Date(p.last_update).getTime() : 0;
        const localModule = ledger[userName].modules[p.module_id] || {};
        const localLastUpdate = (localModule && localModule.lastUpdate) || 0;
        const cloudModule = {
          moduleId: p.module_id,
          moduleName: p.module_name,
          moduleIcon: p.module_icon,
          hub: p.hub || localModule.hub || (window.RSP_MANIFEST ? window.RSP_MANIFEST.hubOf(p.module_id) : 'product_mastery'),
          answered: p.answered,
          correct: p.correct,
          total: p.total,
          viewedPages: p.viewed_pages,
          bossesDefeated: p.bosses_defeated,
          totalXP: p.total_xp,
          tier: p.tier,
          completedAt: p.completed_at ? new Date(p.completed_at).getTime() : null,
          submittedToWebhook: p.submitted_to_webhook,
          lastUpdate: cloudLastUpdate || 0
        };
        const preferred = cloudLastUpdate > localLastUpdate ? cloudModule : localModule;
        const history = mergeAttemptHistory(localModule.attemptHistory, p.attempt_history);
        const completedAt = localModule.completedAt || cloudModule.completedAt || null;
        ledger[userName].modules[p.module_id] = Object.assign({}, preferred, {
          moduleId: p.module_id,
          moduleName: preferred.moduleName || cloudModule.moduleName || p.module_id,
          moduleIcon: preferred.moduleIcon || cloudModule.moduleIcon || 'âš¡',
          hub: preferred.hub || cloudModule.hub,
          completedAt: completedAt,
          totalXP: Math.max(Number(localModule.totalXP || 0), Number(p.total_xp || 0)),
          lastUpdate: Math.max(localLastUpdate, cloudLastUpdate),
          openedAt: localModule.openedAt || null,
          lastAttemptAt: localModule.lastAttemptAt || (history.length ? Number(history[history.length-1].finishedAt || history[history.length-1].finished_at || 0) : null),
          attempts: Math.max(Number(localModule.attempts || 0), Number(p.attempts || 0), history.length),
          bestScore: Math.max(Number(localModule.bestScore || 0), Number(p.correct || 0)),
          bestPct: Math.max(Number(localModule.bestPct || 0), Number(p.best_pct || 0)),
          attemptHistory: history,
          // Detailed answer review is intentionally device-local; never erase
          // it when the cloud only contains the compact attempt summary.
          lastAttempt: localModule.lastAttempt || null
        });
      });
      localStorage.setItem('rsp_ledger', JSON.stringify(ledger));
    }catch(e){ console.warn('syncDown failed:', e); }
  }

  // ============================================================
  // PUBLIC API — everything the rest of the portal calls
  // ============================================================
  window.RSPCloud = {
    isConfigured: isConfigured,
    // Admin elevation — memory only, dies with the tab (see setAdminKey above)
    setAdminKey: setAdminKey,
    verifyAdminKey: verifyAdminKey,
    hasAdminKey: hasAdminKey,
    clearAdminKey: clearAdminKey,
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
    updateUserStatus: updateUserStatus,
    deleteLearner: deleteLearner,
    getUserDetail: getUserDetail,
    grantManualBadge: grantManualBadge,
    listAllManualGrants: listAllManualGrants,
    syncUp: syncUpFromLocal,
    syncDown: syncDownToLocal,
    listPaths: listPaths,
    getPath: getPath,
    upsertPath: upsertPath,
    deletePath: deletePath,
    setUserRoles: setUserRoles,
    getModuleConfig: getModuleConfig,
    getAllModuleConfigs: getAllModuleConfigs,
    setModuleConfig: setModuleConfig,
    setModuleCodeword: setModuleCodeword,
    deleteModuleConfig: deleteModuleConfig,
    flipbookBucket: FLIPBOOK_BUCKET,
    flipbookPublicUrl: flipbookPublicUrl,
    uploadFlipbookAsset: uploadFlipbookAsset,
    setFlipbook: setFlipbook,
    getFlipbook: getFlipbook,
    KUDOS_TO_PUMBLE: KUDOS_TO_PUMBLE
  };

  if(!isConfigured){
    console.info('RSPCloud: Supabase not configured — running localStorage-only.');
  } else {
    console.info('RSPCloud: connected to ' + SUPABASE_URL);
  }
})();
