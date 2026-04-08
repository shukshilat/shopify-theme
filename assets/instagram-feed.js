(function () {
  function safeExternalUrl(value) {
    if (!value || typeof value !== 'string') return '';
    var trimmed = value.trim();
    if (!trimmed) return '';
    try {
      var parsed = new URL(trimmed, window.location.origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch (e) {
      return '';
    }
  }

  function postTargetUrl(item) {
    return safeExternalUrl(item && item.permalink) || safeExternalUrl(item && item.media_url) || '';
  }

  function truncate(text, maxLen) {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen).trim() + '...';
  }

  function createMediaNode(item) {
    if (item.media_type === 'VIDEO') {
      var video = document.createElement('video');
      video.className = 'instagram-feed__video';
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      if (item.thumbnail_url) video.poster = item.thumbnail_url;
      video.src = item.media_url;
      return video;
    }

    var image = document.createElement('img');
    image.className = 'instagram-feed__image';
    image.src = item.media_url;
    image.alt = item.caption ? truncate(item.caption, 90) : 'Instagram post';
    image.loading = 'lazy';
    return image;
  }

  function bindSafeLinkOpen(gridEl) {
    if (!gridEl || gridEl.dataset.instagramClickBound === 'true') return;
    gridEl.dataset.instagramClickBound = 'true';

    gridEl.addEventListener('click', function (event) {
      var link = event.target.closest('.instagram-feed__media-link[href]');
      if (!link || !gridEl.contains(link)) return;

      var href = safeExternalUrl(link.getAttribute('href'));
      if (!href) return;

      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      event.stopPropagation();

      try {
        var opened = window.open(href, '_blank', 'noopener,noreferrer');
        if (!opened) window.location.assign(href);
      } catch (e) {
        window.location.assign(href);
      }
    }, true);
  }

  async function loadFeed(root) {
    var accessToken = root.dataset.accessToken || '';
    var limit = Number(root.dataset.limit || '9');
    var section = root.closest('.instagram-feed');
    var statusEl = section ? section.querySelector('[data-instagram-status]') : null;
    var gridEl = root;

    if (!accessToken) {
      if (statusEl) statusEl.hidden = false;
      return;
    }

    try {
      var params = new URLSearchParams({
        fields: 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp',
        limit: String(limit),
        access_token: accessToken,
      });
      var response = await fetch('https://graph.instagram.com/me/media?' + params.toString(), {
        method: 'GET',
      });
      if (!response.ok) throw new Error('Instagram request failed');
      var json = await response.json();
      var items = (json && json.data) || [];

      if (!items.length) {
        if (statusEl) statusEl.hidden = false;
        return;
      }

      if (statusEl) statusEl.hidden = true;
      gridEl.innerHTML = '';
      bindSafeLinkOpen(gridEl);

      items.forEach(function (item) {
        var article = document.createElement('article');
        article.className = 'instagram-feed__item';
        var targetUrl = postTargetUrl(item);
        var mediaNode = createMediaNode(item);

        if (targetUrl) {
          var link = document.createElement('a');
          link.className = 'instagram-feed__media-link';
          link.href = targetUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.appendChild(mediaNode);
          article.appendChild(link);
        } else {
          var mediaWrapper = document.createElement('div');
          mediaWrapper.className = 'instagram-feed__media-link instagram-feed__media-link--static';
          mediaWrapper.appendChild(mediaNode);
          article.appendChild(mediaWrapper);
        }

        if (item.caption) {
          var caption = document.createElement('p');
          caption.className = 'instagram-feed__caption';
          caption.textContent = truncate(item.caption, 120);
          article.appendChild(caption);
        }

        gridEl.appendChild(article);
      });
    } catch (err) {
      if (statusEl) statusEl.hidden = false;
    }
  }

  function initInstagramFeeds() {
    document.querySelectorAll('[data-instagram-feed]').forEach(loadFeed);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInstagramFeeds);
  } else {
    initInstagramFeeds();
  }
})();
