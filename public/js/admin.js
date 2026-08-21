(function () {
  async function api(path, options) {
    return fetch(path, { credentials: 'same-origin', ...options });
  }

  function wireLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const res = await api('/admin/api/login', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
      });
      if (res.ok) {
        window.location.href = '/admin/dashboard.html';
      } else {
        document.getElementById('login-error').hidden = false;
      }
    });
  }

  let allProperties = [];
  let currentEditId = null;

  function renderPropertiesTable() {
    const tbody = document.getElementById('properties-tbody');
    if (!tbody) return;
    tbody.innerHTML = allProperties.map((p) => `
      <tr>
        <td>${p.title_fr}</td>
        <td>${p.status}</td>
        <td>${p.location}</td>
        <td>${p.price}</td>
        <td>${p.featured ? 'Oui' : 'Non'}</td>
        <td>
          <button type="button" data-edit="${p.id}">Modifier</button>
          <button type="button" data-delete="${p.id}">Supprimer</button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openPropertyForm(Number(btn.getAttribute('data-edit'))));
    });
    tbody.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteProperty(Number(btn.getAttribute('data-delete'))));
    });
  }

  async function loadProperties() {
    const res = await api('/api/properties');
    allProperties = await res.json();
    renderPropertiesTable();
  }

  async function deleteProperty(id) {
    if (!window.confirm('Supprimer ce bien ?')) return;
    await api(`/admin/api/properties/${id}`, { method: 'DELETE' });
    await loadProperties();
  }

  function fillFormWithProperty(property) {
    const form = document.getElementById('property-form');
    Object.entries(property).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (!field) return;
      if (field.type === 'checkbox') field.checked = !!value;
      else field.value = value == null ? '' : value;
    });
  }

  function renderImageThumbs(property) {
    const row = document.getElementById('image-thumb-row');
    row.innerHTML = (property.images || []).map((img) => `
      <span><img src="${img.url}" alt=""><button type="button" data-remove-image="${img.id}">x</button></span>
    `).join('');
    row.querySelectorAll('[data-remove-image]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/admin/api/properties/${property.id}/images/${btn.getAttribute('data-remove-image')}`, { method: 'DELETE' });
        const updated = await (await api(`/api/properties/${property.id}`)).json();
        renderImageThumbs(updated);
      });
    });
  }

  async function openPropertyForm(id) {
    const section = document.getElementById('property-form-section');
    if (!section) return;
    section.hidden = false;
    document.getElementById('property-form').reset();
    document.getElementById('image-upload-section').hidden = true;
    if (id) {
      currentEditId = id;
      document.getElementById('property-form-title').textContent = 'Modifier le bien';
      const property = await (await api(`/api/properties/${id}`)).json();
      fillFormWithProperty(property);
      const criteriaValues = {};
      (property.criteria || []).forEach((c) => { criteriaValues[c.id] = c.value; });
      renderPropertyCriteriaFields(criteriaValues);
      document.getElementById('image-upload-section').hidden = false;
      renderImageThumbs(property);
    } else {
      currentEditId = null;
      document.getElementById('property-form-title').textContent = 'Nouveau bien';
      renderPropertyCriteriaFields({});
    }
  }

  function wirePropertyForm() {
    const newBtn = document.getElementById('new-property-btn');
    if (!newBtn) return;
    newBtn.addEventListener('click', () => openPropertyForm(null));
    document.getElementById('cancel-property-btn').addEventListener('click', () => {
      document.getElementById('property-form-section').hidden = true;
    });

    const form = document.getElementById('property-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      data.featured = form.elements.namedItem('featured').checked;
      data.criteria = collectCriteriaValues();
      const method = currentEditId ? 'PUT' : 'POST';
      const url = currentEditId ? `/admin/api/properties/${currentEditId}` : '/admin/api/properties';
      const res = await api(url, {
        method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
      });
      const result = await res.json();
      currentEditId = currentEditId || result.id;
      await loadProperties();
      await openPropertyForm(currentEditId);
    });

    document.getElementById('image-file-input').addEventListener('change', async (event) => {
      if (!currentEditId || !event.target.files.length) return;
      const formData = new FormData();
      Array.from(event.target.files).forEach((file) => formData.append('images', file));
      await api(`/admin/api/properties/${currentEditId}/images`, { method: 'POST', body: formData });
      const updated = await (await api(`/api/properties/${currentEditId}`)).json();
      renderImageThumbs(updated);
      event.target.value = '';
    });
  }

  const INQUIRY_STATUS_LABELS = { new: 'Nouveau', contacted: 'Contacté', closed: 'Clôturé' };

  function renderInquiriesTable(inquiries) {
    const tbody = document.getElementById('inquiries-tbody');
    if (!tbody) return;
    tbody.innerHTML = inquiries.map((i) => `
      <tr>
        <td>${new Date(i.created_at).toLocaleString()}</td>
        <td>${i.name}</td>
        <td>${i.email}</td>
        <td>${i.phone || ''}</td>
        <td>${i.property_ref || ''}</td>
        <td>${i.message}</td>
        <td>
          <select data-inquiry-status="${i.id}">
            ${Object.entries(INQUIRY_STATUS_LABELS).map(([value, label]) =>
              `<option value="${value}"${i.status === value ? ' selected' : ''}>${label}</option>`).join('')}
          </select>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-inquiry-status]').forEach((select) => {
      select.addEventListener('change', async () => {
        await api(`/admin/api/inquiries/${select.getAttribute('data-inquiry-status')}`, {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: select.value })
        });
      });
    });
  }

  async function loadInquiries() {
    const res = await api('/admin/api/inquiries');
    renderInquiriesTable(await res.json());
  }

  async function loadStats() {
    const res = await api('/admin/api/stats');
    const rows = await res.json();
    const tbody = document.getElementById('stats-tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map((r) => {
      let label = r.path;
      const propertyMatch = r.path.match(/^property:(\d+)$/);
      if (propertyMatch) {
        const property = allProperties.find((p) => p.id === Number(propertyMatch[1]));
        label = property ? `Bien #${propertyMatch[1]} — ${property.title_fr}` : `Bien #${propertyMatch[1]} (supprimé)`;
      }
      return `<tr><td>${label}</td><td>${r.views}</td></tr>`;
    }).join('');
  }

  function wireTabs() {
    const buttons = document.querySelectorAll('.tab-buttons button');
    if (!buttons.length) return;
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-panel').forEach((panel) => {
          panel.hidden = panel.id !== `tab-${tab}`;
        });
        if (tab === 'inquiries') loadInquiries();
        if (tab === 'types') { loadTypes(); loadCriteria(); }
        if (tab === 'stats') loadStats();
        if (tab === 'content') { loadSettings(); loadContent(); }
      });
    });
  }

  /* ---------- Property type categories ---------- */

  let allTypes = [];

  function renderPropertyTypeSelect() {
    const select = document.getElementById('property-type-select');
    if (!select) return;
    const selected = select.value;
    select.innerHTML = allTypes.map((t) => `<option value="${t.value}">${t.label_fr}</option>`).join('');
    if (selected && allTypes.some((t) => t.value === selected)) select.value = selected;
  }

  function renderTypesTable() {
    const tbody = document.getElementById('types-tbody');
    if (!tbody) return;
    tbody.innerHTML = allTypes.map((t) => `
      <tr>
        <td>${t.label_fr}</td>
        <td>${t.label_en}</td>
        <td>${t.value}</td>
        <td><button type="button" data-delete-type="${t.id}">Supprimer</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-delete-type]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!window.confirm('Supprimer cette catégorie ? Les biens existants de ce type ne seront pas modifiés.')) return;
        await api(`/admin/api/types/${btn.getAttribute('data-delete-type')}`, { method: 'DELETE' });
        await loadTypes();
      });
    });
  }

  async function loadTypes() {
    const res = await api('/admin/api/types');
    allTypes = await res.json();
    renderTypesTable();
    renderPropertyTypeSelect();
  }

  /* ---------- Search criteria ---------- */

  let allCriteria = [];

  function renderPropertyCriteriaFields(values = {}) {
    const container = document.getElementById('property-criteria-fields');
    if (!container) return;
    const section = document.getElementById('property-criteria-section');
    section.hidden = allCriteria.length === 0;
    container.innerHTML = allCriteria.map((c) => c.kind === 'boolean'
      ? `<div class="form-field"><label><input type="checkbox" data-criterion-input="${c.id}"${values[c.id] ? ' checked' : ''}> ${c.label_fr}</label></div>`
      : `<div class="form-field"><label>${c.label_fr}</label><input type="number" min="0" data-criterion-input="${c.id}" value="${values[c.id] != null ? values[c.id] : ''}"></div>`
    ).join('');
  }

  function collectCriteriaValues() {
    const values = {};
    document.querySelectorAll('[data-criterion-input]').forEach((input) => {
      const id = input.getAttribute('data-criterion-input');
      if (input.type === 'checkbox') {
        if (input.checked) values[id] = 1;
      } else if (input.value !== '' && Number(input.value) > 0) {
        values[id] = Number(input.value);
      }
    });
    return values;
  }

  function renderCriteriaTable() {
    const tbody = document.getElementById('criteria-tbody');
    if (!tbody) return;
    tbody.innerHTML = allCriteria.map((c) => `
      <tr>
        <td>${c.label_fr}</td>
        <td>${c.label_en}</td>
        <td>${c.kind === 'boolean' ? 'Oui / Non' : 'Nombre'}</td>
        <td><button type="button" data-delete-criterion="${c.id}">Supprimer</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-delete-criterion]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!window.confirm('Supprimer ce critère ? Les valeurs enregistrées sur les biens seront perdues.')) return;
        await api(`/admin/api/criteria/${btn.getAttribute('data-delete-criterion')}`, { method: 'DELETE' });
        await loadCriteria();
      });
    });
  }

  async function loadCriteria() {
    const res = await api('/admin/api/criteria');
    allCriteria = await res.json();
    renderCriteriaTable();
    renderPropertyCriteriaFields();
  }

  function wireCriterionForm() {
    const form = document.getElementById('criterion-form');
    if (!form) return;
    const errorEl = document.getElementById('criterion-error');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorEl.hidden = true;
      const data = Object.fromEntries(new FormData(form).entries());
      const res = await api('/admin/api/criteria', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errorEl.textContent = body.error || 'Erreur lors de l\'ajout.';
        errorEl.hidden = false;
        return;
      }
      form.reset();
      await loadCriteria();
    });
  }

  /* ---------- Site settings & content ---------- */

  async function loadSettings() {
    const form = document.getElementById('settings-form');
    if (!form) return;
    const settings = await (await api('/api/settings')).json();
    Object.entries(settings).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field) field.value = value;
    });
  }

  function wireSettingsForm() {
    const form = document.getElementById('settings-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const res = await api('/admin/api/settings', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
      });
      const saved = document.getElementById('settings-saved');
      saved.hidden = !res.ok;
      setTimeout(() => { saved.hidden = true; }, 2500);
    });
  }

  let contentLang = 'fr';
  let contentEntries = [];

  function renderContentTable() {
    const tbody = document.getElementById('content-tbody');
    if (!tbody) return;
    const filter = (document.getElementById('content-filter').value || '').toLowerCase();
    const visible = contentEntries.filter((e) =>
      !filter || e.key.toLowerCase().includes(filter) || String(e.value).toLowerCase().includes(filter));
    tbody.innerHTML = visible.map((e, index) => `
      <tr>
        <td style="font-size:0.8rem;color:var(--color-subtitle);">${e.key}${e.overridden ? ' *' : ''}</td>
        <td><textarea data-content-key="${e.key}" rows="${String(e.value).length > 80 ? 3 : 1}" style="width:100%;">${e.value}</textarea></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-content-key]').forEach((input) => {
      input.addEventListener('change', async () => {
        await api('/admin/api/content', {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lang: contentLang, key: input.getAttribute('data-content-key'), value: input.value })
        });
      });
    });
  }

  async function loadContent() {
    const res = await api(`/admin/api/content?lang=${contentLang}`);
    contentEntries = await res.json();
    renderContentTable();
  }

  function wireContentControls() {
    const filter = document.getElementById('content-filter');
    if (!filter) return;
    filter.addEventListener('input', renderContentTable);
    document.querySelectorAll('[data-content-lang]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('[data-content-lang]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        contentLang = btn.getAttribute('data-content-lang');
        await loadContent();
      });
    });
  }

  function wireTypeForm() {
    const form = document.getElementById('type-form');
    if (!form) return;
    const errorEl = document.getElementById('type-error');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorEl.hidden = true;
      const data = Object.fromEntries(new FormData(form).entries());
      const res = await api('/admin/api/types', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errorEl.textContent = body.error || 'Erreur lors de l\'ajout.';
        errorEl.hidden = false;
        return;
      }
      form.reset();
      await loadTypes();
    });
  }

  function wireLogout() {
    const btn = document.getElementById('logout-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      await api('/admin/api/logout', { method: 'POST' });
      window.location.href = '/admin/login.html';
    });
  }

  async function initDashboard() {
    const usernameEl = document.getElementById('admin-username');
    if (!usernameEl) return;
    const sessionRes = await api('/admin/api/session');
    if (!sessionRes.ok) {
      window.location.href = '/admin/login.html';
      return;
    }
    const session = await sessionRes.json();
    usernameEl.textContent = session.username;
    wireTabs();
    wirePropertyForm();
    wireTypeForm();
    wireCriterionForm();
    wireSettingsForm();
    wireContentControls();
    wireLogout();
    await loadTypes();
    await loadCriteria();
    await loadProperties();
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireLoginForm();
    initDashboard();
  });
})();
