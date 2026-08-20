(function () {
  function currentLang() {
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'fr';
  }

  function formatPrice(property) {
    return new Intl.NumberFormat('fr-FR').format(property.price) + ' ' + property.currency;
  }

  let lastResults = [];

  function renderResults(properties) {
    const grid = document.getElementById('properties-grid');
    const noResults = document.getElementById('no-results');
    const lang = currentLang();
    if (!properties.length) {
      grid.innerHTML = '';
      noResults.hidden = false;
      return;
    }
    noResults.hidden = true;
    const bedroomsLabel = (window.EfieldI18n && window.EfieldI18n.t('propertiesPage.bedroomsLabel')) || '';
    grid.innerHTML = properties.map((p) => `
      <a class="property-card" href="/property.html?id=${p.id}">
        <img src="${p.primaryImage || '/img/brand/hero-home.png'}" alt="${lang === 'en' ? p.title_en : p.title_fr}">
        <div class="card-body">
          <h3>${lang === 'en' ? p.title_en : p.title_fr}</h3>
          <p class="price">${formatPrice(p)}</p>
          <p class="meta">
            <span>${p.location}</span>
            ${p.bedrooms ? `<span>${p.bedrooms} ${bedroomsLabel}</span>` : ''}
          </p>
        </div>
      </a>
    `).join('');
  }

  function formToQuery(form) {
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }

  async function runSearch(form) {
    const query = formToQuery(form);
    const res = await fetch(`/api/properties${query ? '?' + query : ''}`);
    lastResults = await res.json();
    renderResults(lastResults);
  }

  function fillFormFromUrl(form) {
    const urlParams = new URLSearchParams(window.location.search);
    let hasAdvanced = false;
    urlParams.forEach((value, key) => {
      const field = form.elements.namedItem(key);
      if (field) {
        field.value = value;
        if (!['status', 'type', 'location'].includes(key)) hasAdvanced = true;
      }
    });
    if (hasAdvanced) document.getElementById('advanced-fields').hidden = false;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('search-form');
    const advanced = document.getElementById('advanced-fields');
    const toggleBtn = document.getElementById('toggle-advanced');

    toggleBtn.addEventListener('click', () => { advanced.hidden = !advanced.hidden; });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      runSearch(form);
    });

    fillFormFromUrl(form);
    runSearch(form);
  });

  document.addEventListener('efield:lang-changed', () => renderResults(lastResults));
})();
