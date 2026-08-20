(function () {
  function currentLang() {
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'fr';
  }

  function formatPrice(property) {
    return new Intl.NumberFormat('fr-FR').format(property.price) + ' ' + property.currency;
  }

  function getPropertyId() {
    return new URLSearchParams(window.location.search).get('id');
  }

  function t(pathStr) {
    const dict = window.__efieldDict || {};
    return pathStr.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), dict) || '';
  }

  let currentProperty = null;

  function renderProperty(property) {
    const lang = currentLang();
    document.getElementById('property-title').textContent = lang === 'en' ? property.title_en : property.title_fr;
    document.getElementById('property-description').textContent = lang === 'en' ? property.description_en : property.description_fr;

    const images = property.images.length ? property.images : [{ url: '/img/brand/hero-home.png' }];
    document.getElementById('gallery-main').src = images[0].url;
    const thumbs = document.getElementById('gallery-thumbs');
    thumbs.innerHTML = images.map((img) => `<img src="${img.url}" alt="">`).join('');
    thumbs.querySelectorAll('img').forEach((thumb) => {
      thumb.addEventListener('click', () => { document.getElementById('gallery-main').src = thumb.src; });
    });

    const characteristics = [];
    if (property.bedrooms) characteristics.push([t('propertyDetail.bedroomsLabel'), property.bedrooms]);
    if (property.garages) characteristics.push([t('propertyDetail.garagesLabel'), property.garages]);
    if (property.parking) characteristics.push([t('propertyDetail.parkingLabel'), property.parking]);
    if (property.land_area_m2) characteristics.push([t('propertyDetail.landAreaLabel'), `${property.land_area_m2} m²`]);
    if (property.floor_area_m2) characteristics.push([t('propertyDetail.floorAreaLabel'), `${property.floor_area_m2} m²`]);
    characteristics.push([t('propertyDetail.priceLabel'), formatPrice(property)]);
    document.getElementById('characteristics').innerHTML = characteristics
      .map(([label, value]) => `<div><strong>${label}</strong><div>${value}</div></div>`).join('');

    document.getElementById('refDisplay').value = property.id;
  }

  async function loadProperty() {
    const id = getPropertyId();
    if (!id) return;
    const res = await fetch(`/api/properties/${id}`);
    if (!res.ok) return;
    currentProperty = await res.json();
    renderProperty(currentProperty);
  }

  function wireForm() {
    const form = document.getElementById('inquiry-form');
    const success = document.getElementById('form-success');
    const error = document.getElementById('form-error');
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

  document.addEventListener('DOMContentLoaded', () => { loadProperty(); wireForm(); });
  document.addEventListener('efield:lang-changed', () => { if (currentProperty) renderProperty(currentProperty); });
})();
