/**
 * Toggle unit vs weight panels on product cards (single-variant).
 */
(function () {
  function syncPanels(root) {
    const form = root.querySelector('form.card-product-qty__form');
    if (!form) return;
    const unitPanel = root.querySelector('[data-card-panel="unit"]');
    const weightPanel = root.querySelector('[data-card-panel="weight"]');
    if (!unitPanel || !weightPanel) return;

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

  function initKgStepper(root) {
    root.querySelectorAll('[data-card-kg-stepper]').forEach((wrap) => {
      const input = wrap.querySelector('.js-card-qty-kg');
      if (!input) return;
      const step = parseFloat(input.getAttribute('step')) || 0.1;
      const min = parseFloat(input.getAttribute('min')) || 0.1;

      const setValue = (next) => {
        const v = Math.round(next * 1000) / 1000;
        input.value = String(v);
        input.dispatchEvent(new Event('change', { bubbles: true }));
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
    form.querySelectorAll('input[name="purchase_mode"]').forEach((input) => {
      input.addEventListener('change', () => syncPanels(root));
    });
    syncPanels(root);
    initKgStepper(root);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-card-quantity-root]').forEach(init);
  });
})();
