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

  window.EfieldPartials = {
    init: async function () {
      await Promise.all([
        includePartial('#site-header', '/partials/header.html'),
        includePartial('#site-footer', '/partials/footer.html')
      ]);
      highlightActiveNavLink();
      await window.EfieldI18n.init();
    }
  };
})();
