(function () {
  var bar = document.getElementById('status-bar');
  if (!bar) return;

  var hints = window.STATUS_HINTS || [];

  function findHint(el) {
    var cur = el;
    while (cur && cur !== document.documentElement) {
      // data-status attribute (e.g. minimap dots)
      if (cur.dataset && cur.dataset.status) {
        return { label: cur.dataset.status, animate: false };
      }
      // Static hints from STATUS_HINTS (e.g. party toggle)
      for (var i = 0; i < hints.length; i++) {
        var h = hints[i];
        try {
          if (cur.matches && cur.matches(h.selector)) {
            return { label: h.label, animate: !!h.animate };
          }
        } catch (e) {}
      }
      // <a> link → show text content; animate if #nav-center
      if (cur.tagName === 'A') {
        // .card-link (focused product overlay) → show product name from sibling .m-name
        if (cur.classList && cur.classList.contains('card-link')) {
          var card = cur.parentElement;
          if (card) {
            var name = card.querySelector('.m-name');
            if (name) return { label: name.textContent.trim(), animate: false };
          }
          return null;
        }
        // .cat-card (catalogue view) → show .m-name
        if (cur.classList && cur.classList.contains('cat-card')) {
          var catName = cur.querySelector('.m-name');
          if (catName) return { label: catName.textContent.trim(), animate: false };
          return null;
        }
        var text = cur.textContent.trim();
        if (text) return { label: text, animate: cur.id === 'nav-center' };
      }
      // .img-slot → find caption <p> in parent .mod
      if (cur.classList && cur.classList.contains('img-slot')) {
        var mod = cur.closest ? cur.closest('.mod') : null;
        if (mod) {
          var p = mod.querySelector('p');
          if (p) return { label: p.textContent.trim(), animate: false };
        }
      }
      cur = cur.parentElement;
    }
    return null;
  }

  document.addEventListener('mousemove', function (e) {
    var h = findHint(e.target);
    if (h) {
      bar.textContent = h.label;
      bar.style.animation = h.animate ? 'hue-cycle 1.5s linear infinite' : '';
    } else {
      bar.textContent = e.clientX + ', ' + e.clientY;
      bar.style.animation = '';
    }
  });
})();
