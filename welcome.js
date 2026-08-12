(function(){
  'use strict';

  const STORAGE_KEY = 'rsp_welcome_seen_v1';
  let previousFocus = null;
  let previousOverflow = '';

  function accountKey(user){
    const name = String(user && user.name || '').trim().toLowerCase();
    if(!name) return '';
    const startedAt = String(user && user.startedAt || user && user.started_at || 'account');
    return name + '|' + startedAt;
  }

  function readSeen(){
    try{
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }catch(e){
      return {};
    }
  }

  function hasSeen(user){
    const key = accountKey(user);
    return !!(key && readSeen()[key]);
  }

  function markSeen(user){
    const key = accountKey(user);
    if(!key) return;
    try{
      const seen = readSeen();
      seen[key] = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    }catch(e){}
  }

  function addStyles(){
    if(document.getElementById('rspWelcomeStyles')) return;
    const style = document.createElement('style');
    style.id = 'rspWelcomeStyles';
    style.textContent = `
      .rsp-welcome-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,12,19,.86);backdrop-filter:blur(8px)}
      .rsp-welcome-modal{width:min(760px,100%);max-height:calc(100vh - 40px);overflow:auto;color:#f8fafc;background:linear-gradient(145deg,#2a4b66 0%,#102332 72%);border:1px solid #4d7898;border-radius:22px;box-shadow:0 28px 80px rgba(0,0,0,.55);font-family:inherit}
      .rsp-welcome-header{padding:28px 30px 22px;border-bottom:1px solid #365f7d;background:radial-gradient(circle at top right,rgba(229,114,37,.11),transparent 46%)}
      .rsp-welcome-logo{display:block;width:min(230px,72vw);height:auto;margin:0 0 19px;object-fit:contain}
      .rsp-welcome-eyebrow{margin:0 0 8px;color:#df8a55;font-size:12px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}
      .rsp-welcome-title{margin:0;color:#fff;font-size:clamp(25px,4vw,36px);line-height:1.1;font-weight:900;letter-spacing:-.025em}
      .rsp-welcome-intro{margin:12px 0 0;max-width:650px;color:#cbd5e1;font-size:15px;line-height:1.65}
      .rsp-welcome-body{padding:24px 30px 28px}
      .rsp-welcome-heading{margin:0 0 12px;color:#f8fafc;font-size:15px;font-weight:900;letter-spacing:.02em}
      .rsp-welcome-paths{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:13px}
      .rsp-welcome-path{padding:17px;border:1px solid #365f7d;border-radius:14px;background:#102332}
      .rsp-welcome-path strong{display:block;margin-bottom:6px;color:#df8a55;font-size:15px}
      .rsp-welcome-path p{margin:0;color:#cbd5e1;font-size:13px;line-height:1.55}
      .rsp-welcome-nav-note{margin:0 0 22px;color:#94a3b8;font-size:13px;line-height:1.55}
      .rsp-welcome-info{margin-bottom:22px;padding:18px 20px;border:1px solid #365f7d;border-radius:14px;background:rgba(9,23,34,.64)}
      .rsp-welcome-list{margin:0;padding-left:20px;color:#cbd5e1;font-size:14px;line-height:1.6}
      .rsp-welcome-list li+li{margin-top:8px}
      .rsp-welcome-list strong{color:#f8fafc}
      .rsp-welcome-achievements{margin:0 0 24px;padding:15px 17px;border-left:3px solid #b75b28;border-radius:0 10px 10px 0;background:rgba(183,91,40,.08);color:#dbeafe;font-size:14px;line-height:1.6}
      .rsp-welcome-actions{display:flex;flex-wrap:wrap;gap:10px}
      .rsp-welcome-action{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 17px;border-radius:10px;border:1px solid transparent;font:inherit;font-size:14px;font-weight:900;text-decoration:none;cursor:pointer;transition:transform .15s ease,background .15s ease,border-color .15s ease}
      .rsp-welcome-action:hover{transform:translateY(-1px)}
      .rsp-welcome-action:focus-visible{outline:3px solid #38bdf8;outline-offset:3px}
      .rsp-welcome-primary{background:#b75b28;color:#fff}
      .rsp-welcome-primary:hover{background:#a94e20}
      .rsp-welcome-secondary{border-color:#6b91ad;background:#2a4b66;color:#f8fafc}
      .rsp-welcome-secondary:hover{border-color:#df8a55;background:#365f7d}
      .rsp-welcome-quiet{border-color:#365f7d;background:transparent;color:#cbd5e1}
      .rsp-welcome-quiet:hover{background:#2a4b66;color:#fff}
      @media(max-width:620px){
        .rsp-welcome-overlay{align-items:flex-end;padding:0}
        .rsp-welcome-modal{max-height:94vh;border-radius:20px 20px 0 0}
        .rsp-welcome-header,.rsp-welcome-body{padding-left:20px;padding-right:20px}
        .rsp-welcome-paths{grid-template-columns:1fr}
        .rsp-welcome-actions{display:grid}
        .rsp-welcome-action{width:100%}
      }
      @media(prefers-reduced-motion:reduce){.rsp-welcome-action{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function close(){
    const overlay = document.getElementById('rspWelcomeOverlay');
    if(!overlay) return;
    overlay.remove();
    document.body.style.overflow = previousOverflow;
    if(previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    previousFocus = null;
  }

  function navigate(user, href){
    markSeen(user);
    window.location.href = href;
  }

  function show(user){
    if(!user || !accountKey(user) || hasSeen(user)) return false;
    if(document.getElementById('rspWelcomeOverlay')) return true;

    addStyles();
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;

    const overlay = document.createElement('div');
    overlay.id = 'rspWelcomeOverlay';
    overlay.className = 'rsp-welcome-overlay';
    overlay.innerHTML = `
      <section class="rsp-welcome-modal" role="dialog" aria-modal="true" aria-labelledby="rspWelcomeTitle" aria-describedby="rspWelcomeIntro">
        <header class="rsp-welcome-header">
          <img class="rsp-welcome-logo" src="images/rsp-industrial-logo.png" alt="RSP Industrial">
          <p class="rsp-welcome-eyebrow">Your training starts here</p>
          <h2 class="rsp-welcome-title" id="rspWelcomeTitle">Welcome to the RSP Training Portal</h2>
          <p class="rsp-welcome-intro" id="rspWelcomeIntro">This portal is your home for new-hire onboarding, product training, quizzes, progress tracking, and achievements.</p>
        </header>
        <div class="rsp-welcome-body">
          <h3 class="rsp-welcome-heading">Choose where to start</h3>
          <div class="rsp-welcome-paths">
            <div class="rsp-welcome-path">
              <strong>Product Training</strong>
              <p>Build your product knowledge and work toward Product Mastery.</p>
            </div>
            <div class="rsp-welcome-path">
              <strong>Onboarding</strong>
              <p>Learn about RSP, our culture, your role, and the skills you need to get started.</p>
            </div>
          </div>
          <p class="rsp-welcome-nav-note">You can switch between Product Training and Onboarding at any time using the navigation at the top of the portal.</p>

          <div class="rsp-welcome-info">
            <h3 class="rsp-welcome-heading">Modules and quizzes</h3>
            <ul class="rsp-welcome-list">
              <li>Work through each module in order. Some modules finish with a quiz.</li>
              <li>After completing a module, look in the <strong>bottom-right corner</strong> for the quiz or testing prompt.</li>
              <li>Quiz passcodes can only be received from <strong>Gabe</strong>.</li>
              <li><strong>Product Mastery testing is completed in person and monitored.</strong></li>
            </ul>
          </div>

          <p class="rsp-welcome-achievements"><strong>Earn XP, badges, and new tiers</strong> as you complete training. Your progress and achievements are saved to your learner profile so you can see how far you have come.</p>

          <div class="rsp-welcome-actions">
            <button class="rsp-welcome-action rsp-welcome-primary" type="button" data-welcome-destination="onboarding.html">Start Onboarding</button>
            <button class="rsp-welcome-action rsp-welcome-secondary" type="button" data-welcome-destination="product-mastery.html">Explore Product Training</button>
            <button class="rsp-welcome-action rsp-welcome-quiet" type="button" data-welcome-close>I’ll Look Around</button>
          </div>
        </div>
      </section>`;

    overlay.querySelectorAll('[data-welcome-destination]').forEach(function(button){
      button.addEventListener('click', function(){ navigate(user, button.dataset.welcomeDestination); });
    });
    overlay.querySelector('[data-welcome-close]').addEventListener('click', function(){
      markSeen(user);
      close();
    });
    overlay.addEventListener('keydown', function(event){
      if(event.key === 'Escape'){
        event.preventDefault();
        markSeen(user);
        close();
        return;
      }
      if(event.key !== 'Tab') return;
      const focusable = Array.from(overlay.querySelectorAll('button:not([disabled]),a[href]'));
      if(!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
      else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
    });

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    markSeen(user);
    overlay.querySelector('.rsp-welcome-primary').focus();
    return true;
  }

  window.RSPWelcome = { show: show, close: close, hasSeen: hasSeen, markSeen: markSeen };
})();
