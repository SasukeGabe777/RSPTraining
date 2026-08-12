/**
 * RSP TRAINING PORTAL — FLIPBOOK CONVERSION PIPELINE (admin only)
 * ============================================================
 * Turns an admin-uploaded PDF into a set of optimized page images and
 * stores them in Supabase Storage, then records a flipbook config on
 * module_config so the employee viewer can load pre-rendered pages.
 *
 * WHY CLIENT-SIDE? This portal is a static site (no app server), so there
 * is no backend to run a conversion job on. We instead convert ONCE, in the
 * admin's browser at upload time, using pdf.js. Employees never render the
 * PDF — they only ever load the finished images. This is the practical
 * equivalent of server-side conversion for a server-less deployment.
 *
 * Depends on:
 *   - pdf.js (loaded lazily from cdnjs)
 *   - window.RSPCloud (cloud.js) for Storage uploads + config writes
 *
 * Public API: window.RSPFlipbookConvert.convertAndUpload(moduleId, file, opts)
 * ============================================================
 */
(function(){
  // ── tuning knobs (production-minded defaults) ──
  const MAX_PDF_BYTES   = 60 * 1024 * 1024;  // 60 MB upload cap
  const MAX_PAGES       = 120;               // refuse absurdly long PDFs
  const PAGE_MAX_W      = 1600;              // longest page edge for full image (px)
  const THUMB_MAX_W     = 320;               // thumbnail width (px)
  const JPEG_QUALITY    = 0.82;
  const WEBP_QUALITY    = 0.82;

  const PDFJS_VERSION = '3.11.174';
  const PDFJS_SRC     = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VERSION + '/pdf.min.js';
  const PDFJS_WORKER  = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VERSION + '/pdf.worker.min.js';

  let _pdfjsPromise = null;
  let _webpSupport = null;

  // Lazy-load pdf.js once and wire up its worker.
  function loadPdfjs(){
    if(_pdfjsPromise) return _pdfjsPromise;
    _pdfjsPromise = new Promise(function(resolve, reject){
      if(window.pdfjsLib){ resolve(window.pdfjsLib); return; }
      const s = document.createElement('script');
      s.src = PDFJS_SRC;
      s.onload = function(){
        if(window.pdfjsLib){
          try{ window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; }catch(e){}
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('pdf.js failed to initialize'));
        }
      };
      s.onerror = function(){ reject(new Error('Could not load pdf.js (network blocked?)')); };
      document.head.appendChild(s);
    });
    return _pdfjsPromise;
  }

  // Does this browser's canvas actually encode WebP? (Safari < 14 did not.)
  function supportsWebp(){
    if(_webpSupport !== null) return _webpSupport;
    try{
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      _webpSupport = c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }catch(e){ _webpSupport = false; }
    return _webpSupport;
  }

  function canvasToBlob(canvas, type, quality){
    return new Promise(function(resolve, reject){
      if(canvas.toBlob){
        canvas.toBlob(function(b){ b ? resolve(b) : reject(new Error('Encoding failed')); }, type, quality);
      } else {
        // Very old fallback via dataURL
        try{
          const data = canvas.toDataURL(type, quality);
          const bin = atob(data.split(',')[1]);
          const arr = new Uint8Array(bin.length);
          for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: type }));
        }catch(e){ reject(e); }
      }
    });
  }

  // Validate that the bytes really are a PDF — don't trust the extension.
  // PDFs begin with "%PDF-" within the first bytes.
  function looksLikePdf(arrayBuffer){
    const head = new Uint8Array(arrayBuffer.slice(0, 5));
    return head[0]===0x25 && head[1]===0x50 && head[2]===0x44 && head[3]===0x46 && head[4]===0x2D;
  }

  /**
   * Render one pdf.js page into a canvas, scaled so its longest edge is
   * <= maxW. Returns { blob, type, width, height }.
   */
  async function renderPageToBlob(page, maxW, quality){
    const base = page.getViewport({ scale: 1 });
    const longest = Math.max(base.width, base.height);
    const scale = Math.min(maxW / longest, 3); // never upscale past 3x source
    const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });

    const canvas = document.createElement('canvas');
    canvas.width  = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    // White matte so any transparent PDF content doesn't render black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    const useWebp = supportsWebp();
    const type = useWebp ? 'image/webp' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, type, quality);
    return { blob: blob, type: type, ext: useWebp ? 'webp' : 'jpg', width: canvas.width, height: canvas.height };
  }

  /**
   * Convert a PDF File into stored page images and write the flipbook config.
   *
   * @param {string} moduleId
   * @param {File}   file      the uploaded PDF
   * @param {object} opts      { updatedBy, onProgress(stage, pct, msg) }
   * @returns {Promise<object>} the saved flipbook record
   *
   * Status lifecycle written to module_config.flipbook.status:
   *   pending → processing → ready   (happy path)
   *                        → failed  (any error; message stored in .error)
   */
  async function convertAndUpload(moduleId, file, opts){
    opts = opts || {};
    const updatedBy = opts.updatedBy || 'admin';
    const progress = typeof opts.onProgress === 'function' ? opts.onProgress : function(){};

    if(!(window.RSPCloud && window.RSPCloud.isConfigured)){
      throw new Error('Supabase not connected — run supabase-migration-v5.sql and add your keys to cloud.js first.');
    }
    if(!file) throw new Error('No file provided.');

    // ── validate type + size (don't trust the extension alone) ──
    const buf = await file.arrayBuffer();
    if(!looksLikePdf(buf)){
      throw new Error('That file is not a valid PDF.');
    }
    if(file.size > MAX_PDF_BYTES){
      throw new Error('PDF is too large (' + (file.size/1048576).toFixed(1) + ' MB). Max is ' + (MAX_PDF_BYTES/1048576) + ' MB.');
    }

    const version = Date.now();
    const baseDir = moduleId + '/v' + version;

    // Write an early "processing" record so the admin (and any concurrent
    // viewer) can see that conversion has started.
    async function writeStatus(rec){
      try{ await window.RSPCloud.setFlipbook(moduleId, rec); }catch(e){ console.warn('flipbook status write failed:', e); }
    }
    let record = {
      status: 'processing',
      pdf_name: file.name,
      version: version,
      page_count: 0,
      page_urls: [],
      thumb_urls: [],
      updated_at: new Date().toISOString(),
      updated_by: updatedBy
    };
    progress('processing', 2, 'Validating and loading PDF…');
    await writeStatus(record);

    try{
      const pdfjsLib = await loadPdfjs();

      // 1) Store the original PDF (kept for re-download / re-processing).
      progress('processing', 6, 'Uploading original PDF…');
      const pdfBlob = new Blob([buf], { type: 'application/pdf' });
      const pdfUrl = await window.RSPCloud.uploadFlipbookAsset(baseDir + '/source.pdf', pdfBlob, 'application/pdf');
      record.pdf_url = pdfUrl;

      // 2) Parse the PDF.
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const pageCount = pdf.numPages;
      if(pageCount < 1) throw new Error('PDF has no pages.');
      if(pageCount > MAX_PAGES) throw new Error('PDF has ' + pageCount + ' pages; max supported is ' + MAX_PAGES + '.');
      record.page_count = pageCount;

      const pageUrls = new Array(pageCount);
      const thumbUrls = new Array(pageCount);
      let aspect = null;

      // 3) Render + upload each page (and a thumbnail) in order.
      for(let i = 1; i <= pageCount; i++){
        const page = await pdf.getPage(i);

        const full = await renderPageToBlob(page, PAGE_MAX_W, supportsWebp() ? WEBP_QUALITY : JPEG_QUALITY);
        if(aspect === null) aspect = full.width / full.height; // page-1 ratio drives the viewer
        const pagePath = baseDir + '/page-' + String(i).padStart(3, '0') + '.' + full.ext;
        pageUrls[i-1] = await window.RSPCloud.uploadFlipbookAsset(pagePath, full.blob, full.type);

        const thumb = await renderPageToBlob(page, THUMB_MAX_W, 0.7);
        const thumbPath = baseDir + '/thumb-' + String(i).padStart(3, '0') + '.' + thumb.ext;
        thumbUrls[i-1] = await window.RSPCloud.uploadFlipbookAsset(thumbPath, thumb.blob, thumb.type);

        page.cleanup && page.cleanup();

        const pct = 10 + Math.round((i / pageCount) * 85);
        progress('processing', pct, 'Converting page ' + i + ' of ' + pageCount + '…');

        // Periodically persist partial progress so a long job is recoverable
        // and the status UI stays honest.
        if(i % 5 === 0){
          record.page_urls = pageUrls.slice(0, i);
          record.thumb_urls = thumbUrls.slice(0, i);
          await writeStatus(record);
        }
      }

      // 4) Finalize the record as ready.
      record.page_urls = pageUrls;
      record.thumb_urls = thumbUrls;
      record.aspect = aspect || 0.7727; // sane default ~ US Letter portrait
      record.status = 'ready';
      record.error = null;
      record.updated_at = new Date().toISOString();
      progress('processing', 98, 'Finishing up…');
      await window.RSPCloud.setFlipbook(moduleId, record);
      progress('ready', 100, 'Flipbook ready — ' + pageCount + ' pages.');
      return record;

    }catch(err){
      record.status = 'failed';
      record.error = (err && err.message) ? err.message : String(err);
      record.updated_at = new Date().toISOString();
      await writeStatus(record);
      progress('failed', 100, 'Conversion failed: ' + record.error);
      throw err;
    }
  }

  window.RSPFlipbookConvert = {
    convertAndUpload: convertAndUpload,
    looksLikePdf: looksLikePdf,
    supportsWebp: supportsWebp,
    MAX_PDF_BYTES: MAX_PDF_BYTES,
    MAX_PAGES: MAX_PAGES
  };
})();
