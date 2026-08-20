const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('admin login page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/admin/login.html`)).text();
    assert.match(html, /id="login-form"/);
    assert.match(html, /name="username"/);
    assert.match(html, /name="password"/);
    assert.match(html, /src="\/js\/admin\.js"/);
  } finally {
    await close();
  }
});
