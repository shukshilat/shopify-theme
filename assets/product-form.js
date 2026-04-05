/**
 * Cart quantity string for weight: grams (legacy) or kg decimal (matches per-kg variant price).
 * Used for both "משקל" and "יח'" when quantity means kg.
 */
function computeCardKgQuantityValue(kg, behavior, min, max, increment) {
  const grams = Math.round(kg * 1000);

  if (behavior === 'grams') {
    let g = Math.max(1, grams);
    if (increment > 1) {
      g = Math.round(g / increment) * increment;
      if (g < min) g = min;
    }
    if (max != null && !Number.isNaN(max)) g = Math.min(g, max);
    return String(Math.max(1, g));
  }

  let kgQty = Math.max(0.001, Math.round(kg * 1000) / 1000);
  const stepKg = increment > 1 ? increment / 1000 : 0.1;
  if (increment > 1) {
    kgQty = Math.round(kgQty / stepKg) * stepKg;
    kgQty = Math.round(kgQty * 1000) / 1000;
  } else {
    kgQty = Math.round(kgQty / 0.1) * 0.1;
    kgQty = Math.round(kgQty * 1000) / 1000;
  }
  // Shopify min/max are often in grams (≥100); if min is small (e.g. 1), treat as kg already.
  const boundsInGrams = min >= 100 || (max != null && !Number.isNaN(max) && max >= 100);
  const minKg = min > 0 ? (boundsInGrams ? min / 1000 : min) : 0;
  const maxKg =
    max != null && !Number.isNaN(max) ? (boundsInGrams ? max / 1000 : max) : null;
  if (minKg > 0) {
    kgQty = Math.max(minKg, kgQty);
  }
  if (maxKg != null) {
    kgQty = Math.min(maxKg, kgQty);
  }

  // kg_tenths: integer cart qty = tenths of kg (12 = 1.2 kg). Variant price in Admin must be per 0.1 kg (e.g. ₪2 when shelf price is ₪20/kg).
  if (behavior === 'kg_tenths') {
    const minTenths = minKg > 0 ? Math.max(1, Math.round(minKg * 10)) : 1;
    let tenths = Math.round(kgQty * 10);
    tenths = Math.max(minTenths, tenths);
    if (maxKg != null && !Number.isNaN(maxKg)) {
      const maxTenths = Math.max(minTenths, Math.round(maxKg * 10));
      tenths = Math.min(maxTenths, tenths);
    }
    return String(Math.max(1, tenths));
  }

  // kg (default): decimal kg in cart — matches “price per kg” variant pricing when Shopify accepts fractional qty.
  return String(kgQty);
}

/**
 * Card quick-add: JSON body so quantity is a real number (decimals survive; FormData can be lossy in some paths).
 */
function buildCardCartAddJsonPayload(form, cart, modeForCart) {
  const variantId = form.querySelector('[name="id"]')?.value;
  if (!variantId) return null;

  const qtyEl = form.querySelector(
    'input.card-product-qty__quantity-hidden[name="quantity"], input[name="quantity"]'
  );
  const qtyRaw = qtyEl?.value ?? '1';
  let quantity = parseFloat(String(qtyRaw).replace(',', '.'));
  if (Number.isNaN(quantity) || quantity <= 0) quantity = 1;

  const properties = {};
  form.querySelectorAll('[name^="properties["]').forEach((el) => {
    if (!el.name || el.disabled) return;
    const m = el.name.match(/^properties\[(.+)\]$/);
    if (m) properties[m[1]] = el.value;
  });
  if (modeForCart) properties['_purchase_mode'] = modeForCart;

  const sectionIds = cart.getSectionsToRender().map((section) => section.id);
  return {
    items: [{ id: Number(variantId), quantity, properties }],
    sections: sectionIds,
    sections_url: window.location.pathname,
  };
}

