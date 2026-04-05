class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (!cartLink) return;

    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink);
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(cartLink);
      }
    });
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);
    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {
      this.classList.add('animate', 'active');
      requestAnimationFrame(() => {
        this.applyPanelAnchorPosition(triggeredBy);
        requestAnimationFrame(() => this.applyPanelAnchorPosition(triggeredBy));
      });
    });

    this.addEventListener(
      'transitionend',
      () => {
        const panel = this.querySelector('.drawer__inner.cart-drawer__panel');
        const containerToTrapFocusOn = this.classList.contains('is-empty')
          ? this.querySelector('.drawer__inner-empty') || panel || document.getElementById('CartDrawer')
          : panel || document.getElementById('CartDrawer');
        const focusElement = this.querySelector('.drawer__close') || this.querySelector('.drawer__inner');
        if (containerToTrapFocusOn && focusElement) {
          trapFocus(containerToTrapFocusOn, focusElement);
        }
      },
      { once: true }
    );

    document.body.classList.add('overflow-hidden');

    if (!this._boundOnResize) {
      this._boundOnResize = () => this.applyPanelAnchorPosition(null);
      window.addEventListener('resize', this._boundOnResize);
    }
    if (!this._boundOnScroll) {
      this._boundOnScroll = () => this.applyPanelAnchorPosition(null);
      window.addEventListener('scroll', this._boundOnScroll, true);
    }
  }

  /**
   * Aligns the drawer panel to the viewport (true float) using inline !important — beats theme CSS/transform parents.
   */
  applyPanelAnchorPosition(triggeredBy) {
    if (!this.classList.contains('active')) return;

    const el = triggeredBy || this.activeElement;
    const panel = this.querySelector('.drawer__inner.cart-drawer__panel');
    if (!panel) return;

    const vh = window.innerHeight;
    const margin = 8;
    const maxPanelH = Math.min(vh * 0.88, 52 * 16);

    let panelH = panel.getBoundingClientRect().height;
    if (!panelH || panelH < 40) panelH = Math.min(maxPanelH, 400);

    let topPx;
    if (el && typeof el.getBoundingClientRect === 'function' && el.isConnected) {
      const r = el.getBoundingClientRect();
      const anchorCenterY = r.top + Math.max(r.height, 1) / 2;
      topPx = anchorCenterY - panelH / 2;
    } else {
      topPx = (vh - panelH) / 2;
    }

    topPx = Math.max(margin, Math.min(topPx, vh - panelH - margin));
    const topStr = `${Math.round(topPx)}px`;

    this.style.setProperty('--cart-panel-top', topStr);
    panel.style.setProperty('position', 'fixed', 'important');
    panel.style.setProperty('left', '0', 'important');
    panel.style.setProperty('top', topStr, 'important');
    panel.style.setProperty('z-index', '10001', 'important');
    panel.style.setProperty('max-height', '88vh', 'important');
  }

  clearPanelInlinePosition() {
    const panel = this.querySelector('.drawer__inner.cart-drawer__panel');
    if (!panel) return;
    ['position', 'left', 'top', 'z-index', 'max-height'].forEach((prop) => panel.style.removeProperty(prop));
  }

  close() {
    if (this._boundOnResize) {
      window.removeEventListener('resize', this._boundOnResize);
    }
    if (this._boundOnScroll) {
      window.removeEventListener('scroll', this._boundOnScroll, true);
    }
    this._boundOnResize = null;
    this._boundOnScroll = null;

    this.clearPanelInlinePosition();
    this.classList.remove('active', 'animate');
    removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  renderContents(parsedState) {
    this.querySelector('.drawer__inner').classList.contains('is-empty') &&
      this.querySelector('.drawer__inner').classList.remove('is-empty');
    this.productId = parsedState.id;
    const sections = parsedState.sections;
    this.getSectionsToRender().forEach((section) => {
      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);

      if (!sectionElement) return;
      const html = sections && sections[section.id];
      const inner = this.getSectionInnerHTML(html, section.selector);
      if (inner != null) sectionElement.innerHTML = inner;
    });

    const openAfterPaint = () => {
      setTimeout(() => {
        this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
        this.open();
        setTimeout(() => {
          this.applyPanelAnchorPosition();
          requestAnimationFrame(() => this.applyPanelAnchorPosition());
        }, 0);
      });
    };

    if (typeof window.updateCartUIFromCart === 'function') {
      fetch(themeCartJsUrl())
        .then((r) => r.json())
        .then((cart) => {
          window.updateCartUIFromCart(cart);
          if (typeof window.themeRefreshAllCardLinePricing === 'function') {
            window.themeRefreshAllCardLinePricing();
          }
          if (typeof window.themePersistAllCardQtyStates === 'function') {
            window.themePersistAllCardQtyStates();
          }
        })
        .catch(() => {})
        .finally(openAfterPaint);
    } else {
      openAfterPaint();
    }
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    if (html == null || typeof html !== 'string' || !html.trim()) return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.querySelector(selector);
    return el ? el.innerHTML : null;
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

function themeCartJsUrl() {
  if (typeof window.Shopify !== 'undefined' && window.Shopify.routes && window.Shopify.routes.root) {
    return `${window.Shopify.routes.root}cart.js`;
  }
  return '/cart.js';
}

/** When bundled section HTML is missing or renderContents throws — reload drawer markup from the server cart context. */
window.themeRefreshCartDrawerFromSection = function () {
  const base = (window.routes && window.routes.cart_url) || '/cart';
  return fetch(`${base}?section_id=cart-drawer`)
    .then((r) => r.text())
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const next = doc.getElementById('CartDrawer');
      const cur = document.getElementById('CartDrawer');
      if (!next || !cur) return null;
      cur.innerHTML = next.innerHTML;
      return fetch(themeCartJsUrl()).then((res) => res.json());
    })
    .then((cart) => {
      const drawer = document.querySelector('cart-drawer');
      if (drawer && cart && Array.isArray(cart.items)) {
        drawer.classList.toggle('is-empty', cart.items.length === 0);
      }
      if (cart && typeof window.updateCartUIFromCart === 'function') {
        window.updateCartUIFromCart(cart);
      }
    })
    .catch(() => {});
};

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
    ];
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
