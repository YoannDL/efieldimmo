const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('about page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/about.html`)).text();
    assert.match(html, /id="site-header"/);
    assert.match(html, /id="site-footer"/);
    assert.match(html, /data-i18n="about.title"/);
    assert.match(html, /data-i18n="about.diff4Title"/);
    assert.match(html, /data-i18n="about.expatBullet5"/);
  } finally {
    await close();
  }
});
