const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('header and footer partials are served with expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const header = await (await fetch(`${baseUrl}/partials/header.html`)).text();
    assert.match(header, /class="nav"/);
    assert.match(header, /lang-toggle/);
    assert.match(header, /data-i18n="nav.properties"/);

    const footer = await (await fetch(`${baseUrl}/partials/footer.html`)).text();
    assert.match(footer, /class="footer-grid"/);
    assert.match(footer, /whatsapp-button/);
  } finally {
    await close();
  }
});
