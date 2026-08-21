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

  let lastResults = [];
  let availableTypes = [];
  let currentProperty = null;

  const NEW_BADGE_DAYS = 30;

  function isNew(property) {
    if (!property.created_at) return false;
    const created = new Date(property.created_at.replace(' ', 'T') + 'Z');
    return (Date.now() - created.getTime()) < NEW_BADGE_DAYS * 24 * 60 * 60 * 1000;
  }

  function badgesHtml(property) {
    const badges = [];
    if (property.availability === 'sold') badges.push(`<span class="badge-sold">${t('propertiesPage.badgeSold')}</span>`);
    else if (property.availability === 'reserved') badges.push(`<span class="badge-reserved">${t('propertiesPage.badgeReserved')}</span>`);
    else if (isNew(property)) badges.push(`<span class="badge-new">${t('propertiesPage.badgeNew')}</span>`);
    return badges.join(' ');
  }

  /* ---------- Search filters (auto-populated from the admin-managed list) ---------- */

  function renderTypeOptions() {
    const select = document.getElementById('type');
    if (!select) return;
    const lang = currentLang();
    const selected = select.value;
    while (select.options.length > 1) select.remove(1);
    availableTypes.forEach((type) => {
      const option = document.createElement('option');
      option.value = type.value;
      option.textContent = lang === 'en' ? type.label_en : type.label_fr;
      select.appendChild(option);
    });
    select.value = selected && [...select.options].some((o) => o.value === selected) ? selected : select.value;
  }

  async function loadFilters() {
    const res = await fetch('/api/filters');
    const filters = await res.json();
    availableTypes = filters.types;
    renderTypeOptions();
    const datalist = document.getElementById('location-suggestions');
    if (datalist) {
      datalist.innerHTML = filters.locations.map((loc) => `<option value="${loc}"></option>`).join('');
    }
  }

  /* ---------- Results grid ---------- */

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
    const bedroomsLabel = t('propertiesPage.bedroomsLabel');
    grid.innerHTML = properties.map((p) => `
      <a class="property-card${p.availability === 'sold' ? ' is-sold' : ''}" href="/properties.html?open=${p.id}" data-property-id="${p.id}">
        <img src="${p.primaryImage || '/img/brand/hero-home.png'}" alt="${lang === 'en' ? p.title_en : p.title_fr}">
        <div class="card-body">
          ${badgesHtml(p)}
          <h3>${lang === 'en' ? p.title_en : p.title_fr}</h3>
          <p class="price">${formatPrice(p)}</p>
          <p class="meta">
            <span>${p.location}</span>
            ${p.bedrooms ? `<span>${p.bedrooms} ${bedroomsLabel}</span>` : ''}
          </p>
        </div>
      </a>
    `).join('');
    grid.querySelectorAll('[data-property-id]').forEach((card) => {
      card.addEventListener('click', (event) => {
        event.preventDefault();
        openModal(Number(card.getAttribute('data-property-id')));
      });
    });
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

  /* ---------- Property detail modal ---------- */

  const WHATSAPP_BASE = 'https://wa.me/23057000000';

  function updateWhatsAppLink(property) {
    const button = document.querySelector('.whatsapp-button');
    if (!button) return;
    if (!property) {
      button.setAttribute('href', WHATSAPP_BASE);
      return;
    }
    const lang = currentLang();
    const title = lang === 'en' ? property.title_en : property.title_fr;
    const message = (t('propertyDetail.whatsappMessage') || 'Bonjour, bien #{id} – {title}')
      .replace('{id}', property.id).replace('{title}', title);
    button.setAttribute('href', `${WHATSAPP_BASE}?text=${encodeURIComponent(message)}`);
  }

  function renderModal(property) {
    const lang = currentLang();
    document.getElementById('modal-title').textContent = lang === 'en' ? property.title_en : property.title_fr;
    document.getElementById('modal-badges').innerHTML = badgesHtml(property);
    document.getElementById('modal-description').textContent = lang === 'en' ? property.description_en : property.description_fr;

    const mapFrame = document.getElementById('modal-map');
    mapFrame.src = property.map_url && property.map_url.includes('output=embed')
      ? property.map_url
      : `https://maps.google.com/maps?q=${encodeURIComponent((property.map_url && !property.map_url.startsWith('http') ? property.map_url : property.location) + ', Mauritius')}&output=embed`;

    updateWhatsAppLink(property);

    const images = property.images.length ? property.images : [{ url: '/img/brand/hero-home.png' }];
    document.getElementById('modal-gallery-main').src = images[0].url;
    const thumbs = document.getElementById('modal-gallery-thumbs');
    thumbs.innerHTML = images.map((img) => `<img src="${img.url}" alt="">`).join('');
    thumbs.querySelectorAll('img').forEach((thumb) => {
      thumb.addEventListener('click', () => { document.getElementById('modal-gallery-main').src = thumb.src; });
    });

    const characteristics = [];
    if (property.bedrooms) characteristics.push([t('propertyDetail.bedroomsLabel'), property.bedrooms]);
    if (property.garages) characteristics.push([t('propertyDetail.garagesLabel'), property.garages]);
    if (property.parking) characteristics.push([t('propertyDetail.parkingLabel'), property.parking]);
    if (property.land_area_m2) characteristics.push([t('propertyDetail.landAreaLabel'), `${property.land_area_m2} m²`]);
    if (property.floor_area_m2) characteristics.push([t('propertyDetail.floorAreaLabel'), `${property.floor_area_m2} m²`]);
    characteristics.push([t('propertyDetail.priceLabel'), formatPrice(property)]);
    document.getElementById('modal-characteristics').innerHTML = characteristics
      .map(([label, value]) => `<div><strong>${label}</strong><div>${value}</div></div>`).join('');

    document.getElementById('modal-ref').value = property.id;
  }

  async function openModal(id) {
    const res = await fetch(`/api/properties/${id}`);
    if (!res.ok) return;
    currentProperty = await res.json();
    renderModal(currentProperty);
    document.getElementById('modal-form-success').hidden = true;
    document.getElementById('modal-form-error').hidden = true;
    document.getElementById('property-modal').hidden = false;
    document.body.classList.add('modal-open');
    fetch('/api/track', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: `property:${currentProperty.id}` })
    }).catch(() => {});
  }

  function closeModal() {
    document.getElementById('property-modal').hidden = true;
    document.body.classList.remove('modal-open');
    document.getElementById('modal-map').src = 'about:blank';
    updateWhatsAppLink(null);
    currentProperty = null;
  }

  function wireModal() {
    const overlay = document.getElementById('property-modal');
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-print').addEventListener('click', () => window.print());
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.hidden) closeModal();
    });

    const form = document.getElementById('modal-inquiry-form');
    const success = document.getElementById('modal-form-success');
    const error = document.getElementById('modal-form-error');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      success.hidden = true; error.hidden = true;
      const data = Object.fromEntries(new FormData(form).entries());
      data.propertyRef = currentProperty ? currentProperty.id : null;
      try {
        const res = await fetch('/api/inquiries', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('inquiry submission failed');
        form.reset();
        success.hidden = false;
      } catch (e) {
        error.hidden = false;
      }
    });
  }

  /* ---------- Init ---------- */

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('search-form');
    const advanced = document.getElementById('advanced-fields');
    const toggleBtn = document.getElementById('toggle-advanced');

    toggleBtn.addEventListener('click', () => { advanced.hidden = !advanced.hidden; });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      runSearch(form);
    });

    wireModal();
    fillFormFromUrl(form);
    loadFilters();
    runSearch(form);

    const openId = new URLSearchParams(window.location.search).get('open');
    if (openId) openModal(Number(openId));
  });

  document.addEventListener('efield:lang-changed', () => {
    renderResults(lastResults);
    renderTypeOptions();
    if (currentProperty) renderModal(currentProperty);
  });
})();
