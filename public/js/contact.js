(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    const success = document.getElementById('form-success');
    const error = document.getElementById('form-error');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      success.hidden = true; error.hidden = true;
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const res = await fetch('/api/inquiries', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('contact submission failed');
        form.reset();
        success.hidden = false;
      } catch (e) {
        error.hidden = false;
      }
    });
  });
})();
