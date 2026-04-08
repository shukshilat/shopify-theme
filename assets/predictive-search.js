/** מקסימום מוצרים במגש החיפוש החי אחרי מיזוג API + סקשן (דף החיפוש המלא מציג הכל) */
const PREDICTIVE_MERGED_MAX_PRODUCTS = 24;

class PredictiveSearch extends SearchForm {
  constructor() {
    super();
    this.cachedResults = {};
    this.predictiveSearchResults = this.querySelector('[data-predictive-search]');
    this.allPredictiveSearchInstances = document.querySelectorAll('predictive-search');
    this.isOpen = false;
    this.abortController = new AbortController();
    this.searchTerm = '';

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.input.form.addEventListener('submit', this.onFormSubmit.bind(this));

    this.input.addEventListener('focus', this.onFocus.bind(this));
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    this.addEventListener('keyup', this.onKeyup.bind(this));
    this.addEventListener('keydown', this.onKeydown.bind(this));
  }

  getQuery() {
    return this.input.value.trim();
  }

  onChange() {
    super.onChange();
    const newSearchTerm = this.getQuery();
    if (!this.searchTerm || !newSearchTerm.startsWith(this.searchTerm)) {
      // Remove the results when they are no longer relevant for the new search term
      // so they don't show up when the dropdown opens again
      this.querySelector('#predictive-search-results-groups-wrapper')?.remove();
    }

    // Update the term asap, don't wait for the predictive search query to finish loading
    this.updateSearchForTerm(this.searchTerm, newSearchTerm);

    this.searchTerm = newSearchTerm;

    if (!this.searchTerm.length) {
      this.close(true);
      return;
    }

    this.getSearchResults(this.searchTerm);
  }

  onFormSubmit(event) {
    if (!this.getQuery().length || this.querySelector('[aria-selected="true"] a')) event.preventDefault();
  }

  onFormReset(event) {
    super.onFormReset(event);
    if (super.shouldResetForm()) {
      this.searchTerm = '';
      this.abortController.abort();
      this.abortController = new AbortController();
      this.closeResults(true);
    }
  }

  onFocus() {
    const currentSearchTerm = this.getQuery();

    if (!currentSearchTerm.length) return;

    if (this.searchTerm !== currentSearchTerm) {
      // Search term was changed from other search input, treat it as a user change
      this.onChange();
    } else if (this.getAttribute('results') === 'true') {
      this.open();
    } else {
      this.getSearchResults(this.searchTerm);
    }
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onKeyup(event) {
    if (!this.getQuery().length) this.close(true);

    switch (event.code) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'Enter':
        event.preventDefault();
        break;
    }

    switch (event.code) {
      case 'ArrowUp':
        this.switchOption('up');
        break;
      case 'ArrowDown':
        this.switchOption('down');
        break;
      case 'Enter':
        this.selectOption();
        break;
    }
  }

