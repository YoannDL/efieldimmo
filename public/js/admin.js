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
      document.getElementById('image-upload-section').hidden = false;
      renderImageThumbs(property);
    } else {
      currentEditId = null;
      document.getElementById('property-form-title').textContent = 'Nouveau bien';
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
      </tr>
    `).join('');
  }

  async function loadInquiries() {
    const res = await api('/admin/api/inquiries');
    renderInquiriesTable(await res.json());
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
        if (tab === 'types') loadTypes();
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
    wireLogout();
    await loadTypes();
    await loadProperties();
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireLoginForm();
    initDashboard();
  });
})();
