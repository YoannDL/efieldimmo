const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('admin dashboard page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/admin/dashboard.html`)).text();
    assert.match(html, /id="properties-tbody"/);
    assert.match(html, /id="property-form"/);
    assert.match(html, /id="image-upload-section"/);
    assert.match(html, /id="inquiries-tbody"/);
    assert.match(html, /id="types-tbody"/);
    assert.match(html, /id="type-form"/);
    assert.match(html, /id="stats-tbody"/);
    assert.match(html, /name="availability"/);
    assert.match(html, /name="featured_order"/);
    assert.match(html, /name="map_url"/);
    assert.match(html, /id="logout-btn"/);
    assert.match(html, /src="\/js\/admin\.js"/);
  } finally {
    await close();
  }
});
