/**
 * Showcase collection carousel — RTL-native scroll, dots, and arrow controls.
 * Scoped to .collection-list--showcase only (does not modify global.js).
 */
(function () {
  const ROOT_SELECTOR = '.collection-list--showcase slider-component.collection-list__showcase-carousel';
  const WIDGET_TRACK_SELECTOR = '.collection-list--showcase-track[id^="Slider-"]';

  function getSlides(slider) {
    return Array.from(slider.querySelectorAll(':scope > [id^="Slide-"]')).filter(
      (el) => el.clientWidth > 0
    );
  }

  function slideStep(slides) {
    if (slides.length < 2) return slides[0] ? slides[0].offsetWidth : 0;
    return Math.abs(slides[1].offsetLeft - slides[0].offsetLeft);
  }

  function readVisibleFromCss(slider) {
    const wrapper = slider.closest('.collection-list-wrapper.collection-list--showcase');
    if (!wrapper) return null;
    const raw = getComputedStyle(wrapper).getPropertyValue('--showcase-visible').trim();
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed) || parsed <= 0) return null;
    return Math.max(1, Math.floor(parsed));
  }

  function visibleCount(slider, slides, step) {
    const fromCss = readVisibleFromCss(slider);
    if (fromCss) return Math.min(fromCss, slides.length || fromCss);
    if (!slides.length || !step) return 1;
    return Math.max(1, Math.floor(slider.clientWidth / step));
  }

  function maxStartIndex(slides, visible) {
    return Math.max(0, slides.length - visible);
  }

  /** Leading slide index at inline-start (right edge in RTL track). */
  function readStartIndex(slider, slides) {
    if (!slides.length) return 0;
    const sliderRect = slider.getBoundingClientRect();
    const anchorX = sliderRect.right;
    let best = 0;
    let bestDist = Infinity;
    slides.forEach((slide, i) => {
      const r = slide.getBoundingClientRect();
      const dist = Math.abs(r.right - anchorX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function scrollToStartIndex(slider, slides, startIndex) {
    const slide = slides[startIndex];
    if (!slide) return;
    slide.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'start',
    });
  }

  function updateButtons(state, startIndex, maxStart) {
    const { advance, retreat } = state.buttons;
    if (advance) {
      advance.disabled = maxStart > 0 && startIndex >= maxStart;
      advance.setAttribute('aria-disabled', advance.disabled ? 'true' : 'false');
    }
    if (retreat) {
      retreat.disabled = startIndex <= 0;
      retreat.setAttribute('aria-disabled', retreat.disabled ? 'true' : 'false');
    }
  }

  function buildDots(container, totalPages, sectionId, activeIndex) {
    container.innerHTML = '';
    const dots = [];
    for (let i = 0; i < totalPages; i += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'slider-counter__link slider-counter__link--dots' +
        (i === activeIndex ? ' slider-counter__link--active' : '');
      btn.setAttribute('aria-label', 'עמוד ' + (i + 1) + ' מתוך ' + totalPages);
      btn.setAttribute('aria-controls', 'Slider-' + sectionId);
      btn.dataset.pageIndex = String(i);
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.setAttribute('aria-hidden', 'true');
      btn.append(dot);
      container.append(btn);
      dots.push(btn);
    }
    return dots;
  }

  function setActiveDot(dots, index) {
    dots.forEach((dot, i) => {
      dot.classList.toggle('slider-counter__link--active', i === index);
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
  }

  function destroy(root) {
    if (!root._showcaseCleanup) return;
    root._showcaseCleanup.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler, options);
    });
    if (root._showcaseResizeObserver) {
      root._showcaseResizeObserver.disconnect();
    }
    if (root._showcaseScrollRaf) {
      cancelAnimationFrame(root._showcaseScrollRaf);
    }
    delete root._showcaseCleanup;
    delete root._showcaseResizeObserver;
    delete root._showcaseScrollRaf;
    delete root._showcaseInit;
    delete root._showcaseState;
  }

  function refresh(state) {
    const { slider, dotsWrap, root } = state;
    state.slides = getSlides(slider);
    state.step = slideStep(state.slides);
    state.visible = visibleCount(slider, state.slides, state.step);
    state.maxStart = maxStartIndex(state.slides, state.visible);
    state.totalPages = state.maxStart + 1;
    state.startIndex = Math.min(state.startIndex, state.maxStart);

    if (state.totalPages < 2) {
      dotsWrap.innerHTML = '';
      state.dots = [];
    } else {
      state.dots = buildDots(dotsWrap, state.totalPages, state.sectionId, state.startIndex);
      state.dots.forEach((btn) => {
        const handler = (e) => {
          e.preventDefault();
          const idx = parseInt(btn.dataset.pageIndex, 10);
          if (Number.isNaN(idx)) return;
          state.startIndex = Math.min(Math.max(idx, 0), state.maxStart);
          scrollToStartIndex(slider, state.slides, state.startIndex);
          setActiveDot(state.dots, state.startIndex);
          updateButtons(state, state.startIndex, state.maxStart);
        };
        btn.addEventListener('click', handler);
        root._showcaseCleanup.push({ target: btn, type: 'click', handler });
      });
    }

    updateButtons(state, state.startIndex, state.maxStart);
    setActiveDot(state.dots, state.startIndex);
  }

  function onScroll(state) {
    if (state._showcaseScrollRaf) return;
    state._showcaseScrollRaf = requestAnimationFrame(() => {
      state._showcaseScrollRaf = null;
      const idx = readStartIndex(state.slider, state.slides);
      if (idx !== state.startIndex) {
        state.startIndex = idx;
        setActiveDot(state.dots, state.startIndex);
        updateButtons(state, state.startIndex, state.maxStart);
      }
    });
  }

  function initRoot(root) {
    if (root._showcaseInit) destroy(root);
    root._showcaseInit = true;
    root._showcaseCleanup = [];

    const slider = root.querySelector('.collection-list--showcase-track[id^="Slider-"]');
    const dotsWrap = root.querySelector('[data-showcase-dots]');
    const controls = root.querySelector('[data-showcase-controls]');
    if (!slider || !dotsWrap || !controls) return;

    const advance = controls.querySelector('[data-showcase-nav="advance"]');
    const retreat = controls.querySelector('[data-showcase-nav="retreat"]');

    const state = {
      root,
      slider,
      dotsWrap,
      buttons: { advance, retreat },
      sectionId: slider.id.replace('Slider-', ''),
      slides: [],
      dots: [],
      step: 0,
      visible: 1,
      maxStart: 0,
      totalPages: 1,
      startIndex: 0,
    };
    root._showcaseState = state;

    refresh(state);
    scrollToStartIndex(slider, state.slides, 0);

  const bind = (el, type, handler, options) => {
      el.addEventListener(type, handler, options);
      root._showcaseCleanup.push({ target: el, type, handler, options });
    };

    bind(
      advance,
      'click',
      (e) => {
        e.preventDefault();
        if (state.startIndex >= state.maxStart) return;
        state.startIndex += 1;
        scrollToStartIndex(state.slider, state.slides, state.startIndex);
        setActiveDot(state.dots, state.startIndex);
        updateButtons(state, state.startIndex, state.maxStart);
      }
    );

    bind(
      retreat,
      'click',
      (e) => {
        e.preventDefault();
        if (state.startIndex <= 0) return;
        state.startIndex -= 1;
        scrollToStartIndex(state.slider, state.slides, state.startIndex);
        setActiveDot(state.dots, state.startIndex);
        updateButtons(state, state.startIndex, state.maxStart);
      }
    );

    bind(
      advance,
      'keydown',
      (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          advance.click();
        }
      }
    );

    bind(
      retreat,
      'keydown',
      (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          retreat.click();
        }
      }
    );

    const onScrollHandler = () => onScroll(state);
    bind(slider, 'scroll', onScrollHandler, { passive: true });

    const ro = new ResizeObserver(() => {
      const prevStart = state.startIndex;
      refresh(state);
      state.startIndex = Math.min(prevStart, state.maxStart);
      scrollToStartIndex(state.slider, state.slides, state.startIndex);
    });
    ro.observe(slider);
    root._showcaseResizeObserver = ro;
  }

  function boot(scope) {
    (scope || document).querySelectorAll(ROOT_SELECTOR).forEach(initRoot);
    initShowcaseWidgetVisibility(scope);
  }

  /** Mobile-only: hide floating Waze/WhatsApp while the showcase track crosses the viewport vertical center. */
  const widgetVisibility = (function () {
    const BAR_SELECTOR = '[data-floating-side-bar]';
    const MOBILE_MQ = '(max-width: 749px)';
    /** Thin activation band at viewport center (avoids zero-area IO edge cases). */
    const CENTER_BAND_HEIGHT_PX = 2;
    const intersectingTracks = new Set();
    let observer = null;
    let storedRootMargin = '';
    /** Registered showcase sections — survives desktop mode until section unload. */
    let registeredTargets = [];
    let mqListenerAttached = false;
    let resizeListenerAttached = false;

    function getBar() {
      return document.querySelector(BAR_SELECTOR);
    }

    function isMobile() {
      return window.matchMedia(MOBILE_MQ).matches;
    }

    function setSuppressed(suppress) {
      const bar = getBar();
      if (!bar) return;

      if (!suppress) {
        bar.removeAttribute('data-showcase-widgets-suppressed');
        bar.removeAttribute('aria-hidden');
        bar.querySelectorAll('a[href]').forEach((link) => {
          const stored = link.dataset.showcasePrevTabindex;
          if (stored === undefined) return;
          if (stored === '') link.removeAttribute('tabindex');
          else link.setAttribute('tabindex', stored);
          delete link.dataset.showcasePrevTabindex;
        });
        return;
      }

      bar.setAttribute('data-showcase-widgets-suppressed', 'true');
      bar.setAttribute('aria-hidden', 'true');
      bar.querySelectorAll('a[href]').forEach((link) => {
        if (link.dataset.showcasePrevTabindex === undefined) {
          link.dataset.showcasePrevTabindex = link.getAttribute('tabindex') ?? '';
        }
        link.setAttribute('tabindex', '-1');
      });

      if (bar.contains(document.activeElement)) {
        const fallback =
          document.querySelector(
            '.collection-list--showcase [data-showcase-controls] button:not([disabled])'
          ) || document.getElementById('MainContent');
        if (fallback && typeof fallback.focus === 'function') {
          fallback.focus({ preventScroll: true });
        }
      }
    }

    function syncSuppressedState() {
      if (!isMobile() || intersectingTracks.size === 0) {
        setSuppressed(false);
        return;
      }
      setSuppressed(true);
    }

    function onIntersection(entries) {
      if (!isMobile()) return;
      entries.forEach((entry) => {
        if (entry.isIntersecting) intersectingTracks.add(entry.target);
        else intersectingTracks.delete(entry.target);
      });
      syncSuppressedState();
    }

    function centerBandRootMargin() {
      const h = window.innerHeight;
      const centerY = h / 2;
      const halfBand = CENTER_BAND_HEIGHT_PX / 2;
      const topInset = Math.max(0, Math.floor(centerY - halfBand));
      const bottomInset = Math.max(0, Math.floor(h - centerY - halfBand));
      return `-${topInset}px 0px -${bottomInset}px 0px`;
    }

    function trackCrossesViewportCenter(track) {
      const rect = track.getBoundingClientRect();
      const centerY = window.innerHeight / 2;
      return rect.top <= centerY && rect.bottom >= centerY;
    }

    function syncIntersectingFromGeometry() {
      if (!isMobile()) {
        intersectingTracks.clear();
        setSuppressed(false);
        return;
      }
      intersectingTracks.clear();
      registeredTargets.forEach((track) => {
        if (trackCrossesViewportCenter(track)) intersectingTracks.add(track);
      });
      syncSuppressedState();
    }

    function disconnectObserver() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      storedRootMargin = '';
    }

    /** Returns true when a new observer instance was created (re-observe all targets). */
    function createCenterLineObserver() {
      const margin = centerBandRootMargin();
      if (observer && margin === storedRootMargin) return false;
      disconnectObserver();
      storedRootMargin = margin;
      observer = new IntersectionObserver(onIntersection, {
        threshold: 0,
        root: null,
        rootMargin: margin,
      });
      return true;
    }

    function observeAllTargets() {
      if (!observer) return;
      registeredTargets.forEach((target) => observer.observe(target));
    }

    /** Stop IO and restore widgets; keep registeredTargets for a later mobile resize. */
    function detachObservations() {
      intersectingTracks.clear();
      setSuppressed(false);
      disconnectObserver();
    }

    function attachObservations() {
      if (!isMobile() || !registeredTargets.length) return;
      createCenterLineObserver();
      observeAllTargets();
      syncIntersectingFromGeometry();
    }

    function refreshObserverGeometry() {
      if (!isMobile() || !registeredTargets.length) return;
      intersectingTracks.clear();
      createCenterLineObserver();
      observeAllTargets();
      syncIntersectingFromGeometry();
    }

    function ensureResizeListener() {
      if (resizeListenerAttached) return;
      resizeListenerAttached = true;
      let rafId = 0;
      const scheduleRefresh = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          if (!isMobile()) return;
          refreshObserverGeometry();
        });
      };
      window.addEventListener('resize', scheduleRefresh, { passive: true });
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleRefresh, { passive: true });
      }
    }

    function ensureMediaListener() {
      if (mqListenerAttached) return;
      mqListenerAttached = true;
      ensureResizeListener();
      const mq = window.matchMedia(MOBILE_MQ);
      const onChange = () => {
        if (!mq.matches) {
          detachObservations();
          return;
        }
        attachObservations();
      };
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onChange);
      } else {
        mq.addListener(onChange);
      }
    }

    function isWidgetTrackEl(el) {
      if (!el || !el.matches(WIDGET_TRACK_SELECTOR)) return false;
      return Boolean(el.closest('.collection-list-wrapper.collection-list--showcase'));
    }

    function observeSection(trackEl) {
      if (!isWidgetTrackEl(trackEl)) return;
      if (registeredTargets.includes(trackEl)) return;

      registeredTargets.push(trackEl);
      ensureMediaListener();

      if (!isMobile()) return;

      const recreated = createCenterLineObserver();
      if (recreated) observeAllTargets();
      else observer.observe(trackEl);
      syncIntersectingFromGeometry();
    }

    function teardownSection(trackEl) {
      if (!trackEl) return;
      intersectingTracks.delete(trackEl);
      const idx = registeredTargets.indexOf(trackEl);
      if (idx >= 0) {
        registeredTargets.splice(idx, 1);
        if (observer) observer.unobserve(trackEl);
      }
      if (!registeredTargets.length) {
        detachObservations();
      } else {
        syncSuppressedState();
      }
    }

    return { observeSection, teardownSection, detachObservations };
  })();

  function initShowcaseWidgetVisibility(scope) {
    const root = scope || document;
    root.querySelectorAll(WIDGET_TRACK_SELECTOR).forEach((trackEl) => {
      widgetVisibility.observeSection(trackEl);
    });
  }

  function teardownShowcaseWidgetVisibility(scope) {
    const root = scope || document;
    root.querySelectorAll(WIDGET_TRACK_SELECTOR).forEach((trackEl) => {
      widgetVisibility.teardownSection(trackEl);
    });
  }

  document.addEventListener('DOMContentLoaded', () => boot());
  document.addEventListener('shopify:section:load', (e) => boot(e.target));
  document.addEventListener('shopify:section:unload', (e) => {
    teardownShowcaseWidgetVisibility(e.target);
    e.target.querySelectorAll(ROOT_SELECTOR).forEach(destroy);
  });
})();