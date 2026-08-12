/**
 * RSP TRAINING PORTAL — FLIPBOOK VIEWER (employee-facing)
 * ============================================================
 * Renders pre-converted PDF page images as a page-flip "digital booklet"
 * using StPageFlip: page-curl animation, shadows, prev/next, a desktop
 * two-page spread, mobile single-page view, fullscreen, and progress
 * tracking with a "Complete Training" gate on the final page.
 *
 * The page images are produced once at upload time by flipbook-convert.js
 * and stored in Supabase Storage, so this viewer only loads finished images.
 *
 * StPageFlip is loaded lazily from a CDN. If it can't load, we fall back to
 * a simple prev/next image reader so the training still works.
 *
 * Public API:
 *   window.RSPFlipbook.mount(container, {
 *     flipbook,              // the module_config.flipbook record
 *     startPage,             // 0-based page to open on (resume)
 *     completed,             // bool — already completed?
 *     allowComplete,         // bool — show the Complete Training button
 *     completeLabel,         // string — button label before completion (default 'Ready for Testing'; pass 'Complete Training' for quiz-less modules)
 *     onPage(cur, highest, total),   // called on every page change
 *     onComplete()                   // called when learner clicks Complete
 *   })  →  returns a controller { destroy() }
 * ============================================================
 */
