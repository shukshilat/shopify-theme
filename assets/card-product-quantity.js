/**
 * Product card quantity: unit/weight panels, kg stepper, live line totals, main price sync.
 */
(function () {
  function getMoneyConfig() {
    const m = window.ShopifyCardQtyMoney || {};
    return {
      format: m.format || '{{amount}}',
      formatWithCurrency: m.formatWithCurrency || m.format || '{{amount}}',
    };
  }

  function formatMoney(cents, useCurrency) {
    const cfg = getMoneyConfig();
    const fmt = useCurrency ? cfg.formatWithCurrency : cfg.format;
    const n = Math.max(0, Math.round(Number(cents) || 0));
    const amount = (n / 100).toFixed(2);
    const amountNoDecimals = String(Math.round(n / 100));
    const amountWithCommaSeparator = amount.replace('.', ',');
    const amountNoDecimalsWithCommaSeparator = amountNoDecimals.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fmt
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, amountWithCommaSeparator)
      .replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/g, amountNoDecimalsWithCommaSeparator)
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, amountNoDecimals)
      .replace(/\{\{\s*amount\s*\}\}/g, amount);
  }

  function readPricing(form) {
    const d = form.dataset;
    return {
      variantCents: parseInt(d.variantCents || '0', 10) || 0,
      compareAtCents: parseInt(d.compareAtCents || '0', 10) || 0,
      comparePerKg: parseInt(d.comparePerKg || '0', 10) || 0,
      centsPerKg: parseInt(d.centsPerKg || '0', 10) || 0,
      lineUnitCents: parseInt(d.lineUnitCents || '0', 10) || 0,
      currencyWithCode: d.currencyWithCode === 'true',
    };
  }

  function getMode(form) {
    return (
      form.querySelector('input[name="purchase_mode"]:checked')?.value ||
      form.querySelector('input[name="purchase_mode"][type="hidden"]')?.value ||
      'unit'
    );
  }

  /** Integer units (מנות) — matches snapUnitQuantityInt in product-form.js */
  function getUnitQty(form) {
    const inp = form.querySelector('.js-card-qty-unit');
    if (!inp) return 1;
    const min = parseInt(form.dataset.qtyMin || '1', 10) || 1;
    const inc = parseInt(form.dataset.qtyIncrement || '1', 10) || 1;
    const maxStr = form.dataset.qtyMax;
    const max = maxStr && maxStr !== '' ? parseInt(maxStr, 10) : null;
    let q = parseInt(inp.value, 10);
    if (Number.isNaN(q)) q = min;
    q = Math.max(min, q);
    if (inc > 1) {
      const k = Math.ceil((q - min) / inc);
      q = min + k * inc;
    }
    if (max != null && !Number.isNaN(max)) q = Math.min(q, max);
    return Math.max(1, q);
  }

  /** תצוגת ק״ג בלי אפסים עשרוניים מיותרים (0.7, 12.5, 1) — מתאים ל-type=number */
  function formatKgDisplayString(kg) {
    const v = Math.round(Number(kg) * 1000) / 1000;
    if (!Number.isFinite(v) || v < 0.001) return '0.1';
    const s = v.toFixed(3).replace(/\.?0+$/, '');
    return s.length ? s : String(v);
  }

  function getKg(form) {
    const inp = form.querySelector('.js-card-qty-kg');
    if (!inp) return 1;
    let kg = parseFloat(String(inp.value).replace(',', '.'));
    if (Number.isNaN(kg)) kg = 0.1;
    return Math.max(0.1, Math.round(kg * 1000) / 1000);
  }

  function lineCents(mode, form, p) {
    if (mode === 'weight') {
      const perKg = p.centsPerKg > 0 ? p.centsPerKg : p.variantCents;
      return Math.round(perKg * getKg(form));
    }
    return Math.round(p.variantCents * getUnitQty(form));
  }

  function compareCents(mode, form, line, p) {
    if (p.compareAtCents <= p.variantCents) return 0;
    if (mode === 'weight') {
      if (p.comparePerKg > 0) return Math.round(p.comparePerKg * getKg(form));
      if (p.variantCents > 0) return Math.round(line * (p.compareAtCents / p.variantCents));
      return 0;
    }
    return Math.round(p.compareAtCents * getUnitQty(form));
  }

  function updatePricing(root) {
    const form = root.querySelector('form.card-product-qty__form');
    if (!form) return;

    const mode = getMode(form);
    const p = readPricing(form);
    const line = lineCents(mode, form, p);
    const cmp = compareCents(mode, form, line, p);
    const useCur = p.currencyWithCode;
    const lineStr = formatMoney(line, useCur);
    const cmpStr = cmp > 0 ? formatMoney(cmp, useCur) : '';

    const totalEl = root.querySelector('[data-card-line-total]');
    if (totalEl) totalEl.textContent = lineStr;

    const cmpEl = root.querySelector('[data-card-line-compare]');
    if (cmpEl) {
      if (cmpStr) {
        cmpEl.textContent = cmpStr;
        cmpEl.hidden = false;
      } else {
        cmpEl.textContent = '';
        cmpEl.hidden = true;
      }
    }

    /* לא מחליפים את מחיר המוצר הראשי (מחיר לק״ג מה-Liquid) — רק סה״כ שורה בווידג׳ */
  }

  function syncPanels(root) {
    const form = root.querySelector('form.card-product-qty__form');
    if (!form) return;
    const unitPanel = root.querySelector('[data-card-panel="unit"]');
    const weightPanel = root.querySelector('[data-card-panel="weight"]');
    if (unitPanel && weightPanel) {
      const mode =
        form.querySelector('input[name="purchase_mode"]:checked')?.value ||
        form.querySelector('input[name="purchase_mode"][type="hidden"]')?.value;
      if (mode === 'weight') {
        unitPanel.classList.add('hidden');
        unitPanel.setAttribute('hidden', '');
        weightPanel.classList.remove('hidden');
        weightPanel.removeAttribute('hidden');
      } else {
        weightPanel.classList.add('hidden');
        weightPanel.setAttribute('hidden', '');
        unitPanel.classList.remove('hidden');
        unitPanel.removeAttribute('hidden');
      }
    }
    updatePricing(root);
  }

  function themeCartJsUrl() {
    if (typeof window.Shopify !== 'undefined' && window.Shopify.routes && window.Shopify.routes.root) {
      return `${window.Shopify.routes.root}cart.js`;
    }
    return '/cart.js';
  }

  function propsFromCartItem(item) {
    if (typeof window.themeLineItemProps === 'function') {
      return window.themeLineItemProps(item);
    }
    const raw = item && item.properties;
    if (!raw) return {};
    if (Array.isArray(raw)) {
      const o = {};
      for (let i = 0; i < raw.length; i++) {
        const e = raw[i];
        if (e && e.name != null) {
          o[String(e.name)] = e.value != null && e.value !== '' ? String(e.value) : '';
        }
      }
      return o;
    }
    if (typeof raw === 'object') return raw;
    return {};
  }

  /** תואם ל־cart-drawer / product-form: איך נקבע מצב שורה בעגלה */
  function linePurchaseModeFromItem(item) {
    const p = propsFromCartItem(item);
    const wk = String(p._weight_qty_unit_kg || p['_weight_qty_unit_kg'] || '').trim();
    if (wk === '0.1') return 'weight';
    const pm = String(p._purchase_mode || p['_purchase_mode'] || '').trim();
    if (pm === 'weight' || pm === 'unit') return pm;
    const qtyStr = String(item.quantity ?? '');
    if (qtyStr.includes('.')) return 'weight';
    return 'unit';
  }

  /** ק״ג לתצוגה בכרטיס — תואם ל־lineItemQuantityAsKg ב־product-form.js */
  function lineItemQtyAsKgForCard(item, form) {
    const p = propsFromCartItem(item);
    const wk = String(p._weight_qty_unit_kg || p['_weight_qty_unit_kg'] || '').trim();
    const q = Number(item.quantity);
    if (!Number.isFinite(q)) return 0;
    if (wk === '0.1') return q / 10;
    const wb = form?.dataset?.weightBehavior || '';
    if (wb === 'grams') return q / 1000;
    if (wb === 'kg_tenths') return q / 10;
    return q;
  }

  function snapUnitQuantityForForm(form, raw) {
    const min = parseInt(form.dataset.qtyMin || '1', 10) || 1;
    const inc = parseInt(form.dataset.qtyIncrement || '1', 10) || 1;
    const maxStr = form.dataset.qtyMax;
    const max = maxStr && maxStr !== '' ? parseInt(maxStr, 10) : null;
    let q = parseInt(String(raw), 10);
    if (Number.isNaN(q)) q = min;
    q = Math.max(min, q);
    if (inc > 1) {
      const k = Math.ceil((q - min) / inc);
      q = min + k * inc;
    }
    if (max != null && !Number.isNaN(max)) q = Math.min(q, max);
    return Math.max(1, q);
  }

  function setInputValueNotify(el, value) {
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * אחרי ריענון דף / חזרה לקטלוג — משחזר מתג יחידה/משקל וכמויות לפי העגלה (Shopify כבר שומרת properties).
   */
  function syncOneCardRootFromCart(root, cart) {
    const form = root.querySelector('form.card-product-qty__form');
    if (!form || !cart || !Array.isArray(cart.items)) return;

    const variantInput = form.querySelector('[name="id"]');
    if (!variantInput) return;
    const variantId = Number(variantInput.value);
    if (!Number.isFinite(variantId)) return;

    const items = cart.items.filter((it) => Number(it.variant_id) === variantId);
    const weightRadio = form.querySelector('input[name="purchase_mode"][value="weight"]');
    const unitRadio = form.querySelector('input[name="purchase_mode"][value="unit"]');
    const hiddenMode = form.querySelector('input[name="purchase_mode"][type="hidden"]');
    const hasDualMode = Boolean(weightRadio && unitRadio);
    const min = parseInt(form.dataset.qtyMin || '1', 10) || 1;

    let weightKg = 0;
    let unitQty = 0;
    for (const it of items) {
      const mode = linePurchaseModeFromItem(it);
      if (mode === 'weight') {
        const wb = form.dataset.weightBehavior || '';
        if (wb === 'property') continue;
        weightKg += lineItemQtyAsKgForCard(it, form);
      } else {
        unitQty += Number(it.quantity) || 0;
      }
    }
    weightKg = Math.round(weightKg * 1000) / 1000;

    /*
     * אין שורה בעגלה לוריאנט הזה — לא מאפסים את הכרטיס.
     * אחרת כל הוספת מוצר (cart-update) הייתה דורסת בחירת ק״ג/מתג של מוצרים שלא בעגלה.
     */
    if (items.length === 0) {
      return;
    }

    if (hiddenMode) {
      const forced = hiddenMode.value;
      if (forced === 'weight') {
        const kgIn = form.querySelector('.js-card-qty-kg');
        const kgVal = weightKg > 0 ? weightKg : 0.1;
        if (kgIn) setInputValueNotify(kgIn, formatKgDisplayString(kgVal));
      } else {
        const uIn = form.querySelector('.js-card-qty-unit');
        const uVal = snapUnitQuantityForForm(form, unitQty > 0 ? unitQty : min);
        if (uIn) setInputValueNotify(uIn, String(uVal));
      }
      syncPanels(root);
      return;
    }

    if (hasDualMode) {
      const preferWeight = weightKg > 0;
      if (preferWeight) {
        weightRadio.checked = true;
        const kgIn = form.querySelector('.js-card-qty-kg');
        if (kgIn) setInputValueNotify(kgIn, formatKgDisplayString(weightKg));
      } else {
        unitRadio.checked = true;
        const uIn = form.querySelector('.js-card-qty-unit');
        const uVal = snapUnitQuantityForForm(form, unitQty > 0 ? unitQty : min);
        if (uIn) setInputValueNotify(uIn, String(uVal));
      }
    }

    syncPanels(root);
  }

  function syncAllCardRootsFromCart(cart) {
    document.querySelectorAll('[data-card-quantity-root]').forEach((root) => {
      syncOneCardRootFromCart(root, cart);
    });
  }

  function refreshAllCardsFromServerCart() {
    fetch(themeCartJsUrl())
      .then((r) => r.json())
      .then((cart) => syncAllCardRootsFromCart(cart))
      .catch(() => {});
  }

  function initKgStepper(root, onChange) {
    root.querySelectorAll('[data-card-kg-stepper]').forEach((wrap) => {
      const input = wrap.querySelector('.js-card-qty-kg');
      if (!input) return;
      const step = parseFloat(input.getAttribute('step')) || 0.1;
      const min = parseFloat(input.getAttribute('min')) || 0.1;

      const setValue = (next) => {
        const v = Math.round(next * 1000) / 1000;
        input.value = formatKgDisplayString(v);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        onChange();
      };

      wrap.querySelector('[name="kg-minus"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        let v = parseFloat(input.value);
        if (Number.isNaN(v)) v = min;
        const next = Math.max(min, Math.round((v - step) * 1000) / 1000);
        setValue(next);
      });

      wrap.querySelector('[name="kg-plus"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        let v = parseFloat(input.value);
        if (Number.isNaN(v)) v = min;
        setValue(Math.round((v + step) * 1000) / 1000);
      });
    });
  }

  function init(root) {
    const form = root.querySelector('form');
    if (!form) return;

    const refresh = () => updatePricing(root);

    form.querySelectorAll('input[name="purchase_mode"]').forEach((input) => {
      input.addEventListener('change', () => syncPanels(root));
    });

    form.querySelector('.js-card-qty-unit')?.addEventListener('change', refresh);
    form.querySelector('.js-card-qty-unit')?.addEventListener('input', refresh);
    form.querySelector('.js-card-qty-kg')?.addEventListener('change', refresh);
    form.querySelector('.js-card-qty-kg')?.addEventListener('input', refresh);

    form.querySelectorAll('quantity-input').forEach((qi) => {
      qi.addEventListener('change', refresh);
    });

    syncPanels(root);
    initKgStepper(root, refresh);
    const kgIn = form.querySelector('.js-card-qty-kg');
    if (kgIn) {
      const parsed = parseFloat(String(kgIn.value).replace(',', '.'));
      if (!Number.isNaN(parsed)) {
        kgIn.value = formatKgDisplayString(parsed);
      }
    }
    refresh();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-card-quantity-root]').forEach(init);
    refreshAllCardsFromServerCart();
  });

  window.addEventListener('pageshow', (ev) => {
    if (ev.persisted) refreshAllCardsFromServerCart();
  });

  if (typeof subscribe !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
    subscribe(PUB_SUB_EVENTS.cartUpdate, () => {
      refreshAllCardsFromServerCart();
    });
  }
})();
