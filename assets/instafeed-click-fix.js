(function () {
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

  document.addEventListener(
    'click',
    function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (!inInstafeedContext(target)) return;

      var link = target.closest('a[href]');
      if (!link) return;

      var href = normalizeUrl(link.getAttribute('href'));
      if (!href) return;

      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      event.stopPropagation();

      window.location.assign(href);
    },
    true
  );
})();