(function(){
  const STF_SRC = 'https://cdn.jsdelivr.net/npm/page-flip/dist/js/page-flip.browser.js';
  let _stfPromise = null;

  function loadStPageFlip(){
    if(_stfPromise) return _stfPromise;
    _stfPromise = new Promise(function(resolve, reject){
      if(window.St && window.St.PageFlip){ resolve(window.St.PageFlip); return; }
      const s = document.createElement('script');
      s.src = STF_SRC;
      s.onload = function(){
        if(window.St && window.St.PageFlip) resolve(window.St.PageFlip);
        else reject(new Error('StPageFlip failed to initialize'));
      };
      s.onerror = function(){ reject(new Error('Could not load page-flip library')); };
      document.head.appendChild(s);
    });
    return _stfPromise;
  }

  function el(tag, cls, html){
    const n = document.createElement(tag);
    if(cls) n.className = cls;
    if(html != null) n.innerHTML = html;
    return n;
  }

  function loomEmbedUrl(url){
    if(!url) return '';
    try{
      var parsed = new URL(String(url), location.href);
      if(parsed.protocol !== 'https:' || !(parsed.hostname === 'loom.com' || parsed.hostname.endsWith('.loom.com'))) return '';
      parsed.pathname = parsed.pathname.replace('/share/', '/embed/');
      parsed.search = '?hide_owner=true&hide_share=true&hide_title=true&autoplay=0';
      parsed.hash = '';
      return parsed.href;
    }catch(e){ return ''; }
  }

  function safeWebUrl(url){
    try{
      var parsed = new URL(String(url || ''), location.href);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
    }catch(e){ return ''; }
  }

  function buildVideoPageContent(embedUrl, title){
    var wrap = el('div', 'rsp-fb-video-page');
    if(title){ var t = el('div', 'rsp-fb-video-title'); t.textContent = title; wrap.appendChild(t); }
    if(!embedUrl){
      var unavailable = el('p'); unavailable.textContent = 'This video link is unavailable.'; wrap.appendChild(unavailable);
      return wrap;
    }
    var iframe = document.createElement('iframe');
    iframe.className = 'rsp-fb-video-iframe';
    iframe.setAttribute('data-src', embedUrl);
    iframe.src = embedUrl;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
    wrap.appendChild(iframe);
    return wrap;
  }

  function showMessage(container, ico, title, body){
    container.innerHTML = '';
    const wrap = el('div', 'rsp-flipbook');
    const msg = el('div', 'rsp-flipbook-msg');
    msg.appendChild(el('div', 'fb-ico', ico));
    msg.appendChild(el('h4', null, title));
    if(body) msg.appendChild(el('p', null, body));
    wrap.appendChild(msg);
    container.appendChild(wrap);
  }

  // Loading / processing state (also used to reflect admin conversion status).
  function showLoading(container, label, pct){
    container.innerHTML = '';
    const wrap = el('div', 'rsp-flipbook');
    const box = el('div', 'rsp-flipbook-loading');
    box.appendChild(el('div', 'rsp-flipbook-spinner'));
    box.appendChild(el('div', 'rsp-flipbook-progress-text', label || 'Loading flipbook…'));
    if(typeof pct === 'number'){
      const bar = el('div', 'rsp-flipbook-bar');
      const fill = el('span'); fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
      bar.appendChild(fill); box.appendChild(bar);
    }
    wrap.appendChild(box);
    container.appendChild(wrap);
  }

  // Preload all page images so the flip doesn't show blank leaves.
  function preloadImages(urls){
    return Promise.all(urls.map(function(u){
      return new Promise(function(res){
        const im = new Image();
        im.onload = im.onerror = function(){ res(); };
        im.src = u;
      });
    }));
  }

  function mount(container, opts){
    opts = opts || {};
    const fb = opts.flipbook || {};
    const onPage = typeof opts.onPage === 'function' ? opts.onPage : function(){};
    const onComplete = typeof opts.onComplete === 'function' ? opts.onComplete : function(){};

    // Guard: nothing to show
    if(!fb || !fb.page_urls || !fb.page_urls.length){
      showMessage(container, '📄', 'No flipbook yet', 'This training does not have a PDF flipbook loaded.');
      return { destroy: function(){} };
    }

    const pages = fb.page_urls.map(safeWebUrl).filter(Boolean);
    if(!pages.length){
      showMessage(container, '📄', 'Flipbook unavailable', 'No safe page URLs were found for this training.');
      return { destroy: function(){} };
    }
    // Interleave video pages into the PDF page sequence
    const videoPageDefs = (fb.video_pages || []).slice().sort(function(a,b){ return a.insert_after - b.insert_after; });
    const pageItems = [];
    var vpi = 0;
    pages.forEach(function(url, i){
      pageItems.push({type:'pdf', url:url});
      while(vpi < videoPageDefs.length && videoPageDefs[vpi].insert_after === i + 1){
        pageItems.push({type:'video', url:loomEmbedUrl(videoPageDefs[vpi].url||''), title:videoPageDefs[vpi].title||''});
        vpi++;
      }
    });
    const total = pageItems.length;
    const aspect = fb.aspect && fb.aspect > 0 ? fb.aspect : 0.7727;
    let highest = Math.max(1, Math.min(total, (opts.startPage || 0) + 1));
    let destroyed = false;
    let pageFlip = null;
    const cleanupFns = []; // listeners to remove on destroy

    showLoading(container, 'Loading training pages…');

    Promise.all([ loadStPageFlip().catch(function(){ return null; }), preloadImages(pageItems.filter(function(it){ return it.type === 'pdf'; }).map(function(it){ return it.url; })) ])
      .then(function(res){
        if(destroyed) return;
        const PageFlip = res[0];
        if(PageFlip) buildFlip(PageFlip);
        else buildFallback(); // library blocked — degrade gracefully
      });

    // ── shared chrome (controls bar) ──
    function buildChrome(wrap, api){
      const controls = el('div', 'rsp-flipbook-controls');

      const prev = el('button', 'rsp-fb-btn', '‹ Prev');
      const next = el('button', 'rsp-fb-btn', 'Next ›');
      const counter = el('div', 'rsp-fb-counter');
      const track = el('div', 'rsp-fb-track'); const trackFill = el('span'); track.appendChild(trackFill);
      const spacer = el('div', 'rsp-fb-spacer');
      const fs = el('button', 'rsp-fb-btn', '⤢ Fullscreen');

      controls.appendChild(prev);
      controls.appendChild(counter);
      controls.appendChild(track);
      controls.appendChild(next);
      controls.appendChild(spacer);
      controls.appendChild(fs);

      let completeBtn = null;
      if(opts.allowComplete){
        const readyLabel = opts.completeLabel || 'Ready for Testing';
        completeBtn = el('button', 'rsp-fb-btn rsp-fb-complete', opts.completed ? '✓ Completed' : readyLabel);
        if(opts.completed) completeBtn.classList.add('is-done');
        controls.appendChild(completeBtn);
      }
      wrap.appendChild(controls);

      prev.onclick = function(){ api.prev(); };
      next.onclick = function(){ api.next(); };
      fs.onclick = function(){ if(api.toggleFs) api.toggleFs(); };
      if(completeBtn){
        completeBtn.onclick = function(){
          if(completeBtn.disabled || completeBtn.classList.contains('is-done')) return;
          completeBtn.classList.add('is-done');
          completeBtn.textContent = '✓ Completed';
          onComplete();
        };
      }

      // Reusable refresh of counter / buttons / completion gate.
      function refresh(cur, reached){
        // cur is 1-based "furthest visible page" in the current spread
        counter.textContent = 'Page ' + cur + ' / ' + total;
        trackFill.style.width = Math.round((cur / total) * 100) + '%';
        prev.disabled = cur <= 1;
        next.disabled = cur >= total;
        if(completeBtn && !opts.completed){
          if(reached >= total){
            completeBtn.disabled = false;
            completeBtn.title = 'You’ve reached the last page — mark this training complete.';
          } else {
            completeBtn.disabled = true;
            completeBtn.title = 'Reach the last page to finish.';
          }
        }
      }
      return { refresh: refresh };
    }

    // ── primary path: StPageFlip ──
    function buildFlip(PageFlip){
      container.innerHTML = '';
      const wrap = el('div', 'rsp-flipbook');
      const stage = el('div', 'rsp-flipbook-stage');
      const bookEl = el('div', 'rsp-flipbook-book');
      stage.appendChild(bookEl);
      wrap.appendChild(stage);
      container.appendChild(wrap);

      // Build page DOM. First + last pages are "hard" covers for a book feel.
      // StPageFlip's loadFromHTML expects the leaves to already be children
      // of the mount element, so we append them before loading.
      const pageEls = pageItems.map(function(item, i){
        const isCover = (i === 0 || i === total - 1);
        const isVideo = item.type === 'video';
        const p = el('div', 'rsp-flipbook-page' + (isCover ? ' rsp-flipbook-page--cover' : '') + (isVideo ? ' rsp-flipbook-page--video' : ''));
        if(isCover && !isVideo) p.setAttribute('data-density', 'hard');
        if(isVideo){
          p.appendChild(buildVideoPageContent(loomEmbedUrl(item.url), item.title));
        } else {
          const img = new Image();
          img.src = item.url; img.alt = 'Page ' + (i + 1); img.loading = 'eager';
          p.appendChild(img);
        }
        bookEl.appendChild(p);
        return p;
      });

      // Base single-page dimensions; size:'stretch' fills the parent and
      // usePortrait flips to a single-page view on narrow screens (mobile).
      const baseW = 500;
      const baseH = Math.round(baseW / aspect);
      pageFlip = new PageFlip(bookEl, {
        width: baseW,
        height: baseH,
        size: 'stretch',
        minWidth: 280,
        maxWidth: 1100,
        minHeight: Math.round(280 / aspect),
        maxHeight: Math.round(1100 / aspect),
        drawShadow: true,
        maxShadowOpacity: 0.5,
        flippingTime: 700,
        usePortrait: true,
        showCover: true,
        autoSize: true,
        mobileScrollSupport: false
      });
      pageFlip.loadFromHTML(pageEls);

      const chrome = buildChrome(wrap, {
        prev: function(){ pageFlip.flipPrev(); },
        next: function(){ pageFlip.flipNext(); },
        toggleFs: function(){ toggleFs(); }
      });

      function furthestVisible(){
        const idx = pageFlip.getCurrentPageIndex(); // 0-based, left page of spread
        // landscape spreads show two pages, so the furthest visible is idx+1
        const orient = pageFlip.getOrientation ? pageFlip.getOrientation() : 'portrait';
        const span = (orient === 'landscape') ? 2 : 1;
        return Math.min(total, idx + span);
      }

      function report(){
        const cur = furthestVisible();
        if(cur > highest) highest = cur;
        chrome.refresh(cur, highest);
        onPage(cur, highest, total);
      }

      function pauseOffscreenVideos(){
        const idx = pageFlip.getCurrentPageIndex();
        const orient = pageFlip.getOrientation ? pageFlip.getOrientation() : 'portrait';
        const span = orient === 'landscape' ? 2 : 1;
        pageEls.forEach(function(p, i){
          const iframe = p.querySelector('iframe');
          if(!iframe) return;
          const onScreen = i >= idx && i < idx + span;
          if(!onScreen && iframe.src !== 'about:blank'){
            iframe.src = 'about:blank';
          } else if(onScreen && iframe.src === 'about:blank'){
            iframe.src = iframe.getAttribute('data-src') || '';
          }
        });
      }
      pageFlip.on('flip', function(){ pauseOffscreenVideos(); report(); });
      pageFlip.on('changeOrientation', function(){ pauseOffscreenVideos(); report(); });

      // ── fullscreen fit ──
      // StPageFlip 'stretch' fits the book to its PARENT element's width
      // (here, the stage) and derives height from that — it never caps by
      // height. In fullscreen the stage is full-screen-wide, so the book grows
      // until its height overflows the viewport and the top/bottom get clipped.
      //
      // The library exposes no update() method; it only recalculates on a
      // window 'resize'. So the fix is: while fullscreen, give the stage an
      // EXPLICIT width that keeps the page height within the available height,
      // then dispatch a synthetic resize so StPageFlip re-fits to it. A guard
      // flag stops the synthetic resize from re-entering this handler.
      let adjusting = false;
      function applyFsFit(){
        if(adjusting) return;
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        const isFs = (!!fsEl && (fsEl === wrap || wrap.contains(fsEl) || fsEl.contains(wrap)))
                     || wrap.classList.contains('rsp-fs-sim');
        if(!isFs){
          stage.style.width = '';
          stage.style.height = '';
          stage.style.maxWidth = '';
          stage.style.margin = '';
        } else {
          const controlsEl = wrap.querySelector('.rsp-flipbook-controls');
          const controlsH = controlsEl ? controlsEl.offsetHeight : 56;
          const availH = Math.max(220, window.innerHeight - controlsH - 8);
          const availW = Math.max(220, window.innerWidth - 8);
          // 2-page when height-constrained 2-page width fits within availW (desktop);
          // single-page otherwise (tablets where portrait pages can't span the full width).
          const twoUpW = availH * aspect * 2;
          const across = (twoUpW <= availW) ? 2 : 1;
          const bookW = Math.floor(Math.min(availW, availH * aspect * across));
          stage.style.width = bookW + 'px';
          // Explicit height lets StPageFlip read container dimensions for portrait/landscape mode:
          // across=1 → bookW < availH (portrait container) → 1 page
          // across=2 → bookW > availH (landscape container) → 2 pages
          stage.style.height = availH + 'px';
          stage.style.maxWidth = 'none';
          stage.style.margin = '0 auto';
        }
        adjusting = true;
        try{ window.dispatchEvent(new Event('resize')); }catch(e){}
        adjusting = false;
      }
      // enterSimFs/exitSimFs/toggleFs defined here (inside buildFlip) so applyFsFit is in scope
      function enterSimFs(){ wrap.classList.add('rsp-fs-sim'); applyFsFit(); }
      function exitSimFs(){ wrap.classList.remove('rsp-fs-sim'); applyFsFit(); }
      function toggleFs(){
        var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        if(fsEl){
          if(document.exitFullscreen) document.exitFullscreen();
          else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
        } else if(wrap.classList.contains('rsp-fs-sim')){
          exitSimFs();
        } else {
          if(wrap.requestFullscreen){
            wrap.requestFullscreen().catch(function(){ enterSimFs(); });
          } else if(wrap.webkitRequestFullscreen){
            wrap.webkitRequestFullscreen();
          } else {
            enterSimFs();
          }
        }
      }
      // Delay native fullscreen handler so the viewport has finished expanding
      function onFsChange(){ setTimeout(applyFsFit, 50); }
      function onEscSim(e){ if(e.key === 'Escape' && wrap.classList.contains('rsp-fs-sim')) exitSimFs(); }
      document.addEventListener('fullscreenchange', onFsChange);
      document.addEventListener('webkitfullscreenchange', onFsChange);
      document.addEventListener('keydown', onEscSim);
      window.addEventListener('resize', applyFsFit);
      cleanupFns.push(function(){
        document.removeEventListener('fullscreenchange', onFsChange);
        document.removeEventListener('webkitfullscreenchange', onFsChange);
        document.removeEventListener('keydown', onEscSim);
        window.removeEventListener('resize', applyFsFit);
      });

      // open on resume page if provided
      if(opts.startPage && opts.startPage > 0){
        try{ pageFlip.turnToPage(Math.min(opts.startPage, total - 1)); }catch(e){}
      }
      report();
    }

    // ── fallback: simple prev/next image reader (no library) ──
    function buildFallback(){
      container.innerHTML = '';
      const wrap = el('div', 'rsp-flipbook');
      const stage = el('div', 'rsp-flipbook-stage');
      wrap.appendChild(stage);
      container.appendChild(wrap);

      let cur = Math.max(0, opts.startPage || 0);
      let activeIframe = null;
      function show(){
        const item = pageItems[cur];
        const oneBased = cur + 1;
        if(oneBased > highest) highest = oneBased;
        chrome.refresh(oneBased, highest);
        onPage(oneBased, highest, total);
        if(activeIframe){ activeIframe.src = 'about:blank'; activeIframe = null; }
        stage.innerHTML = '';
        if(item.type === 'video'){
          const vwrap = buildVideoPageContent(loomEmbedUrl(item.url), item.title);
          vwrap.style.cssText = 'width:100%;min-height:340px;';
          activeIframe = vwrap.querySelector('iframe');
          stage.appendChild(vwrap);
        } else {
          const img = new Image();
          img.className = 'rsp-flipbook-page';
          img.style.maxWidth = '100%';
          img.style.maxHeight = '70vh';
          img.style.objectFit = 'contain';
          img.style.background = '#fff';
          img.style.borderRadius = '8px';
          img.src = item.url;
          stage.appendChild(img);
        }
      }
      const chrome = buildChrome(wrap, {
        prev: function(){ if(cur > 0){ cur--; show(); } },
        next: function(){ if(cur < total - 1){ cur++; show(); } }
      });
      show();
    }

    return {
      destroy: function(){
        destroyed = true;
        cleanupFns.forEach(function(fn){ try{ fn(); }catch(e){} });
        cleanupFns.length = 0;
        try{ if(pageFlip) pageFlip.destroy(); }catch(e){}
        container.innerHTML = '';
      }
    };
  }

  window.RSPFlipbook = { mount: mount, showLoading: showLoading, showMessage: showMessage };
})();
