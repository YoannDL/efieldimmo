const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('services page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/services.html`)).text();
    assert.match(html, /id="site-header"/);
    assert.match(html, /id="site-footer"/);
    assert.match(html, /data-i18n="services.title"/);
    assert.match(html, /data-i18n="services.service4Text"/);
  } finally {
    await close();
  }
});
