/**
 * Auto-rotating hero from theme assets (hero-slide-1.png …).
 */
(function () {
  function init(root) {
    const viewport = root.querySelector('[data-hero-asset-viewport]');
    if (!viewport) return;

    const slides = [...viewport.querySelectorAll('.hero-asset-carousel__slide')];
    const dots = [...root.querySelectorAll('.hero-asset-carousel__dot')];
    if (slides.length < 2) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let intervalMs = parseInt(viewport.getAttribute('data-interval-ms') || '5000', 10);
    if (Number.isNaN(intervalMs) || intervalMs < 2000) intervalMs = 5000;

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

    if (reduceMotion) return;

    let timer = setInterval(() => goTo(index + 1), intervalMs);

    root.addEventListener('mouseenter', () => {
      clearInterval(timer);
      timer = null;
    });
    root.addEventListener('mouseleave', () => {
      if (!timer) timer = setInterval(() => goTo(index + 1), intervalMs);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-hero-asset-carousel]').forEach(init);
  });
})();
