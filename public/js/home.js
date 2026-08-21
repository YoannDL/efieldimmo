(function () {
  function currentLang() {
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'fr';
  }

  function formatPrice(property) {
    return new Intl.NumberFormat('fr-FR').format(property.price) + ' ' + property.currency;
  }

  function t(pathStr) {
    const dict = window.__efieldDict || {};
    return pathStr.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), dict) || '';
  }

  function isNew(property) {
    if (!property.created_at) return false;
    const created = new Date(property.created_at.replace(' ', 'T') + 'Z');
    return (Date.now() - created.getTime()) < 30 * 24 * 60 * 60 * 1000;
  }

  function availabilityBadge(property) {
    if (property.availability === 'sold') return `<span class="badge-sold">${t('propertiesPage.badgeSold')}</span>`;
    if (property.availability === 'reserved') return `<span class="badge-reserved">${t('propertiesPage.badgeReserved')}</span>`;
    if (isNew(property)) return `<span class="badge-new">${t('propertiesPage.badgeNew')}</span>`;
    return '';
  }

  function renderFeatured(properties) {
    const container = document.getElementById('featured-properties');
    if (!container) return;
    const lang = currentLang();
    container.innerHTML = properties.slice(0, 3).map((p) => `
      <a class="property-card${p.availability === 'sold' ? ' is-sold' : ''}" href="/properties.html?open=${p.id}">
        <img src="${p.primaryImage || '/img/brand/hero-home.png'}" alt="${lang === 'en' ? p.title_en : p.title_fr}">
        <div class="card-body">
          <span class="badge-featured">${t('propertiesPage.featuredBadge')}</span> ${availabilityBadge(p)}
          <h3>${lang === 'en' ? p.title_en : p.title_fr}</h3>
          <p class="price">${formatPrice(p)}</p>
          <p class="meta"><span>${p.location}</span></p>
        </div>
      </a>
    `).join('');
  }

  let cachedProperties = [];

  async function loadFeatured() {
    const res = await fetch('/api/properties');
    const all = await res.json();
    cachedProperties = all.filter((p) => p.featured)
      .sort((a, b) => ((a.featured_order || 9999) - (b.featured_order || 9999)) || (b.id - a.id));
    renderFeatured(cachedProperties);
  }

  document.addEventListener('DOMContentLoaded', loadFeatured);
  document.addEventListener('efield:lang-changed', () => renderFeatured(cachedProperties));
})();
