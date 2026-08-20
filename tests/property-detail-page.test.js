const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('property detail page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/property.html`)).text();
    assert.match(html, /id="gallery-main"/);
    assert.match(html, /id="gallery-thumbs"/);
    assert.match(html, /id="characteristics"/);
    assert.match(html, /id="inquiry-form"/);
    assert.match(html, /name="propertyRef"/);
    assert.match(html, /src="\/js\/property-detail\.js"/);
  } finally {
    await close();
  }
});
