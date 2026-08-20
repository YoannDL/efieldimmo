(function () {
  const STORAGE_KEY = 'efield-lang';

  async function loadDictionary(lang) {
    const res = await fetch(`/i18n/${lang}.json`);
    return res.json();
  }

  function getByPath(obj, keyPath) {
    return keyPath.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
  }

  function applyDictionary(dict) {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const value = getByPath(dict, el.getAttribute('data-i18n'));
      if (value !== undefined) el.textContent = value;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const value = getByPath(dict, el.getAttribute('data-i18n-placeholder'));
      if (value !== undefined) el.setAttribute('placeholder', value);
    });
  }

  function setActiveToggleButton(lang) {
    document.querySelectorAll('.lang-toggle button').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  async function setLanguage(lang) {
    const dict = await loadDictionary(lang);
    window.__efieldDict = dict;
    applyDictionary(dict);
    setActiveToggleButton(lang);
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.dispatchEvent(new CustomEvent('efield:lang-changed', { detail: { lang, dict } }));
  }

  function initLangToggle() {
    document.querySelectorAll('.lang-toggle button').forEach((btn) => {
      btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang')));
    });
  }

  window.EfieldI18n = {
    init: async function () {
      initLangToggle();
      const saved = localStorage.getItem(STORAGE_KEY);
      const lang = saved === 'en' ? 'en' : 'fr';
      await setLanguage(lang);
    },
    t: function (keyPath) {
      return getByPath(window.__efieldDict || {}, keyPath);
    }
  };
})();
