(function () {
  async function includePartial(selector, url) {
    const el = document.querySelector(selector);
    if (!el) return;
    const res = await fetch(url);
    el.innerHTML = await res.text();
  }

  function highlightActiveNavLink() {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav a').forEach((link) => {
      if (link.getAttribute('href') === `/${current}`) link.classList.add('active-link');
    });
  }

  function wireMobileNavToggle() {
    const toggle = document.getElementById('nav-toggle');
    const nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  async function applySiteSettings() {
    try {
      const settings = await (await fetch('/api/settings')).json();
      window.__efieldSettings = settings;
      document.querySelectorAll('[data-setting]').forEach((el) => {
        const value = settings[el.getAttribute('data-setting')];
        if (value) el.textContent = value;
      });
      document.querySelectorAll('[data-setting-href]').forEach((el) => {
        const value = settings[el.getAttribute('data-setting-href')];
        if (value) el.setAttribute('href', value);
      });
      const whatsapp = document.querySelector('.whatsapp-button');
      if (whatsapp && settings.whatsapp_number) {
        whatsapp.setAttribute('href', `https://wa.me/${settings.whatsapp_number}`);
      }
      document.dispatchEvent(new CustomEvent('efield:settings-loaded', { detail: settings }));
    } catch (e) { /* settings are cosmetic; the page must still render */ }
  }

  window.EfieldPartials = {
    init: async function () {
      await Promise.all([
        includePartial('#site-header', '/partials/header.html'),
        includePartial('#site-footer', '/partials/footer.html')
      ]);
      await applySiteSettings();
      highlightActiveNavLink();
      wireMobileNavToggle();
      fetch('/api/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: window.location.pathname === '/' ? '/index.html' : window.location.pathname })
      }).catch(() => {});
      await window.EfieldI18n.init();
    }
  };
})();
