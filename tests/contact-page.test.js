const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('contact page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/contact.html`)).text();
    assert.match(html, /id="contact-form"/);
    assert.match(html, /name="email"/);
    assert.match(html, /name="message"/);
    assert.match(html, /src="\/js\/contact\.js"/);
  } finally {
    await close();
  }
});
