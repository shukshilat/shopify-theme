/**
 * Cart quantity string for weight: grams (legacy) or kg decimal (matches per-kg variant price).
 * Used for both "משקל" and "יח'" when quantity means kg.
 */
/** cart.js לפעמים מחזיר properties כמערך {name,value} — חייבים אובייקט לקריאת _purchase_mode */
function normalizeLineItemProperties(raw) {
  if (raw == null) return {};
  if (Array.isArray(raw)) {
    const o = {};
    for (const e of raw) {
      if (e && e.name != null) {
        o[String(e.name)] = e.value != null && e.value !== '' ? String(e.value) : '';
      }
    }
    return o;
  }
  if (typeof raw === 'object') return raw;
  return {};
}

function lineItemProps(item) {
  return normalizeLineItemProperties(item && item.properties);
}

if (typeof window !== 'undefined') {
  window.themeLineItemProps = lineItemProps;
}

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
  // Shopify min/max are often in grams (≥100). מספרים קטנים (<100) בכללי וריאנט הם בדרך כלל "יחידות מכירה", לא ק״ג גולמיים.
  const boundsInGrams = min >= 100 || (max != null && !Number.isNaN(max) && max >= 100);
  let minKg = min > 0 ? (boundsInGrams ? min / 1000 : min) : 0;
  let maxKg =
    max != null && !Number.isNaN(max) ? (boundsInGrams ? max / 1000 : max) : null;

  // kg_tenths: min=1 בניהול = לרוב "מינימום יחידה אחת" (= 0.1 ק״ג), לא 1 ק״ג — אחרת 0.6 נכפה ל-1.0.
  if (behavior === 'kg_tenths' && !boundsInGrams && min > 0) {
    minKg = min * 0.1;
  }

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

  const wb = form.dataset.weightBehavior || 'kg';
  if (wb !== 'kg_tenths') {
    delete properties['_weight_qty_unit_kg'];
  }

  const sectionIds = cart.getSectionsToRender().map((section) => section.id);
  const item = { id: Number(variantId), quantity, properties };
  if (wb === 'kg') {
    if (variantPricedPerTenthKg(form)) {
      const kg = Number(item.quantity);
      if (Number.isFinite(kg) && kg > 0) {
        item.quantity = Math.max(1, Math.round(kg * 10));
        item.properties._weight_qty_unit_kg = '0.1';
      }
    } else if (variantAppearsPricedPerGram(form)) {
      const kg = Number(item.quantity);
      if (Number.isFinite(kg) && kg > 0) {
        item.quantity = Math.max(1, Math.round(kg * 1000));
        delete item.properties._weight_qty_unit_kg;
      }
    }
  }
  return {
    items: [item],
    sections: sectionIds,
    sections_url: window.location.pathname,
  };
}

function themeCartJsUrl() {
  if (typeof window.Shopify !== 'undefined' && window.Shopify.routes && window.Shopify.routes.root) {
    return `${window.Shopify.routes.root}cart.js`;
  }
  return '/cart.js';
}

function lineItemQuantityAsKg(item) {
  if (!item) return 0;
  const p = lineItemProps(item);
  const wk = String(p._weight_qty_unit_kg || p['_weight_qty_unit_kg'] || '').trim();
  const q = Number(item.quantity);
  if (!Number.isFinite(q)) return 0;
  if (wk === '0.1') return q / 10;
  return q;
}

/** Sum existing cart lines as kg for same variant + _purchase_mode (before this add). */
function findPrevQtyKgForVariantMerge(cart, variantId, properties) {
  const wantMode = properties && properties._purchase_mode;
  const items = cart?.items || [];
  let sumKg = 0;
  for (const it of items) {
    if (Number(it.variant_id) !== Number(variantId)) continue;
    if (wantMode != null && wantMode !== '') {
      const p = lineItemProps(it);
      if (String(p._purchase_mode || '') !== String(wantMode)) continue;
    }
    sumKg += lineItemQuantityAsKg(it);
  }
  return sumKg;
}

