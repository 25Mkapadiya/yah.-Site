(function () {
  var cfg = window.YAH_CONFIG || {};
  var form = document.getElementById('signup');
  var statusEl = document.getElementById('status');
  var button = form.querySelector('button');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var cta = document.getElementById('cta');

  // Swap the form for the confirmation without changing the page's height.
  // The body centers <main> vertically, so any height change would move the
  // logo away from the background circuits drawn into it.
  function done() {
    if (cta) {
      cta.style.height = cta.offsetHeight + 'px';
      cta.classList.add('done');
    }
    form.hidden = true;
    statusEl.textContent = "You're on the list.";
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.elements.email.value.trim().toLowerCase();

    // Bots fill the hidden field; pretend it worked.
    if (form.elements.website.value) { done(); return; }

    if (!EMAIL_RE.test(email)) {
      statusEl.textContent = 'Enter a valid email.';
      form.elements.email.focus();
      return;
    }

    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_PUBLISHABLE_KEY.indexOf('PASTE_') === 0) {
      statusEl.textContent = 'Sign-ups open soon.';
      return;
    }

    button.disabled = true;
    statusEl.textContent = '';

    fetch(cfg.SUPABASE_URL + '/rest/v1/' + cfg.TABLE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cfg.SUPABASE_PUBLISHABLE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ email: email, source: location.hostname || null })
    }).then(function (res) {
      // 409 = this email is already on the list (unique constraint).
      if (res.ok || res.status === 409) { done(); return; }
      throw new Error('HTTP ' + res.status);
    }).catch(function () {
      button.disabled = false;
      statusEl.textContent = 'Something went wrong. Try again.';
    });
  });
})();
