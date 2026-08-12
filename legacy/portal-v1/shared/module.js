/* =============================================================
   RSP TRAINING MODULE — SHARED FRAMEWORK
   Exposes window.RSPModule with a single init(config) entry
   point. Each module's inline script just calls:

     RSPModule.init({
       moduleId:           "motor-mastery",
       moduleName:         "Motor Mastery",
       moduleIcon:         "⚡",
       quiz:               [...],
       minibosses:         {...},
       mapSections:        [...],
       pageRanges:         [{section:"intro", from:1, to:3}, ...],
       totalQuestions:     30,
       passGold:           24,           // optional, default 80%
       passSilver:         18,           // optional, default 60%
       pageXpTotal:        170,          // optional informational
       minibossXpTotal:    50,           // optional informational
       adminPassword:      (window.RSP_CONFIG && window.RSP_CONFIG.adminPassword) || "",
       pumbleWebhookUrl:   "https://...",
       storageKey:         "rsp_motor_progress",   // legacy cleanup key
       trackerSelector:    null,          // optional override
       tierBadges: {                       // optional tier copy
         gold:   { name:"...", msg:"..." },
         silver: { name:"...", msg:"..." },
         bronze: { name:"...", msg:"..." }
       },
       tierSubmitText: {                   // optional Pumble copy
         gold:"...", silver:"...", bronze:"..."
       },
       minibossCount: 2                   // optional, for webhook copy
     });

   The framework preserves every behavior found in the three
   shipping modules (accessories / mastery / fundamentals).
   ============================================================= */

