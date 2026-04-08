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

  function firstValidUrl(values) {
    for (var i = 0; i < values.length; i += 1) {
      var normalized = normalizeUrl(values[i]);
      if (normalized) return normalized;
    }
    return '';
  }

  function pickFromSrcset(srcset) {
    if (!srcset) return '';
    var first = String(srcset).split(',')[0] || '';
    var url = first.trim().split(' ')[0];
    return normalizeUrl(url);
  }

  function detectMedia(target) {
    var mediaEl = target.closest('img,video');
    if (!mediaEl) {
      var wrapper = target.closest('a, article, li, div');
      if (wrapper) mediaEl = wrapper.querySelector('img,video');
    }
    if (!mediaEl) return null;

    if (mediaEl.tagName === 'VIDEO') {
      var videoSrc = firstValidUrl([mediaEl.currentSrc, mediaEl.src, mediaEl.getAttribute('src')]);
      if (!videoSrc) return null;
      return {
        type: 'video',
        src: videoSrc,
        poster: firstValidUrl([mediaEl.poster, mediaEl.getAttribute('poster')]),
        alt: '',
      };
    }

    var imageSrc = firstValidUrl([
      mediaEl.currentSrc,
      mediaEl.src,
      mediaEl.getAttribute('data-src'),
      pickFromSrcset(mediaEl.getAttribute('srcset')),
    ]);
    if (!imageSrc) return null;
    return {
      type: 'image',
      src: imageSrc,
      poster: '',
      alt: mediaEl.alt || '',
    };
  }

  function ensureModal() {
    var existing = document.getElementById('InstafeedInlineModal');
    if (existing) return existing;

    var style = document.createElement('style');
    style.id = 'InstafeedInlineModalStyle';
    style.textContent =
      '#InstafeedInlineModal{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.82);display:none;align-items:center;justify-content:center;padding:2rem}' +
      '#InstafeedInlineModal.is-open{display:flex}' +
      '#InstafeedInlineModal .insta-inline-modal__dialog{position:relative;max-width:min(92vw,900px);max-height:92vh;width:auto}' +
      '#InstafeedInlineModal .insta-inline-modal__close{position:absolute;top:.8rem;right:.8rem;border:0;border-radius:999px;background:#111;color:#fff;width:3.6rem;height:3.6rem;cursor:pointer;font-size:2rem;line-height:1}' +
      '#InstafeedInlineModal .insta-inline-modal__media{display:block;max-width:100%;max-height:90vh;border-radius:.8rem;background:#000}';
    document.head.appendChild(style);

    var modal = document.createElement('div');
    modal.id = 'InstafeedInlineModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Instagram post preview');
    modal.innerHTML =
      '<div class="insta-inline-modal__dialog">' +
      '<button type="button" class="insta-inline-modal__close" aria-label="Close">×</button>' +
      '<div class="insta-inline-modal__content"></div>' +
      '</div>';

    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.closest('.insta-inline-modal__close')) {
        closeModal();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    document.body.appendChild(modal);
    return modal;
  }

  function closeModal() {
    var modal = document.getElementById('InstafeedInlineModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    var content = modal.querySelector('.insta-inline-modal__content');
    if (content) content.innerHTML = '';
    document.body.classList.remove('overflow-hidden');
  }

  function openModalWithMedia(media) {
    if (!media || !media.src) return;
    var modal = ensureModal();
    var content = modal.querySelector('.insta-inline-modal__content');
    if (!content) return;
    content.innerHTML = '';

    if (media.type === 'video') {
      var video = document.createElement('video');
      video.className = 'insta-inline-modal__media';
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = 'metadata';
      if (media.poster) video.poster = media.poster;
      video.src = media.src;
      content.appendChild(video);
    } else {
      var image = document.createElement('img');
      image.className = 'insta-inline-modal__media';
      image.src = media.src;
      image.alt = media.alt || 'Instagram post';
      content.appendChild(image);
    }

    modal.classList.add('is-open');
    document.body.classList.add('overflow-hidden');
  }

  function cleanupPossibleAppModalArtifacts() {
    document.body.classList.remove('overflow-hidden');
    document.documentElement.classList.remove('overflow-hidden');
    document.querySelectorAll('.modal-overlay, .instafeed-overlay, .insta-modal-overlay').forEach(function (el) {
      el.style.display = 'none';
      el.setAttribute('hidden', 'hidden');
    });
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
      var media = detectMedia(target);
      if (media) openModalWithMedia(media);
    },
    true
  );
})();