/** ק״ג שהלקוח ביקש בכרטיס (רק לשונית משקל). */
function getCardRequestedKg(form, modeForCart) {
  if (!form || modeForCart !== 'weight') return null;
  const mode =
    form.querySelector('input[name="purchase_mode"]:checked')?.value ||
    form.querySelector('input[name="purchase_mode"][type="hidden"]')?.value ||
    'unit';
  if (mode !== 'weight') return null;
  const raw = form.querySelector('.js-card-qty-kg')?.value;
  const kg = parseFloat(String(raw).replace(',', '.'));
  if (!Number.isFinite(kg) || kg <= 0) return null;
  return Math.round(kg * 1000) / 1000;
}

function pickAddedLineItem(response, variantId) {
  const items = Array.isArray(response?.items) ? response.items : [];
  const same = items.filter((it) => Number(it.variant_id) === Number(variantId));
  return same.length ? same[same.length - 1] : items[items.length - 1];
}

/**
 * Shopify often floors decimal qty on /cart/add.js. /cart/change.js requires integers.
 * /cart/update.js keyed by line key may still accept decimal kg for weight products.
 */
function reconcileWeightKgLineViaCartUpdate(response, variantId, targetKg) {
  if (!response || response.status || targetKg == null) return Promise.resolve(response);
  const hit = pickAddedLineItem(response, variantId);
  if (!hit || hit.key == null) return Promise.resolve(response);
  const actualKg = lineItemQuantityAsKg(hit);
  if (Math.abs(actualKg - targetKg) < 0.0001) return Promise.resolve(response);
  const url = window.routes && window.routes.cart_update_url;
  if (!url) return Promise.resolve(response);

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ updates: { [String(hit.key)]: targetKg } }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((cart) => {
      if (!cart || !Array.isArray(cart.items)) return response;
      const line = cart.items.find((it) => String(it.key) === String(hit.key));
      if (!line || Math.abs(lineItemQuantityAsKg(line) - targetKg) > 0.0001) return response;
      return {
        ...response,
        ...cart,
        items: cart.items,
        __reconciled: true,
      };
    })
    .catch(() => response);
}

function mergeFreshCartSectionsIntoResponse(response) {
  if (!response) return Promise.resolve(response);
  const cartUrl = (window.routes && window.routes.cart_url) || '/cart';
  const ids = ['cart-drawer', 'cart-icon-bubble'];
  const sections = { ...(response.sections || {}) };
  return Promise.all(
    ids.map((id) =>
      fetch(`${cartUrl}?section_id=${encodeURIComponent(id)}`)
        .then((r) => (r.ok ? r.text() : ''))
        .then((html) => {
          if (html) sections[id] = html;
        })
    )
  ).then(() => ({ ...response, sections }));
}

/** Variant price ≈ (מחיר לק״ג)/10 → כמות בעגלה בעשיריות עם _weight_qty_unit_kg */
function variantPricedPerTenthKg(form) {
  const vc = parseInt(form?.dataset?.variantCents, 10);
  const cpk = parseInt(form?.dataset?.centsPerKg, 10);
  if (!Number.isFinite(vc) || !Number.isFinite(cpk) || cpk <= 0) return false;
  return Math.abs(vc * 10 - cpk) <= Math.max(3, Math.round(cpk * 0.02));
}

/** Variant price ≈ (מחיר לק״ג)/1000 → כמות בעגלה בגרמים שלמים */
function variantAppearsPricedPerGram(form) {
  const vc = parseInt(form?.dataset?.variantCents, 10);
  const cpk = parseInt(form?.dataset?.centsPerKg, 10);
  if (!Number.isFinite(vc) || !Number.isFinite(cpk) || cpk <= 0) return false;
  const perGram = Math.round(cpk / 1000);
  if (perGram < 1) return false;
  return Math.abs(vc - perGram) <= Math.max(1, Math.round(perGram * 0.15));
}

/**
 * אחרי add שמעגל למספר שלם: מוחקים שורה ומוסיפים עם כמות שלמה (עשיריות או גרמים)
 * שמתאימה למחיר הווריאנט בניהול.
 */
