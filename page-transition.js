// Shared page-to-page transition — fade + blur out before navigating, fade + blur in on load.
// Since this is a plain multi-page site (not an SPA), a true cross-fade between old/new page
// content isn't possible; this instead blurs/fades the current page out, waits for that to
// finish, then navigates — timed so it reads as one continuous motion, not two separate cuts.
(function () {
  var DURATION_MS = 320; // placeholder — tune live

  var style = document.createElement('style');
  style.textContent =
    'body { transition: opacity ' + DURATION_MS + 'ms ease, filter ' + DURATION_MS + 'ms ease; }' +
    'body.page-transitioning { opacity: 0; filter: blur(12px); pointer-events: none; }';
  document.head.appendChild(style);

  // Start blurred/hidden, then fade in on load (two rAFs so the browser registers the
  // "before" state on its own frame before we transition to the "after" state).
  document.body.classList.add('page-transitioning');
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      document.body.classList.remove('page-transitioning');
    });
  });

  window.goTo = function (url) {
    if (!url) return;
    document.body.classList.add('page-transitioning');
    setTimeout(function () { window.location.href = url; }, DURATION_MS);
  };

  // Browser back/forward often restores the page from bfcache instead of re-running
  // this script — which means it comes back frozen in whatever state it was in the
  // instant it navigated away (i.e. still blurred/hidden from goTo() above, since a
  // fresh load never happens to trigger the fade-in rAFs). event.persisted is true
  // exactly on that restore, so force the visible state back on then.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      document.body.classList.remove('page-transitioning');
    }
  });

  // Generically intercept plain <a href="something.html"> clicks so every page's nav
  // links get the transition without editing each tag by hand. Pages with their own
  // custom click handling (e.g. products.html's cursor-driven clicks) already call
  // e.preventDefault() themselves before this bubbles up — e.defaultPrevented lets us
  // skip those instead of double-handling, since that code calls goTo() directly.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank') return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^([a-z]+:)?\/\//i.test(href) || href.indexOf('mailto:') === 0) return;
    e.preventDefault();
    goTo(a.href);
  });
})();