if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        // Prefer drawer when present — notification mode still has no <cart-drawer>; avoids wrong renderContents targets.
        this.cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText =
          this.submitButton.querySelector('[data-product-form-submit-label]') ||
          this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      applyCardQuantityMode() {
        const form = this.form;
        if (!form || !form.classList.contains('card-product-qty__form')) return;

        const behavior = form.dataset.weightBehavior || 'kg';
        const mode =
          form.querySelector('input[name="purchase_mode"]:checked')?.value ||
          form.querySelector('input[name="purchase_mode"][type="hidden"]')?.value ||
          'unit';

        const qtyHidden = form.querySelector('.card-product-qty__quantity-hidden');
        if (!qtyHidden) return;

        const min = parseInt(form.dataset.qtyMin || '1', 10) || 1;
        const max =
          form.dataset.qtyMax && form.dataset.qtyMax !== ''
            ? parseInt(form.dataset.qtyMax, 10)
            : null;
        const increment = parseInt(form.dataset.qtyIncrement || '1', 10) || 1;

        const root = form.closest('[data-card-quantity-root]');
        const sellByWeightAndUnit = root?.dataset?.showWeight === 'true';

        form.querySelectorAll('input[name^="properties["][data-card-weight-prop="true"]').forEach((el) =>
          el.remove()
        );

        const snapUnitQuantityInt = (raw) => {
          let q = parseInt(raw, 10);
          if (Number.isNaN(q)) q = min;
          q = Math.max(min, q);
          if (increment > 1) {
            const k = Math.ceil((q - min) / increment);
            q = min + k * increment;
          }
          if (max != null && !Number.isNaN(max)) q = Math.min(q, max);
          return Math.max(1, q);
        };

        const applyKgFromInput = (kgRaw) => {
          const kg = parseFloat(String(kgRaw).replace(',', '.')) || 0.1;
          if (behavior === 'property') {
            qtyHidden.value = '1';
            const inp = document.createElement('input');
            inp.type = 'hidden';
            inp.name = 'properties[משקל]';
            inp.setAttribute('data-card-weight-prop', 'true');
            inp.value = `${String(kg).replace(/\.?0+$/, '')} ק״ג`;
            form.appendChild(inp);
            return;
          }
          qtyHidden.value = computeCardKgQuantityValue(kg, behavior, min, max, increment);
        };

        // יח' על מוצר שנמכר לפי משקל: המספר בשדה = ק״ג (לא יחידות שלמות) — כמו לשונית ק״ג
        if (mode === 'unit' && sellByWeightAndUnit) {
          const kgRaw = form.querySelector('.js-card-qty-unit')?.value;
          applyKgFromInput(kgRaw);
        } else if (mode === 'unit') {
          const raw = form.querySelector('.js-card-qty-unit')?.value;
          qtyHidden.value = String(snapUnitQuantityInt(raw));
        } else {
          const kgRaw = form.querySelector('.js-card-qty-kg')?.value;
          applyKgFromInput(kgRaw);
        }

        form.querySelectorAll('input[name="properties[_weight_qty_unit_kg]"][data-card-weight-scale="true"]').forEach((el) =>
          el.remove()
        );
        const needsWeightScaleProp =
          behavior === 'kg_tenths' &&
          (mode === 'weight' || (mode === 'unit' && sellByWeightAndUnit));
        if (needsWeightScaleProp) {
          const p = document.createElement('input');
          p.type = 'hidden';
          p.name = 'properties[_weight_qty_unit_kg]';
          p.value = '0.1';
          p.setAttribute('data-card-weight-scale', 'true');
          form.appendChild(p);
        }
      }

      paintCartUIAfterAdd(response) {
        if (!this.cart) return;
        const isDrawer = this.cart.tagName === 'CART-DRAWER';
        const drawerSectionHtml = response.sections && response.sections['cart-drawer'];
        const drawerSectionOk =
          typeof drawerSectionHtml === 'string' && drawerSectionHtml.length > 0;

        if (isDrawer && !drawerSectionOk && typeof window.themeRefreshCartDrawerFromSection === 'function') {
          window.themeRefreshCartDrawerFromSection();
          return;
        }

        try {
          this.cart.renderContents(response);
        } catch (e) {
          console.error(e);
          if (isDrawer && typeof window.themeRefreshCartDrawerFromSection === 'function') {
            window.themeRefreshCartDrawerFromSection();
          }
        }
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.applyCardQuantityMode();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const isCardQty = this.form.classList.contains('card-product-qty__form');
        let modeForCart = null;
        if (isCardQty) {
          const root = this.form.closest('[data-card-quantity-root]');
          const sellByWeightAndUnit = root?.dataset?.showWeight === 'true';
          const mode =
            this.form.querySelector('input[name="purchase_mode"]:checked')?.value ||
            this.form.querySelector('input[name="purchase_mode"][type="hidden"]')?.value ||
            'unit';
          modeForCart = sellByWeightAndUnit && mode === 'unit' ? 'weight' : mode;
        }

        const variantIdForEvents = this.form.querySelector('[name="id"]')?.value;

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        let formData = null;
        if (isCardQty && this.cart) {
          const payload = buildCardCartAddJsonPayload(this.form, this.cart, modeForCart);
          if (payload) {
            config.headers['Content-Type'] = 'application/json';
            config.headers['Accept'] = 'application/json';
            config.body = JSON.stringify(payload);
          }
        }
        if (!config.body) {
          formData = new FormData(this.form);
          formData.delete('purchase_mode');
          if (isCardQty && modeForCart) {
            formData.set('properties[_purchase_mode]', modeForCart);
          }
          if (this.cart) {
            formData.append(
              'sections',
              this.cart.getSectionsToRender().map((section) => section.id)
            );
            formData.append('sections_url', window.location.pathname);
          }
          config.body = formData;
        }

        if (this.cart) {
          const anchorForCart =
            evt.submitter ||
            this.closest('[data-card-quantity-root]') ||
            this.closest('.product-card-wrapper') ||
            this.submitButton;
          this.cart.setActiveElement(anchorForCart);
        }

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: variantIdForEvents || formData?.get?.('id'),
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButtonText.classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');
            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: variantIdForEvents || formData?.get?.('id'),
                cartData: response,
              }).then(() => {
                CartPerformance.measureFromMarker('add:wait-for-subscribers', startMarker);
              });
            this.error = false;
            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    CartPerformance.measure("add:paint-updated-sections", () => {
                      this.paintCartUIAfterAdd(response);
                    });
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              CartPerformance.measure("add:paint-updated-sections", () => {
                this.paintCartUIAfterAdd(response);
              });
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');

            CartPerformance.measureFromEvent("add:user-action", evt);
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
