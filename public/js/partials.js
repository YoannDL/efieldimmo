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

  window.EfieldPartials = {
    init: async function () {
      await Promise.all([
        includePartial('#site-header', '/partials/header.html'),
        includePartial('#site-footer', '/partials/footer.html')
      ]);
      highlightActiveNavLink();
      wireMobileNavToggle();
      await window.EfieldI18n.init();
    }
  };
})();