(function(global){
  'use strict';

  // ---- localStorage helpers (memory fallback) ----
  const memStore = {};
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return memStore[k] || null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){ memStore[k]=v; } }
  function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){ delete memStore[k]; } }

  // Shared keys across every module so the portal can pull them all.
  const KEY_USER   = 'rsp_user';
  const KEY_LEDGER = 'rsp_ledger';
  const KEY_ADMIN_SESSION = 'rsp_admin_unlocked';

  function ssGet(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
  function ssSet(k,v){ try{ sessionStorage.setItem(k,v); }catch(e){} }

  function escapeHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ============================================================
  //  RSPModule.init(config)
  // ============================================================
  function init(config){
    // ---------- Resolve / default the config ----------
    const cfg = Object.assign({
      moduleId:        'unnamed-module',
      moduleName:      'Untitled Module',
      moduleIcon:      '⭐',
      quiz:            [],
      minibosses:      {},
      mapSections:     [],
      pageRanges:      [],
      totalQuestions:  0,
      passGold:        null,
      passSilver:      null,
      pageXpTotal:     0,
      minibossXpTotal: 0,
      adminPassword:   (window.RSP_CONFIG && window.RSP_CONFIG.adminPassword) || "",
      pumbleWebhookUrl: '',
      storageKey:      null,
      tierBadges:      null,
      tierSubmitText:  null,
      minibossCount:   null
    }, config || {});

    if(cfg.totalQuestions === 0 && Array.isArray(cfg.quiz)){
      cfg.totalQuestions = cfg.quiz.length;
    }
    if(cfg.passGold   === null) cfg.passGold   = Math.ceil(cfg.totalQuestions * 0.80);
    if(cfg.passSilver === null) cfg.passSilver = Math.ceil(cfg.totalQuestions * 0.60);
    if(cfg.minibossCount === null) cfg.minibossCount = Object.keys(cfg.minibosses).length;

    const QUIZ_XP_TOTAL = cfg.totalQuestions * 2;
    const TOTAL_XP = (cfg.pageXpTotal || 0) + QUIZ_XP_TOTAL + (cfg.minibossXpTotal || 0);
    const QUIZ_LETTERS = ['A','B','C','D'];

    const DEFAULT_TIERS = {
      gold:   { name:'MASTERY',  msg:'Top tier — keep it sharp.' },
      silver: { name:'SOLID',    msg:'Re-run APPLY level and re-fight.' },
      bronze: { name:'RE-DO',    msg:'Back to LEARN. The boss waits.' }
    };
    const TIERS = Object.assign({}, DEFAULT_TIERS, cfg.tierBadges || {});

    const DEFAULT_SUBMIT_TIERS = {
      gold:   '🥇 Mastery',
      silver: '🥈 Solid — Re-run APPLY level',
      bronze: '🥉 Needs Re-do — Back to LEARN'
    };
    const SUBMIT_TIERS = Object.assign({}, DEFAULT_SUBMIT_TIERS, cfg.tierSubmitText || {});

    // ---------- State ----------
    const state = {
      user:            null,
      answered:        {},
      correct:         0,
      viewedPages:     new Set(),
      bossesDefeated:  {},
      currentSection:  (cfg.mapSections[0] && cfg.mapSections[0].id) || 'intro',
      submittedToWebhook: false,
      _completedAt:    null
    };

    // ---------- PAGE → SECTION lookup ----------
    const PAGE_TO_SECTION = {};
    function buildPageMap(){
      (cfg.pageRanges || []).forEach(r => {
        for(let i=r.from; i<=r.to; i++) PAGE_TO_SECTION[i] = r.section;
      });
    }

    // ---------- Quiz card renderer ----------
    function normalizeQuizQuestion(raw, fallbackN){
      const qNum = parseInt(raw && raw.n, 10) || parseInt(fallbackN, 10) || 0;
      const opts = {};
      QUIZ_LETTERS.forEach(letter => {
        const value = raw && raw.opts ? raw.opts[letter] : '';
        opts[letter] = value == null ? '' : String(value);
      });
      return {
        n: qNum,
        q: raw && raw.q != null ? String(raw.q) : '',
        opts: opts,
        c: QUIZ_LETTERS.includes(raw && raw.c) ? raw.c : 'A'
      };
    }

    function findQuizQuestion(qNum){
      return cfg.quiz.find(q => String(q.n) === String(qNum)) || null;
    }

    function setQuizCardData(card, question){
      if(!card || !question) return;
      card.setAttribute('data-q', String(question.n));
      card.dataset.quizJson = JSON.stringify(normalizeQuizQuestion(question, question.n));
    }

    function getQuizCardData(card){
      if(!card) return null;
      const fallbackN = card.getAttribute && card.getAttribute('data-q');
      const raw = card.dataset && card.dataset.quizJson;
      if(raw){
        try{
          return normalizeQuizQuestion(JSON.parse(raw), fallbackN);
        }catch(e){}
      }
      const fromCfg = findQuizQuestion(fallbackN);
      return fromCfg ? normalizeQuizQuestion(fromCfg, fallbackN) : null;
    }

    function collectEditedQuizQuestions(root){
      const scope = root || document;
      const overrides = {};
      scope.querySelectorAll('.qcard[data-q]').forEach(card => {
        const question = getQuizCardData(card);
        if(question) overrides[String(question.n)] = question;
      });
      return cfg.quiz.map(question => {
        const key = String(question.n);
        return overrides[key]
          ? normalizeQuizQuestion(overrides[key], question.n)
          : normalizeQuizQuestion(question, question.n);
      });
    }

    function syncQuizConfigFromCards(root){
      cfg.quiz = collectEditedQuizQuestions(root);
    }

    function renderCard(card, q){
      const question = normalizeQuizQuestion(q, card.getAttribute('data-q'));
      setQuizCardData(card, question);
      const printOpts = QUIZ_LETTERS.map(L => `${L}. ${escapeHtml(question.opts[L])}`).join('<br>');
      card.innerHTML = `
        <span class="qnum">Q ${question.n}</span>
        <p class="qtext">${escapeHtml(question.q)}</p>
        <p class="opts print-only">${printOpts}</p>
        <div class="opts-buttons interactive-only" data-q="${question.n}" data-correct="${question.c}">
          ${QUIZ_LETTERS.map(L =>
            `<button data-letter="${L}" type="button"><span class="letter">${L}.</span><span>${escapeHtml(question.opts[L])}</span></button>`
          ).join('')}
        </div>
      `;
    }

    // ---------- XP helpers ----------
    function pageXP(){
      let xp = 0;
      state.viewedPages.forEach(pid => {
        const pg = document.querySelector('[data-page-id="'+pid+'"]');
        if(pg) xp += parseInt(pg.dataset.xp, 10) || 0;
      });
      return xp;
    }
    function bossXP(){
      let xp = 0;
      Object.keys(state.bossesDefeated).forEach(bid => {
        xp += state.bossesDefeated[bid].xp || 0;
      });
      return xp;
    }

    // ---------- Save / load progress (unified ledger) ----------
    function saveProgress(){
      if(!state.user) return;
      const totalXP = pageXP() + state.correct * 2 + bossXP();
      const isComplete = Object.keys(state.answered).length === cfg.totalQuestions;
      const moduleData = {
        moduleId:     cfg.moduleId,
        moduleName:   cfg.moduleName,
        moduleIcon:   cfg.moduleIcon,
        answered:     state.answered,
        correct:      state.correct,
        total:        cfg.totalQuestions,
        viewedPages:  Array.from(state.viewedPages),
        bossesDefeated: state.bossesDefeated,
        submittedToWebhook: !!state.submittedToWebhook,
        totalXP:      totalXP,
        tier:         isComplete
                        ? (state.correct >= cfg.passGold   ? 'gold'
                          : state.correct >= cfg.passSilver ? 'silver'
                          : 'bronze')
                        : null,
        lastUpdate:   Date.now(),
        completedAt:  isComplete ? (state._completedAt || (state._completedAt = Date.now())) : null
      };

      const ledger = JSON.parse(lsGet(KEY_LEDGER) || '{}');
      if(state.user && state.user.name){
        if(!ledger[state.user.name]){
          ledger[state.user.name] = {
            name:      state.user.name,
            id:        state.user.id,
            startedAt: state.user.startedAt,
            modules:   {}
          };
        }
        if(!ledger[state.user.name].modules) ledger[state.user.name].modules = {};
        ledger[state.user.name].modules[cfg.moduleId] = moduleData;
        lsSet(KEY_LEDGER, JSON.stringify(ledger));
      }
    }

    function loadProgress(){
      if(!state.user || !state.user.name) return;
      const ledger = JSON.parse(lsGet(KEY_LEDGER) || '{}');
      const entry  = ledger[state.user.name];
      if(!entry || !entry.modules || !entry.modules[cfg.moduleId]) return;
      try{
        const data = entry.modules[cfg.moduleId];
        state.answered           = data.answered || {};
        state.correct            = data.correct || 0;
        state.viewedPages        = new Set(data.viewedPages || []);
        state.bossesDefeated     = data.bossesDefeated || {};
        state.submittedToWebhook = !!data.submittedToWebhook;
        if(data.completedAt) state._completedAt = data.completedAt;

        // Re-apply each saved quiz answer to the DOM
        Object.keys(state.answered).forEach(qNum => {
          const wrap = document.querySelector('.opts-buttons[data-q="'+qNum+'"]');
          if(!wrap) return;
          const correct = wrap.dataset.correct;
          const chosen  = state.answered[qNum];
          const chosenBtn  = wrap.querySelector('button[data-letter="'+chosen+'"]');
          const correctBtn = wrap.querySelector('button[data-letter="'+correct+'"]');
          if(chosenBtn) chosenBtn.classList.add(chosen === correct ? 'correct' : 'wrong');
          if(chosen !== correct && correctBtn) correctBtn.classList.add('correct');
          Array.from(wrap.querySelectorAll('button')).forEach(b => b.disabled = true);
        });

        // Mark defeated mini-boss gates
        Object.keys(state.bossesDefeated).forEach(bid => {
          const gate = document.querySelector('.miniboss-gate[data-miniboss="'+bid+'"]');
          if(gate){
            gate.classList.add('defeated');
            const result = state.bossesDefeated[bid];
            const bossName = (cfg.minibosses[bid] && cfg.minibosses[bid].name) || 'Boss';
            gate.innerHTML = '<div class="icon">✅</div><h3>'+bossName+' DEFEATED</h3>'+
                             '<div class="sub">Score: '+result.score+'/5 · +'+result.xp+' XP earned</div>';
          }
        });

        // Reflect restored answer state in the boss-round HP bars
        updateBossHpBars();
      }catch(e){ /* ignore corrupt save */ }
    }

    // ---------- XP tracker rendering ----------
    function updateTracker(){
      const answered = Object.keys(state.answered).length;
      const pXP      = pageXP();
      const qXP      = state.correct * 2;
      const bXP      = bossXP();
      const totalXP  = pXP + qXP + bXP;

      const elXP        = document.getElementById('trackerXP');
      const elAnswered  = document.getElementById('trackerAnswered');
      const elCorrect   = document.getElementById('trackerCorrect');
      const elPages     = document.getElementById('trackerPages');
      const elFill      = document.getElementById('trackerFill');
      const elUser      = document.getElementById('trackerUser');

      if(elXP)       elXP.textContent = totalXP;
      if(elAnswered) elAnswered.textContent = answered;
      if(elCorrect)  elCorrect.textContent = state.correct;
      if(elPages)    elPages.textContent = state.viewedPages.size;
      if(elFill && TOTAL_XP > 0) elFill.style.width = Math.min(100, (totalXP / TOTAL_XP * 100)) + '%';
      if(elUser && state.user) elUser.textContent = cfg.moduleIcon + ' ' + state.user.name.toUpperCase();

      renderSideMap();

      // Results page (final score widget — optional, only renders if present)
      const sc = document.getElementById('scoreCorrect');
      if(sc){
        sc.textContent = state.correct;
        const sx = document.getElementById('scoreXP');     if(sx) sx.textContent = totalXP;
        const sb = document.getElementById('scoreBar');    if(sb) sb.style.width = (state.correct / cfg.totalQuestions * 100) + '%';
        const tier = document.getElementById('tierBadge');
        if(tier){
          if(answered === cfg.totalQuestions){
            let badgeKey = 'bronze';
            if(state.correct >= cfg.passGold)        badgeKey = 'gold';
            else if(state.correct >= cfg.passSilver) badgeKey = 'silver';
            const medal = badgeKey === 'gold' ? '🥇' : badgeKey === 'silver' ? '🥈' : '🥉';
            const t = TIERS[badgeKey];
            tier.innerHTML = '<div class="tier-badge-display badge-'+badgeKey+'">'+
              '<div class="medal">'+medal+'</div>'+
              '<div class="tier-name">'+escapeHtml(t.name)+'</div>'+
              '<div class="tier-msg">'+escapeHtml(t.msg)+'</div>'+
            '</div>';
          } else {
            tier.innerHTML = '<div style="color:#94A3B8;font-size:12px;text-align:center">'+
              '<div style="font-size:32px">⏳</div>'+
              '<div style="margin-top:6px">Answer all '+cfg.totalQuestions+'<br>to see your tier</div>'+
            '</div>';
          }
        }
      }
    }

    // ---------- Quiz answer click handler ----------
    function handleClick(e){
      const btn  = e.currentTarget;
      const wrap = btn.parentElement;
      const qNum = wrap.dataset.q;
      if(state.answered[qNum]) return;
      const correct = wrap.dataset.correct;
      const chosen  = btn.dataset.letter;
      state.answered[qNum] = chosen;
      if(chosen === correct){
        btn.classList.add('correct');
        state.correct++;
      } else {
        btn.classList.add('wrong');
        const correctBtn = wrap.querySelector('button[data-letter="'+correct+'"]');
        if(correctBtn) correctBtn.classList.add('correct');
      }
      Array.from(wrap.querySelectorAll('button')).forEach(b => b.disabled = true);
      saveProgress();
      updateTracker();
      updateBossHpBars();

      // Auto-submit to Pumble when fully complete
      if(Object.keys(state.answered).length === cfg.totalQuestions
         && cfg.pumbleWebhookUrl
         && !state.submittedToWebhook){
        setTimeout(() => submitResults(false), 800);
      }
    }

    // Update each boss-round page's HP bar based on questions answered
    // on that page. Bar starts at 100% (full) and depletes to 0% when
    // every question on that round page has been answered.
    function updateBossHpBars(){
      const roundPages = document.querySelectorAll('.page.boss-page[data-quiz-page]');
      roundPages.forEach(page => {
        const cards = page.querySelectorAll('.qcard[data-q]');
        if(cards.length === 0) return;
        let answered = 0;
        cards.forEach(c => { if(state.answered[c.dataset.q]) answered++; });
        const remaining = Math.max(0, cards.length - answered) / cards.length;
        const fill = page.querySelector('.hp-bar .fill');
        if(fill) fill.style.width = (remaining * 100) + '%';
      });
    }

    function resetQuiz(){
      state.answered = {};
      state.correct  = 0;
      document.querySelectorAll('.opts-buttons button').forEach(b => {
        b.disabled = false;
        b.classList.remove('correct','wrong');
      });
      saveProgress();
      updateTracker();
      updateBossHpBars();
      const firstQuiz = document.querySelector('[data-quiz-page="1"]');
      if(firstQuiz) firstQuiz.scrollIntoView({behavior:'smooth'});
    }

    function resetAll(){
      if(!confirm('Reset ALL progress? This will clear your XP, quiz answers, and log you out.')) return;
      if(cfg.storageKey) lsDel(cfg.storageKey);
      lsDel(KEY_USER);
      location.reload();
    }

    // ---------- Page XP tagging + viewed observation ----------
    function tagPagesForXP(){
      document.querySelectorAll('.page').forEach((page, idx) => {
        let xp = 0;
        if(page.querySelector('.lvl-learn')) xp = 10;
        else if(page.querySelector('.lvl-apply')) xp = 15;
        if(xp > 0){
          page.dataset.xp     = xp;
          page.dataset.pageId = 'p' + idx;
        }
      });
    }

    function watchPages(){
      const obs = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(e.isIntersecting && e.intersectionRatio >= 0.4){
            const pid = e.target.dataset.pageId;
            if(pid && !state.viewedPages.has(pid)){
              state.viewedPages.add(pid);
              saveProgress();
              updateTracker();
            }
          }
        });
      }, {threshold: [0.4, 0.5]});
      document.querySelectorAll('.page[data-xp]').forEach(p => obs.observe(p));
    }

    // ---------- Side map ----------
    function sectionStatus(sec){
      if(sec.isBoss && sec.bossId){
        if(state.bossesDefeated[sec.bossId]) return 'done';
      }
      if(sec.id === 'finalboss' || sec.isFinal){
        const answered = Object.keys(state.answered).length;
        if(answered === cfg.totalQuestions) return 'done';
        if(answered > 0) return 'current';
      }
      if(sec.id === state.currentSection) return 'current';
      const sectionPages = Array.from(document.querySelectorAll('[data-section-id="'+sec.id+'"]'));
      if(sectionPages.length > 0){
        const allViewed = sectionPages.every(p => state.viewedPages.has(p.dataset.pageId));
        if(allViewed) return 'done';
      }
      return 'locked';
    }

    function renderSideMap(){
      const path = document.getElementById('mapPath');
      if(!path) return;
      const html = cfg.mapSections.map(sec => {
        const status = sectionStatus(sec);
        const cls = ['map-node', status, sec.isBoss ? 'boss' : ''].filter(Boolean).join(' ');
        return '<div class="'+cls+'" data-section="'+sec.id+'" data-firstpage="'+sec.firstPage+'" data-bossid="'+(sec.bossId||'')+'">'+
          '<div class="dot">'+sec.icon+'</div>'+
          '<div class="map-label"><div class="name">'+sec.name+'</div><div class="meta">'+sec.meta+'</div></div>'+
        '</div>';
      }).join('');
      path.innerHTML = html;
      path.querySelectorAll('.map-node').forEach(n => n.addEventListener('click', onMapNodeClick));
    }

    function onMapNodeClick(e){
      const node   = e.currentTarget;
      const bossId = node.dataset.bossid;
      if(bossId){ openMiniboss(bossId); return; }
      const firstPage = parseInt(node.dataset.firstpage, 10);
      const pages = document.querySelectorAll('.page');
      const target = pages[firstPage - 1];
      if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
    }

    function tagSectionsOnPages(){
      document.querySelectorAll('.page').forEach((page, idx) => {
        const num = idx + 1;
        if(!page.dataset.sectionId){
          const sec = PAGE_TO_SECTION[num];
          if(sec) page.dataset.sectionId = sec;
        }
        if(!page.dataset.pageId) page.dataset.pageId = 'p' + idx;
      });
    }

    // ---------- Mini-boss engine ----------
    function openMiniboss(bossId){
      const boss = cfg.minibosses[bossId];
      if(!boss) return;
      if(state.bossesDefeated[bossId]){
        renderMinibossSummary(bossId);
      } else {
        renderMinibossQuiz(bossId);
      }
      document.getElementById('minibossOverlay').classList.add('show');
    }

    function closeMiniboss(){
      const ov = document.getElementById('minibossOverlay');
      if(ov) ov.classList.remove('show');
    }

    function renderMinibossQuiz(bossId){
      const boss  = cfg.minibosses[bossId];
      const modal = document.getElementById('minibossModal');
      const qHtml = boss.questions.map((q, idx) => {
        return '<div class="qcard" data-mbq="'+idx+'">'+
          '<span class="qnum">Q '+(idx+1)+'</span>'+
          '<p class="qtext">'+q.q+'</p>'+
          '<div class="opts-buttons" data-correct="'+q.c+'">'+
            ['A','B','C','D'].map(L =>
              '<button data-letter="'+L+'" type="button">'+
                '<span class="letter">'+L+'.</span>'+
                '<span>'+escapeHtml(q.opts[L])+'</span>'+
              '</button>'
            ).join('')+
          '</div>'+
        '</div>';
      }).join('');
      modal.innerHTML =
        '<div class="header">'+
          '<div class="boss-icon">'+boss.icon+'</div>'+
          '<div><div class="boss-sub">'+boss.tagline+'</div><h2>'+boss.name+'</h2></div>'+
        '</div>'+
        '<div class="hp-bar"><div class="fill" id="mbHpFill"></div></div>'+
        '<div id="mbProgress" style="margin-top:6px;color:#94A3B8;font-size:11px;font-weight:800;letter-spacing:.1em">'+
          '0 / '+boss.questions.length+' answered · need '+boss.passScore+' correct to win'+
        '</div>'+
        '<div id="mbQuestions" style="margin-top:6px">'+qHtml+'</div>'+
        '<div class="miniboss-actions"><button class="close" id="mbClose">FLEE</button></div>';

      let mbCorrect = 0, mbAnswered = 0;
      modal.querySelectorAll('.opts-buttons button').forEach(btn => {
        btn.addEventListener('click', function(){
          const wrap = btn.parentElement;
          if(wrap.dataset.locked === '1') return;
          wrap.dataset.locked = '1';
          const correct = wrap.dataset.correct;
          const chosen  = btn.dataset.letter;
          if(chosen === correct){
            btn.classList.add('correct');
            mbCorrect++;
          } else {
            btn.classList.add('wrong');
            const cb = wrap.querySelector('button[data-letter="'+correct+'"]');
            if(cb) cb.classList.add('correct');
          }
          Array.from(wrap.querySelectorAll('button')).forEach(b => b.disabled = true);
          mbAnswered++;
          const prog = document.getElementById('mbProgress');
          if(prog) prog.textContent = mbAnswered+' / '+boss.questions.length+' answered · '+mbCorrect+' correct · need '+boss.passScore+' to win';
          const hp = document.getElementById('mbHpFill');
          if(hp) hp.style.width = (100 - (mbAnswered / boss.questions.length * 100)) + '%';
          if(mbAnswered === boss.questions.length){
            finishMiniboss(bossId, mbCorrect);
          }
        });
      });
      const closeBtn = document.getElementById('mbClose');
      if(closeBtn) closeBtn.addEventListener('click', closeMiniboss);
    }

    function finishMiniboss(bossId, score){
      const boss = cfg.minibosses[bossId];
      const won  = score >= boss.passScore;
      const xpEarned = won ? boss.xpReward : 0;
      if(won){
        state.bossesDefeated[bossId] = {score:score, xp:xpEarned, defeatedAt:Date.now()};
        saveProgress();
        const gate = document.querySelector('.miniboss-gate[data-miniboss="'+bossId+'"]');
        if(gate){
          gate.classList.add('defeated');
          gate.innerHTML = '<div class="icon">✅</div><h3>'+boss.name+' DEFEATED</h3>'+
                           '<div class="sub">Score: '+score+'/'+boss.questions.length+' · +'+xpEarned+' XP earned</div>';
        }
      }
      const modal = document.getElementById('minibossModal');
      const resultHtml = '<div class="miniboss-result '+(won?'win':'lose')+'">'+
        '<h3>'+(won?'🏆 VICTORY':'💀 DEFEATED')+'</h3>'+
        '<p>You scored '+score+' out of '+boss.questions.length+'. '+
        (won
          ? 'You earned <b>+'+xpEarned+' XP</b>. The path forward is clear.'
          : 'You needed '+boss.passScore+' correct to win. Re-read the section and try again.')+
        '</p></div>';
      modal.querySelector('.miniboss-actions').insertAdjacentHTML('beforebegin', resultHtml);
      const actions = modal.querySelector('.miniboss-actions');
      actions.innerHTML = won
        ? '<button class="continue" id="mbCont">CONTINUE →</button>'
        : '<button class="close" id="mbRetry">TRY AGAIN</button> <button class="close" id="mbCloseEnd">CLOSE</button>';
      if(won){
        document.getElementById('mbCont').addEventListener('click', closeMiniboss);
      } else {
        document.getElementById('mbRetry').addEventListener('click', () => renderMinibossQuiz(bossId));
        document.getElementById('mbCloseEnd').addEventListener('click', closeMiniboss);
      }
      updateTracker();
    }

    function renderMinibossSummary(bossId){
      const boss   = cfg.minibosses[bossId];
      const result = state.bossesDefeated[bossId];
      const modal  = document.getElementById('minibossModal');
      modal.innerHTML =
        '<div class="header">'+
          '<div class="boss-icon">✅</div>'+
          '<div><div class="boss-sub">DEFEATED</div><h2>'+boss.name+'</h2></div>'+
        '</div>'+
        '<div class="miniboss-result win">'+
          '<h3>🏆 ALREADY DEFEATED</h3>'+
          '<p>You scored '+result.score+'/'+boss.questions.length+' and earned <b>+'+result.xp+' XP</b>.</p>'+
        '</div>'+
        '<div class="miniboss-actions"><button class="continue" id="mbCloseDone">CLOSE</button></div>';
      document.getElementById('mbCloseDone').addEventListener('click', closeMiniboss);
    }

    // ---------- Admin mode ----------
    function isAdminURL(){
      return new URLSearchParams(location.search).get('admin') === 'true';
    }

    function isEditorURL(){
      return new URLSearchParams(location.search).get('edit') === 'true';
    }

    function renderQuizCardsOnPage(){
      document.querySelectorAll('.qcard[data-q]').forEach(card => {
        const n = parseInt(card.dataset.q, 10);
        const q = findQuizQuestion(n);
        if(q) renderCard(card, q);
      });
      if(isEditorURL()) return;
      document.querySelectorAll('.opts-buttons button').forEach(b => b.addEventListener('click', handleClick));
    }

    function openEditorLogin(){
      const sessionKey = 'rsp_editor_unlocked_' + cfg.moduleId;
      try{
        if(ssGet(sessionKey) === 'true' || ssGet(KEY_ADMIN_SESSION) === 'true'){
          if(ssGet(KEY_ADMIN_SESSION) === 'true') ssSet(sessionKey, 'true');
          enterEditorMode();
          return;
        }
      }catch(e){}

      const gate = document.createElement('div');
      gate.id = 'moduleEditorGate';
      gate.className = 'module-editor-gate';
      gate.innerHTML =
        '<div class="module-editor-login">'+
          '<div class="module-editor-pretitle">RSP INDUSTRIAL CONTENT EDITOR</div>'+
          '<h2>'+escapeHtml(cfg.moduleName)+'</h2>'+
          '<p>Enter the admin password to edit a draft.</p>'+
          '<input type="password" id="moduleEditorPwd" placeholder="Admin password" autocomplete="off">'+
          '<div class="module-editor-error" id="moduleEditorErr"></div>'+
          '<button type="button" id="moduleEditorUnlock">Unlock editor</button>'+
          '<a href="'+escapeHtml(location.pathname)+'">Return to learner view</a>'+
        '</div>';
      document.body.appendChild(gate);

      function unlock(){
        const input = document.getElementById('moduleEditorPwd');
        if(input && cfg.adminPassword && input.value === cfg.adminPassword){
          ssSet(sessionKey, 'true');
          ssSet(KEY_ADMIN_SESSION, 'true');
          gate.remove();
          enterEditorMode();
        } else {
          const err = document.getElementById('moduleEditorErr');
          if(err) err.textContent = 'Wrong password.';
        }
      }

      document.getElementById('moduleEditorUnlock').addEventListener('click', unlock);
      document.getElementById('moduleEditorPwd').addEventListener('keydown', e => { if(e.key === 'Enter') unlock(); });
      setTimeout(() => {
        const input = document.getElementById('moduleEditorPwd');
        if(input) input.focus();
      }, 50);
    }

    function enterEditorMode(){
      document.body.classList.add('rsp-edit-mode');
      document.body.classList.remove('has-sidemap', 'collapsed-map');

      let selectedPage = document.querySelector('.page');
      let selectedBlock = null;
      let changed = false;
      // Internal block clipboard — stores the outerHTML of the most-recently
      // copied top-level block. Lives only in memory for this editor session
      // (intentionally; the system clipboard would conflict with text copy).
      let blockClipboard = '';
      // Undo stack — snapshots the outerHTML of every .page in DOM order
      // before each block-level mutation. Capped so the array can't grow
      // unbounded over a long editing session. Note: this is a *structural*
      // undo; text edits inside a focused contenteditable use the browser's
      // native Ctrl+Z while you're typing.
      const undoStack = [];
      const UNDO_LIMIT = 50;

      const editableSelector = [
        'h1','h2','h3','p','li',
        '.page-tag','.level-banner','.pill','.sub','.xp-pill',
        '.tc-name','.tc-tag','.tc-desc','.tc-use','.body-d','.types',
        '.stamp','.xp-num','.says','.means','.quote-it',
        // Product / manufacturer card content. .mfr-tag/.mfr-mat and
        // .prod-tag/.prod-use were missing here, so card kickers and
        // materials lines weren't directly editable — clicking them
        // bubbled up to the whole card. Adding them lets each line in
        // the card focus on its own.
        '.prod-name','.prod-desc','.prod-tag','.prod-use',
        '.mfr-name','.mfr-desc','.mfr-tag','.mfr-mat',
        '.xp-target-center','.xp-target-badge',
        '.protected-diagram-label','.protected-diagram-item',
        '.value-card-icon',
        // Cover-page chrome: the two ribbon pills ("RSP INDUSTRIAL",
        // "MODULE 01") and the bottom tagline ("Learn it. Apply it. …")
        // are both small text bits the editor previously didn't expose.
        '.badge', '.tagline > div',
        // Numbered chips on cards: .num (01/02/03 on level cards),
        // .num-d (1-5 on decision cards), .obj-num (1-6 on objectives).
        // Constraining .num to .level-card avoids capturing the XP
        // tracker's #trackerXP .num, which is hidden in edit mode but
        // shouldn't be made contenteditable either.
        '.level-card .num', '.num-d', '.obj-num',
        // Flat content containers — these have no nested editable
        // children, so they need to be contenteditable themselves to
        // register clicks. blockUnit() lists them in compositeBlockSelector
        // so once selected they're treated as a single unit by move/copy/
        // delete/paste.
        '.powerup'
      ].join(',');

      const toolbar = document.createElement('div');
      toolbar.id = 'moduleEditorToolbar';
      toolbar.className = 'rsp-module-editor';
      toolbar.innerHTML =
        '<div class="rsp-editor-title">'+
          '<span class="rsp-editor-kicker">Draft editor</span>'+
          '<strong>'+escapeHtml(cfg.moduleName)+'</strong>'+
          '<span id="rspEditorStatus">No changes</span>'+
        '</div>'+
        '<div class="rsp-editor-actions">'+
          '<button type="button" data-editor-action="undo" title="Undo last block change (text edits use Ctrl+Z while typing)">↶ Undo</button>'+
          '<button type="button" data-editor-action="add-page" title="Add a new blank page after the selected page">+ Page</button>'+
          '<button type="button" data-editor-action="paragraph" title="Add paragraph">+ Text</button>'+
          '<button type="button" data-editor-action="factbox" title="Add callout">+ Callout</button>'+
          '<button type="button" data-editor-action="image" title="Add image">+ Image</button>'+
          '<button type="button" data-editor-action="video" title="Add video">+ Video</button>'+
          '<button type="button" data-editor-action="seeit" title="Add a hover-to-reveal photo button to the selected text block">+ See it</button>'+
          '<button type="button" data-editor-action="seeit-video" title="Add a hover-to-reveal video button to the selected text block">+ See it (video)</button>'+
          '<button type="button" data-editor-action="copy-block" title="Copy the selected block to the editor clipboard">📋 Copy</button>'+
          '<button type="button" data-editor-action="paste-block" title="Paste the most recently copied block after the selected block">📌 Paste</button>'+
          '<button type="button" data-editor-action="delete-block" title="Delete the selected block">🗑 Delete</button>'+
          '<button type="button" data-editor-action="replace-media" title="Replace selected media">Replace media</button>'+
          '<button type="button" data-editor-action="copy" title="Copy draft HTML">Copy HTML</button>'+
          '<button type="button" data-editor-action="download" title="Download draft HTML">Download draft</button>'+
          '<a href="'+escapeHtml(location.pathname)+'">Exit</a>'+
        '</div>';
      document.body.appendChild(toolbar);

      const dropHint = document.createElement('div');
      dropHint.id = 'rspEditorDropHint';
      dropHint.className = 'rsp-module-editor rsp-editor-drop-hint';
      dropHint.textContent = 'Drop image or video on a page to add it to this draft.';
      document.body.appendChild(dropHint);

      const dialog = document.createElement('div');
      dialog.id = 'rspEditorDialog';
      dialog.className = 'rsp-module-editor rsp-editor-dialog';
      document.body.appendChild(dialog);

      // Floating ↑/↓ reorder controls for the currently selected block.
      // Portalled to body so they never get trapped in a parent stacking
      // context and are visible above page content.
      const blockControls = document.createElement('div');
      blockControls.className = 'rsp-editor-block-controls rsp-module-editor';
      blockControls.innerHTML =
        '<button type="button" data-move="up" title="Move block up" aria-label="Move block up">▲</button>'+
        '<button type="button" data-move="down" title="Move block down" aria-label="Move block down">▼</button>';
      document.body.appendChild(blockControls);
      blockControls.addEventListener('click', e => {
        const btn = e.target.closest('button[data-move]');
        if(!btn || btn.disabled) return;
        e.stopPropagation();
        if(btn.dataset.move === 'up') moveSelectedBlock(-1);
        else if(btn.dataset.move === 'down') moveSelectedBlock(1);
      });

      function markChanged(){
        changed = true;
        document.body.classList.add('rsp-editor-has-changes');
        const status = document.getElementById('rspEditorStatus');
        if(status) status.textContent = 'Unsaved draft changes';
      }

      // Briefly flash a transient message in the status slot, then revert to
      // the standard "Unsaved draft changes" / "No changes" label.
      let flashStatusTimer = null;
      function flashStatus(text){
        const status = document.getElementById('rspEditorStatus');
        if(!status) return;
        status.textContent = text;
        if(flashStatusTimer) clearTimeout(flashStatusTimer);
        flashStatusTimer = setTimeout(() => {
          status.textContent = changed ? 'Unsaved draft changes' : 'No changes';
        }, 1500);
      }

      // Find the smallest "meaningful block" around `el` — the unit of
      // action for delete/copy. Legacy pages wrap their content in a single
      // top-level flex/grid div with all the actual content nested inside,
      // so walking up to the .page's direct child would nuke the whole
      // panel for a click that was meant to delete just one paragraph.
      //
      // Rules:
      //   1. If `el` is inside a known composite wrapper (factbox, media
      //      block, callout, info card), return the WHOLE wrapper — those
      //      should always delete as one unit.
      //   2. Otherwise return the contenteditable element itself (heading,
      //      paragraph, list item, page-tag) so we only remove what was
      //      actually clicked.
      //   3. Never walk past the enclosing .page.
      // Inner pieces of the protected-diagram (illustration, dashed lines,
      // hazard list items) are registered as their own composites so the
      // editor's move/copy/delete operate on each piece independently
      // instead of grabbing the whole surrounding .factbox. blockUnit()
      // uses el.closest(), which returns the NEAREST matching ancestor —
      // so an item match wins over the factbox match further up the tree.
      // The outer .protected-diagram is intentionally NOT a composite:
      // clicking the diagram's empty grid gaps should fall through to the
      // factbox so the whole panel can still be selected as one unit when
      // that's what the user wants.
      const compositeBlockSelector = [
        '.protected-diagram-item',
        '.protected-diagram-illustration',
        '.protected-diagram-line',
        '.protected-diagram-lines',
        '.protected-diagram-list',
        '.factbox', '.rsp-media-block', 'figure',
        '.powerup', '.callout', '.img-peek',
        '.tc-card', '.prod-card', '.mfr-card',
        '.xp-target-card',
        // Numbered "step" cards on the intro pages — level-card (01/02/03
        // LEARN/APPLY/TEST) and decision-card (1-5 on the decision flow).
        // Both render as a single visual unit; treating them as composites
        // lets the editor's move/copy/delete arrows operate on the whole
        // card while the inner number/heading/body remain individually
        // editable via editableSelector.
        '.level-card', '.decision-card',
        // Decorative SVGs (cover-page cube, Ohm's-law triangle, circuit
        // diagrams, etc.) have no editable text — but the user still
        // needs to be able to select and move/delete them as a single
        // block. SVGs nested inside .qcard quiz cards are protected by
        // the quiz card's own click handler in wireQuizEditorCards, so
        // adding `svg` here doesn't hijack quiz interactions.
        'svg'
      ].join(',');
      const selectableBlockSelector = [
        '[contenteditable="true"]',
        'img', 'video', 'iframe',
        compositeBlockSelector
      ].join(', ');
      function blockUnit(el){
        if(!el) return null;
        const page = el.closest && el.closest('.page');
        if(!page) return null;
        // 1. Prefer the nearest composite wrapper if there is one.
        const composite = el.closest(compositeBlockSelector);
        if(composite && page.contains(composite)) return composite;
        // 2. Editable elements are themselves the unit.
        if(el.matches && el.matches('[contenteditable="true"]')) return el;
        const editable = el.closest && el.closest('[contenteditable="true"]');
        if(editable && page.contains(editable)) return editable;
        // 3. Bare media as a last resort.
        if(el.matches && el.matches('img, video, iframe')) return el;
        return null;
      }

      // Siblings of a movable block — skips insert-handles (editor chrome
       // that lives in the same parent) and decorative page chrome. Works
       // regardless of whether the block sits directly under .page or
       // inside a layout wrapper, because we filter the block's own
       // parent.children, not a hard-coded scope.
      function getMovableSiblings(block){
        if(!block || !block.parentNode) return [];
        return Array.from(block.parentNode.children).filter(c => {
          if(c.matches && c.matches('.rsp-editor-insert-handle')) return false;
          if(c.matches && c.matches('.page-tag, .page-num, .xp')) return false;
          return true;
        });
      }

      function moveSelectedBlock(direction){
        const block = blockUnit(selectedBlock);
        if(!block){
          flashStatus('Click a block first');
          return;
        }
        if(block.matches('.page-tag, .page-num, .xp')){
          flashStatus("Can't move page chrome");
          return;
        }
        const sibs = getMovableSiblings(block);
        const idx = sibs.indexOf(block);
        if(idx < 0) return;
        const targetIdx = idx + direction;
        if(targetIdx < 0 || targetIdx >= sibs.length){
          flashStatus(direction < 0 ? 'Already at the top' : 'Already at the bottom');
          return;
        }
        pushUndo();
        const target = sibs[targetIdx];
        if(direction < 0){
          target.insertAdjacentElement('beforebegin', block);
        } else {
          target.insertAdjacentElement('afterend', block);
        }
        // Selection stays on the same DOM node, which has moved. Re-anchor
        // page reference in case the block crossed pages (it shouldn't,
        // since we filter the same parent, but be safe).
        selectedPage = block.closest('.page') || selectedPage;
        refreshSelection();
        markChanged();
        injectInsertHandles();
        flashStatus(direction < 0 ? 'Moved up' : 'Moved down');
      }

      // Capture the current pages so a later undo() can restore them.
      // Call BEFORE the mutation runs so the snapshot reflects pre-change
      // state (including any in-flight text edits the user has made since
      // the previous snapshot).
      function pushUndo(){
        const pages = Array.from(document.querySelectorAll('.page'));
        if(!pages.length) return;
        undoStack.push(pages.map(p => p.outerHTML));
        if(undoStack.length > UNDO_LIMIT) undoStack.shift();
      }

      function undo(){
        if(!undoStack.length){
          flashStatus('Nothing to undo');
          return;
        }
        const snapshot = undoStack.pop();
        const currentPages = Array.from(document.querySelectorAll('.page'));
        if(!currentPages.length){
          flashStatus('No pages to restore into');
          return;
        }
        const parent = currentPages[0].parentNode;
        const lastPage = currentPages[currentPages.length - 1];
        // Remember the node that sits AFTER the page block so we can
        // re-insert restored pages back into the same slot.
        const afterAnchor = lastPage.nextSibling;
        currentPages.forEach(p => p.remove());

        const frag = document.createDocumentFragment();
        snapshot.forEach(html => {
          const t = document.createElement('template');
          t.innerHTML = html.trim();
          if(t.content.firstElementChild) frag.appendChild(t.content.firstElementChild);
        });
        if(afterAnchor && afterAnchor.parentNode === parent){
          parent.insertBefore(frag, afterAnchor);
        } else {
          parent.appendChild(frag);
        }

        // Re-wire editability on every restored page so click-to-edit still works.
        document.querySelectorAll('.page').forEach(p => makeEditable(p));
        syncQuizConfigFromCards(document);
        wireQuizEditorCards(document);
        selectedBlock = null;
        selectedPage = document.querySelector('.page');
        refreshSelection();
        markChanged();
        flashStatus('Undid last change');
        injectInsertHandles();
        wireVideoFacades(document);
        wireImgPeekPopups(document);
        wireYouTubeIframes(document);
      }

      // -------- Between-block "+ Add block" affordances --------
      // Thin strip in every gap between in-flow page children. Clicking
      // opens a small floating menu that calls the same add* / paste
      // functions the toolbar uses. The "anchor" passed to the menu is
      // the block ABOVE the gap, so insertNearSelection lands the new
      // node right where the user clicked.
      function isInFlowPageChild(el){
        if(!el || !el.matches) return false;
        if(el.matches('.rsp-editor-insert-handle')) return false;
        if(el.matches('.page-tag, .page-num, .xp')) return false;
        const style = window.getComputedStyle(el);
        if(style.position === 'absolute' || style.position === 'fixed') return false;
        return true;
      }

      function injectInsertHandles(){
        // Wipe all existing handles first — re-adding from scratch is
        // simpler than reconciling, and there are never that many.
        document.querySelectorAll('.rsp-editor-insert-handle').forEach(h => h.remove());

        document.querySelectorAll('.page').forEach(page => {
          const inFlow = Array.from(page.children).filter(isInFlowPageChild);
          const pageTag = page.querySelector(':scope > .page-tag');

          if(inFlow.length === 0){
            // Empty page (only chrome). Anchor to the page-tag so the
            // first insertion lands at the start of the content area.
            const handle = makeInsertHandle(pageTag || null, page);
            if(pageTag) pageTag.insertAdjacentElement('afterend', handle);
            else page.appendChild(handle);
            return;
          }

          inFlow.forEach((child, i) => {
            // Handle ABOVE this child. Anchor = previous in-flow child,
            // or page-tag for the very first gap (so we insert at the
            // top of the content area, not at the bottom).
            const anchor = (i === 0) ? (pageTag || null) : inFlow[i - 1];
            const handle = makeInsertHandle(anchor, page);
            page.insertBefore(handle, child);
          });
          // One more handle AFTER the last in-flow child.
          const last = inFlow[inFlow.length - 1];
          const tailHandle = makeInsertHandle(last, page);
          last.insertAdjacentElement('afterend', tailHandle);
        });
      }

      function makeInsertHandle(anchorBlock, page){
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'rsp-editor-insert-handle';
        handle.setAttribute('aria-label', 'Insert a block here');
        handle.innerHTML = '<span>+ Add block</span>';
        handle.addEventListener('click', e => {
          e.stopPropagation();
          e.preventDefault();
          showInsertMenu(handle, anchorBlock, page);
        });
        return handle;
      }

      function showInsertMenu(triggerEl, anchorBlock, page){
        // Close any menu that's already open.
        document.querySelectorAll('.rsp-editor-insert-menu').forEach(m => m.remove());

        const menu = document.createElement('div');
        menu.className = 'rsp-editor-insert-menu';
        const pasteRow = blockClipboard
          ? '<button type="button" data-insert="paste">📌 Paste</button>'
          : '';
        menu.innerHTML =
          '<button type="button" data-insert="text">📝 Text</button>'+
          '<button type="button" data-insert="callout">💡 Callout</button>'+
          '<button type="button" data-insert="image">🖼 Image</button>'+
          '<button type="button" data-insert="video">▶ Video</button>'+
          '<button type="button" data-insert="seeit">📸 See It</button>'+
          '<button type="button" data-insert="seeit-video">▶ See It (video)</button>'+
          pasteRow;
        // Portal the menu to body — appending it inside the handle traps
        // it in the handle's stacking context, which sibling handles at
        // the same z-index then paint over. Body-level avoids that and
        // lets the menu's z-index actually win.
        document.body.appendChild(menu);
        const rect = triggerEl.getBoundingClientRect();
        menu.style.left = (rect.left + window.scrollX + rect.width / 2) + 'px';
        menu.style.top = (rect.bottom + window.scrollY + 6) + 'px';

        let closeOnOutside = null;
        function closeMenu(){
          menu.remove();
          if(closeOnOutside) document.removeEventListener('click', closeOnOutside, true);
          closeOnOutside = null;
        }

        menu.addEventListener('click', e => {
          const btn = e.target.closest('button[data-insert]');
          if(!btn) return;
          e.stopPropagation();
          const action = btn.dataset.insert;
          // Point the existing add*/paste plumbing at this gap.
          if(anchorBlock){
            selectedBlock = anchorBlock;
            selectedPage = anchorBlock.closest('.page') || page;
          } else {
            selectedBlock = null;
            selectedPage = page;
          }
          closeMenu();
          if(action === 'text') addParagraph();
          else if(action === 'callout') addFactbox();
          else if(action === 'image') addImage();
          else if(action === 'video') addVideo();
          else if(action === 'seeit') addSeeIt();
          else if(action === 'seeit-video') addSeeItVideo();
          else if(action === 'paste') pasteAfterSelectedBlock();
        });

        // Outside-click closes. setTimeout(0) so the same click that
        // opened the menu doesn't immediately fire this listener.
        setTimeout(() => {
          closeOnOutside = function(e){
            if(menu.contains(e.target)) return;
            closeMenu();
          };
          document.addEventListener('click', closeOnOutside, true);
        }, 0);
      }

      function refreshSelection(){
        document.querySelectorAll('.rsp-editor-selected-page').forEach(el => el.classList.remove('rsp-editor-selected-page'));
        document.querySelectorAll('.rsp-editor-selected-block').forEach(el => el.classList.remove('rsp-editor-selected-block'));
        if(selectedPage) selectedPage.classList.add('rsp-editor-selected-page');
        if(selectedBlock) selectedBlock.classList.add('rsp-editor-selected-block');
        positionBlockControls();
      }

      // Anchor the floating ↑/↓ controls to the selected block's top-right
      // corner (in page coordinates so they scroll with the page). Hides
      // when there's no meaningful block to act on. Updates the disabled
      // state on each arrow based on whether a prev/next sibling exists.
      function positionBlockControls(){
        const block = blockUnit(selectedBlock);
        if(!block || block.matches('.page-tag, .page-num, .xp')){
          blockControls.classList.remove('show');
          return;
        }
        const rect = block.getBoundingClientRect();
        // 6px right of the block, top edge aligned with the block's top.
        const left = rect.right + window.scrollX + 6;
        const top = rect.top + window.scrollY;
        blockControls.style.left = left + 'px';
        blockControls.style.top = top + 'px';
        blockControls.classList.add('show');

        // Disabled-state for arrows: no prev sibling → up disabled, etc.
        const sibs = getMovableSiblings(block);
        const idx = sibs.indexOf(block);
        const upBtn = blockControls.querySelector('button[data-move="up"]');
        const downBtn = blockControls.querySelector('button[data-move="down"]');
        if(upBtn) upBtn.disabled = (idx <= 0);
        if(downBtn) downBtn.disabled = (idx < 0 || idx >= sibs.length - 1);
      }

      // Re-position on window resize so controls follow if layout reflows.
      window.addEventListener('resize', positionBlockControls);

      function canEdit(el){
        if(!el) return false;
        if(el.closest('.rsp-module-editor,.module-editor-gate,.interactive-only,.qcard,.opts-buttons,svg,script,style')) return false;
        if(el.querySelector && el.querySelector('.img-peek,.opts-buttons,button,input,textarea,select')) return false;
        return el.closest('.page');
      }

      function makeEditable(root){
        const nodes = [];
        if(root.matches && root.matches(editableSelector)) nodes.push(root);
        root.querySelectorAll(editableSelector).forEach(el => nodes.push(el));
        nodes.forEach(el => {
          if(!canEdit(el)) return;
          el.setAttribute('contenteditable', 'true');
          el.setAttribute('spellcheck', 'true');
          el.classList.add('rsp-editor-editable');
          el.addEventListener('focus', () => {
            selectedPage = el.closest('.page') || selectedPage;
            selectedBlock = el;
            refreshSelection();
          });
          el.addEventListener('input', markChanged);
        });
      }

      function setSelectedFromEvent(e){
        const page = e.target.closest && e.target.closest('.page');
        if(page) selectedPage = page;
        // .img-peek (the See It pill) is in the selector list so clicks
        // on the small pill register as a block selection — then
        // replaceSelectedMedia can find the popup image inside via its
        // existing querySelector('img,video,iframe') fallback.
        const block = e.target.closest && e.target.closest(selectableBlockSelector);
        if(block && block.closest('.page')) selectedBlock = block;
        else if(page) selectedBlock = null;
        refreshSelection();
      }

      function insertNearSelection(html){
        if(!selectedPage) selectedPage = document.querySelector('.page');
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        const node = template.content.firstElementChild;
        if(!node || !selectedPage) return;
        pushUndo();

        const anchor = selectedBlock && selectedBlock.closest('.page') === selectedPage
          ? selectedBlock.closest('.rsp-media-block') || selectedBlock
          : null;
        if(anchor && anchor.parentNode){
          anchor.insertAdjacentElement('afterend', node);
        } else {
          const footer = selectedPage.querySelector('.xp, .page-num');
          if(footer) footer.insertAdjacentElement('beforebegin', node);
          else selectedPage.appendChild(node);
        }
        selectedBlock = node;
        makeEditable(node);
        refreshSelection();
        markChanged();
        injectInsertHandles();
        // Paste of a See It pill, or any block containing one, lands
        // here too — make sure its popup gets the hover-positioner so
        // it doesn't quietly stay clipped. Same logic for any YouTube
        // iframe in the pasted block — wire its error-detector so a
        // broken embed swaps to the clickable fallback.
        wireImgPeekPopups(node);
        wireYouTubeIframes(node);
      }

      // Build a YouTube embed URL with the params that maximise the
      // chance of playback succeeding on third-party hosts. The `origin`
      // param in particular is required by YouTube for embed-permission
      // checks; without it some videos load the player UI but silently
      // refuse to play. rel=0, modestbranding=1, playsinline=1 are
      // cosmetic / behavioural polish.
      function buildYouTubeEmbed(id){
        // Note: we use the regular youtube.com/embed host rather than
        // the youtube-nocookie.com variant. The -nocookie variant
        // refuses to play more videos in third-party iframes (it's
        // stricter about origin matching and rejects more "Error 153"
        // configuration cases). Privacy difference at our scale is
        // negligible — both are equally legitimate embed paths.
        //
        // enablejsapi=1 exposes the iframe to the YouTube IFrame
        // Player API so wireYouTubeIframes() can attach an onError
        // handler and gracefully fall back when the embed fails.
        const params = ['rel=0', 'modestbranding=1', 'playsinline=1', 'enablejsapi=1'];
        if(typeof location !== 'undefined' && location.origin && location.origin !== 'null'){
          params.push('origin=' + encodeURIComponent(location.origin));
        }
        return 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?' + params.join('&');
      }

      // Parse a raw video URL into the iframe-friendly embed URL AND the
      // canonical watch URL. The watch URL is rendered as a fallback link
      // below each embed so users still have a way to view the video if
      // the owner has disabled embedding (YouTube "Error 153" case).
      function parseVideoUrl(raw){
        try{
          const url = new URL(raw, location.href);
          if(url.hostname.includes('youtu.be')){
            const id = url.pathname.replace(/^\//, '').split('/')[0];
            if(id) return {
              embedSrc: buildYouTubeEmbed(id),
              watchUrl: 'https://www.youtube.com/watch?v=' + encodeURIComponent(id),
              videoId: id,
              kind: 'youtube'
            };
          }
          if(url.hostname.includes('youtube.com') || url.hostname.includes('youtube-nocookie.com')){
            const vId = url.searchParams.get('v');
            const shortsMatch = url.pathname.match(/^\/(?:shorts|live)\/([^\/?#]+)/);
            const embedMatch = url.pathname.match(/\/embed\/([^\/?#]+)/);
            const id = vId || (shortsMatch && shortsMatch[1]) || (embedMatch && embedMatch[1]);
            if(id) return {
              embedSrc: buildYouTubeEmbed(id),
              watchUrl: 'https://www.youtube.com/watch?v=' + encodeURIComponent(id),
              videoId: id,
              kind: 'youtube'
            };
          }
          if(url.hostname.includes('vimeo.com')){
            const isPlayerHost = url.hostname.startsWith('player.');
            const vimeoIdMatch = url.pathname.match(/\/(\d+)/);
            if(isPlayerHost && vimeoIdMatch) return {
              embedSrc: url.href,
              watchUrl: 'https://vimeo.com/' + vimeoIdMatch[1],
              kind: 'vimeo'
            };
            if(vimeoIdMatch) return {
              embedSrc: 'https://player.vimeo.com/video/' + vimeoIdMatch[1],
              watchUrl: 'https://vimeo.com/' + vimeoIdMatch[1],
              kind: 'vimeo'
            };
          }
        }catch(e){}
        // Direct media URL (.mp4, .webm, etc.) — no fallback.
        return {embedSrc: raw, watchUrl: '', kind: 'direct'};
      }

      // Back-compat shim — replaceSelectedMedia still calls this for the
      // existing iframe src assignment path.
      function normalizeVideoUrl(raw){
        return parseVideoUrl(raw).embedSrc;
      }

      function isEmbedUrl(src){
        return /youtube(?:-nocookie)?\.com\/embed\//.test(src) || /player\.vimeo\.com\/video\//.test(src);
      }

      function openEditorDialog(options){
        const fields = options.fields || [];
        dialog.innerHTML =
          '<div class="rsp-editor-dialog-backdrop" data-editor-dialog-close="true"></div>'+
          '<form class="rsp-editor-dialog-card">'+
            '<button type="button" class="rsp-editor-dialog-x" data-editor-dialog-close="true" aria-label="Close">x</button>'+
            '<div class="rsp-editor-dialog-kicker">Draft editor</div>'+
            '<h2>'+escapeHtml(options.title || 'Edit block')+'</h2>'+
            (options.intro ? '<p>'+escapeHtml(options.intro)+'</p>' : '')+
            '<div class="rsp-editor-dialog-fields">'+fields.map((field, idx) => {
              const id = 'rspEditorField' + idx;
              const control = field.type === 'textarea'
                ? '<textarea id="'+id+'" name="'+escapeHtml(field.name)+'" rows="'+(field.rows || 5)+'" placeholder="'+escapeHtml(field.placeholder || '')+'">'+escapeHtml(field.value || '')+'</textarea>'
                : '<input id="'+id+'" name="'+escapeHtml(field.name)+'" type="'+escapeHtml(field.type || 'text')+'" value="'+escapeHtml(field.value || '')+'" placeholder="'+escapeHtml(field.placeholder || '')+'">';
              return '<label for="'+id+'">'+escapeHtml(field.label || field.name)+control+'</label>';
            }).join('')+'</div>'+
            '<div class="rsp-editor-dialog-actions">'+
              '<button type="button" class="secondary" data-editor-dialog-close="true">Cancel</button>'+
              '<button type="submit">'+escapeHtml(options.submitLabel || 'Apply')+'</button>'+
            '</div>'+
          '</form>';

        function close(){
          dialog.classList.remove('show');
          dialog.innerHTML = '';
          document.removeEventListener('keydown', onKey);
        }

        function onKey(e){
          if(e.key === 'Escape') close();
        }

        dialog.querySelectorAll('[data-editor-dialog-close="true"]').forEach(btn => {
          btn.addEventListener('click', close);
        });

        const form = dialog.querySelector('form');
        form.addEventListener('submit', e => {
          e.preventDefault();
          const values = {};
          fields.forEach((field, idx) => {
            const input = form.querySelector('#rspEditorField' + idx);
            values[field.name] = input ? input.value.trim() : '';
          });
          close();
          if(typeof options.onSubmit === 'function') options.onSubmit(values);
        });

        document.addEventListener('keydown', onKey);
        dialog.classList.add('show');
        const first = dialog.querySelector('input,textarea');
        if(first) setTimeout(() => first.focus(), 20);
      }

      function wireQuizEditorCards(root){
        (root || document).querySelectorAll('.qcard[data-q]').forEach(card => {
          if(!card.dataset.quizJson){
            const existing = findQuizQuestion(card.dataset.q);
            if(existing) setQuizCardData(card, existing);
          }
          card.classList.add('rsp-editor-quiz-card');
          card.setAttribute('role', 'button');
          card.setAttribute('tabindex', '0');
          if(card.dataset.quizEditorWired === 'true') return;
          card.dataset.quizEditorWired = 'true';

          const openEditor = e => {
            if(!document.body.classList.contains('rsp-edit-mode')) return;
            e.preventDefault();
            e.stopPropagation();
            selectedPage = card.closest('.page') || selectedPage;
            selectedBlock = card;
            refreshSelection();
            openQuizQuestionDialog(card);
          };

          card.addEventListener('click', openEditor);
          card.addEventListener('keydown', e => {
            if(e.key === 'Enter' || e.key === ' '){
              openEditor(e);
            }
          });
        });
      }

      function openQuizQuestionDialog(card){
        const question = getQuizCardData(card);
        if(!question){
          flashStatus('Question data missing');
          return;
        }
        dialog.innerHTML =
          '<div class="rsp-editor-dialog-backdrop" data-editor-dialog-close="true"></div>'+
          '<form class="rsp-editor-dialog-card rsp-editor-quiz-dialog">'+
            '<button type="button" class="rsp-editor-dialog-x" data-editor-dialog-close="true" aria-label="Close">x</button>'+
            '<div class="rsp-editor-dialog-kicker">Draft editor</div>'+
            '<h2>Edit Question '+escapeHtml(question.n)+'</h2>'+
            '<p>Update the prompt, rewrite any answer, then choose the correct answer with the checkmark on the right.</p>'+
            '<div class="rsp-editor-dialog-fields">'+
              '<label for="rspQuizPrompt">Question'+
                '<textarea id="rspQuizPrompt" name="prompt" rows="4">'+escapeHtml(question.q)+'</textarea>'+
              '</label>'+
            '</div>'+
            '<div class="rsp-editor-quiz-answer-list">'+
              QUIZ_LETTERS.map(letter => {
                return '<div class="rsp-editor-quiz-answer-row">'+
                  '<div class="rsp-editor-quiz-letter">'+letter+'</div>'+
                  '<input type="text" name="opt-'+letter+'" value="'+escapeHtml(question.opts[letter] || '')+'" placeholder="Answer '+letter+'">'+
                  '<label class="rsp-editor-quiz-correct">'+
                    '<input type="radio" name="correctAnswer" value="'+letter+'"'+(question.c === letter ? ' checked' : '')+'>'+
                    '<span>✓ Correct</span>'+
                  '</label>'+
                '</div>';
              }).join('')+
            '</div>'+
            '<div class="rsp-editor-dialog-error" id="rspQuizDialogErr"></div>'+
            '<div class="rsp-editor-dialog-actions">'+
              '<button type="button" class="secondary" data-editor-dialog-close="true">Cancel</button>'+
              '<button type="submit">Save question</button>'+
            '</div>'+
          '</form>';

        function close(){
          dialog.classList.remove('show');
          dialog.innerHTML = '';
          document.removeEventListener('keydown', onKey);
        }

        function onKey(e){
          if(e.key === 'Escape') close();
        }

        dialog.querySelectorAll('[data-editor-dialog-close="true"]').forEach(btn => {
          btn.addEventListener('click', close);
        });

        const form = dialog.querySelector('form');
        form.addEventListener('submit', e => {
          e.preventDefault();
          const next = normalizeQuizQuestion({
            n: question.n,
            q: form.querySelector('#rspQuizPrompt').value.trim(),
            opts: {},
            c: ((form.querySelector('input[name="correctAnswer"]:checked') || {}).value || 'A')
          }, question.n);
          QUIZ_LETTERS.forEach(letter => {
            const input = form.querySelector('input[name="opt-'+letter+'"]');
            next.opts[letter] = input ? input.value.trim() : '';
          });

          const err = form.querySelector('#rspQuizDialogErr');
          if(!next.q || QUIZ_LETTERS.some(letter => !next.opts[letter])){
            if(err) err.textContent = 'Fill in the question prompt and all four answers before saving.';
            return;
          }

          pushUndo();
          cfg.quiz = cfg.quiz.map(q => String(q.n) === String(next.n) ? next : q);
          renderCard(card, next);
          wireQuizEditorCards(card);
          selectedPage = card.closest('.page') || selectedPage;
          selectedBlock = card;
          refreshSelection();
          markChanged();
          flashStatus('Question updated');
          close();
        });

        document.addEventListener('keydown', onKey);
        dialog.classList.add('show');
        const first = dialog.querySelector('#rspQuizPrompt');
        if(first) setTimeout(() => first.focus(), 20);
      }

      function addParagraph(){
        insertNearSelection('<p class="lead rsp-editor-new" style="margin-top:14px">New paragraph text.</p>');
      }

      function addFactbox(){
        insertNearSelection('<div class="factbox rsp-editor-new" style="margin-top:14px"><h3>New callout</h3><p style="margin-top:6px">Add supporting detail here.</p></div>');
      }

      // -------- "+ Page" — insert a new blank page after the selected one --------
      // Adds a fresh <section class="page"> sibling after selectedPage (or at the
      // end of the page list when no page is selected). The placeholder content
      // mirrors what real module pages look like: a page-tag kicker, an h2, a
      // .lead paragraph, and a .page-num footer. The new page becomes the
      // selectedPage, gets its editable nodes wired up, scrolls into view, and
      // flags the draft as changed.
      function addPage(){
        const allPages = Array.from(document.querySelectorAll('.page'));
        if(!allPages.length) return;
        const anchor = (selectedPage && selectedPage.parentNode) ? selectedPage : allPages[allPages.length - 1];
        const parent = anchor.parentNode;
        if(!parent) return;

        pushUndo();
        const template = document.createElement('template');
        template.innerHTML =
          '<section class="page rsp-editor-new">'+
            '<div class="page-tag">▸ NEW PAGE</div>'+
            '<h2 style="margin-top:.5in">New page heading.</h2>'+
            '<p class="lead" style="margin-top:14px">Add content here.</p>'+
            '<div class="page-num">--</div>'+
          '</section>';
        const newPage = template.content.firstElementChild;
        if(!newPage) return;

        anchor.insertAdjacentElement('afterend', newPage);
        selectedPage = newPage;
        selectedBlock = null;
        makeEditable(newPage);
        refreshSelection();
        markChanged();
        injectInsertHandles();
        // Defer the scroll a tick so the layout has settled.
        setTimeout(() => {
          try{ newPage.scrollIntoView({behavior: 'smooth', block: 'start'}); }catch(e){ newPage.scrollIntoView(); }
        }, 0);
      }

      function insertImageBlock(imageSrc, imageAlt){
        insertNearSelection(
          '<figure class="rsp-media-block rsp-editor-new">'+
            '<img src="'+escapeHtml(imageSrc)+'" alt="'+escapeHtml(imageAlt)+'">'+
            '<figcaption contenteditable="true" spellcheck="true">Image caption</figcaption>'+
          '</figure>'
        );
      }

      function addImage(src, alt){
        if(src){
          insertImageBlock(src, alt || 'Training image');
          return;
        }
        openEditorDialog({
          title: 'Add image',
          intro: 'Paste an image URL or a relative path like ../images/enclosures/photo.png.',
          submitLabel: 'Add image',
          fields: [
            {name:'src', label:'Image URL or path', placeholder:'../images/enclosures/photo.png'},
            {name:'alt', label:'Alt text', placeholder:'Training image'}
          ],
          onSubmit: values => {
            if(!values.src) return;
            insertImageBlock(values.src, values.alt || 'Training image');
          }
        });
      }

      function insertVideoBlock(raw){
        const parsed = parseVideoUrl(raw);
        // Fallback link — for videos whose owner has disabled embedding,
        // or when stricter networks block iframe playback, this gives the
        // viewer a direct path to the canonical video. Always rendered.
        const fallbackLink = (parsed.kind === 'youtube' || parsed.kind === 'vimeo') && parsed.watchUrl
          ? '<a class="rsp-video-fallback" href="'+escapeHtml(parsed.watchUrl)+'" target="_blank" rel="noopener noreferrer">Watch on '+(parsed.kind === 'youtube' ? 'YouTube' : 'Vimeo')+' ↗</a>'
          : '';

        let html;
        if(parsed.kind === 'youtube' && parsed.videoId){
          // YouTube facade — render a thumbnail + play overlay instead of
          // auto-loading the iframe. Clicking swaps the iframe in (wired
          // by wireVideoFacades). This sidesteps the auto-fail "Error
          // 153" cascade for embed-disabled videos: viewers see a clean
          // thumbnail by default, and have an obvious "Watch on YouTube"
          // path if the iframe ends up erroring after click.
          const thumb = 'https://img.youtube.com/vi/'+encodeURIComponent(parsed.videoId)+'/hqdefault.jpg';
          html =
            '<div class="rsp-media-block rsp-video-block rsp-editor-new">'+
              '<button type="button" class="rsp-video-facade" '+
                'data-embed-src="'+escapeHtml(parsed.embedSrc)+'" '+
                'aria-label="Play video">'+
                '<img src="'+escapeHtml(thumb)+'" alt="Video thumbnail" loading="lazy">'+
                '<span class="rsp-video-play" aria-hidden="true">▶</span>'+
              '</button>'+
              fallbackLink+
              '<p contenteditable="true" spellcheck="true">Video caption</p>'+
            '</div>';
        } else if(isEmbedUrl(parsed.embedSrc)){
          // Vimeo / generic embed — keep auto-loading iframe. Vimeo has
          // far fewer embed restrictions in practice than YouTube.
          const allowTokens = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
          html =
            '<div class="rsp-media-block rsp-video-block rsp-editor-new">'+
              '<iframe src="'+escapeHtml(parsed.embedSrc)+'" title="Training video" frameborder="0" '+
                'allow="'+allowTokens+'" referrerpolicy="origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>'+
              fallbackLink+
              '<p contenteditable="true" spellcheck="true">Video caption</p>'+
            '</div>';
        } else {
          // Direct media file (.mp4, .webm, etc.)
          html =
            '<div class="rsp-media-block rsp-video-block rsp-editor-new">'+
              '<video controls playsinline src="'+escapeHtml(parsed.embedSrc)+'"></video>'+
              '<p contenteditable="true" spellcheck="true">Video caption</p>'+
            '</div>';
        }
        insertNearSelection(html);
        // Wire any newly-inserted facade so its click handler is live.
        wireVideoFacades(document);
        wireYouTubeIframes(document);
      }

      function addVideo(src){
        if(src){
          insertVideoBlock(src);
          return;
        }
        openEditorDialog({
          title: 'Add video',
          intro: 'Paste a YouTube/Vimeo link or a relative video path. If a YouTube embed shows the red "Watch on YouTube" fallback tile after saving, the video owner has disabled embedding — pick a different video, or self-host the clip in portal/videos/<module>/ and reference it as ../videos/<module>/<file>.mp4.',
          submitLabel: 'Add video',
          fields: [
            {name:'src', label:'Video URL or path', placeholder:'https://www.youtube.com/watch?v=...  ·  ../videos/enclosures/demo.mp4'}
          ],
          onSubmit: values => {
            if(!values.src) return;
            insertVideoBlock(values.src);
          }
        });
      }

      // -------- "+ See it" hover-popup photo button --------
      // Inserts the existing .img-peek pattern (yellow pill button +
      // hover-to-reveal image) inline at the end of the currently
      // selected text block. Falls back to the first editable element
      // on the selected page if no text block is in focus.
      // Accepts an array of image srcs (1-6) which render as a grid in
      // the popup. data-count on the popup drives the column layout.
      function buildImgPeekHtml(srcs, label, alt){
        const safeLabel = escapeHtml(label || '📸 SEE IT');
        const safeAlt = escapeHtml(alt || 'Product photo');
        const clean = (Array.isArray(srcs) ? srcs : [srcs]).filter(Boolean).slice(0, 6);
        const imgsHtml = clean.map(s => '<img src="'+escapeHtml(s)+'" alt="'+safeAlt+'">').join('');
        return '<span class="img-peek rsp-editor-new">'+
          '<button type="button" class="img-peek-btn" aria-label="View images">'+safeLabel+'</button>'+
          '<span class="img-peek-popup" data-count="'+clean.length+'">'+imgsHtml+'</span>'+
        '</span>';
      }

      function insertImgPeek(srcs, label, alt){
        // Prefer the actively selected contenteditable block.
        let target = selectedBlock && selectedBlock.getAttribute && selectedBlock.getAttribute('contenteditable') === 'true'
          ? selectedBlock
          : null;
        // Fall back to the first editable text node on the selected page.
        if(!target && selectedPage){
          target = selectedPage.querySelector('[contenteditable="true"]');
        }
        if(!target){
          alert('Click on a heading or paragraph first, then add a See It.');
          return;
        }
        pushUndo();
        // Append at the end with a leading space so the button doesn't
        // butt up against the preceding word.
        target.insertAdjacentHTML('beforeend', ' ' + buildImgPeekHtml(srcs, label, alt));
        selectedBlock = target;
        refreshSelection();
        markChanged();
        wireImgPeekPopups(target);
      }

      function addSeeIt(){
        openEditorDialog({
          title: 'Add "See it" photo button',
          intro: 'Inserts a yellow pill button into the selected text block. Hover the button to reveal up to 6 images in a grid popup. Click a heading or paragraph first to pick where it goes.',
          submitLabel: 'Add See It',
          fields: [
            {name:'srcs', label:'Image URLs (one per line, up to 6)', type:'textarea', rows:6, placeholder:'../images/enclosures/mfr-hoffman.png\n../images/enclosures/another.png'},
            {name:'label', label:'Button label', placeholder:'📸 SEE IT', value:'📸 SEE IT'},
            {name:'alt', label:'Alt text (shared by every image)', placeholder:'Hoffman enclosure photo'}
          ],
          onSubmit: values => {
            const srcs = (values.srcs || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 6);
            if(!srcs.length) return;
            insertImgPeek(srcs, values.label || '📸 SEE IT', values.alt || 'Product photo');
          }
        });
      }

      // -------- "+ See it (video)" hover-popup video button --------
      // Same pattern as the image See It — reuses the .img-peek pill +
      // popup chrome so styling and layout stay consistent — but the
      // popup contains <iframe> (YouTube/Vimeo) or <video> (direct media)
      // elements instead of <img>. Adds a `.video-peek` modifier class on
      // both the pill and the popup so the CSS can size the players
      // (iframes don't have intrinsic dimensions so we force a 16/9
      // aspect-ratio per cell).
      function buildVideoPeekHtml(rawSrcs, label){
        const safeLabel = escapeHtml(label || '▶ SEE IT');
        const clean = (Array.isArray(rawSrcs) ? rawSrcs : [rawSrcs]).filter(Boolean).slice(0, 6);
        const itemsHtml = clean.map(raw => {
          const parsed = parseVideoUrl(raw);
          // YouTube → use facade-style embed URL. We don't lazy-load
          // (no facade button) inside the popup because the popup
          // itself is hover-revealed, which already acts as a load gate.
          if(parsed.kind === 'youtube' && parsed.videoId){
            return '<iframe class="video-peek-frame" src="'+escapeHtml(parsed.embedSrc)+'" '+
              'title="Training video" frameborder="0" '+
              'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" '+
              'referrerpolicy="origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>';
          }
          if(isEmbedUrl(parsed.embedSrc)){
            return '<iframe class="video-peek-frame" src="'+escapeHtml(parsed.embedSrc)+'" '+
              'title="Training video" frameborder="0" '+
              'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" '+
              'referrerpolicy="origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>';
          }
          // Direct media file (.mp4, .webm, ...) — give it controls so
          // the viewer can play/pause inside the popup.
          return '<video class="video-peek-frame" controls playsinline preload="metadata" src="'+escapeHtml(parsed.embedSrc)+'"></video>';
        }).join('');
        return '<span class="img-peek video-peek rsp-editor-new">'+
          '<button type="button" class="img-peek-btn" aria-label="View videos">'+safeLabel+'</button>'+
          '<span class="img-peek-popup video-peek-popup" data-count="'+clean.length+'">'+itemsHtml+'</span>'+
        '</span>';
      }

      function insertVideoPeek(srcs, label){
        let target = selectedBlock && selectedBlock.getAttribute && selectedBlock.getAttribute('contenteditable') === 'true'
          ? selectedBlock
          : null;
        if(!target && selectedPage){
          target = selectedPage.querySelector('[contenteditable="true"]');
        }
        if(!target){
          alert('Click on a heading or paragraph first, then add a See It (video).');
          return;
        }
        pushUndo();
        target.insertAdjacentHTML('beforeend', ' ' + buildVideoPeekHtml(srcs, label));
        selectedBlock = target;
        refreshSelection();
        markChanged();
        wireImgPeekPopups(target);
        wireYouTubeIframes(target);
      }

      function addSeeItVideo(){
        openEditorDialog({
          title: 'Add "See it" video button',
          intro: 'Inserts a yellow pill button into the selected text block. Hover the button to reveal up to 6 videos in a grid popup. Click a heading or paragraph first to pick where it goes. Embedding tip: some YouTube videos refuse to play inside iframes (owner setting). Those will swap to a clickable "Watch on YouTube" tile; for guaranteed inline playback, self-host the clip in portal/videos/<module>/ and reference it as ../videos/<module>/<file>.mp4.',
          submitLabel: 'Add See It (video)',
          fields: [
            {name:'srcs', label:'Video URLs (one per line, up to 6)', type:'textarea', rows:6, placeholder:'https://www.youtube.com/watch?v=...\n../videos/enclosures/demo.mp4'},
            {name:'label', label:'Button label', placeholder:'▶ SEE IT', value:'▶ SEE IT'}
          ],
          onSubmit: values => {
            const srcs = (values.srcs || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 6);
            if(!srcs.length) return;
            insertVideoPeek(srcs, values.label || '▶ SEE IT');
          }
        });
      }

      // -------- Block delete / copy / paste --------
      // The unit of action is whatever blockUnit() returns for the current
      // selection — the smallest meaningful block (composite wrapper if any,
      // otherwise the contenteditable element itself). Decorative chrome
      // (.page-tag, .page-num, .xp) is refused.
      function deleteSelectedBlock(){
        const block = blockUnit(selectedBlock);
        if(!block){
          // Page-only selection: user clicked empty page background (or
          // otherwise cleared selectedBlock) and wants to remove the whole
          // page, not just one block. Keep at least one page in the draft
          // so the module doesn't end up with no renderable content at all.
          if(selectedPage){
            const pages = Array.from(document.querySelectorAll('.page'));
            if(pages.length <= 1){
              flashStatus("Can't delete the last page");
              return;
            }
            if(!confirm('Are you sure you want to delete EVERYTHING on this page?')) return;
            pushUndo();
            const pageToRemove = selectedPage;
            const nextPage = pageToRemove.nextElementSibling && pageToRemove.nextElementSibling.matches('.page')
              ? pageToRemove.nextElementSibling
              : null;
            const prevPage = pageToRemove.previousElementSibling && pageToRemove.previousElementSibling.matches('.page')
              ? pageToRemove.previousElementSibling
              : null;
            pageToRemove.remove();
            selectedBlock = null;
            selectedPage = nextPage || prevPage || document.querySelector('.page');
            refreshSelection();
            markChanged();
            flashStatus('Page deleted');
            injectInsertHandles();
            return;
          }
          flashStatus('Click a block first');
          return;
        }
        if(block.matches('.page-tag, .page-num, .xp')){
          flashStatus("Can't delete page chrome");
          return;
        }
        pushUndo();
        block.remove();
        selectedBlock = null;
        refreshSelection();
        markChanged();
        flashStatus('Block deleted');
        injectInsertHandles();
      }

      function copySelectedBlock(){
        const block = blockUnit(selectedBlock);
        if(!block){
          flashStatus('Click a block first');
          return;
        }
        blockClipboard = block.outerHTML;
        flashStatus('Block copied');
      }

      function pasteAfterSelectedBlock(){
        if(!blockClipboard){
          flashStatus('Clipboard empty — copy a block first');
          return;
        }
        // Sanitize: strip selection-highlight classes that may have been
        // attached when the block was copied. Add rsp-editor-new so the
        // pasted block gets the "newly added" visual treatment.
        const tmp = document.createElement('template');
        tmp.innerHTML = blockClipboard.trim();
        const node = tmp.content.firstElementChild;
        if(!node){
          flashStatus('Clipboard contents look broken');
          return;
        }
        node.classList.remove('rsp-editor-selected-block', 'rsp-editor-selected-page');
        node.querySelectorAll('.rsp-editor-selected-block, .rsp-editor-selected-page').forEach(el => {
          el.classList.remove('rsp-editor-selected-block', 'rsp-editor-selected-page');
        });
        node.classList.add('rsp-editor-new');
        insertNearSelection(node.outerHTML);
        flashStatus('Block pasted');
      }

      function replaceSelectedMedia(){
        // See It special case — pill holds 1-6 images/videos in a grid,
        // so we show a multi-URL textarea dialog instead of the single-
        // src dialog used for plain images/videos. The video variant is
        // distinguished by the .video-peek modifier class.
        const seeIt = selectedBlock && (
          (selectedBlock.matches && selectedBlock.matches('.img-peek') ? selectedBlock : null) ||
          (selectedBlock.closest && selectedBlock.closest('.img-peek'))
        );
        if(seeIt){
          if(seeIt.classList.contains('video-peek')) replaceSeeItVideos(seeIt);
          else replaceSeeItImages(seeIt);
          return;
        }

        const media = selectedBlock && (selectedBlock.matches('img,video,iframe') ? selectedBlock : selectedBlock.querySelector && selectedBlock.querySelector('img,video,iframe'));
        if(!media){
          alert('Select an image or video first.');
          return;
        }
        openEditorDialog({
          title: 'Replace media',
          intro: 'Paste the new image/video URL or relative path.',
          submitLabel: 'Replace media',
          fields: [
            {name:'src', label:'New media URL or path', value: media.getAttribute('src') || ''}
          ],
          onSubmit: values => {
            if(!values.src) return;
            pushUndo();
            media.setAttribute('src', media.tagName.toLowerCase() === 'iframe' ? normalizeVideoUrl(values.src) : values.src);
            markChanged();
          }
        });
      }

      // Edit the videos shown inside a video See It pill's popup. Mirror
      // of replaceSeeItImages — pulls the current iframe/video srcs out
      // of the popup, opens the textarea dialog, then rebuilds the popup
      // markup via buildVideoPeekHtml so the same player chrome
      // (iframe vs <video> per URL kind) gets applied.
      function replaceSeeItVideos(seeIt){
        const popup = seeIt.querySelector('.img-peek-popup');
        if(!popup) return;
        const existing = Array.from(popup.querySelectorAll('iframe, video'));
        const currentSrcs = existing.map(el => el.getAttribute('src') || '').filter(Boolean);
        const labelBtn = seeIt.querySelector('.img-peek-btn');
        const currentLabel = labelBtn ? labelBtn.textContent.trim() : '▶ SEE IT';
        openEditorDialog({
          title: 'Edit See It videos',
          intro: 'One video URL per line, up to 6. YouTube/Vimeo links and direct .mp4 paths both work.',
          submitLabel: 'Save videos',
          fields: [
            {name:'srcs', label:'Video URLs (one per line, up to 6)', type:'textarea', rows:6, value: currentSrcs.join('\n')},
            {name:'label', label:'Button label', value: currentLabel}
          ],
          onSubmit: values => {
            const srcs = (values.srcs || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 6);
            if(!srcs.length) return;
            pushUndo();
            // Rebuild via the shared HTML helper so iframe/video markup
            // matches what the insert path produces — then transplant
            // the rebuilt children into the existing pill so we don't
            // lose the user's surrounding text-node position.
            const tmp = document.createElement('template');
            tmp.innerHTML = buildVideoPeekHtml(srcs, values.label || '▶ SEE IT').trim();
            const fresh = tmp.content.firstElementChild;
            if(!fresh) return;
            const freshPopup = fresh.querySelector('.img-peek-popup');
            const freshBtn = fresh.querySelector('.img-peek-btn');
            if(freshPopup){
              popup.innerHTML = freshPopup.innerHTML;
              popup.setAttribute('data-count', freshPopup.getAttribute('data-count') || String(srcs.length));
            }
            if(freshBtn && labelBtn) labelBtn.textContent = freshBtn.textContent;
            markChanged();
            flashStatus('See It videos updated');
          }
        });
      }

      // Edit the images shown inside a See It pill's popup. Pre-fills
      // the textarea with the current image URLs (one per line) and a
      // shared alt; submit rebuilds popup.innerHTML and updates the
      // data-count attribute so the grid layout follows.
      function replaceSeeItImages(seeIt){
        const popup = seeIt.querySelector('.img-peek-popup');
        if(!popup) return;
        const existingImgs = Array.from(popup.querySelectorAll('img'));
        const currentSrcs = existingImgs.map(img => img.getAttribute('src') || '').filter(Boolean);
        const currentAlt = existingImgs[0] ? (existingImgs[0].getAttribute('alt') || '') : '';
        openEditorDialog({
          title: 'Edit See It images',
          intro: 'One image URL per line, up to 6. The popup arranges them in a grid (1 / 2 / 3 columns depending on count).',
          submitLabel: 'Save images',
          fields: [
            {name:'srcs', label:'Image URLs (one per line, up to 6)', type:'textarea', rows:6, value: currentSrcs.join('\n')},
            {name:'alt', label:'Alt text (shared by every image)', value: currentAlt}
          ],
          onSubmit: values => {
            const srcs = (values.srcs || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 6);
            if(!srcs.length) return;
            pushUndo();
            const safeAlt = escapeHtml(values.alt || 'Product photo');
            const imgsHtml = srcs.map(src => '<img src="'+escapeHtml(src)+'" alt="'+safeAlt+'">').join('');
            popup.innerHTML = imgsHtml;
            popup.setAttribute('data-count', String(srcs.length));
            markChanged();
            flashStatus('See It images updated');
          }
        });
      }

      function patchQuizConfigInClone(clone){
        const quizJson = JSON.stringify(collectEditedQuizQuestions(clone), null, 2).replace(/\n/g, '\n  ');
        const patterns = [
          /(^\s*quiz:\s*)\[[\s\S]*?\](\s*,\s*\n\s*\/\/ -------- MINI-BOSSES --------)/m,
          /(^\s*quiz:\s*)\[[\s\S]*?\](\s*,\s*\n\s*(?:minibosses:|mapSections:))/m
        ];
        let patched = false;

        clone.querySelectorAll('script:not([src])').forEach(script => {
          if(patched) return;
          const text = script.textContent || '';
          if(text.indexOf('RSPModule.init(') === -1 || text.indexOf('quiz:') === -1) return;
          for(let i = 0; i < patterns.length && !patched; i++){
            const next = text.replace(patterns[i], function(match, prefix, suffix){
              patched = true;
              return prefix + quizJson + suffix;
            });
            if(patched){
              script.textContent = next;
            }
          }
        });

        return patched;
      }

      function cleanDraftClone(){
        const clone = document.documentElement.cloneNode(true);
        patchQuizConfigInClone(clone);
        clone.querySelectorAll('.rsp-module-editor,.module-editor-gate,.rsp-editor-insert-handle,.rsp-editor-insert-menu,.rsp-editor-block-controls').forEach(el => el.remove());
        clone.querySelectorAll('[contenteditable]').forEach(el => {
          el.removeAttribute('contenteditable');
          el.removeAttribute('spellcheck');
        });
        clone.querySelectorAll('.qcard[data-q]').forEach(card => {
          card.innerHTML = '';
          card.classList.remove('rsp-editor-quiz-card');
          card.removeAttribute('role');
          card.removeAttribute('tabindex');
          card.removeAttribute('data-quiz-editor-wired');
          card.removeAttribute('data-quiz-json');
        });
        clone.querySelectorAll('.rsp-editor-editable,.rsp-editor-selected-page,.rsp-editor-selected-block,.rsp-editor-new').forEach(el => {
          el.classList.remove('rsp-editor-editable','rsp-editor-selected-page','rsp-editor-selected-block','rsp-editor-new');
        });
        if(clone.querySelector('body')){
          clone.querySelector('body').classList.remove('rsp-edit-mode','rsp-editor-has-changes','has-sidemap','collapsed-map');
        }
        return '<!DOCTYPE html>\n' + clone.outerHTML;
      }

      function downloadDraft(){
        const html = cleanDraftClone();
        const blob = new Blob([html], {type:'text/html'});
        const a = document.createElement('a');
        const stamp = new Date().toISOString().slice(0,10);
        a.href = URL.createObjectURL(blob);
        a.download = cfg.moduleId + '-draft-' + stamp + '.html';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 0);
      }

      function copyDraft(){
        const html = cleanDraftClone();
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(html).then(() => alert('Draft HTML copied.'));
        } else {
          const ta = document.createElement('textarea');
          ta.value = html;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          alert('Draft HTML copied.');
        }
      }

      toolbar.addEventListener('click', e => {
        const btn = e.target.closest('button[data-editor-action]');
        if(!btn) return;
        const action = btn.dataset.editorAction;
        if(action === 'undo') undo();
        if(action === 'add-page') addPage();
        if(action === 'paragraph') addParagraph();
        if(action === 'factbox') addFactbox();
        if(action === 'image') addImage();
        if(action === 'video') addVideo();
        if(action === 'seeit') addSeeIt();
        if(action === 'seeit-video') addSeeItVideo();
        if(action === 'copy-block') copySelectedBlock();
        if(action === 'paste-block') pasteAfterSelectedBlock();
        if(action === 'delete-block') deleteSelectedBlock();
        if(action === 'replace-media') replaceSelectedMedia();
        if(action === 'download') downloadDraft();
        if(action === 'copy') copyDraft();
      });

      document.addEventListener('click', setSelectedFromEvent, true);
      document.addEventListener('dragover', e => {
        if(!document.body.classList.contains('rsp-edit-mode')) return;
        e.preventDefault();
        dropHint.classList.add('show');
      });
      document.addEventListener('dragleave', e => {
        if(e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight){
          dropHint.classList.remove('show');
        }
      });
      document.addEventListener('drop', e => {
        if(!document.body.classList.contains('rsp-edit-mode')) return;
        e.preventDefault();
        dropHint.classList.remove('show');
        const page = e.target.closest && e.target.closest('.page');
        if(page) selectedPage = page;
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          if(file.type.indexOf('image/') === 0){
            const img = e.target.closest && e.target.closest('img');
            if(img){
              pushUndo();
              img.src = reader.result;
              markChanged();
            } else {
              addImage(reader.result, file.name);
            }
          } else if(file.type.indexOf('video/') === 0){
            addVideo(reader.result);
          } else {
            alert('Drop an image or video file.');
          }
        };
        reader.readAsDataURL(file);
      });

      makeEditable(document);
      syncQuizConfigFromCards(document);
      wireQuizEditorCards(document);
      refreshSelection();
      injectInsertHandles();
      window.addEventListener('beforeunload', e => {
        if(!changed) return;
        e.preventDefault();
        e.returnValue = '';
      });
    }

    function openAdminLogin(){
      const ov = document.getElementById('adminOverlay');
      if(!ov) return;
      ov.classList.add('show');
      ov.innerHTML = '<div class="admin-loginbox">'+
        '<h2>🔒 ADMIN ACCESS</h2>'+
        '<p style="color:#94A3B8;font-size:13px;margin-top:8px">Enter the admin password to view all learner results.</p>'+
        '<input type="password" id="adminPwd" placeholder="Admin password" autofocus>'+
        '<div id="adminErr" style="color:#EF4444;font-size:12px;margin-top:6px;min-height:14px;font-weight:700"></div>'+
        '<button id="adminGo">UNLOCK →</button>'+
        '<p style="color:#64748B;font-size:11px;margin-top:18px">Or <a href="?" style="color:#FACC15">return to learner view</a></p>'+
      '</div>';
      document.getElementById('adminGo').addEventListener('click', tryAdminLogin);
      document.getElementById('adminPwd').addEventListener('keydown', e => { if(e.key === 'Enter') tryAdminLogin(); });
    }

    function tryAdminLogin(){
      const pwd = document.getElementById('adminPwd').value;
      if(cfg.adminPassword && pwd === cfg.adminPassword){
        ssSet(KEY_ADMIN_SESSION, 'true');
        renderAdminDashboard();
      } else {
        document.getElementById('adminErr').textContent = 'Wrong password.';
      }
    }

    function renderAdminDashboard(){
      const rawLedger = JSON.parse(lsGet(KEY_LEDGER) || '{}');
      const learners = Object.values(rawLedger).map(l => {
        const m = (l.modules && l.modules[cfg.moduleId]) || {};
        return {
          name: l.name, id: l.id, startedAt: l.startedAt,
          answered: m.answered || {},
          correct:  m.correct  || 0,
          viewedPages: m.viewedPages || [],
          bossesDefeated: m.bossesDefeated || {}
        };
      }).filter(l => Object.keys(l.answered).length > 0 || l.viewedPages.length > 0);

      const totalLearners = learners.length;
      const completed = learners.filter(l => Object.keys(l.answered || {}).length === cfg.totalQuestions).length;
      const avgScore  = totalLearners > 0
        ? (learners.reduce((sum, l) => sum + (l.correct || 0), 0) / totalLearners).toFixed(1)
        : '0';
      const passed = learners.filter(l => (l.correct || 0) >= cfg.passGold).length;

      const rows = learners.length === 0
        ? '<tr><td colspan="6" style="text-align:center;color:#64748B;padding:40px">No learners yet. Reps will appear here once they sign in.</td></tr>'
        : learners.sort((a,b) => (b.correct||0) - (a.correct||0)).map(l => {
            const ansCount = Object.keys(l.answered||{}).length;
            const score    = l.correct || 0;
            const tier = ansCount < cfg.totalQuestions ? '⏳ In Progress'
                       : (score >= cfg.passGold   ? '🥇 Mastery'
                       :  score >= cfg.passSilver ? '🥈 Solid'
                       :  '🥉 Re-do');
            const dt = l.startedAt ? new Date(l.startedAt).toLocaleDateString() : '—';
            const bossesDefeated = Object.keys(l.bossesDefeated || {}).length;
            return '<tr>'+
              '<td><b>'+escapeHtml(l.name||'?')+'</b><br><span style="color:#64748B;font-size:11px">'+escapeHtml(l.id||'')+'</span></td>'+
              '<td>'+dt+'</td>'+
              '<td>'+ansCount+' / '+cfg.totalQuestions+'</td>'+
              '<td><b>'+score+'</b> / '+cfg.totalQuestions+'</td>'+
              '<td>'+bossesDefeated+' / '+cfg.minibossCount+'</td>'+
              '<td>'+tier+'</td>'+
            '</tr>';
          }).join('');

      const ov = document.getElementById('adminOverlay');
      ov.innerHTML = '<button class="admin-btn exit" id="adminExit">← Exit Admin</button>'+
        '<div class="pretitle">RSP INDUSTRIAL · ADMIN DASHBOARD</div>'+
        '<h1>'+cfg.moduleIcon+' '+escapeHtml(cfg.moduleName)+' — Trainer View</h1>'+
        '<p style="color:#94A3B8;margin-top:6px">Learner data on this device only. Wipe with the buttons below.</p>'+
        '<div class="admin-grid">'+
          '<div class="admin-card"><h3>TOTAL LEARNERS</h3><div class="stat-num">'+totalLearners+'</div></div>'+
          '<div class="admin-card"><h3>COMPLETED</h3><div class="stat-num">'+completed+'</div></div>'+
          '<div class="admin-card"><h3>PASSED ('+cfg.passGold+'+)</h3><div class="stat-num">'+passed+'</div></div>'+
          '<div class="admin-card"><h3>AVG SCORE</h3><div class="stat-num">'+avgScore+'</div></div>'+
        '</div>'+
        '<div class="admin-card" style="margin-top:18px">'+
          '<h3>📋 LEARNER LEDGER</h3>'+
          '<table class="admin-table"><thead><tr><th>NAME / ID</th><th>STARTED</th><th>ANSWERED</th><th>SCORE</th><th>MINI-BOSSES</th><th>TIER</th></tr></thead>'+
          '<tbody>'+rows+'</tbody></table>'+
          '<div class="admin-actions">'+
            '<button class="admin-btn" id="adminExport">⬇ EXPORT CSV</button>'+
            '<button class="admin-btn" id="adminCopy">📋 COPY JSON</button>'+
            '<button class="admin-btn danger" id="adminWipe">🗑 WIPE ALL DATA</button>'+
          '</div>'+
        '</div>';

      document.getElementById('adminExit').addEventListener('click', () => { location.href = location.pathname; });
      document.getElementById('adminWipe').addEventListener('click', () => {
        if(confirm('Wipe ALL learner data on this device? This cannot be undone.')){
          lsDel(KEY_LEDGER);
          if(cfg.storageKey) lsDel(cfg.storageKey);
          lsDel(KEY_USER);
          renderAdminDashboard();
        }
      });
      document.getElementById('adminExport').addEventListener('click', () => {
        const headers = ['Name','Employee ID','Started','Answered','Correct','Mini-Bosses Defeated','Tier'];
        const csvRows = learners.map(l => {
          const ansCount = Object.keys(l.answered||{}).length;
          const score    = l.correct || 0;
          const tier = ansCount < cfg.totalQuestions ? 'In Progress'
                     : (score >= cfg.passGold ? 'Mastery'
                     :  score >= cfg.passSilver ? 'Solid'
                     :  'Re-do');
          const dt = l.startedAt ? new Date(l.startedAt).toISOString() : '';
          return [l.name||'', l.id||'', dt, ansCount, score, Object.keys(l.bossesDefeated||{}).length, tier];
        });
        const csv = [headers, ...csvRows].map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
        const blob = new Blob([csv], {type:'text/csv'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rsp_' + cfg.moduleId.replace(/-/g,'_') + '_learners_' + new Date().toISOString().slice(0,10) + '.csv';
        a.click();
      });
      document.getElementById('adminCopy').addEventListener('click', () => {
        const txt = JSON.stringify(learners, null, 2);
        navigator.clipboard.writeText(txt).then(() => alert('Learner data copied to clipboard.'));
      });
    }

    // ---------- Pumble webhook submission ----------
    function buildResultsMessage(){
      const score   = state.correct;
      const totalXP = pageXP() + state.correct * 2 + bossXP();
      const tierKey = score >= cfg.passGold ? 'gold'
                    : score >= cfg.passSilver ? 'silver'
                    : 'bronze';
      const tier      = SUBMIT_TIERS[tierKey];
      const bossesDef = Object.keys(state.bossesDefeated).length;
      const elapsed   = state.user && state.user.startedAt
        ? Math.round((Date.now() - state.user.startedAt) / 60000)
        : 0;
      return [
        "🏆 *" + (state.user.name || 'Anonymous') + "* completed *" + cfg.moduleName + "*!",
        "",
        "*Employee ID:* " + (state.user.id || '—'),
        "*Score:* " + score + " / " + cfg.totalQuestions,
        "*Tier:* " + tier,
        "*Total XP:* " + totalXP + " / " + TOTAL_XP,
        "*Mini-bosses defeated:* " + bossesDef + " / " + cfg.minibossCount,
        "*Time on training:* " + elapsed + " min",
        "*Submitted:* " + new Date().toLocaleString()
      ].join("\n");
    }

    function setSubmitStatus(html, color){
      const el = document.getElementById('submitStatus');
      if(el){ el.innerHTML = html; el.style.color = color || '#94A3B8'; }
    }

    async function submitResults(force){
      if(!cfg.pumbleWebhookUrl){
        setSubmitStatus('⚠ Webhook not configured. Trainer must add a webhook URL to enable auto-submit.', '#FACC15');
        return false;
      }
      if(!state.user){
        setSubmitStatus('⚠ Please sign in first.', '#FACC15');
        return false;
      }
      if(Object.keys(state.answered).length < cfg.totalQuestions){
        setSubmitStatus('⏳ Finish all '+cfg.totalQuestions+' questions before submitting.', '#94A3B8');
        return false;
      }
      if(state.submittedToWebhook && !force){
        setSubmitStatus('✅ Results already sent to your trainer.', '#10B981');
        return true;
      }

      setSubmitStatus('📤 Sending results...', '#FACC15');
      const messageText = buildResultsMessage();
      const jsonBody    = JSON.stringify({text: messageText});
      const isPumbleDirect = cfg.pumbleWebhookUrl.indexOf('api.pumble.com') !== -1;

      // Try a direct fetch first
      try{
        const res = await fetch(cfg.pumbleWebhookUrl, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: jsonBody
        });
        if(res.ok || res.status === 200 || res.status === 204){
          state.submittedToWebhook = true;
          saveProgress();
          setSubmitStatus('✅ Results sent to trainer at ' + new Date().toLocaleTimeString(), '#10B981');
          return true;
        }
      }catch(e1){ console.warn('Direct submit failed:', e1.message || e1); }

      // Fallback to sendBeacon
      try{
        if(navigator.sendBeacon){
          const blob = new Blob([jsonBody], {type:'application/json'});
          const sent = navigator.sendBeacon(cfg.pumbleWebhookUrl, blob);
          if(sent){
            state.submittedToWebhook = true;
            saveProgress();
            setSubmitStatus('✅ Results sent (via beacon). Check Pumble to confirm. ' + new Date().toLocaleTimeString(), '#10B981');
            return true;
          }
        }
      }catch(e2){ console.warn('Beacon submit failed:', e2.message || e2); }

      if(isPumbleDirect){
        setSubmitStatus(
          '⚠ Pumble blocks direct browser submissions (CORS). Two fixes:\n' +
          '  1) Click "📋 COPY RESULTS" below to paste into Pumble manually, OR\n' +
          '  2) Ask your admin to set up the Google Apps Script proxy.',
          '#FACC15'
        );
      } else {
        setSubmitStatus('⚠ Auto-send failed. Click "📋 COPY RESULTS" to paste into Pumble manually.', '#FACC15');
      }
      return false;
    }

    async function copyResults(){
      const text = buildResultsMessage();
      try{
        await navigator.clipboard.writeText(text);
        setSubmitStatus('✅ Copied to clipboard! Paste it into your trainer\'s Pumble channel.', '#10B981');
      }catch(e){
        setSubmitStatus('⚠ Could not copy automatically. Highlight + copy this:\n\n' + text, '#FACC15');
      }
    }

    // ---------- Login overlay ----------
    function showLogin(){
      const ov = document.getElementById('loginOverlay');
      if(ov) ov.classList.remove('hidden');
      setTimeout(() => {
        const n = document.getElementById('loginName');
        if(n) n.focus();
      }, 100);
    }

    function hideLogin(){
      const ov = document.getElementById('loginOverlay');
      if(ov) ov.classList.add('hidden');
    }

    function doLogin(){
      const name = document.getElementById('loginName').value.trim();
      const id   = document.getElementById('loginId').value.trim();
      const err  = document.getElementById('loginErr');
      if(!name){
        err.textContent = 'Please enter your name to begin.';
        return;
      }
      state.user = {name:name, id:id, startedAt:Date.now()};
      lsSet(KEY_USER, JSON.stringify(state.user));
      hideLogin();
      updateTracker();
    }

    // ============================================================
    // ============================================================
    //  Video facade — thumbnail-first YouTube embed
    // ============================================================
    // Live on every module page (not just edit mode). Each
    // .rsp-video-facade button gets a click handler that swaps the
    // facade for a real iframe with autoplay=1, so the viewer's click
    // is the user gesture that authorises playback. Sidesteps "Error
    // 153 — Video player configuration error" by not auto-loading any
    // YouTube iframe; viewers always see a thumbnail until they click.
    function wireVideoFacades(root){
      (root || document).querySelectorAll('.rsp-video-facade:not([data-wired])').forEach(btn => {
        btn.setAttribute('data-wired', '1');
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          const src = btn.dataset.embedSrc;
          if(!src) return;
          const sep = src.indexOf('?') >= 0 ? '&' : '?';
          const iframe = document.createElement('iframe');
          iframe.src = src + sep + 'autoplay=1';
          iframe.title = 'Training video';
          iframe.setAttribute('frameborder', '0');
          iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
          iframe.setAttribute('referrerpolicy', 'origin-when-cross-origin');
          iframe.setAttribute('allowfullscreen', '');
          btn.replaceWith(iframe);
          // Hook YT IFrame API error detection. If the just-loaded
          // iframe hits Error 100/101/150 (or doesn't reach onReady
          // within 5 s — a proxy for the Error 153 "configuration"
          // case YouTube renders inside the iframe), we replace it
          // with renderEmbedErrorFallback's clean clickable thumbnail.
          attachYouTubeErrorHandler(iframe);
        });
      });
    }

    // ============================================================
    //  YouTube IFrame Player API — error detection
    // ============================================================
    // Loads https://www.youtube.com/iframe_api lazily on the first
    // YouTube iframe we need to monitor, then wraps each iframe in a
    // YT.Player instance so we can subscribe to onError/onReady.
    //
    // Why we need this: YouTube sometimes refuses to play an embedded
    // video — most commonly Error 153 ("Video player configuration
    // error"), which can come from the video owner disabling embeds,
    // an origin mismatch, or a stricter -nocookie host check. The
    // error is rendered INSIDE the iframe so the viewer's only path
    // out is the tiny "Watch on YouTube" link YouTube shows. We can't
    // bypass the underlying restriction client-side, but we CAN trade
    // YouTube's branded error iframe for a much clearer fallback that
    // the viewer can click straight through to.
    //
    // Caveats:
    //   - Error 153 is not in YouTube's officially-documented onError
    //     codes, so we ALSO use a 5 s onReady-timeout: if the player
    //     never reports ready, we treat the embed as failed.
    //   - If the YT API script is blocked (CSP, network), the helper
    //     resolves to null and we leave the original iframe in place.
    //     Viewer still gets YouTube's error UI + our fallback link
    //     below the player.
    //   - All side-effects are idempotent — flagging each iframe with
    //     `data-yt-error-wired` so re-running this on the same tree
    //     doesn't double-wrap players.
    let __ytApiPromise = null;
    function loadYouTubeAPI(){
      if(__ytApiPromise) return __ytApiPromise;
      __ytApiPromise = new Promise(resolve => {
        if(window.YT && window.YT.Player) return resolve(window.YT);
        const previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function(){
          if(typeof previousReady === 'function'){ try{ previousReady(); }catch(e){} }
          resolve(window.YT);
        };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        tag.onerror = function(){ resolve(null); };
        document.head.appendChild(tag);
      });
      return __ytApiPromise;
    }

    function getYouTubeVideoIdFromEmbed(src){
      if(!src) return null;
      const m = String(src).match(/\/embed\/([^?#\/]+)/);
      return m ? m[1] : null;
    }

    function attachYouTubeErrorHandler(iframe){
      if(!iframe || iframe.dataset.ytErrorWired) return;
      const src = iframe.getAttribute('src') || '';
      if(!/youtube(?:-nocookie)?\.com\/embed\//.test(src)) return;
      // Skip iframes without `enablejsapi=1` — the YT IFrame API can't
      // bind to them and our readyTimer would falsely fire, replacing
      // a perfectly-good video with the error fallback. Older saved
      // module drafts predate the param so this preserves them
      // unchanged; only embeds built by the current buildYouTubeEmbed
      // get monitored.
      if(!/[?&]enablejsapi=1\b/.test(src)) return;
      const videoId = getYouTubeVideoIdFromEmbed(src);
      if(!videoId) return;
      iframe.dataset.ytErrorWired = '1';
      if(!iframe.id) iframe.id = 'rsp-yt-' + Math.random().toString(36).slice(2, 10);
      const watchUrl = 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId);

      loadYouTubeAPI().then(YT => {
        if(!YT || !YT.Player) return;
        let readyTimer = setTimeout(() => {
          // Hit Error 153 most often shows AFTER iframe load but the
          // YT API doesn't reliably surface it as onError. A
          // 5 s "no onReady yet" hint is a decent proxy: real
          // embeds resolve onReady within ~1 s on broadband.
          renderEmbedErrorFallback(iframe, videoId, watchUrl);
          readyTimer = null;
        }, 5000);
        try{
          new YT.Player(iframe.id, {
            events: {
              onReady: function(){
                if(readyTimer){ clearTimeout(readyTimer); readyTimer = null; }
              },
              onError: function(e){
                if(readyTimer){ clearTimeout(readyTimer); readyTimer = null; }
                const code = e && e.data;
                // 2 (bad param), 5 (HTML5), 100 (gone),
                // 101/150 (owner disabled embedding) — all map to
                // "no point keeping the broken iframe".
                if(code === 2 || code === 5 || code === 100 || code === 101 || code === 150){
                  renderEmbedErrorFallback(iframe, videoId, watchUrl);
                }
              }
            }
          });
        }catch(err){
          if(readyTimer){ clearTimeout(readyTimer); readyTimer = null; }
          /* swallow — viewer keeps default iframe */
        }
      });
    }

    function renderEmbedErrorFallback(iframe, videoId, watchUrl){
      if(!iframe || !iframe.parentNode) return;
      const fallback = document.createElement('a');
      fallback.className = 'rsp-video-embed-error';
      fallback.href = watchUrl || ('https://www.youtube.com/watch?v=' + encodeURIComponent(videoId));
      fallback.target = '_blank';
      fallback.rel = 'noopener noreferrer';
      fallback.setAttribute('aria-label', 'Watch on YouTube');
      const thumb = 'https://img.youtube.com/vi/' + encodeURIComponent(videoId) + '/hqdefault.jpg';
      fallback.innerHTML =
        '<img src="' + escapeHtml(thumb) + '" alt="Video thumbnail" loading="lazy">' +
        '<div class="rsp-video-embed-error-overlay">' +
          '<div class="rsp-video-embed-error-badge">▶ Watch on YouTube</div>' +
          '<div class="rsp-video-embed-error-sub">This video can\'t be embedded — click to open it on YouTube.</div>' +
        '</div>';
      iframe.replaceWith(fallback);
    }

    // Scan a tree for YouTube iframes and wire error-handlers on each.
    // Called wherever new content lands: boot(), undo restores, and
    // every editor insert path. Idempotent via data-yt-error-wired.
    //
    // Skips iframes nested inside .img-peek-popup (the See It hover
    // popups). Those iframes carry `loading="lazy"` and live inside
    // a display:none container until hovered, so the YT API's
    // onReady/onError timing is unreliable — the 5 s timeout would
    // false-positive on a video the viewer hasn't even hovered yet.
    // For See It videos viewers get YouTube's native error UI, which
    // is acceptable for a quick preview.
    function wireYouTubeIframes(root){
      (root || document).querySelectorAll('iframe[src*="youtube"]:not([data-yt-error-wired])').forEach(iframe => {
        if(iframe.closest('.img-peek-popup')) return;
        attachYouTubeErrorHandler(iframe);
      });
    }

    // ============================================================
    //  See It popup positioner
    // ============================================================
    // The .img-peek-popup is position:fixed so it can escape any
    // ancestor that clips (overflow:hidden on .level-card / mfr-card /
    // etc.) or that creates its own stacking context (transforms,
    // filters, or a lower-z-index sibling painting over it).
    //
    // CSS parks the popup off-screen by default; this function attaches
    // a hover/focus handler to each .img-peek pill that computes the
    // pill button's viewport-relative bounding rect and sets the
    // popup's inline top/left so it lands directly under the button.
    //
    // While the popup is visible we also listen for scroll and resize
    // so the popup tracks the button — without this it would hang where
    // it was first opened when the user scrolls or window-resizes.
    function wireImgPeekPopups(root){
      (root || document).querySelectorAll('.img-peek:not([data-popup-wired])').forEach(peek => {
        peek.setAttribute('data-popup-wired', '1');
        const btn = peek.querySelector('.img-peek-btn');
        const popup = peek.querySelector('.img-peek-popup');
        if(!btn || !popup) return;

        function position(){
          const rect = btn.getBoundingClientRect();
          popup.style.left = (rect.left + rect.width / 2) + 'px';
          popup.style.top = (rect.bottom + 10) + 'px';
        }

        // Visibility is JS-managed so the popup stays open while the
        // mouse moves from the pill button across the 10px gap into
        // the popup itself. The 150ms scheduled-hide acts as a buffer
        // for the gap; entering the popup before the timer fires
        // cancels it. The CSS `:hover .img-peek-popup{display:grid}`
        // rule is the no-JS fallback — JS overrides it via inline
        // `display:grid` when needed and clears the inline style to
        // hand control back to CSS.
        let hideTimer = null;
        let tracking = false;

        function startTracking(){
          if(tracking) return;
          tracking = true;
          window.addEventListener('scroll', position, true);
          window.addEventListener('resize', position);
        }
        function stopTracking(){
          if(!tracking) return;
          tracking = false;
          window.removeEventListener('scroll', position, true);
          window.removeEventListener('resize', position);
        }

        function show(){
          if(hideTimer){ clearTimeout(hideTimer); hideTimer = null; }
          position();
          popup.style.display = 'grid';
          startTracking();
        }
        function scheduleHide(){
          if(hideTimer) return;
          hideTimer = setTimeout(() => {
            popup.style.display = '';
            stopTracking();
            hideTimer = null;
          }, 150);
        }

        peek.addEventListener('mouseenter', show);
        peek.addEventListener('mouseleave', scheduleHide);
        // Listening on the popup too is what fixes the gap: if the
        // user's mouse lands on the popup before scheduleHide fires,
        // we cancel the timer and keep it visible.
        popup.addEventListener('mouseenter', show);
        popup.addEventListener('mouseleave', scheduleHide);
        btn.addEventListener('focus', show);
        btn.addEventListener('blur', scheduleHide);
      });
    }

    // ============================================================
    //  Bootstrap on DOMContentLoaded
    // ============================================================
    function boot(){
      buildPageMap();
      tagSectionsOnPages();
      wireVideoFacades(document);
      wireImgPeekPopups(document);
      wireYouTubeIframes(document);

      if(isEditorURL()){
        renderQuizCardsOnPage();
        openEditorLogin();
        return;
      }

      // Admin URL bypasses login + everything else.
      if(isAdminURL()){
        openAdminLogin();
        return;
      }

      // Render every quiz card found on the page
      renderQuizCardsOnPage();

      // Optional buttons on the results page
      const rb = document.getElementById('resetBtn');
      if(rb) rb.addEventListener('click', resetQuiz);
      const rp = document.getElementById('resetProgress');
      if(rp) rp.addEventListener('click', resetAll);
      const sb = document.getElementById('submitBtn');
      if(sb) sb.addEventListener('click', () => submitResults(true));
      const cb = document.getElementById('copyBtn');
      if(cb) cb.addEventListener('click', copyResults);

      // Mini-boss gates
      document.querySelectorAll('.miniboss-gate').forEach(gate => {
        gate.addEventListener('click', () => openMiniboss(gate.dataset.miniboss));
      });

      // Side-map toggle
      const mapToggle = document.getElementById('mapToggle');
      if(mapToggle){
        mapToggle.addEventListener('click', () => {
          const sm = document.getElementById('sideMap');
          sm.classList.toggle('collapsed');
          document.body.classList.toggle('collapsed-map');
          mapToggle.textContent = sm.classList.contains('collapsed') ? '›' : '‹';
        });
      }
      document.body.classList.add('has-sidemap');

      // Login flow
      const stored = lsGet(KEY_USER);
      if(stored){
        try{
          state.user = JSON.parse(stored);
          hideLogin();
        }catch(e){
          showLogin();
        }
      } else {
        showLogin();
      }
      const loginBtn = document.getElementById('loginBtn');
      if(loginBtn) loginBtn.addEventListener('click', doLogin);
      const loginName = document.getElementById('loginName');
      if(loginName) loginName.addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });
      const loginId = document.getElementById('loginId');
      if(loginId) loginId.addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });

      // XP system
      tagPagesForXP();
      loadProgress();
      watchPages();

      // Scroll-spy to update side-map current section
      const secObs = new IntersectionObserver(function(entries){
        let topSec = null;
        let topRatio = 0;
        entries.forEach(e => {
          if(e.intersectionRatio > topRatio){
            topRatio = e.intersectionRatio;
            topSec   = e.target.dataset.sectionId;
          }
        });
        if(topSec && topSec !== state.currentSection){
          state.currentSection = topSec;
          renderSideMap();
        }
      }, {threshold:[0.3, 0.6, 0.9]});
      document.querySelectorAll('.page[data-section-id]').forEach(p => secObs.observe(p));

      renderSideMap();
      updateTracker();
    }

    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      // Already past DOMContentLoaded — kick off immediately.
      boot();
    }

    // Return a small handle so callers can introspect or trigger
    // things from outside the module if needed.
    return {
      cfg,
      state,
      saveProgress,
      loadProgress,
      updateTracker,
      submitResults,
      copyResults,
      openMiniboss,
      closeMiniboss
    };
  }

  // ---- Export ----
  global.RSPModule = {
    init: init,
    // Exposed utilities (rare cases where a module wants them):
    lsGet: lsGet, lsSet: lsSet, lsDel: lsDel,
    escapeHtml: escapeHtml,
    KEY_USER:   KEY_USER,
    KEY_LEDGER: KEY_LEDGER
  };

})(typeof window !== 'undefined' ? window : this);