  onKeydown(event) {
    // Prevent the cursor from moving in the input when using the up and down arrow keys
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      event.preventDefault();
    }
  }

  updateSearchForTerm(previousTerm, newTerm) {
    const searchForTextElement = this.querySelector('[data-predictive-search-search-for-text]');
    const currentButtonText = searchForTextElement?.innerText;
    if (currentButtonText) {
      if (currentButtonText.match(new RegExp(previousTerm, 'g')).length > 1) {
        // The new term matches part of the button text and not just the search term, do not replace to avoid mistakes
        return;
      }
      const newButtonText = currentButtonText.replace(previousTerm, newTerm);
      searchForTextElement.innerText = newButtonText;
    }
  }

  switchOption(direction) {
    if (!this.getAttribute('open')) return;

    const moveUp = direction === 'up';
    const selectedElement = this.querySelector('[aria-selected="true"]');

    // Filter out hidden elements (duplicated page and article resources) thanks
    // to this https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent
    const allVisibleElements = Array.from(this.querySelectorAll('li, button.predictive-search__item')).filter(
      (element) => element.offsetParent !== null
    );
    let activeElementIndex = 0;

    if (moveUp && !selectedElement) return;

    let selectedElementIndex = -1;
    let i = 0;

    while (selectedElementIndex === -1 && i <= allVisibleElements.length) {
      if (allVisibleElements[i] === selectedElement) {
        selectedElementIndex = i;
      }
      i++;
    }

    this.statusElement.textContent = '';

    if (!moveUp && selectedElement) {
      activeElementIndex = selectedElementIndex === allVisibleElements.length - 1 ? 0 : selectedElementIndex + 1;
    } else if (moveUp) {
      activeElementIndex = selectedElementIndex === 0 ? allVisibleElements.length - 1 : selectedElementIndex - 1;
    }

    if (activeElementIndex === selectedElementIndex) return;

    const activeElement = allVisibleElements[activeElementIndex];

    activeElement.setAttribute('aria-selected', true);
    if (selectedElement) selectedElement.setAttribute('aria-selected', false);

    this.input.setAttribute('aria-activedescendant', activeElement.id);
  }

  selectOption() {
    const selectedOption = this.querySelector('[aria-selected="true"] a, button[aria-selected="true"]');

    if (selectedOption) selectedOption.click();
  }

  getSearchResults(searchTerm) {
    /* ביטול בקשות קודמות — בלי זה תשובות ישנות דורסות חיפוש חדש והממשק נראה “תקוע” */
    this.abortController.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const termSnapshot = searchTerm;

    const queryKey = searchTerm.replace(/\s+/g, '-').toLowerCase();
    this.setLiveRegionLoadingState();

    if (this.cachedResults[queryKey]) {
      this.renderSearchResults(this.cachedResults[queryKey]);
      return;
    }

    const suggestBase =
      typeof routes !== 'undefined' && routes.predictive_search_url ? routes.predictive_search_url : '/search/suggest';
    const htmlUrl = `${suggestBase}?q=${encodeURIComponent(searchTerm)}&section_id=predictive-search`;
    const suggestJsonRoot = suggestBase.replace(/\/$/, '');
    const searchBase =
      typeof routes !== 'undefined' && routes.search_url ? routes.search_url : '/search';

    const loadMarkup = async () => {
      /* בקשת JSON אחת (כל סוגי המשאבים) — יציבה יותר משני נתיבים נפרדים */
      const jsonAllUrl = `${suggestJsonRoot}.json?${new URLSearchParams({
        q: searchTerm,
        'resources[type]': 'product,query,collection,page,article',
        'resources[limit]': '10',
        'resources[limit_scope]': 'each',
      }).toString()}`;

      let rAll = null;
      let sectionHtml = '';
      try {
        const results = await Promise.all([
          fetch(jsonAllUrl, { signal }).then((r) => (r.ok ? r.json() : null)),
          PredictiveSearch.fetchSearchSectionMarkup(searchBase, searchTerm, signal).catch((err) => {
            if (err?.name === 'AbortError' || err?.code === 20) throw err;
            return '';
          }),
        ]);
        rAll = results[0];
        sectionHtml = typeof results[1] === 'string' ? results[1] : '';
      } catch (error) {
        if (error?.name === 'AbortError' || error?.code === 20) throw error;
      }

      const res = rAll?.resources?.results || {};
      const apiProducts = res.products || [];
      const sectionProducts = PredictiveSearch.parseProductsFromPredictiveHtmlFragment(sectionHtml);
      const mergedProducts = PredictiveSearch.mergeProductListsForPreview(
        apiProducts,
        sectionProducts,
        PREDICTIVE_MERGED_MAX_PRODUCTS
      );
      const combinedData = {
        resources: {
          results: {
            queries: res.queries || [],
            collections: res.collections || [],
            products: mergedProducts,
            pages: res.pages || [],
            articles: res.articles || [],
          },
        },
      };

      const fromMerge = PredictiveSearch.buildMarkupFromSuggestJson(combinedData, searchTerm);
      if (fromMerge) return fromMerge;

      /* גם בעברית — אם המיזוג ריק, ניסיון suggest הרשמי של Shopify */
      try {
        const response = await fetch(htmlUrl, { signal });
        if (!response.ok) throw new Error('html');
        const text = await response.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const sectionRoot = doc.querySelector('#shopify-section-predictive-search');
        const inner = sectionRoot?.innerHTML?.trim() ?? '';
        if (inner.includes('id="predictive-search-results"')) {
          const hasSuggestions = sectionRoot.querySelector('.predictive-search__list-item');
          if (hasSuggestions) return inner;
        }
      } catch (error) {
        if (error?.name === 'AbortError' || error?.code === 20) throw error;
      }

      try {
        const fromPage = await PredictiveSearch.fetchFullSearchPageMarkup(searchBase, searchTerm, signal);
        if (fromPage.includes('id="predictive-search-results"')) return fromPage;
      } catch (error) {
        if (error?.name === 'AbortError' || error?.code === 20) throw error;
      }

      return PredictiveSearch.buildMinimalFallbackMarkup(searchTerm);
    };

    loadMarkup()
      .then((resultsMarkup) => {
        if (this.getQuery() !== termSnapshot) return;
        this.allPredictiveSearchInstances.forEach((predictiveSearchInstance) => {
          predictiveSearchInstance.cachedResults[queryKey] = resultsMarkup;
        });
        this.renderSearchResults(resultsMarkup);
      })
      .catch((error) => {
        if (error?.name === 'AbortError' || error?.code === 20) return;
        this.close();
      });
  }

  /**
   * Full /search page HTML (no section_id) — works when Section Rendering 404s; parses main-search product grid.
   */
  static async fetchFullSearchPageMarkup(searchBase, searchTerm, signal) {
    const url = `${searchBase}?${new URLSearchParams({
      q: searchTerm,
      type: 'product',
      'options[prefix]': 'last',
    }).toString()}`;
    const response = await fetch(url, { signal, credentials: 'same-origin' });
    if (!response.ok) return '';
    const text = await response.text();
    return PredictiveSearch.buildMarkupFromSearchPageHtml(text, searchTerm);
  }

  static buildMarkupFromSearchPageHtml(htmlText, searchTerm) {
    try {
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');
      const root =
        doc.getElementById('product-grid') ||
        doc.querySelector('.template-search__results.collection') ||
        doc.querySelector('#ProductGridContainer');
      if (!root) return '';

      const items = root.querySelectorAll('li.grid__item');
      const products = [];
      const seen = new Set();

      items.forEach((li) => {
        const link =
          li.querySelector('.card__heading a[href*="/products/"]') ||
          li.querySelector('a.full-unstyled-link[href*="/products/"]') ||
          li.querySelector('a[href*="/products/"]');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href || seen.has(href)) return;
        seen.add(href);

        const title = (link.textContent || '').trim();
        /* תמונת מוצר בלבד — לא אייקון "מיוצר בישראל" שנמצא לפניה ב־.card__media */
        const imgEl =
          li.querySelector('.card__media .media img[src]') ||
          li.querySelector('.card__inner .media img[src]') ||
          li.querySelector('.card__media img[src]:not(.card__blue-white-badge__icon)') ||
          li.querySelector('img[src]:not(.card__blue-white-badge__icon)');
        const image = imgEl ? imgEl.getAttribute('src') || '' : '';
        const unitPriceEl = li.querySelector('.unit-price-custom');
        const priceEl = li.querySelector('.price');
        let price = '';
        if (unitPriceEl) {
          price = unitPriceEl.textContent.replace(/\s+/g, ' ').trim();
        } else if (priceEl) {
          const saleOnly = priceEl.querySelector('.price-item--sale.price-item--last');
          price = saleOnly
            ? saleOnly.textContent.replace(/\s+/g, ' ').trim()
            : priceEl.textContent.replace(/\s+/g, ' ').trim();
        }

        products.push({ title, url: href, image, price });
      });

      if (products.length === 0) return '';

      const payload = {
        resources: {
          results: {
            queries: [],
            collections: [],
            products: products.slice(0, PREDICTIVE_MERGED_MAX_PRODUCTS),
            pages: [],
            articles: [],
          },
        },
      };
      return PredictiveSearch.buildMarkupFromSuggestJson(payload, searchTerm);
    } catch (e) {
      return '';
    }
  }

  static async fetchSearchSectionMarkup(searchBase, searchTerm, signal) {
    const params = {
      q: searchTerm,
      type: 'product',
      'options[prefix]': 'last',
    };
    const urlSectionId = `${searchBase}?${new URLSearchParams({
      ...params,
      section_id: 'search-predictive-fallback',
    }).toString()}`;
    let response = await fetch(urlSectionId, { signal });
    if (response.ok) {
      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const extracted = PredictiveSearch.extractStorefrontPredictiveMarkup(doc);
      if (extracted.includes('id="predictive-search-results"')) return extracted;
    }
    const urlSections = `${searchBase}?${new URLSearchParams({
      ...params,
      sections: 'search-predictive-fallback',
    }).toString()}`;
    response = await fetch(urlSections, { signal });
    if (!response.ok) return '';
    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('storefront-json');
      }
      const html = data['search-predictive-fallback'];
      if (!html || typeof html !== 'string') throw new Error('storefront-json');
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return PredictiveSearch.extractStorefrontPredictiveMarkup(doc);
    }
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return PredictiveSearch.extractStorefrontPredictiveMarkup(doc);
  }

  /**
   * Section Rendering returns id="shopify-section-…" (filename or template hash).
   * Fallback: grab #predictive-search-results + live region span from full HTML.
   */
  static extractStorefrontPredictiveMarkup(doc) {
    const sectionRoot =
      doc.querySelector('#shopify-section-search-predictive-fallback') ||
      doc.querySelector('[id*="search-predictive-fallback"]') ||
      [...doc.querySelectorAll('.shopify-section')].find((el) => el.querySelector('#predictive-search-results'));
    if (sectionRoot) {
      const inner = sectionRoot.innerHTML?.trim() ?? '';
      if (inner.includes('id="predictive-search-results"')) return inner;
    }
    const results = doc.getElementById('predictive-search-results');
    if (!results) return '';
    const live = doc.querySelector('[data-predictive-search-live-region-count-value]');
    let html = results.outerHTML;
    if (live && !results.contains(live)) html += live.outerHTML;
    return html;
  }

  static normalizeSuggestApiProduct(p) {
    if (!p) return null;
    let url = p.url || '';
    if (!url && p.handle) {
      url = `/products/${String(p.handle).replace(/^\/+/, '')}`;
    }
    if (!url || !String(url).includes('/products/')) return null;
    return {
      title: p.title || '',
      url,
      image:
        p.image ||
        p.featured_image?.url ||
        (typeof p.featured_image === 'string' ? p.featured_image : '') ||
        '',
      price: typeof p.price === 'string' ? p.price : p.price ? String(p.price) : '',
    };
  }

  static productUrlKey(url) {
    if (!url) return '';
    try {
      const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://shop.example';
      const u = new URL(url, origin);
      return u.pathname.replace(/\/$/, '').toLowerCase();
    } catch {
      return String(url).split('?')[0].replace(/\/$/, '').toLowerCase();
    }
  }

  static mergeProductListsForPreview(fromApi, fromHtml, maxLen) {
    const seen = new Set();
    const out = [];
    const push = (p) => {
      if (!p || !p.url || !String(p.url).includes('/products/')) return;
      const k = PredictiveSearch.productUrlKey(p.url);
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push({
        title: p.title || '',
        url: p.url,
        image: p.image || '',
        price: p.price || '',
      });
    };
    (fromApi || []).forEach((raw) => {
      const n = PredictiveSearch.normalizeSuggestApiProduct(raw);
      if (n) push(n);
    });
    (fromHtml || []).forEach((p) => push(p));
    return out.slice(0, maxLen);
  }

  static parseProductsFromPredictiveHtmlFragment(htmlFragment) {
    if (!htmlFragment || typeof htmlFragment !== 'string') return [];
    if (!htmlFragment.includes('predictive-search-results')) return [];
    try {
      const doc = new DOMParser().parseFromString(htmlFragment, 'text/html');
      const pushFromLi = (li, products, seen) => {
        const a = li.querySelector('a[href*="/products/"]');
        if (!a) return;
        const url = a.getAttribute('href') || '';
        const k = PredictiveSearch.productUrlKey(url);
        if (!k || seen.has(k)) return;
        seen.add(k);
        const titleEl = li.querySelector('.predictive-search__item-heading');
        const title = titleEl ? titleEl.textContent.trim() : '';
        const img = li.querySelector('img.predictive-search__image');
        const image = img ? img.getAttribute('src') || '' : '';
        const unit = li.querySelector('.unit-price-custom');
        let price = '';
        if (unit) price = unit.textContent.replace(/\s+/g, ' ').trim();
        else {
          const pe = li.querySelector('.predictive-search__item-price .price, .price');
          if (pe) price = pe.textContent.replace(/\s+/g, ' ').trim();
        }
        products.push({ title, url, image, price });
      };

      const products = [];
      const seen = new Set();
      const list =
        doc.getElementById('predictive-search-results-products-list') ||
        doc.querySelector('[id="predictive-search-results-products-list"]');
      if (list) {
        list.querySelectorAll('li.predictive-search__list-item').forEach((li) => pushFromLi(li, products, seen));
      } else {
        const root = doc.getElementById('predictive-search-results');
        if (root) {
          root.querySelectorAll('li.predictive-search__list-item').forEach((li) => pushFromLi(li, products, seen));
        }
      }
      return products;
    } catch (e) {
      return [];
    }
  }

  static escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  static i18nReplace(template, term) {
    if (!template) return '';
    return template.replace(/__TERMS__/g, PredictiveSearch.escapeHtml(term));
  }

  static i18nResultsCount(total) {
    const t = window.predictiveSearchI18n?.results_with_count;
    if (t && t.includes('8734212')) return t.replace(/8734212/g, String(total));
    return total === 1 ? '1 result' : `${total} results`;
  }

  static buildMarkupFromSuggestJson(data, searchTerm) {
    const results = data?.resources?.results;
    if (!results) return '';

    const queries = results.queries || [];
    const collections = results.collections || [];
    const products = results.products || [];
    const pages = results.pages || [];
    const articles = results.articles || [];

    const i18n = window.predictiveSearchI18n || {};
    const esc = PredictiveSearch.escapeHtml;

    const firstColumnSize = queries.length + collections.length + pages.length + articles.length;
    const hasAnyList = firstColumnSize > 0 || products.length > 0;
    if (!hasAnyList) return '';

    let wrapperMods = 'predictive-search__results-groups-wrapper';
    if (products.length === 0) wrapperMods += ' predictive-search__results-groups-wrapper--no-products';
    if (queries.length === 0 && collections.length === 0) {
      wrapperMods += ' predictive-search__results-groups-wrapper--no-suggestions';
    }

    let html = `<div id="predictive-search-results" role="listbox"><div id="predictive-search-results-groups-wrapper" class="${wrapperMods}">`;

    if (queries.length > 0 || collections.length > 0) {
      html += `<div class="predictive-search__result-group"><div><h2 id="predictive-search-queries" class="predictive-search__heading text-body caption-with-letter-spacing">${esc(
        i18n.suggestions || 'Suggestions'
      )}</h2><ul id="predictive-search-results-queries-list" class="predictive-search__results-list list-unstyled" role="group" aria-labelledby="predictive-search-queries">`;
      queries.forEach((q, i) => {
        const url = esc(q.url || '');
        const label = q.styled_text || esc(q.text || '');
        html += `<li id="predictive-search-option-query-${i + 1}" class="predictive-search__list-item" role="option" aria-selected="false"><a href="${url}" class="predictive-search__item link link--text" tabindex="-1"><div class="predictive-search__item-content predictive-search__item-content--centered"><p class="predictive-search__item-heading predictive-search__item-query-result h5" aria-label="${esc(
          q.text || ''
        )}">${label}</p></div></a></li>`;
      });
      collections.forEach((c, i) => {
        html += `<li id="predictive-search-option-collection-${i + 1}" class="predictive-search__list-item" role="option" aria-selected="false"><a href="${esc(
          c.url
        )}" class="predictive-search__item link link--text" tabindex="-1"><div class="predictive-search__item-content predictive-search__item-content--centered"><p class="predictive-search__item-heading h5">${esc(
          c.title
        )}</p></div></a></li>`;
      });
      html += `</ul></div>`;

      if (pages.length > 0 || articles.length > 0) {
        html += `<div class="predictive-search__pages-wrapper"><h2 id="predictive-search-pages-desktop" class="predictive-search__heading text-body caption-with-letter-spacing">${esc(
          i18n.pages || 'Pages'
        )}</h2><ul id="predictive-search-results-pages-list-desktop" class="predictive-search__results-list list-unstyled" role="group" aria-labelledby="predictive-search-pages-desktop">`;
        pages.forEach((p, i) => {
          html += `<li id="predictive-search-option-page-desktop-${i + 1}" class="predictive-search__list-item" role="option" aria-selected="false"><a href="${esc(
            p.url
          )}" class="predictive-search__item link link--text" tabindex="-1"><div class="predictive-search__item-content predictive-search__item-content--centered"><p class="predictive-search__item-heading h5">${esc(
            p.title
          )}</p></div></a></li>`;
        });
        articles.forEach((a, i) => {
          html += `<li id="predictive-search-option-article-desktop-${i + 1}" class="predictive-search__list-item" role="option" aria-selected="false"><a href="${esc(
            a.url
          )}" class="predictive-search__item link link--text" tabindex="-1"><div class="predictive-search__item-content predictive-search__item-content--centered"><p class="predictive-search__item-heading h5">${esc(
            a.title
          )}</p></div></a></li>`;
        });
        html += `</ul></div>`;
      }
      html += `</div>`;
    } else if (pages.length > 0 || articles.length > 0) {
      html += `<div class="predictive-search__result-group"><div class="predictive-search__pages-wrapper"><h2 id="predictive-search-pages-desktop" class="predictive-search__heading text-body caption-with-letter-spacing">${esc(
        i18n.pages || 'Pages'
      )}</h2><ul id="predictive-search-results-pages-list-desktop" class="predictive-search__results-list list-unstyled" role="group" aria-labelledby="predictive-search-pages-desktop">`;
      pages.forEach((p, i) => {
        html += `<li id="predictive-search-option-page-desktop-${i + 1}" class="predictive-search__list-item" role="option" aria-selected="false"><a href="${esc(
          p.url
        )}" class="predictive-search__item link link--text" tabindex="-1"><div class="predictive-search__item-content predictive-search__item-content--centered"><p class="predictive-search__item-heading h5">${esc(
          p.title
        )}</p></div></a></li>`;
      });
      articles.forEach((a, i) => {
        html += `<li id="predictive-search-option-article-desktop-${i + 1}" class="predictive-search__list-item" role="option" aria-selected="false"><a href="${esc(
          a.url
        )}" class="predictive-search__item link link--text" tabindex="-1"><div class="predictive-search__item-content predictive-search__item-content--centered"><p class="predictive-search__item-heading h5">${esc(
          a.title
        )}</p></div></a></li>`;
      });
      html += `</ul></div></div>`;
    }

    if (products.length > 0 || pages.length > 0 || articles.length > 0) {
      html += `<div class="predictive-search__result-group">`;
      if (products.length > 0) {
        html += `<div><h2 id="predictive-search-products" class="predictive-search__heading text-body caption-with-letter-spacing">${esc(
          i18n.products || 'Products'
        )}</h2><ul id="predictive-search-results-products-list" class="predictive-search__results-list list-unstyled" role="group" aria-labelledby="predictive-search-products">`;
        products.forEach((product, i) => {
          const imgUrl = product.image || product.featured_image?.url || product.featured_image;
          const thumb = imgUrl
            ? `<img class="predictive-search__image" src="${esc(imgUrl)}" alt="" width="50" height="50" loading="lazy">`
            : '';
          const priceHtml = product.price
            ? `<div class="predictive-search__item-price caption"><span class="price">${esc(product.price)}</span></div>`
            : '';
          html += `<li id="predictive-search-option-product-${i + 1}" class="predictive-search__list-item" role="option" aria-selected="false"><a href="${esc(
            product.url
          )}" class="predictive-search__item predictive-search__item--link-with-thumbnail link link--text" tabindex="-1">${thumb}<div class="predictive-search__item-content predictive-search__item-content--centered"><p class="predictive-search__item-heading h5">${esc(
            product.title
          )}</p>${priceHtml}</div></a></li>`;
        });
        html += `</ul></div>`;
      }
      if (pages.length > 0 || articles.length > 0) {
        html += `<div class="predictive-search__pages-wrapper"><h2 id="predictive-search-pages-mobile" class="predictive-search__heading text-body caption-with-letter-spacing">${esc(
          i18n.pages || 'Pages'
        )}</h2><ul id="predictive-search-results-pages-list-mobile" class="predictive-search__results-list list-unstyled" role="group" aria-labelledby="predictive-search-pages-mobile">`;
        pages.forEach((p, i) => {
          html += `<li id="predictive-search-option-page-mobile-${i + 1}" class="predictive-search__list-item" role="option" aria-selected="false"><a href="${esc(
            p.url
          )}" class="predictive-search__item link link--text" tabindex="-1"><div class="predictive-search__item-content predictive-search__item-content--centered"><p class="predictive-search__item-heading h5">${esc(
            p.title
          )}</p></div></a></li>`;
        });
        articles.forEach((a, i) => {
          html += `<li id="predictive-search-option-article-mobile-${i + 1}" class="predictive-search__list-item" role="option" aria-selected="false"><a href="${esc(
            a.url
          )}" class="predictive-search__item link link--text" tabindex="-1"><div class="predictive-search__item-content predictive-search__item-content--centered"><p class="predictive-search__item-heading h5">${esc(
            a.title
          )}</p></div></a></li>`;
        });
        html += `</ul></div>`;
      }
      html += `</div>`;
    }

    html += `</div>`;

    const total = queries.length + collections.length + products.length + pages.length + articles.length;
    const searchForText = PredictiveSearch.i18nReplace(i18n.search_for, searchTerm);
    const liveText =
      total === 0
        ? PredictiveSearch.i18nReplace(i18n.no_results, searchTerm)
        : PredictiveSearch.i18nResultsCount(total);

    html += `<div id="predictive-search-option-search-keywords" class="predictive-search__search-for-button"><button class="predictive-search__item predictive-search__item--term link link--text h5 animate-arrow" tabindex="-1" role="option" aria-selected="false"><span data-predictive-search-search-for-text>${searchForText}</span><span class="svg-wrapper"></span></button></div>`;
    html += `<span class="hidden" data-predictive-search-live-region-count-value>${esc(liveText)}</span>`;
    html += `</div>`;

    return html;
  }

  static buildMinimalFallbackMarkup(searchTerm) {
    const i18n = window.predictiveSearchI18n || {};
    const esc = PredictiveSearch.escapeHtml;
    const searchForText = PredictiveSearch.i18nReplace(i18n.search_for, searchTerm);
    const liveText = PredictiveSearch.i18nReplace(i18n.no_results, searchTerm);
    return `<div id="predictive-search-results" role="listbox"><div id="predictive-search-option-search-keywords" class="predictive-search__search-for-button"><button class="predictive-search__item predictive-search__item--term link link--text h5 animate-arrow" tabindex="-1" role="option" aria-selected="false"><span data-predictive-search-search-for-text>${searchForText}</span><span class="svg-wrapper"></span></button></div><span class="hidden" data-predictive-search-live-region-count-value>${esc(
      liveText
    )}</span></div>`;
  }

  setLiveRegionLoadingState() {
    this.statusElement = this.statusElement || this.querySelector('.predictive-search-status');
    this.loadingText = this.loadingText || this.getAttribute('data-loading-text');

    this.setLiveRegionText(this.loadingText);
    this.setAttribute('loading', true);
  }

  setLiveRegionText(statusText) {
    this.statusElement.setAttribute('aria-hidden', 'false');
    this.statusElement.textContent = statusText;

    setTimeout(() => {
      this.statusElement.setAttribute('aria-hidden', 'true');
    }, 1000);
  }

  renderSearchResults(resultsMarkup) {
    this.predictiveSearchResults.innerHTML = resultsMarkup;
    this.setAttribute('results', true);

    this.setLiveRegionResults();
    this.open();
  }

  setLiveRegionResults() {
    this.removeAttribute('loading');
    const live = this.querySelector('[data-predictive-search-live-region-count-value]');
    if (live) this.setLiveRegionText(live.textContent);
  }

  getResultsMaxHeight() {
    this.resultsMaxHeight =
      window.innerHeight - document.querySelector('.section-header')?.getBoundingClientRect().bottom;
    return this.resultsMaxHeight;
  }

  open() {
    this.predictiveSearchResults.style.maxHeight = this.resultsMaxHeight || `${this.getResultsMaxHeight()}px`;
    this.setAttribute('open', true);
    this.input.setAttribute('aria-expanded', true);
    this.isOpen = true;
  }

  close(clearSearchTerm = false) {
    this.closeResults(clearSearchTerm);
    this.isOpen = false;
  }

  closeResults(clearSearchTerm = false) {
    if (clearSearchTerm) {
      this.input.value = '';
      this.removeAttribute('results');
    }
    const selected = this.querySelector('[aria-selected="true"]');

    if (selected) selected.setAttribute('aria-selected', false);

    this.input.setAttribute('aria-activedescendant', '');
    this.removeAttribute('loading');
    this.removeAttribute('open');
    this.input.setAttribute('aria-expanded', false);
    this.resultsMaxHeight = false;
    this.predictiveSearchResults.removeAttribute('style');
  }
}

customElements.define('predictive-search', PredictiveSearch);
