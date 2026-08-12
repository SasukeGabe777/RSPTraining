(function(){
  const KEY_USER = 'rsp_user';
  const KEY_LEDGER = 'rsp_ledger';
  const ATTEMPT_PREFIX = 'rsp_training_attempt_';
  const mem = {};
  const ADMIN_NAMES = ['adminaccess', 'admin', 'rsp-admin'];

  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return mem[k] || null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k, v); }catch(e){ mem[k] = v; } }
  function parse(json, fallback){
    if(json == null || json === '') return fallback;
    try{ return JSON.parse(json); }catch(e){ return fallback; }
  }

  function getManifest(){ return window.RSP_MANIFEST || { brand:{}, categories:[], modules:[] }; }
  function getTraining(id){ return (getManifest().modules || []).find(m => m.id === id) || null; }
  function getCategory(id){ return (getManifest().categories || []).find(c => c.id === id) || null; }
  function getTrainings(){ return (getManifest().modules || []).filter(m => m.published); }

  function getCurrentUser(){ return parse(lsGet(KEY_USER), null); }
  function setCurrentUser(user){ lsSet(KEY_USER, JSON.stringify(user)); return user; }
  function clearCurrentUser(){ try{ localStorage.removeItem(KEY_USER); }catch(e){ delete mem[KEY_USER]; } }
  function createUser(name, id){
    return { name:name.trim(), id:(id || '').trim(), startedAt:Date.now() };
  }

  function isAdminUser(user){
    if(!user || !user.name) return false;
    return ADMIN_NAMES.indexOf(user.name.trim().toLowerCase()) !== -1;
  }

  function getLedger(){ return parse(lsGet(KEY_LEDGER), {}); }
  function saveLedger(ledger){ lsSet(KEY_LEDGER, JSON.stringify(ledger)); }

  function ensureUserRecord(user){
    const ledger = getLedger();
    if(!ledger[user.name]){
      ledger[user.name] = {
        name: user.name,
        id: user.id || '',
        startedAt: user.startedAt || Date.now(),
        modules: {}
      };
      saveLedger(ledger);
    }
    return ledger[user.name];
  }

  function bootstrapUser(){
    const user = getCurrentUser();
    if(!user || !user.name) return null;
    ensureUserRecord(user);
    return user;
  }

  async function syncUser(user){
    if(!(window.RSPCloud && window.RSPCloud.isConfigured) || !user) return;
    try{
      await window.RSPCloud.upsertUser(user);
      await window.RSPCloud.syncDown(user.name);
      return getCurrentUser() || user;
    }catch(e){
      console.warn('training-shell syncUser failed:', e);
    }
    return user;
  }

  async function syncUp(user){
    if(!(window.RSPCloud && window.RSPCloud.isConfigured) || !user) return;
    try{
      await window.RSPCloud.syncUp(user.name);
    }catch(e){
      console.warn('training-shell syncUp failed:', e);
    }
  }

  function getProgress(user, moduleId){
    if(!user) return null;
    const ledger = getLedger();
    return (((ledger[user.name] || {}).modules || {})[moduleId]) || null;
  }

  function canAccess(user, training){
    if(!training || !training.prerequisite) return { locked:false, reason:'' };
    if(isAdminUser(user)) return { locked:false, reason:'' };
    const prereq = getTraining(training.prerequisite);
    const prereqProgress = prereq ? getProgress(user, prereq.id) : null;
    if(prereqProgress && prereqProgress.completedAt) return { locked:false, reason:'' };
    return {
      locked:true,
      reason:'Complete "' + (prereq ? prereq.name : training.prerequisite) + '" first.'
    };
  }

  function trainingStatus(user, training){
    const lock = canAccess(user, training);
    if(lock.locked) return { status:'locked', label:'Locked', detail:lock.reason, pct:0 };
    const progress = getProgress(user, training.id);
    if(!progress) return { status:'new', label:'Start', detail:'No attempts yet.', pct:0 };
    const xp = progress.totalXP || 0;
    if(progress.completedAt) return { status:'completed', label:'Passed', detail:'Passed ' + formatDate(progress.completedAt), pct:100 };
    if(progress.attempts || progress.openedAt || progress.lastAttemptAt){
      return { status:'progress', label:'In Progress', detail:(progress.attempts || 0) + ' attempt' + ((progress.attempts || 0) === 1 ? '' : 's'), pct: xp > 0 && training.xp ? Math.min(100, Math.round(xp/training.xp*100)) : 5 };
    }
    return { status:'new', label:'Start', detail:'No attempts yet.', pct:0 };
  }

  function updateProgress(user, moduleId, mutator){
    const ledger = getLedger();
    if(!ledger[user.name]){
      ledger[user.name] = { name:user.name, id:user.id || '', startedAt:user.startedAt || Date.now(), modules:{} };
    }
    const learner = ledger[user.name];
    if(!learner.modules[moduleId]) learner.modules[moduleId] = {};
    mutator(learner.modules[moduleId]);
    saveLedger(ledger);
    return learner.modules[moduleId];
  }

  function markOpened(user, training){
    updateProgress(user, training.id, rec => {
      rec.moduleName = training.name;
      rec.moduleIcon = training.icon;
      rec.openedAt = rec.openedAt || Date.now();
      rec.lastUpdate = Date.now();
      rec.total = rec.total || ((training.quiz && training.quiz.questionCount) || 0);
      rec.viewedPages = rec.viewedPages || [];
      rec.bossesDefeated = rec.bossesDefeated || {};
    });
  }

  function shuffle(arr){
    const copy = arr.slice();
    for(let i = copy.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function cloneQuestion(question){
    return {
      id: question.id,
      prompt: question.prompt,
      options: question.options.slice(),
      answer: question.answer,
      explanation: question.explanation
    };
  }

  function getAttempt(trainingId){
    return parse(sessionStorage.getItem(ATTEMPT_PREFIX + trainingId), null);
  }
  function saveAttempt(attempt){
    sessionStorage.setItem(ATTEMPT_PREFIX + attempt.trainingId, JSON.stringify(attempt));
  }
  function clearAttempt(trainingId){
    sessionStorage.removeItem(ATTEMPT_PREFIX + trainingId);
  }

  function buildAttempt(training){
    const bank = ((training.quiz || {}).bank || []);
    const count = Math.min((training.quiz || {}).questionCount || bank.length, bank.length);
    const questions = shuffle(bank).slice(0, count).map(cloneQuestion);
    const attempt = {
      trainingId: training.id,
      startedAt: Date.now(),
      currentIndex: 0,
      passPct: training.quiz.passPct,
      questions: questions,
      answers: {}
    };
    saveAttempt(attempt);
    return attempt;
  }

  function submitAttempt(user, training){
    const attempt = getAttempt(training.id);
    if(!attempt) return null;
    let score = 0;
    const reviewed = attempt.questions.map(question => {
      const selected = Object.prototype.hasOwnProperty.call(attempt.answers, question.id)
        ? attempt.answers[question.id]
        : null;
      const isCorrect = selected === question.answer;
      if(isCorrect) score++;
      return {
        id: question.id,
        prompt: question.prompt,
        options: question.options.slice(),
        selected: selected,
        selectedText: selected == null ? null : question.options[selected],
        correctAnswer: question.answer,
        correctText: question.options[question.answer],
        isCorrect: isCorrect,
        explanation: question.explanation
      };
    });
    const total = attempt.questions.length;
    const pct = total ? Math.round((score / total) * 100) : 0;
    const passed = pct >= training.quiz.passPct;
    const finishedAt = Date.now();

    const progress = updateProgress(user, training.id, rec => {
      rec.moduleName = training.name;
      rec.moduleIcon = training.icon;
      rec.openedAt = rec.openedAt || attempt.startedAt;
      rec.lastAttemptAt = finishedAt;
      rec.lastUpdate = finishedAt;
      rec.attempts = (rec.attempts || 0) + 1;
      rec.answered = attempt.answers;
      rec.correct = score;
      rec.total = total;
      rec.viewedPages = rec.viewedPages || [];
      rec.bossesDefeated = rec.bossesDefeated || {};
      rec.bestScore = Math.max(rec.bestScore || 0, score);
      rec.bestPct = Math.max(rec.bestPct || 0, pct);
      rec.lastAttempt = {
        finishedAt: finishedAt,
        score: score,
        total: total,
        pct: pct,
        passed: passed,
        items: reviewed
      };
      if(passed){
        rec.completedAt = rec.completedAt || finishedAt;
        rec.totalXP = training.xp || 0;
        rec.tier = 'gold';
      }else{
        rec.totalXP = rec.totalXP || 0;
        if(!rec.completedAt) rec.tier = null;
      }
      rec.submittedToWebhook = !!rec.submittedToWebhook;
    });

    clearAttempt(training.id);
    return progress;
  }

  function getNextTraining(training){
    const trainings = getTrainings();
    const idx = trainings.findIndex(t => t.id === training.id);
    if(idx < 0) return null;
    return trainings[idx + 1] || null;
  }

  function formatDate(ts){
    if(!ts) return '—';
    try{
      return new Date(ts).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
    }catch(e){
      return '—';
    }
  }

  function escapeHtml(str){
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderUserAvatar(user, size){
    if(user && user.avatar && window.renderAvatar){
      return window.renderAvatar(user.avatar, size || 44);
    }
    const letter = user && user.name ? user.name.trim().charAt(0).toUpperCase() : '?';
    return '<div style="width:' + (size || 44) + 'px;height:' + (size || 44) + 'px;border-radius:50%;display:grid;place-items:center;background:#0F172A;color:#FACC15;font-weight:800;font-size:18px">' + escapeHtml(letter) + '</div>';
  }

  window.RSPTrainingShell = {
    KEY_USER: KEY_USER,
    KEY_LEDGER: KEY_LEDGER,
    createUser: createUser,
    getCurrentUser: getCurrentUser,
    setCurrentUser: setCurrentUser,
    clearCurrentUser: clearCurrentUser,
    bootstrapUser: bootstrapUser,
    syncUser: syncUser,
    syncUp: syncUp,
    getTraining: getTraining,
    getCategory: getCategory,
    getTrainings: getTrainings,
    getLedger: getLedger,
    getProgress: getProgress,
    canAccess: canAccess,
    trainingStatus: trainingStatus,
    markOpened: markOpened,
    getAttempt: getAttempt,
    saveAttempt: saveAttempt,
    clearAttempt: clearAttempt,
    buildAttempt: buildAttempt,
    submitAttempt: submitAttempt,
    getNextTraining: getNextTraining,
    isAdminUser: isAdminUser,
    formatDate: formatDate,
    escapeHtml: escapeHtml,
    renderUserAvatar: renderUserAvatar
  };
})();