function readdWeightLineWithScaledIntegerQty(response, form, cardPayload, targetKg) {
  const variantId = Number(cardPayload.items[0].id);
  const baseProps = { ...cardPayload.items[0].properties };
  const hit = pickAddedLineItem(response, variantId);
  if (!hit || hit.key == null) return Promise.resolve(response);

  let nextQty = null;
  const nextProps = { ...baseProps };
  if (variantPricedPerTenthKg(form)) {
    nextQty = Math.max(1, Math.round(targetKg * 10));
    nextProps._weight_qty_unit_kg = '0.1';
  } else if (variantAppearsPricedPerGram(form)) {
    nextQty = Math.max(1, Math.round(targetKg * 1000));
    delete nextProps._weight_qty_unit_kg;
  } else {
    return Promise.resolve(response);
  }

  const changeUrl = window.routes && window.routes.cart_change_url;
  const addUrl = window.routes && window.routes.cart_add_url;
  if (!changeUrl || !addUrl) return Promise.resolve(response);

  return fetch(changeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id: hit.key, quantity: 0 }),
  })
    .then((r) => {
      if (!r.ok) throw new Error('clear line');
      return fetch(addUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: [{ id: variantId, quantity: nextQty, properties: nextProps }],
          sections: cardPayload.sections,
          sections_url: cardPayload.sections_url,
        }),
      });
    })
    .then((r) => r.json())
    .then((addRes) => {
      if (addRes.status) return response;
      return fetch(themeCartJsUrl())
        .then((rr) => rr.json())
        .then((cart) => ({
          ...response,
          ...addRes,
          ...cart,
          items: cart.items,
          __reconciled: true,
        }));
    })
    .catch(() => response);
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

        // יחידות = מספר שלם; משקל = ק״ג (עם לשונית משקל בלבד)
        if (mode === 'unit') {
          const raw = form.querySelector('.js-card-qty-unit')?.value;
          qtyHidden.value = String(snapUnitQuantityInt(raw));
        } else {
          const kgRaw = form.querySelector('.js-card-qty-kg')?.value;
          applyKgFromInput(kgRaw);
        }

        form.querySelectorAll('input[name="properties[_weight_qty_unit_kg]"][data-card-weight-scale="true"]').forEach((el) =>
          el.remove()
        );
        const needsWeightScaleProp = behavior === 'kg_tenths' && mode === 'weight';
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

      syncCardQtyFromCartResponse(finalResponse) {
        const form = this.form;
        if (!form || !form.classList.contains('card-product-qty__form')) return;
        if (typeof window.themeSyncCardQuantityRootFromCart !== 'function') return;
        const root = this.closest('[data-card-quantity-root]');
        if (!root) return;
        const cartLike =
          finalResponse && Array.isArray(finalResponse.items) ? finalResponse : null;
        if (cartLike) {
          window.themeSyncCardQuantityRootFromCart(root, cartLike);
          return;
        }
        fetch(themeCartJsUrl())
          .then((r) => r.json())
          .then((cart) => {
            window.themeSyncCardQuantityRootFromCart(root, cart);
          })
          .catch(() => {});
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.applyCardQuantityMode();

        const isCardQty = this.form.classList.contains('card-product-qty__form');
        const cardPurchaseMode =
          this.form.querySelector('input[name="purchase_mode"]:checked')?.value ||
          this.form.querySelector('input[name="purchase_mode"][type="hidden"]')?.value ||
          'unit';
        if (
          isCardQty &&
          cardPurchaseMode === 'weight' &&
          this.form.getAttribute('data-card-weight-price-mismatch') === 'true'
        ) {
          this.handleErrorMessage(
            'מחיר הווריאנט בניהול חייב להיות לפי 0.1 ק״ג. חלקו את מחיר הק״ג ב־10 (למשל ₪20/ק״ג → ₪2 בווריאנט). אחרי השמירה ההוספה לעגלה תתאים לכמות ולמחיר בכרטיס.'
          );
          return;
        }

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');
        let modeForCart = null;
        if (isCardQty) {
          const mode =
            this.form.querySelector('input[name="purchase_mode"]:checked')?.value ||
            this.form.querySelector('input[name="purchase_mode"][type="hidden"]')?.value ||
            'unit';
          modeForCart = mode;
        }

        const variantIdForEvents = this.form.querySelector('[name="id"]')?.value;

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        let formData = null;
        const cardPayload =
          isCardQty && this.cart ? buildCardCartAddJsonPayload(this.form, this.cart, modeForCart) : null;
        if (cardPayload) {
          config.headers['Content-Type'] = 'application/json';
          config.headers['Accept'] = 'application/json';
          config.body = JSON.stringify(cardPayload);
        }
        if (!config.body) {
          formData = new FormData(this.form);
          formData.delete('purchase_mode');
          const wbForm = this.form.dataset.weightBehavior || 'kg';
          if (wbForm !== 'kg_tenths') {
            formData.delete('properties[_weight_qty_unit_kg]');
          }
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

        const wb = this.form.dataset.weightBehavior || 'kg';
        const needKgReconcile =
          Boolean(cardPayload) && modeForCart === 'weight' && wb === 'kg';

        const requestedKg = getCardRequestedKg(this.form, modeForCart);
        const targetLineQtyPromise =
          needKgReconcile && requestedKg != null
            ? fetch(themeCartJsUrl())
                .then((r) => r.json())
                .then((cart) => {
                  const row = cardPayload.items[0];
                  const prevKg = findPrevQtyKgForVariantMerge(cart, row.id, row.properties);
                  return Math.round((prevKg + requestedKg) * 1000) / 1000;
                })
                .catch(() => Math.round(requestedKg * 1000) / 1000)
            : Promise.resolve(null);

        if (this.cart) {
          const anchorForCart =
            evt.submitter ||
            this.closest('[data-card-quantity-root]') ||
            this.closest('.product-card-wrapper') ||
            this.submitButton;
          this.cart.setActiveElement(anchorForCart);
        }

        const cartAddUrl =
          (typeof window.routes !== 'undefined' && window.routes.cart_add_url) || '/cart/add.js';

        targetLineQtyPromise
          .then((targetLineQty) =>
            fetch(cartAddUrl, config)
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

                let pipeline = Promise.resolve(response);
                if (needKgReconcile && targetLineQty != null && variantIdForEvents) {
                  pipeline = pipeline
                    .then((r) =>
                      reconcileWeightKgLineViaCartUpdate(r, Number(variantIdForEvents), targetLineQty)
                    )
                    .then((fr) => {
                      if (fr && fr.__reconciled) return fr;
                      if (cardPayload && this.form) {
                        return readdWeightLineWithScaledIntegerQty(
                          fr,
                          this.form,
                          cardPayload,
                          targetLineQty
                        );
                      }
                      return fr;
                    })
                    .then((fr) => {
                      if (fr && fr.__reconciled) {
                        const next = { ...fr };
                        delete next.__reconciled;
                        return mergeFreshCartSectionsIntoResponse(next);
                      }
                      return fr;
                    });
                }

                return pipeline.then((finalResponse) => {
                  const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');
                  if (!this.error)
                    publish(PUB_SUB_EVENTS.cartUpdate, {
                      source: 'product-form',
                      productVariantId: variantIdForEvents || formData?.get?.('id'),
                      cartData: finalResponse,
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
                          CartPerformance.measure('add:paint-updated-sections', () => {
                            this.paintCartUIAfterAdd(finalResponse);
                          });
                          this.syncCardQtyFromCartResponse(finalResponse);
                        });
                      },
                      { once: true }
                    );
                    quickAddModal.hide(true);
                  } else {
                    CartPerformance.measure('add:paint-updated-sections', () => {
                      this.paintCartUIAfterAdd(finalResponse);
                    });
                    this.syncCardQtyFromCartResponse(finalResponse);
                  }
                });
              })
          )
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');

            CartPerformance.measureFromEvent('add:user-action', evt);
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
