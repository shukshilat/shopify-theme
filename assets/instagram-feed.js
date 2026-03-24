(function () {
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

  async function loadFeed(root) {
    var accessToken = root.dataset.accessToken || '';
    var limit = Number(root.dataset.limit || '9');
    var statusEl = root.querySelector('[data-instagram-status]');
    var gridEl = root.querySelector('[data-instagram-grid]');

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
      if (!gridEl) return;
      gridEl.innerHTML = '';

      items.forEach(function (item) {
        var article = document.createElement('article');
        article.className = 'instagram-feed__item';

        var link = document.createElement('a');
        link.className = 'instagram-feed__media-link';
        link.href = item.permalink;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.appendChild(createMediaNode(item));
        article.appendChild(link);

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
