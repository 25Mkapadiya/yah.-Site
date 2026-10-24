(function () {
  var cfg = window.YAH_CONFIG || {};
  var form = document.getElementById('signup-form');
  var statusEl = document.getElementById('form-status');
  var doneEl = document.getElementById('signup-done');
  var button = form.querySelector('button[type="submit"]');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', !!isError);
  }

  function markInvalid(input, invalid) {
    if (invalid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function showDone() {
    form.hidden = true;
    document.getElementById('signup-title').hidden = true;
    form.parentNode.querySelector('.card-sub').hidden = true;
    doneEl.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setStatus('');

    var data = new FormData(form);
    var name = (data.get('name') || '').trim();
    var email = (data.get('email') || '').trim().toLowerCase();
    var school = (data.get('school') || '').trim();
    var gradYear = (data.get('grad_year') || '').trim();
    var interests = data.getAll('interests');

    // Bots fill the hidden field; pretend it worked.
    if (data.get('website')) { showDone(); return; }

    var nameInput = form.elements.name;
    var emailInput = form.elements.email;
    var yearInput = form.elements.grad_year;
    markInvalid(nameInput, !name);
    markInvalid(emailInput, !EMAIL_RE.test(email));
    markInvalid(yearInput, gradYear && !/^\d{4}$/.test(gradYear));

    if (!name) { setStatus('Please enter your name.', true); nameInput.focus(); return; }
    if (!EMAIL_RE.test(email)) { setStatus('Please enter a valid email address.', true); emailInput.focus(); return; }
    if (gradYear && !/^\d{4}$/.test(gradYear)) { setStatus('Class year should be four digits, like 2029.', true); yearInput.focus(); return; }

    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_PUBLISHABLE_KEY.indexOf('PASTE_') === 0) {
      setStatus('Sign-ups open soon. Please check back shortly.', true);
      return;
    }

    button.disabled = true;
    setStatus('Signing you up…');

    fetch(cfg.SUPABASE_URL + '/rest/v1/' + cfg.TABLE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cfg.SUPABASE_PUBLISHABLE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        name: name,
        email: email,
        school: school || null,
        grad_year: gradYear ? parseInt(gradYear, 10) : null,
        interests: interests,
        source: location.hostname || null
      })
    }).then(function (res) {
      // 409 = this email is already on the list (unique constraint).
      if (res.ok || res.status === 409) { showDone(); return; }
      throw new Error('HTTP ' + res.status);
    }).catch(function () {
      button.disabled = false;
      setStatus('Something went wrong. Please try again in a moment.', true);
    });
  });
})();
