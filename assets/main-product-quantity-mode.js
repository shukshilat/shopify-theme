(function () {
  function formatKg(v) {
    var n = Math.round((Number(v) || 0) * 1000) / 1000;
    if (!Number.isFinite(n) || n < 0.1) n = 0.1;
    return n.toFixed(3).replace(/\.?0+$/, '');
  }

  function computeTenthsFromKg(kg) {
    var v = parseFloat(String(kg).replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) v = 0.1;
    return String(Math.max(1, Math.round(v * 10)));
  }

  function syncPanels(root, mode) {
    var unitPanel = root.querySelector('[data-main-panel="unit"]');
    var weightPanel = root.querySelector('[data-main-panel="weight"]');
    if (unitPanel) {
      unitPanel.classList.toggle('hidden', mode !== 'unit');
      if (mode === 'unit') unitPanel.removeAttribute('hidden');
      else unitPanel.setAttribute('hidden', '');
    }
    if (weightPanel) {
      weightPanel.classList.toggle('hidden', mode !== 'weight');
      if (mode === 'weight') weightPanel.removeAttribute('hidden');
      else weightPanel.setAttribute('hidden', '');
    }
  }

  function initRoot(root) {
    var formId = root.getAttribute('data-product-form-id');
    if (!formId) return;
    var productForm = document.getElementById(formId);
    if (!productForm) return;

    var hasWeight = root.getAttribute('data-has-weight') === 'true';
    var hasUnit = root.getAttribute('data-has-unit') === 'true';
    if (!hasWeight) return;

    var unitInput = root.querySelector('.js-main-qty-unit');
    var kgInput = root.querySelector('.js-main-qty-kg');
    var modeButtons = root.querySelectorAll('[data-main-mode-btn]');

    var modePropHidden = productForm.querySelector('input[name="properties[_purchase_mode]"][data-main-qty-mode="true"]');
    if (!modePropHidden) {
      modePropHidden = document.createElement('input');
      modePropHidden.type = 'hidden';
      modePropHidden.name = 'properties[_purchase_mode]';
      modePropHidden.setAttribute('data-main-qty-mode', 'true');
      productForm.appendChild(modePropHidden);
    }

    var qtyInput = productForm.querySelector('input[name="quantity"]');
    if (!qtyInput && unitInput) {
      qtyInput = unitInput;
    }

    function currentMode() {
      var activeBtn = root.querySelector('[data-main-mode-btn].is-active');
      if (activeBtn) return activeBtn.getAttribute('data-main-mode-btn');
      if (!hasUnit) return 'weight';
      return 'unit';
    }

    function ensureWeightScaleProp(mode) {
      var existing = productForm.querySelector('input[name="properties[_weight_qty_unit_kg]"][data-main-weight-scale="true"]');
      if (mode === 'weight') {
        if (!existing) {
          existing = document.createElement('input');
          existing.type = 'hidden';
          existing.name = 'properties[_weight_qty_unit_kg]';
          existing.value = '0.1';
          existing.setAttribute('data-main-weight-scale', 'true');
          productForm.appendChild(existing);
        } else {
          existing.value = '0.1';
        }
      } else if (existing) {
        existing.remove();
      }
    }

    function applyModeValues() {
      var mode = currentMode();
      modePropHidden.value = mode;
      syncPanels(root, mode);
      ensureWeightScaleProp(mode);
      if (!qtyInput) return;
      if (mode === 'weight') {
        qtyInput.value = computeTenthsFromKg(kgInput ? kgInput.value : '1');
      } else if (unitInput) {
        qtyInput.value = unitInput.value || qtyInput.value || '1';
      }
    }

    modeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-main-mode-btn');
        modeButtons.forEach(function (b) {
          var active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        syncPanels(root, mode);
        applyModeValues();
      });
    });

    if (kgInput) {
      kgInput.addEventListener('input', function () {
        if (currentMode() === 'weight') applyModeValues();
      });
      kgInput.addEventListener('blur', function () {
        kgInput.value = formatKg(kgInput.value);
        if (currentMode() === 'weight') applyModeValues();
      });
    }

    root.querySelector('[name="kg-minus"]')?.addEventListener('click', function (e) {
      e.preventDefault();
      if (!kgInput) return;
      var v = parseFloat(String(kgInput.value).replace(',', '.'));
      if (!Number.isFinite(v)) v = 0.1;
      kgInput.value = formatKg(Math.max(0.1, v - 0.1));
      if (currentMode() === 'weight') applyModeValues();
    });

    root.querySelector('[name="kg-plus"]')?.addEventListener('click', function (e) {
      e.preventDefault();
      if (!kgInput) return;
      var v = parseFloat(String(kgInput.value).replace(',', '.'));
      if (!Number.isFinite(v)) v = 0.1;
      kgInput.value = formatKg(v + 0.1);
      if (currentMode() === 'weight') applyModeValues();
    });

    if (!hasUnit) {
      modePropHidden.value = 'weight';
      syncPanels(root, 'weight');
    }
    applyModeValues();
  }

  function initAll() {
    document.querySelectorAll('[data-main-qty-root]').forEach(initRoot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
