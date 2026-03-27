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

  function init(root) {
    const form = root.querySelector('form');
    if (!form) return;
    form.querySelectorAll('input[name="purchase_mode"]').forEach((input) => {
      input.addEventListener('change', () => syncPanels(root));
    });
    syncPanels(root);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-card-quantity-root]').forEach(init);
  });
})();
