/**
 * Auto-rotating hero (hero-slide-1…4). מחליף שקופיות אוטומטית.
 */
(function () {
  function clearTimer(root) {
    if (root._heroAssetTimer) {
      clearInterval(root._heroAssetTimer);
      root._heroAssetTimer = null;
    }
  }

  function init(root) {
    const viewport = root.querySelector('[data-hero-asset-viewport]');
    if (!viewport) return;

    const slides = [...viewport.querySelectorAll('.hero-asset-carousel__slide')];
    const dots = [...root.querySelectorAll('.hero-asset-carousel__dot')];
    if (slides.length < 2) return;

    clearTimer(root);

    let intervalMs = parseInt(viewport.getAttribute('data-interval-ms') || '5000', 10);
    if (Number.isNaN(intervalMs) || intervalMs < 2500) intervalMs = 5000;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      intervalMs = Math.max(intervalMs, 8000);
    }

    let index = slides.findIndex((el) => el.classList.contains('is-active'));
    if (index < 0) index = 0;

    function goTo(next) {
      const n = ((next % slides.length) + slides.length) % slides.length;
      slides[index].classList.remove('is-active');
      slides[index].setAttribute('aria-hidden', 'true');
      dots[index]?.classList.remove('is-active');
      dots[index]?.setAttribute('aria-selected', 'false');
      index = n;
      slides[index].classList.add('is-active');
      slides[index].setAttribute('aria-hidden', 'false');
      dots[index]?.classList.add('is-active');
      dots[index]?.setAttribute('aria-selected', 'true');
    }

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => goTo(i));
    });

    const inDesignMode = typeof Shopify !== 'undefined' && Shopify.designMode;

    if (!inDesignMode) {
      root._heroAssetTimer = setInterval(() => goTo(index + 1), intervalMs);

      viewport.addEventListener('mouseenter', () => clearTimer(root));
      viewport.addEventListener('mouseleave', () => {
        if (!root._heroAssetTimer) {
          root._heroAssetTimer = setInterval(() => goTo(index + 1), intervalMs);
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          clearTimer(root);
        } else if (!root._heroAssetTimer && !inDesignMode) {
          root._heroAssetTimer = setInterval(() => goTo(index + 1), intervalMs);
        }
      });
    }
  }

  function boot() {
    document.querySelectorAll('[data-hero-asset-carousel]').forEach(init);
  }

  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('shopify:section:load', (event) => {
    event.target.querySelectorAll('[data-hero-asset-carousel]').forEach(init);
  });
})();
