const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('properties page has the expected search form and grid', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/properties.html`)).text();
    assert.match(html, /id="site-header"/);
    assert.match(html, /id="search-form"/);
    assert.match(html, /id="advanced-fields"/);
    assert.match(html, /id="properties-grid"/);
    assert.match(html, /src="\/js\/properties\.js"/);
    assert.match(html, /id="property-modal"/);
    assert.match(html, /id="modal-inquiry-form"/);
    assert.match(html, /id="location-suggestions"/);
    assert.doesNotMatch(html, /option value="residential-land"/);
  } finally {
    await close();
  }
});
