class SearchForm extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input[type="search"]');
    this.resetButton = this.querySelector('button[type="reset"]');

    if (this.input) {
      this.input.form.addEventListener('reset', this.onFormReset.bind(this));
      const isPredictiveSearchHost = this.tagName && this.tagName.toLowerCase() === 'predictive-search';
      if (isPredictiveSearchHost) return;

      /* חיפוש חי מהתו הראשון, כולל IME/עברית */
      const triggerChange = () => this.onChange();
      const debouncedTrigger = debounce(triggerChange, 10).bind(this);
      this.input.addEventListener('input', debouncedTrigger);
      this.input.addEventListener('keyup', (event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter') return;
        triggerChange();
      });
      this.input.addEventListener('compositionend', triggerChange);
    }
  }

  toggleResetButton() {
    const resetIsHidden = this.resetButton.classList.contains('hidden');
    if (this.input.value.length > 0 && resetIsHidden) {
      this.resetButton.classList.remove('hidden');
    } else if (this.input.value.length === 0 && !resetIsHidden) {
      this.resetButton.classList.add('hidden');
    }
  }

  onChange() {
    this.toggleResetButton();
  }

  shouldResetForm() {
    return !document.querySelector('[aria-selected="true"] a');
  }

  onFormReset(event) {
    // Prevent default so the form reset doesn't set the value gotten from the url on page load
    event.preventDefault();
    // Don't reset if the user has selected an element on the predictive search dropdown
    if (this.shouldResetForm()) {
      this.input.value = '';
      this.input.focus();
      this.toggleResetButton();
    }
  }
}

customElements.define('search-form', SearchForm);
