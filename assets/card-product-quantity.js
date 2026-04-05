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
      const mode = form.querySelector('input[name="purchase_mode"]:checked')?.value;
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
  });
})();
