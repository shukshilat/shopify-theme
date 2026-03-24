(function () {
  const PREFIX = 'theme-a11y:';
  const KEYS = {
    font: PREFIX + 'fontStep',
    contrast: PREFIX + 'highContrast',
    underline: PREFIX + 'underline',
    motion: PREFIX + 'reduceMotion',
    fontFamily: PREFIX + 'readableFont',
  };

  const FONT_CLASSES = ['a11y-font-step--2', 'a11y-font-step--1', '', 'a11y-font-step-1', 'a11y-font-step-2'];
  const FONT_MIN = -2;
  const FONT_MAX = 2;

  function readInt(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return fallback;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  }

  function readBool(key) {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  }

  function write(key, value) {
    try {
      if (typeof value === 'boolean') {
        if (value) localStorage.setItem(key, '1');
        else localStorage.removeItem(key);
        return;
      }
      if (typeof value === 'number') {
        if (value === 0) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      }
    } catch {
      /* ignore quota */
    }
  }

  function fontClassForStep(step) {
    const idx = step - FONT_MIN;
    return FONT_CLASSES[idx] || '';
  }

  function applyFontStep(root, step) {
    root.classList.remove(
      'a11y-font-step--2',
      'a11y-font-step--1',
      'a11y-font-step-1',
      'a11y-font-step-2'
    );
    const cls = fontClassForStep(step);
    if (cls) root.classList.add(cls);
  }

  function applyFromStorage(root) {
    let step = readInt(KEYS.font, 0);
    step = Math.min(FONT_MAX, Math.max(FONT_MIN, step));
    applyFontStep(root, step);

    root.classList.toggle('a11y-high-contrast', readBool(KEYS.contrast));
    root.classList.toggle('a11y-underline-links', readBool(KEYS.underline));
    root.classList.toggle('a11y-reduce-motion', readBool(KEYS.motion));
    root.classList.toggle('a11y-readable-font', readBool(KEYS.fontFamily));

    return {
      fontStep: step,
      highContrast: readBool(KEYS.contrast),
      underline: readBool(KEYS.underline),
      reduceMotion: readBool(KEYS.motion),
      readableFont: readBool(KEYS.fontFamily),
    };
  }

  function getFocusable(container) {
    return Array.from(
      container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (el) {
      return el.getAttribute('aria-hidden') !== 'true';
    });
  }

  function init() {
    const rootEl = document.querySelector('[data-a11y-widget]');
    if (!rootEl) return;

    const html = document.documentElement;
    const toggle = rootEl.querySelector('[data-a11y-toggle]');
    const panel = rootEl.querySelector('[data-a11y-panel]');
    const closeBtn = rootEl.querySelector('[data-a11y-close]');
    if (!toggle || !panel) return;

    let state = applyFromStorage(html);

    function syncButtons() {
      panel.querySelectorAll('[data-a11y-pressed]').forEach(function (btn) {
        const key = btn.getAttribute('data-a11y-pressed');
        if (key === 'highContrast') btn.setAttribute('aria-pressed', state.highContrast ? 'true' : 'false');
        if (key === 'underline') btn.setAttribute('aria-pressed', state.underline ? 'true' : 'false');
        if (key === 'reduceMotion') btn.setAttribute('aria-pressed', state.reduceMotion ? 'true' : 'false');
        if (key === 'readableFont') btn.setAttribute('aria-pressed', state.readableFont ? 'true' : 'false');
      });
    }

    syncButtons();

    function openPanel() {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      const focusables = getFocusable(panel);
      if (focusables.length) focusables[0].focus();
    }

    function closePanel() {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }

    function togglePanel() {
      if (panel.hidden) openPanel();
      else closePanel();
    }

    toggle.addEventListener('click', togglePanel);
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) {
        e.preventDefault();
        closePanel();
      }
    });

    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || panel.hidden) return;
      const focusables = getFocusable(panel);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    rootEl.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-a11y-action]');
      if (!btn || !panel.contains(btn)) return;
      const action = btn.getAttribute('data-a11y-action');

      if (action === 'font-decrease') {
        state.fontStep = Math.max(FONT_MIN, state.fontStep - 1);
        applyFontStep(html, state.fontStep);
        write(KEYS.font, state.fontStep);
      } else if (action === 'font-increase') {
        state.fontStep = Math.min(FONT_MAX, state.fontStep + 1);
        applyFontStep(html, state.fontStep);
        write(KEYS.font, state.fontStep);
      } else if (action === 'font-reset') {
        state.fontStep = 0;
        applyFontStep(html, 0);
        write(KEYS.font, 0);
      } else if (action === 'toggle-high-contrast') {
        state.highContrast = !state.highContrast;
        html.classList.toggle('a11y-high-contrast', state.highContrast);
        write(KEYS.contrast, state.highContrast);
      } else if (action === 'toggle-underline') {
        state.underline = !state.underline;
        html.classList.toggle('a11y-underline-links', state.underline);
        write(KEYS.underline, state.underline);
      } else if (action === 'toggle-reduce-motion') {
        state.reduceMotion = !state.reduceMotion;
        html.classList.toggle('a11y-reduce-motion', state.reduceMotion);
        write(KEYS.motion, state.reduceMotion);
      } else if (action === 'toggle-readable-font') {
        state.readableFont = !state.readableFont;
        html.classList.toggle('a11y-readable-font', state.readableFont);
        write(KEYS.fontFamily, state.readableFont);
      } else if (action === 'reset-all') {
        state = {
          fontStep: 0,
          highContrast: false,
          underline: false,
          reduceMotion: false,
          readableFont: false,
        };
        Object.values(KEYS).forEach(function (k) {
          try {
            localStorage.removeItem(k);
          } catch {
            /* ignore */
          }
        });
        html.classList.remove(
          'a11y-font-step--2',
          'a11y-font-step--1',
          'a11y-font-step-1',
          'a11y-font-step-2',
          'a11y-high-contrast',
          'a11y-underline-links',
          'a11y-reduce-motion',
          'a11y-readable-font'
        );
      }
      syncButtons();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
