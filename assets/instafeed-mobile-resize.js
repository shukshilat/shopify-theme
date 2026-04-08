(function () {
  function isMobileViewport() {
    return window.matchMedia('(max-width: 749px)').matches;
  }

  function hasInstagramMedia(root) {
    if (!root || root.nodeType !== 1) return false;
    var media = root.querySelectorAll('img, video, iframe');
    for (var i = 0; i < media.length; i += 1) {
      var el = media[i];
      var src = (el.currentSrc || el.src || el.getAttribute('src') || '').toLowerCase();
      if (!src) continue;
      if (src.indexOf('instagram') !== -1 || src.indexOf('cdninstagram') !== -1 || src.indexOf('fbcdn') !== -1) {
        return true;
      }
    }
    return false;
  }

  function isLikelyOverlay(el) {
    if (!el || el.nodeType !== 1) return false;
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
    var z = Number(cs.zIndex);
    if (Number.isFinite(z) && z < 100) return false;
    var rect = el.getBoundingClientRect();
    return rect.width >= window.innerWidth * 0.7 && rect.height >= window.innerHeight * 0.6;
  }

  function applyMobileContainStyles(overlay) {
    if (!overlay || overlay.dataset.instaMobileSized === 'true') return;
    overlay.dataset.instaMobileSized = 'true';

    overlay.style.padding =
      'calc(env(safe-area-inset-top, 0px) + 8px) calc(env(safe-area-inset-right, 0px) + 8px) calc(env(safe-area-inset-bottom, 0px) + 8px) calc(env(safe-area-inset-left, 0px) + 8px)';
    overlay.style.boxSizing = 'border-box';

    var media = overlay.querySelectorAll('img, video, iframe');
    media.forEach(function (el) {
      el.style.width = 'auto';
      el.style.height = 'auto';
      el.style.maxWidth =
        'calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 16px)';
      el.style.maxHeight =
        'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 80px)';
      el.style.objectFit = 'contain';
      el.style.margin = '0 auto';
      el.style.display = 'block';
    });
  }

  function scanAndResize() {
    if (!isMobileViewport()) return;
    var candidates = document.querySelectorAll('[role="dialog"], .modal, .lightbox, div, section');
    candidates.forEach(function (el) {
      if (!isLikelyOverlay(el)) return;
      if (!hasInstagramMedia(el)) return;
      applyMobileContainStyles(el);
    });
  }

  var observer = new MutationObserver(function () {
    scanAndResize();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      scanAndResize();
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    });
  } else {
    scanAndResize();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  }

  window.addEventListener('resize', scanAndResize);
})();
