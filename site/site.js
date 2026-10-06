/* Sell with Matthews — the consultation form. Sends one row to the CRM's web_leads table.
   A visitor can only add a row; they can never read anything back. */
(function () {
  var cfg = window.__SITE__ || {};
  var form = document.getElementById('tell');
  if (!form) return;
  var opened = Date.now();

  /* Where the visitor came from, kept for the visit so it survives moving between pages. */
  function source() {
    var q = new URLSearchParams(location.search), keep = '', ref = '';
    try { keep = sessionStorage.getItem('swm-src') || ''; } catch (e) { /* private window */ }
    /* A tagged link (?src=...) always wins; otherwise keep what the visit started with. */
    var tagged = q.get('src') || q.get('utm_source') || '';
    if (!tagged && keep) return keep;
    try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) { ref = ''; }
    var src = tagged || (ref && ref !== location.hostname.replace(/^www\./, '') ? ref : '') || 'Direct';
    if (q.get('utm_campaign')) src += ' / ' + q.get('utm_campaign');
    src = src.slice(0, 200);
    try { sessionStorage.setItem('swm-src', src); } catch (e) { /* private window */ }
    return src;
  }
  var came = source();

  var err = document.getElementById('tell-err');
  function fail(text, field) {
    err.textContent = text; err.hidden = false;
    if (field) field.focus();
  }
  function val(name) { var el = form.elements[name]; return el ? String(el.value || '').replace(/\s+/g, ' ').trim() : ''; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.hidden = true;
    var name = val('name'), phone = val('phone');
    if (!name) return fail('Enter your name.', form.elements.name);
    if (phone.replace(/\D/g, '').length < 7) return fail('Enter a phone number we can call you back on.', form.elements.phone);
    var btn = form.querySelector('button[type=submit]');
    /* Filled in by programs that fill every box, or sent faster than a person types: thank them and send nothing. */
    if (val('website') || Date.now() - opened < 1500) return done(name, phone);
    var row = {
      name: name.slice(0, 120), phone: phone.slice(0, 40), company: val('company').slice(0, 160), program: val('program').slice(0, 40),
      details: String(form.elements.details.value || '').trim().slice(0, 2000), source: came, page: (location.pathname || '/').slice(0, 200)
    };
    if (!cfg.url || !cfg.key) return fail("That didn't send. Please call " + (cfg.phone || 'us') + '.');
    btn.disabled = true; btn.textContent = 'Sending';
    var headers = { 'apikey': cfg.key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
    if (/^eyJ/.test(cfg.key)) headers.Authorization = 'Bearer ' + cfg.key;
    fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/web_leads', { method: 'POST', headers: headers, body: JSON.stringify(row) })
      .then(function (r) { if (!r.ok) throw new Error('status ' + r.status); done(name, phone); })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Request my free consultation';
        fail("That didn't send. Please try again, or call " + (cfg.phone || 'us') + '.');
      });
  });

  function done(name, phone) {
    var first = name.split(' ')[0];
    form.innerHTML = '';
    var h = document.createElement('h2'); h.textContent = 'Thanks, ' + first + '.'; h.tabIndex = -1;
    var p = document.createElement('p'); p.textContent = "We have your request and will call you at " + phone + '.';
    var c = document.createElement('p'); c.className = 'tell-call';
    c.textContent = 'Need us sooner? Call ' + (cfg.phone || 'us') + '.';
    form.appendChild(h); form.appendChild(p); form.appendChild(c);
    form.classList.add('sent');
    h.focus();
  }
})();
