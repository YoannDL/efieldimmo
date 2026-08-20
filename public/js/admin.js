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

  document.addEventListener('DOMContentLoaded', () => {
    wireLoginForm();
  });

  window.EfieldAdminApi = { api };
})();
