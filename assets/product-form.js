if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
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

        const behavior = form.dataset.weightBehavior || 'grams';
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

        form.querySelectorAll('input[name^="properties["][data-card-weight-prop="true"]').forEach((el) =>
          el.remove()
        );

        const snapUnitQuantity = (raw) => {
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

        if (mode === 'unit') {
          const raw = form.querySelector('.js-card-qty-unit')?.value;
          qtyHidden.value = String(snapUnitQuantity(raw));
          return;
        }

        const kg = parseFloat(form.querySelector('.js-card-qty-kg')?.value) || 0.1;
        const grams = Math.round(kg * 1000);

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

        let g = Math.max(1, grams);
        if (increment > 1) {
          g = Math.round(g / increment) * increment;
          if (g < min) g = min;
        }
        if (max != null && !Number.isNaN(max)) g = Math.min(g, max);
        qtyHidden.value = String(Math.max(1, g));
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.applyCardQuantityMode();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        formData.delete('purchase_mode');
        if (this.form.classList.contains('card-product-qty__form')) {
          const mode =
            this.form.querySelector('input[name="purchase_mode"]:checked')?.value ||
            this.form.querySelector('input[name="purchase_mode"][type="hidden"]')?.value ||
            'unit';
          formData.set('properties[_purchase_mode]', mode);
        }
        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append('sections_url', window.location.pathname);
          const anchorForCart =
            evt.submitter ||
            this.closest('[data-card-quantity-root]') ||
            this.closest('.product-card-wrapper') ||
            this.submitButton;
          this.cart.setActiveElement(anchorForCart);
        }
        config.body = formData;

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formData.get('id'),
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
                productVariantId: formData.get('id'),
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
                      this.cart.renderContents(response);
                    });
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              CartPerformance.measure("add:paint-updated-sections", () => {
                this.cart.renderContents(response);
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
