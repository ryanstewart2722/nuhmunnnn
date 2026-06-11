// ═══════════════════════════════════════════════════════════════════
//  GALLERY / LIGHTBOX
//  Requires window.GALLERY_IMAGES = [{src, caption, w, h}, ...]
//  defined on the page before this script loads.
// ═══════════════════════════════════════════════════════════════════
;(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────
  var THUMB_H     = 88;            // filmstrip thumb height (px)
  var THUMB_GAP   = 12;            // gap between thumbs
  var HI_PAD      = 7;             // padding inside highlight box
  var HI_H        = THUMB_H + HI_PAD * 2;  // 102px highlight height
  var STRIP_AREA  = HI_H + 57;     // total bottom bar height (strip + caption row, +35px lift)
  var MAX_W_PCT   = 0.90;          // max display width fraction of overlay
  var MAX_H_PCT   = 0.90;          // max display height fraction of available
  var LERP        = 0.13;          // filmstrip lerp factor
  var CENTER_ZONE = 0.14;          // center-zone width fraction for slideshows
  var SNAP_DELAY  = 150;           // ms after drag release before snap
  var DIM_OPACITY = '0.55';        // opacity for non-selected thumbnails

  // ── State ────────────────────────────────────────────────────────────
  var overlay, mainArea, mainImg, galCursor, captionEl, counterEl;
  var filmWrap, filmStrip, highlightEl;
  var scrollBlocker;
  var thumbEls = [], thumbWidths = [], thumbOffsets = [];
  var images = [];
  var curIdx   = 0;
  var stripX   = 0, targetX = 0;
  var rafId    = null;
  var dragging = false, dragMoved = false;
  var downTarget = null;
  var dragStartClientX = 0, dragStartTargetX = 0;
  var lastVel = 0, lastDragX = 0, lastDragT = 0;
  var snapTimer = null;
  var built = false;

  // ── Tiny helpers ─────────────────────────────────────────────────────
  function mk(tag, css, txt) {
    var d = document.createElement(tag);
    if (css) d.style.cssText = css;
    if (txt !== undefined) d.textContent = txt;
    return d;
  }

  function getImgSrc(el) {
    var bg = el.style.backgroundImage || '';
    var m  = bg.match(/url\(["']?([^"')]+)["']?\)/);
    return m ? m[1] : '';
  }

  function norm(src) { return src.replace(/^\.\//, ''); }

  // ── Build overlay (once) ─────────────────────────────────────────────
  function build() {
    if (built) return;
    built = true;

    // Gallery sits inside all 4 fixed gray strips
    // Full-viewport scroll blocker — sits behind overlay, blocks wheel events on grey strips
    scrollBlocker = mk('div',
      'position:fixed;top:0;bottom:0;left:0;right:0;z-index:899;display:none;pointer-events:none;'
    );
    document.body.appendChild(scrollBlocker);

    overlay = mk('div',
      'position:fixed;top:28px;bottom:28px;left:15px;right:15px;z-index:900;' +
      'background:#ffffff;' +
      'display:none;opacity:0;' +
      'transition:opacity 0.2s ease;' +
      'font-family:ABCDiatype,Arial,sans-serif;font-size:10px;color:#1a1a1a;'
    );

    // Sync overlay background with party mode
    var partyObs = new MutationObserver(function() {
      if (document.body.classList.contains('party')) {
        overlay.style.background = document.body.style.backgroundColor || '#ffffff';
      } else {
        overlay.style.background = '#ffffff';
      }
    });
    partyObs.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });

    // Close — top right
    var closeBtn = mk('div',
      'position:absolute;top:9px;right:24px;cursor:pointer;z-index:10;user-select:none;',
      'Close'
    );
    closeBtn.addEventListener('mouseenter', function () { closeBtn.style.opacity = '0.45'; });
    closeBtn.addEventListener('mouseleave', function () { closeBtn.style.opacity = '1';    });
    closeBtn.onclick = close;
    overlay.appendChild(closeBtn);

    // Main image area (fills gallery from top to above filmstrip)
    mainArea = mk('div',
      'position:absolute;top:0;left:0;right:0;' +
      'bottom:' + STRIP_AREA + 'px;' +
      'display:flex;align-items:center;justify-content:center;'
    );

    mainImg = mk('div',
      'background-size:cover;background-position:center;background-repeat:no-repeat;' +
      'pointer-events:none;transition:opacity 0.1s ease;'
    );

    // Cursor for Prev/Next — covers entire main area
    galCursor = mk('div',
      'position:fixed;pointer-events:none;z-index:9999;' +
      'font-size:10px;color:#fff;mix-blend-mode:difference;' +
      'transform:translate(-50%,-50%);display:none;white-space:nowrap;'
    );
    document.body.appendChild(galCursor);

    // Cursor + click on the full main area (left half = Prev, right half = Next)
    mainArea.style.cursor = 'none';
    mainArea.addEventListener('mousemove', function (e) {
      galCursor.style.display = 'block';
      galCursor.style.left = e.clientX + 'px';
      galCursor.style.top  = e.clientY + 'px';
      var mid = (overlay.offsetWidth || window.innerWidth) / 2;
      galCursor.textContent = e.clientX < mid ? 'Prev' : 'Next';
    });
    mainArea.addEventListener('mouseleave', function () { galCursor.style.display = 'none'; });
    mainArea.addEventListener('click', function (e) {
      var mid = (overlay.offsetWidth || window.innerWidth) / 2;
      goTo(e.clientX < mid ? curIdx - 1 : curIdx + 1);
    });

    mainArea.appendChild(mainImg);
    overlay.appendChild(mainArea);

    // Bottom strip bar
    var bottom = mk('div',
      'position:absolute;bottom:0;left:0;right:0;height:' + STRIP_AREA + 'px;'
    );

    // Filmstrip wrapper (clips overflow)
    filmWrap = mk('div',
      'position:absolute;top:0;left:0;right:0;height:' + HI_H + 'px;overflow:hidden;'
    );

    // Highlight box — sharp corners, 1px black border
    highlightEl = mk('div',
      'position:absolute;top:0;height:' + HI_H + 'px;' +
      'border:1px solid #1a1a1a;' +
      'pointer-events:none;z-index:6;' +
      'transition:width 0.12s ease,left 0.12s ease;'
    );

    // Filmstrip
    filmStrip = mk('div',
      'position:absolute;top:' + HI_PAD + 'px;left:0;' +
      'display:flex;align-items:center;gap:' + THUMB_GAP + 'px;' +
      'will-change:transform;cursor:grab;z-index:5;height:' + THUMB_H + 'px;'
    );

    filmWrap.appendChild(highlightEl);
    filmWrap.appendChild(filmStrip);

    // Caption + counter
    captionEl = mk('div', 'position:absolute;bottom:14px;left:24px;');
    counterEl = mk('div', 'position:absolute;bottom:14px;right:24px;');

    bottom.appendChild(filmWrap);
    bottom.appendChild(captionEl);
    bottom.appendChild(counterEl);
    overlay.appendChild(bottom);
    document.body.appendChild(overlay);

    buildThumbs();
    setupDrag();

    document.addEventListener('keydown', function (e) {
      if (!overlay || overlay.style.display === 'none') return;
      if (e.key === 'ArrowRight') goTo(curIdx + 1);
      if (e.key === 'ArrowLeft')  goTo(curIdx - 1);
      if (e.key === 'Escape')     close();
    });

    // Wheel scroll — document-level capture so grey strips don't leak through
    var wheelTimer = null;
    function onWheel(e) {
      if (!overlay || overlay.style.display === 'none') return;
      e.preventDefault();
      var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      targetX -= delta;
      clamp();

      var ovW    = overlay.offsetWidth || window.innerWidth;
      var center = ovW / 2;
      var best = curIdx, bestD = Infinity;
      thumbOffsets.forEach(function (cx, i) {
        var d = Math.abs(cx + targetX - center);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best !== curIdx) { curIdx = best; updateDisplay(best); }

      tickRAF();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function () { snapNearest(); }, 150);
    }
    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
  }

  // ── Thumbnails ───────────────────────────────────────────────────────
  function buildThumbs() {
    filmStrip.innerHTML = '';
    thumbEls = []; thumbWidths = []; thumbOffsets = [];
    var x = 0;
    images.forEach(function (img, i) {
      var tw = Math.round(THUMB_H * img.w / img.h);
      thumbWidths.push(tw);
      thumbOffsets.push(x + tw / 2);
      x += tw + THUMB_GAP;

      var t = mk('div',
        'flex-shrink:0;' +
        'width:'  + tw      + 'px;' +
        'height:' + THUMB_H + 'px;' +
        'background-color:#e0e0e0;' +
        'background-image:url("' + img.src + '");' +
        'background-size:cover;background-position:center;' +
        'outline:1px solid rgba(0,0,0,0.10);' +
        'cursor:pointer;' +
        'opacity:0;filter:blur(12px);transition:none;'
      );
      // Blur-in on load
      (function (el, src) {
        var loader = new Image();
        loader.onload = function () {
          el.style.transition = 'filter 0.35s ease, opacity 0.35s ease';
          el.style.filter  = 'blur(0px)';
          el.style.opacity = DIM_OPACITY;
          el._loaded = true;
        };
        loader.src = src;
      }(t, img.src));
      filmStrip.appendChild(t);
      thumbEls.push(t);
    });
  }

  // ── Display update (main image + filmstrip visuals, no scroll) ────────
  function updateDisplay(idx) {
    var img  = images[idx];
    var ovW  = overlay.offsetWidth  || window.innerWidth;
    var ovH  = overlay.offsetHeight || (window.innerHeight - 56);
    var availW = ovW * MAX_W_PCT;
    var availH = (ovH - STRIP_AREA - 20) * MAX_H_PCT;
    var scale  = Math.min(availW / img.w, availH / img.h);
    var dw = Math.round(img.w * scale);
    var dh = Math.round(img.h * scale);

    mainImg.style.width           = dw + 'px';
    mainImg.style.height          = dh + 'px';

    // Blur-in main image on each navigation
    mainImg.style.transition = 'none';
    mainImg.style.opacity    = '0';
    mainImg.style.filter     = 'blur(14px)';
    var mainLoader = new Image();
    mainLoader.onload = function () {
      mainImg.style.backgroundImage = "url('" + img.src + "')";
      requestAnimationFrame(function () {
        mainImg.style.transition = 'filter 0.25s ease, opacity 0.25s ease';
        mainImg.style.filter  = 'blur(0px)';
        mainImg.style.opacity = '1';
      });
    };
    mainLoader.src = img.src;

    captionEl.textContent = img.caption || '';
    counterEl.textContent = (idx + 1) + '/' + images.length;

    thumbEls.forEach(function (t, i) {
      // Only update opacity on thumbs that have already loaded
      if (!t._loaded) return;
      t.style.transition = 'opacity 0.15s ease';
      t.style.opacity = i === idx ? '1' : DIM_OPACITY;
    });

    // Highlight: adapt width to selected thumb
    var tw = thumbWidths[idx];
    var hw = tw + HI_PAD * 2;
    highlightEl.style.width = hw + 'px';
    highlightEl.style.left  = (ovW / 2 - hw / 2) + 'px';
  }

  // ── Drag ─────────────────────────────────────────────────────────────
  function setupDrag() {
    filmWrap.addEventListener('pointerdown', function (e) {
      dragging     = true;
      dragMoved    = false;
      downTarget   = e.target;
      dragStartClientX = e.clientX;
      dragStartTargetX = targetX;
      lastDragX    = e.clientX;
      lastDragT    = Date.now();
      lastVel      = 0;
      filmStrip.style.cursor = 'grabbing';
      filmWrap.setPointerCapture(e.pointerId);
      clearTimeout(snapTimer);
      e.preventDefault();
    });

    filmWrap.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragStartClientX;
      if (Math.abs(dx) > 4) dragMoved = true;
      targetX = dragStartTargetX + dx;
      clamp();

      // ── Live nearest-neighbor: update display as thumb slides under center ──
      var ovW    = overlay.offsetWidth || window.innerWidth;
      var center = ovW / 2;
      var best = curIdx, bestD = Infinity;
      thumbOffsets.forEach(function (cx, i) {
        var d = Math.abs(cx + targetX - center);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best !== curIdx) {
        curIdx = best;
        updateDisplay(best);
      }

      var now = Date.now(), dt = now - lastDragT;
      if (dt > 0) lastVel = (e.clientX - lastDragX) / dt * 16;
      lastDragX = e.clientX;
      lastDragT = now;
      tickRAF();
    });

    filmWrap.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      filmStrip.style.cursor = 'grab';

      // Tap (no meaningful drag) → navigate to tapped thumb
      if (!dragMoved) {
        var idx = thumbEls.indexOf(downTarget);
        if (idx >= 0) { goTo(idx); return; }
      }

      // Fling + snap
      targetX += lastVel * 5;
      clamp();
      snapTimer = setTimeout(snapNearest, SNAP_DELAY);
      tickRAF();
    });
  }

  function clamp() {
    if (!thumbOffsets.length) return;
    var ovW = overlay.offsetWidth || window.innerWidth;
    var max =  ovW / 2 - thumbOffsets[0];
    var min =  ovW / 2 - thumbOffsets[images.length - 1];
    targetX = Math.max(min, Math.min(max, targetX));
  }

  function snapNearest() {
    var ovW    = overlay.offsetWidth || window.innerWidth;
    var center = ovW / 2;
    var best = curIdx, bestD = Infinity;
    thumbOffsets.forEach(function (cx, i) {
      var d = Math.abs(cx + targetX - center);
      if (d < bestD) { bestD = d; best = i; }
    });
    goTo(best);
  }

  // ── RAF ──────────────────────────────────────────────────────────────
  function tickRAF() {
    if (rafId) return;
    rafId = requestAnimationFrame(raf);
  }

  function raf() {
    var diff = targetX - stripX;
    if (!dragging && Math.abs(diff) < 0.25) {
      stripX = targetX;
      filmStrip.style.transform = 'translateX(' + Math.round(stripX) + 'px)';
      rafId = null;
      return;
    }
    stripX += diff * LERP;
    filmStrip.style.transform = 'translateX(' + Math.round(stripX) + 'px)';
    rafId = requestAnimationFrame(raf);
  }

  // ── Navigate ─────────────────────────────────────────────────────────
  function goTo(idx) {
    if (!images.length) return;
    idx    = Math.max(0, Math.min(images.length - 1, idx));
    curIdx = idx;

    updateDisplay(idx);

    // Scroll filmstrip to center selected thumb
    var ovW = overlay.offsetWidth || window.innerWidth;
    targetX = ovW / 2 - thumbOffsets[idx];
    clamp();
    tickRAF();
  }

  // ── Open / Close ─────────────────────────────────────────────────────
  function open(idx) {
    images = window.GALLERY_IMAGES || [];
    if (!images.length) return;
    build();
    if (images.length !== thumbEls.length) buildThumbs();

    idx = Math.max(0, Math.min(images.length - 1, idx || 0));

    // Hard-position strip before showing so it doesn't animate from 0
    var ovW = overlay.offsetWidth || window.innerWidth;
    if (!ovW) ovW = window.innerWidth;
    var tx = ovW / 2 - (thumbOffsets[idx] || 0);
    if (thumbOffsets.length) {
      var maxX = ovW / 2 - thumbOffsets[0];
      var minX = ovW / 2 - thumbOffsets[images.length - 1];
      tx = Math.max(minX, Math.min(maxX, tx));
    }
    stripX  = tx;
    targetX = tx;
    filmStrip.style.transform = 'translateX(' + Math.round(tx) + 'px)';

    var scrollEl = document.getElementById('card-scroll') || document.body;
    var savedScrollTop = scrollEl.scrollTop;
    // Lock scroll: overflow hidden + force-reset on any scroll event (beats macOS momentum)
    scrollEl.style.overflowY = 'hidden';
    scrollEl.scrollTop = savedScrollTop;
    function lockScroll() { scrollEl.scrollTop = savedScrollTop; }
    scrollEl.addEventListener('scroll', lockScroll);
    scrollEl._lockScroll = lockScroll;
    scrollEl._savedScrollTop = savedScrollTop;
    scrollBlocker.style.display = 'block';
    overlay.style.display = 'block';
    requestAnimationFrame(function () { overlay.style.opacity = '1'; });
    goTo(idx);
  }

  function close() {
    if (!overlay) return;
    overlay.style.opacity = '0';
    scrollBlocker.style.display = 'none';
    var scrollEl = document.getElementById('card-scroll') || document.body;
    scrollEl.style.overflowY = '';
    if (scrollEl._lockScroll) {
      scrollEl.removeEventListener('scroll', scrollEl._lockScroll);
      scrollEl._lockScroll = null;
    }
    scrollEl.scrollTop = scrollEl._savedScrollTop || 0;
    setTimeout(function () { overlay.style.display = 'none'; }, 200);
    if (galCursor) galCursor.style.display = 'none';
  }

  // ── Wire up page image clicks ─────────────────────────────────────────
  function wireUp() {
    var imgs = window.GALLERY_IMAGES;
    if (!imgs || !imgs.length) return;

    var srcMap = {};
    imgs.forEach(function (img, i) { srcMap[norm(img.src)] = i; });

    function idxFor(el) {
      var src = norm(getImgSrc(el));
      return srcMap.hasOwnProperty(src) ? srcMap[src] : -1;
    }

    // Static images
    document.querySelectorAll('.img-slot:not(.ss)').forEach(function (el) {
      if (el.closest('#m-next') || el.id === 'card-also-img') return;
      var idx = idxFor(el);
      if (idx < 0) return;
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        open(idx);
      });
    });

    // Slideshows: center zone opens gallery, cursor shows "View"
    var ssCursor = document.getElementById('ss-cursor');

    document.querySelectorAll('.img-slot.ss').forEach(function (ssEl) {
      if (ssEl.closest('#m-next')) return;

      ssEl.addEventListener('mousemove', function (e) {
        var r   = ssEl.getBoundingClientRect();
        var pct = (e.clientX - r.left) / r.width;
        if (Math.abs(pct - 0.5) <= CENTER_ZONE / 2) {
          if (ssCursor) ssCursor.style.display = 'none';
          if (galCursor) {
            galCursor.style.display = 'block';
            galCursor.style.left    = e.clientX + 'px';
            galCursor.style.top     = e.clientY + 'px';
            galCursor.textContent   = 'View';
          }
        } else {
          if (galCursor) galCursor.style.display = 'none';
        }
      });
      ssEl.addEventListener('mouseleave', function () {
        if (galCursor) galCursor.style.display = 'none';
      });

      // Capture phase: intercept center-zone clicks before slideshow handler
      ssEl.addEventListener('click', function (e) {
        var r   = ssEl.getBoundingClientRect();
        var pct = (e.clientX - r.left) / r.width;
        if (Math.abs(pct - 0.5) <= CENTER_ZONE / 2) {
          e.stopImmediatePropagation();
          var idx = idxFor(ssEl);
          open(idx >= 0 ? idx : 0);
        }
      }, true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireUp);
  } else {
    wireUp();
  }

  window.openGallery  = open;
  window.closeGallery = close;

}());
