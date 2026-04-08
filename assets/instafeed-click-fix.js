(function () {
  var FALLBACK_PROFILE = 'https://www.instagram.com/sohkshilat/';

  function hasInstafeedMarker(el) {
    if (!el || el.nodeType !== 1) return false;
    var attrs = [el.id || '', el.className || '', el.getAttribute('data-type') || '', el.getAttribute('data-block-id') || '']
      .join(' ')
      .toLowerCase();
    return attrs.indexOf('instafeed') !== -1 || attrs.indexOf('instagram') !== -1;
  }

  function inInstafeedContext(target) {
    var current = target;
    while (current && current !== document.documentElement) {
      if (hasInstafeedMarker(current)) return true;
      current = current.parentElement;
    }
    return false;
  }

  function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    var trimmed = url.trim();
    if (!trimmed) return '';
    try {
      var parsed = new URL(trimmed, window.location.origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch (e) {
      return '';
    }
  }

  function firstValidUrl(values) {
    for (var i = 0; i < values.length; i += 1) {
      var normalized = normalizeUrl(values[i]);
      if (normalized) return normalized;
    }
    return '';
  }

  function cleanupPossibleAppModalArtifacts() {
    document.body.classList.remove('overflow-hidden');
    document.documentElement.classList.remove('overflow-hidden');
    document.querySelectorAll('.modal-overlay, .instafeed-overlay, .insta-modal-overlay').forEach(function (el) {
      el.style.display = 'none';
      el.setAttribute('hidden', 'hidden');
    });
  }

  function resolveInstafeedUrl(target) {
    var link = target.closest('a[href]');
    if (link) return firstValidUrl([link.getAttribute('href'), link.href]);

    var card = target.closest('[data-href], [data-url], [data-permalink], [data-link], [data-post-url]');
    if (card) {
      return firstValidUrl([
        card.getAttribute('data-href'),
        card.getAttribute('data-url'),
        card.getAttribute('data-permalink'),
        card.getAttribute('data-link'),
        card.getAttribute('data-post-url'),
      ]);
    }

    // Some app blocks place the URL on child nodes rather than the clicked node.
    var container = target.closest('[id*="instafeed"], [class*="instafeed"], [class*="instagram"]');
    if (container) {
      var candidate = container.querySelector('a[href], [data-href], [data-url], [data-permalink], [data-link], [data-post-url]');
      if (candidate) {
        return firstValidUrl([
          candidate.getAttribute('href'),
          candidate.getAttribute('data-href'),
          candidate.getAttribute('data-url'),
          candidate.getAttribute('data-permalink'),
          candidate.getAttribute('data-link'),
          candidate.getAttribute('data-post-url'),
        ]);
      }
    }

    return '';
  }

  document.addEventListener(
    'click',
    function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (!inInstafeedContext(target)) return;

      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      event.stopPropagation();

      cleanupPossibleAppModalArtifacts();
      var href = resolveInstafeedUrl(target) || FALLBACK_PROFILE;
      window.location.assign(href);
    },
    true
  );
})();
