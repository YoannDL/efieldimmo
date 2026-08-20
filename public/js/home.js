(function () {
  function currentLang() {
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'fr';
  }

  function formatPrice(property) {
    return new Intl.NumberFormat('fr-FR').format(property.price) + ' ' + property.currency;
  }

  function applyDictToNode(node) {
    const dict = window.__efieldDict || {};
    node.querySelectorAll('[data-i18n]').forEach((el) => {
      const value = el.getAttribute('data-i18n').split('.').reduce((acc, k) => (acc ? acc[k] : undefined), dict);
      if (value !== undefined) el.textContent = value;
    });
  }

  function renderFeatured(properties) {
    const container = document.getElementById('featured-properties');
    if (!container) return;
    const lang = currentLang();
    container.innerHTML = properties.slice(0, 3).map((p) => `
      <a class="property-card" href="/property.html?id=${p.id}">
        <img src="${p.primaryImage || '/img/brand/hero-home.png'}" alt="${lang === 'en' ? p.title_en : p.title_fr}">
        <div class="card-body">
          <span class="badge-featured" data-i18n="propertiesPage.featuredBadge"></span>
          <h3>${lang === 'en' ? p.title_en : p.title_fr}</h3>
          <p class="price">${formatPrice(p)}</p>
          <p class="meta"><span>${p.location}</span></p>
        </div>
      </a>
    `).join('');
    applyDictToNode(container);
  }

  let cachedProperties = [];

  async function loadFeatured() {
    const res = await fetch('/api/properties');
    const all = await res.json();
    cachedProperties = all.filter((p) => p.featured);
    renderFeatured(cachedProperties);
  }

  document.addEventListener('DOMContentLoaded', loadFeatured);
  document.addEventListener('efield:lang-changed', () => renderFeatured(cachedProperties));
})();
