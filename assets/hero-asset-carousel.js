/**
 * Hero asset carousel — image fallback + optional homepage video hero.
 */
(function () {
  const LOAD_TIMEOUT_MS = 8000;
  const RETRY_DELAY_MS = 5000;
  const registry = new WeakMap();

  function clearTimer(state, key) {
    if (state.timers[key]) {
      clearTimeout(state.timers[key]);
      state.timers[key] = null;
    }
  }

  function clearAllTimers(state) {
    Object.keys(state.timers).forEach((key) => clearTimer(state, key));
  }

  function destroyHero(root) {
    const state = registry.get(root);
    if (!state) return;

    clearAllTimers(state);

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.bound.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler, options);
    });
    state.bound = [];

    if (state.carouselTimer) {
      clearInterval(state.carouselTimer);
      state.carouselTimer = null;
    }

    registry.delete(root);
    delete root.dataset.heroInit;
  }

  function addBound(state, target, type, handler, options) {
    target.addEventListener(type, handler, options);
    state.bound.push({ target, type, handler, options });
  }

  function initCarousel(root) {
    const viewport = root.querySelector('[data-hero-asset-viewport]');
    if (!viewport) return;

    const slides = [...viewport.querySelectorAll('.hero-asset-carousel__slide')];
    const dots = [...root.querySelectorAll('.hero-asset-carousel__dot')];
    if (slides.length < 2) return;

    const state = { bound: [], timers: {}, carouselTimer: null };
    registry.set(root, state);

    let intervalMs = parseInt(viewport.getAttribute('data-interval-ms') || '5000', 10);
    if (Number.isNaN(intervalMs) || intervalMs < 2500) intervalMs = 5000;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      intervalMs = Math.max(intervalMs, 8000);
    }

    let index = slides.findIndex((el) => el.classList.contains('is-active'));
    if (index < 0) index = 0;

    function clearCarouselTimer() {
      if (state.carouselTimer) {
        clearInterval(state.carouselTimer);
        state.carouselTimer = null;
      }
    }

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
      addBound(state, dot, 'click', () => goTo(i));
    });

    const inDesignMode = typeof Shopify !== 'undefined' && Shopify.designMode;

    if (!inDesignMode) {
      state.carouselTimer = setInterval(() => goTo(index + 1), intervalMs);

      addBound(state, viewport, 'mouseenter', () => clearCarouselTimer());
      addBound(state, viewport, 'mouseleave', () => {
        if (!state.carouselTimer) {
          state.carouselTimer = setInterval(() => goTo(index + 1), intervalMs);
        }
      });

      addBound(state, document, 'visibilitychange', () => {
        if (document.hidden) {
          clearCarouselTimer();
        } else if (!state.carouselTimer && !inDesignMode) {
          state.carouselTimer = setInterval(() => goTo(index + 1), intervalMs);
        }
      });
    }
  }

  function setTogglePlayingUi(viewport, toggle, playing) {
    if (playing) {
      viewport.classList.add('is-playing');
      viewport.classList.remove('is-paused-ui');
      toggle.setAttribute('aria-label', 'השהה סרטון');
      toggle.setAttribute('aria-pressed', 'false');
    } else {
      viewport.classList.remove('is-playing');
      viewport.classList.add('is-paused-ui');
      toggle.setAttribute('aria-label', 'המשך ניגון');
      toggle.setAttribute('aria-pressed', 'true');
    }
  }

  function initVideoHero(root) {
    const viewport = root.querySelector('[data-hero-video-viewport]');
    const mediaWrap = root.querySelector('[data-hero-video-media]');
    const toggle = root.querySelector('[data-hero-video-toggle]');
    const video = mediaWrap?.querySelector('video');

    if (!viewport || !mediaWrap || !toggle || !video) return;

    const state = {
      bound: [],
      timers: {},
      observer: null,
      carouselTimer: null,
      attempt: 1,
      loadFailedFinal: false,
      videoRevealed: false,
      manualPause: false,
      isIntersecting: true,
      playbackConfirmed: false,
    };
    registry.set(root, state);

    function markReady() {
      if (state.loadFailedFinal) return;
      viewport.classList.add('is-ready');
      toggle.hidden = false;
    }

    function revealVideo() {
      if (state.loadFailedFinal || state.videoRevealed) return;
      state.videoRevealed = true;
      state.playbackConfirmed = true;
      viewport.classList.add('is-video-revealed');
      markReady();
    }

    function markFinalFailure() {
      state.loadFailedFinal = true;
      clearAllTimers(state);
      viewport.classList.add('is-load-failed');
      viewport.classList.remove('is-video-revealed', 'is-ready', 'is-playing');
      toggle.hidden = true;
      try {
        video.pause();
      } catch (_) {
        /* ignore */
      }
    }

    function scheduleAttemptTimeouts() {
      clearTimer(state, 'attempt');
      state.timers.attempt = setTimeout(() => {
        if (state.playbackConfirmed || state.loadFailedFinal) return;
        if (state.attempt === 1) {
          state.attempt = 2;
          clearTimer(state, 'retryDelay');
          state.timers.retryDelay = setTimeout(() => {
            if (state.playbackConfirmed || state.loadFailedFinal) return;
            try {
              video.load();
            } catch (_) {
              /* ignore */
            }
            tryAutoplay();
            scheduleAttemptTimeouts();
          }, RETRY_DELAY_MS);
        } else {
          markFinalFailure();
        }
      }, LOAD_TIMEOUT_MS);
    }

    function tryAutoplay() {
      if (state.loadFailedFinal) return;
      if (state.manualPause) return;
      if (!state.isIntersecting || document.hidden) return;

      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          if (state.playbackConfirmed || state.loadFailedFinal) return;
        });
      }
    }

    function onPlaybackConfirmed() {
      if (state.loadFailedFinal) return;
      clearTimer(state, 'attempt');
      clearTimer(state, 'retryDelay');
      revealVideo();
      setTogglePlayingUi(viewport, toggle, !video.paused && !state.manualPause);
    }

    addBound(state, video, 'playing', () => {
      if (state.loadFailedFinal) return;
      onPlaybackConfirmed();
      if (!state.manualPause) {
        setTogglePlayingUi(viewport, toggle, true);
      }
    });

    addBound(state, video, 'pause', () => {
      if (state.loadFailedFinal) return;
      if (state.manualPause) {
        setTogglePlayingUi(viewport, toggle, false);
      }
    });

    addBound(state, video, 'error', () => {
      if (state.playbackConfirmed || state.loadFailedFinal) return;
      if (state.attempt >= 2) {
        markFinalFailure();
      }
    });

    addBound(state, video, 'waiting', () => {
      /* שמירת הפריים האחרון — לא להחזיר poster */
    });

    addBound(state, video, 'stalled', () => {
      /* שמירת הפריים האחרון — לא להחזיר poster */
    });

    addBound(state, toggle, 'click', () => {
      if (state.loadFailedFinal || !state.playbackConfirmed) return;

      if (state.manualPause) {
        state.manualPause = false;
        viewport.classList.remove('is-manual-pause');
        tryAutoplay();
      } else {
        state.manualPause = true;
        viewport.classList.add('is-manual-pause');
        video.pause();
        setTogglePlayingUi(viewport, toggle, false);
      }
    });

    state.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        state.isIntersecting = entry.isIntersecting;
        if (state.loadFailedFinal) return;

        if (!entry.isIntersecting) {
          if (!state.manualPause) video.pause();
        } else if (!state.manualPause && !document.hidden) {
          tryAutoplay();
        }
      },
      { threshold: 0.25 }
    );
    state.observer.observe(viewport);

    addBound(state, document, 'visibilitychange', () => {
      if (state.loadFailedFinal) return;
      if (document.hidden) {
        if (!state.manualPause) video.pause();
      } else if (state.isIntersecting && !state.manualPause) {
        tryAutoplay();
      }
    });

    addBound(state, window, 'pageshow', (event) => {
      if (!event.persisted || state.loadFailedFinal) return;
      try {
        video.currentTime = 0;
      } catch (_) {
        /* ignore */
      }
      state.manualPause = false;
      viewport.classList.remove('is-manual-pause');
      if (state.isIntersecting && !document.hidden) {
        tryAutoplay();
      }
    });

    try {
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.loop = true;
    } catch (_) {
      /* ignore */
    }

    try {
      video.load();
    } catch (_) {
      /* ignore */
    }

    scheduleAttemptTimeouts();
    tryAutoplay();
  }

  function initRoot(root) {
    if (root.dataset.heroInit === 'true') {
      destroyHero(root);
    }
    root.dataset.heroInit = 'true';

    if (root.dataset.heroVideoMode === 'true') {
      initVideoHero(root);
    } else {
      initCarousel(root);
    }
  }

  function boot(scope) {
    (scope || document).querySelectorAll('[data-hero-asset-carousel]').forEach(initRoot);
  }

  document.addEventListener('DOMContentLoaded', () => boot());
  document.addEventListener('shopify:section:load', (event) => boot(event.target));
  document.addEventListener('shopify:section:unload', (event) => {
    event.target.querySelectorAll('[data-hero-asset-carousel]').forEach(destroyHero);
  });
})();