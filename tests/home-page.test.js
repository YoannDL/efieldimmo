const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('home page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/index.html`)).text();
    assert.match(html, /id="site-header"/);
    assert.match(html, /id="site-footer"/);
    assert.match(html, /data-i18n="home.heroTitle"/);
    assert.match(html, /id="featured-properties"/);
    assert.match(html, /src="\/js\/home\.js"/);
  } finally {
    await close();
  }
});
