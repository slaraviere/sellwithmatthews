/* ============================================================
   Start-up for the website build: sign-in with Supabase Auth, data from Supabase,
   AI drafting through the site's own /api/draft route.
   ============================================================ */
let SB = null;
const WEB = { screen: 'loading', mode: 'signin', msg: '', err: '', email: '', entered: false, askPassword: false, busy: false };

function webGateHtml() {
  const card = inner => `<div class="gate"><div class="gate-card">${inner}</div></div>`;
  if (WEB.screen === 'unconfigured') return card(`<h2>This site isn't connected to its database yet</h2><p>Set <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> in the Vercel project's environment variables, then redeploy.</p>`);
  if (WEB.screen === 'error') return card(`<h2>The CRM couldn't reach its database</h2><p>${esc(WEB.err || 'Check your connection and reload the page.')}</p><div class="row"><button type="button" class="btn primary" data-act="web-reload">Reload</button><button type="button" class="btn" data-act="web-signout">Sign out</button></div>`);
  if (WEB.screen === 'nomember') return card(`<h2>You're signed in, but not on the team yet</h2><p><b>${esc(WEB.email)}</b> hasn't been added to this CRM. Ask a CRM admin to add this email under Territories, then Team, and reload this page.</p><div class="row"><button type="button" class="btn primary" data-act="web-reload">Reload</button><button type="button" class="btn" data-act="web-signout">Sign out</button></div>`);
  if (WEB.screen !== 'login') return loadingHtml('Signing you in…');
  const m = WEB.mode;
  const title = m === 'signup' ? 'Create your account' : m === 'forgot' ? 'Reset your password' : 'Sign in';
  const sub = m === 'signup' ? 'Use the email address your CRM admin added for you.' : m === 'forgot' ? 'We\'ll email you a link to set a new password.' : 'Matthews Auctioneers team members only.';
  return card(`<h2>${title}</h2><p class="muted">${sub}</p>
    ${WEB.err ? `<div class="dlg-msg">${esc(WEB.err)}</div>` : ''}${WEB.msg ? `<div class="gate-ok">${esc(WEB.msg)}</div>` : ''}
    <form id="web-auth" class="gate-form" novalidate>
      <div class="fld"><label for="web-email">Email</label><input id="web-email" type="email" autocomplete="username" data-hold value="${esc(WEB.email)}" required></div>
      ${m === 'forgot' ? '' : `<div class="fld"><label for="web-pass">Password</label><input id="web-pass" type="password" autocomplete="${m === 'signup' ? 'new-password' : 'current-password'}" data-hold minlength="8" required>${m === 'signup' ? '<small>At least 8 characters.</small>' : ''}</div>`}
      <button type="submit" class="btn primary"${WEB.busy ? ' disabled' : ''}>${m === 'signup' ? 'Create account' : m === 'forgot' ? 'Send reset link' : 'Sign in'}</button>
    </form>
    <div class="gate-links">${m !== 'signin' ? `<button type="button" class="link" data-act="web-mode" data-mode="signin">Back to sign in</button>` : `<button type="button" class="link" data-act="web-mode" data-mode="signup">Create an account</button><button type="button" class="link" data-act="web-mode" data-mode="forgot">Forgot password?</button>`}</div>`);
}
function authErrText(error) {
  const m = String((error && error.message) || '').toLowerCase();
  if (m.includes('invalid login')) return 'That email and password don\'t match. Try again or reset your password.';
  if (m.includes('not confirmed')) return 'Confirm your email first: open the link in the message we sent you, then sign in.';
  if (m.includes('already registered')) return 'That email already has an account. Sign in instead, or reset your password.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a few minutes and try again.';
  if (m.includes('password')) return 'Choose a password with at least 8 characters.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'New accounts are turned off. Ask a CRM admin to invite you.';
  return 'That didn\'t work. Check your connection and try again.';
}
async function webAuthSubmit() {
  if (WEB.busy) return;
  const email = clean(($('#web-email') || {}).value).toLowerCase(), pass = ($('#web-pass') || {}).value || '';
  WEB.email = email; WEB.err = ''; WEB.msg = '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { WEB.err = 'Enter your email address.'; return renderNow(); }
  if (WEB.mode !== 'forgot' && pass.length < 8) { WEB.err = WEB.mode === 'signup' ? 'Choose a password with at least 8 characters.' : 'Enter your password.'; return renderNow(); }
  WEB.busy = true; renderNow();
  try {
    if (WEB.mode === 'signin') {
      const { error } = await SB.auth.signInWithPassword({ email, password: pass });
      if (error) WEB.err = authErrText(error);
    } else if (WEB.mode === 'signup') {
      const { data, error } = await SB.auth.signUp({ email, password: pass, options: { emailRedirectTo: location.origin } });
      if (error) WEB.err = authErrText(error);
      else if (!data || !data.session) { WEB.mode = 'signin'; WEB.msg = 'Check your email for a confirmation link, then sign in here.'; }
    } else {
      const { error } = await SB.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
      if (error) WEB.err = authErrText(error);
      else { WEB.mode = 'signin'; WEB.msg = 'If that email has an account, a reset link is on its way.'; }
    }
  } catch (e) { WEB.err = authErrText(e); }
  WEB.busy = false;
  if (!WEB.entered) renderNow();
}

/* AI drafting goes through the site's own server route, which holds the API key. */
function makeWebSample() {
  const call = async (input, opts) => {
    opts = opts || {};
    const { data } = await SB.auth.getSession();
    const token = data && data.session ? data.session.access_token : '';
    let res;
    try { res = await fetch('/api/draft', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ input }), signal: opts.signal }); }
    catch (e) { throw { code: e && e.name === 'AbortError' ? 'cancelled' : 'upstream_error', message: String(e) }; }
    let j = {};
    try { j = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (!res.ok) throw { code: j.code || (res.status === 404 ? 'not_configured' : 'upstream_error'), message: j.message || '' };
    if (!j.text) throw { code: 'empty_completion', message: '' };
    if (opts.onText) opts.onText({ text: j.text, delta: j.text });
    return { text: j.text, truncated: !!j.truncated };
  };
  call.json = async (input, opts) => {
    const r = await call(input, Object.assign({}, opts || {}, { onText: null }));
    const t = r.text.trim();
    const tries = [t, (t.match(/```(?:json)?\s*([\s\S]*?)```/) || [])[1], t.slice(Math.min(...[t.indexOf('['), t.indexOf('{')].filter(i => i >= 0)), Math.max(t.lastIndexOf(']'), t.lastIndexOf('}')) + 1)];
    for (const s of tries) { if (!s) continue; try { return JSON.parse(s); } catch (e) { /* try the next shape */ } }
    throw { code: 'invalid_json', message: '', text: r.text };
  };
  return call;
}
const webDownloads = {
  save: async ({ filename, data }) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: /\.csv$/i.test(filename) ? 'text/csv;charset=utf-8' : /\.json$/i.test(filename) ? 'application/json' : 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return { status: 'saved' };
  },
};

/* The account dialog replaces the "who are you" prompt of the Claude-hosted build. */
function openMe(forcePassword) {
  const me = S.team[ME] || {};
  const spec = [
    { k: 'name', label: 'Your name (shown on your activity)', full: true, max: 60 },
    { k: 'pass', label: forcePassword ? 'Choose a password' : 'New password (leave blank to keep the current one)', type: 'password', full: true, max: 200, hint: 'At least 8 characters.' },
  ];
  openDialog({
    title: forcePassword ? 'Set your password' : 'Your account', sub: 'Signed in as ' + WEB.email + (CAP.isAdmin ? ' · admin' : ''),
    body: fieldsHtml(spec, { name: me.name || '' }),
    extra: `<button type="button" class="btn" data-act="web-signout">Sign out</button>`,
    onSubmit: () => guard(async () => {
      const name = cap(clean($('#f-name').value), 60), pass = $('#f-pass').value || '';
      if (!name) return dlgMsg('Enter your name.');
      if (pass && pass.length < 8) return dlgMsg('Choose a password with at least 8 characters.');
      if (forcePassword && !pass) return dlgMsg('Choose a password so you can sign in next time.');
      if (pass) { const { error } = await SB.auth.updateUser({ password: pass }); if (error) return dlgMsg(authErrText(error)); }
      closeDialog();
      if (name !== me.name) await Store.cfgPatch('team', ME, { name });
      toast(pass ? 'Password and name saved.' : 'Saved.');
    }),
  });
}

async function webEnter(session) {
  if (WEB.entered || !session) return;
  WEB.entered = true; WEB.screen = 'loading'; WEB.email = (session.user && session.user.email) || '';
  renderNow();
  try {
    const { data, error } = await SB.rpc('link_me');
    if (error) throw dbError(error);
    if (!data || !data.id) { WEB.screen = 'nomember'; return renderNow(); }
    ME = data.id; CAP.isAdmin = !!data.is_admin; CAP.uid = data.user_id || '';
    CAP.downloads = webDownloads; CAP.sample = makeWebSample();
    V.tk.rep = ME; V.out.rep = ME;
    Store.onChange = local => schedule(0, !!local);
    Store.onBehind = () => toast('Saved, but some newer details (appointment times, opportunity items, lines of business) can\'t be stored until the database gets its update. Ask your CRM admin to run the latest database update.', { error: true });
    await Store.init(SB);
    CAP.db = SB;
    document.body.classList.remove('anon');
    document.body.classList.toggle('not-admin', !CAP.isAdmin);
    renderNow();
    if (WEB.askPassword) { WEB.askPassword = false; openMe(true); }
  } catch (e) {
    console.error(e);
    WEB.screen = 'error'; WEB.err = e && e.code === 'denied' ? 'Your account does not have access to this CRM.' : 'Check your connection and reload the page.';
    renderNow();
  }
}

ACTIONS['web-mode'] = t => { WEB.mode = t.dataset.mode; WEB.err = ''; WEB.msg = ''; const e = $('#web-email'); if (e) WEB.email = clean(e.value); renderNow(); };
ACTIONS['web-reload'] = () => location.reload();
ACTIONS['web-signout'] = () => { const done = () => location.reload(); if (SB) SB.auth.signOut().then(done, done); else done(); };
CHANGES['backup-file'] = t => {
  const file = t.files && t.files[0];
  if (!file) return;
  V.imp.restore = 'Restoring… keep this page open.'; renderNow();
  file.text().then(text => restoreBackup(JSON.parse(text))).then(n => {
    V.imp.restore = 'Restored: ' + KINDS.map(k => (n[KIND_LABEL[k]] || 0) + ' ' + KIND_LABEL[k].replace('emailDrafts', 'email drafts')).join(', ') + ', ' + n.territories + ' territories, ' + n.team + ' team members. Records already in the CRM were left alone.';
    renderNow();
  }, e => { console.error(e); V.imp.restore = e instanceof SyntaxError ? 'That file isn\'t a CRM backup (it should be the .json file from Full backup).' : errText(e); renderNow(); });
};

async function boot() {
  startShell();
  document.addEventListener('submit', e => { if (e.target.id === 'web-auth') webAuthSubmit(); });
  const cfg = window.__CRM_CONFIG__ || {};
  CAP.checked = true;
  if (!cfg.url || !cfg.key || !window.supabase || !window.supabase.createClient) { WEB.screen = 'unconfigured'; return render(); }
  /* An invite or reset link signs the person in without a password, so ask them to choose one. */
  if (/type=(invite|recovery)/.test(location.hash || '')) WEB.askPassword = true;
  SB = window.supabase.createClient(cfg.url, cfg.key);
  SB.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') WEB.askPassword = true;
    if (event === 'SIGNED_OUT' && WEB.entered) return location.reload();
    if (session && !WEB.entered) setTimeout(() => webEnter(session), 0);
  });
  try {
    const { data } = await SB.auth.getSession();
    if (data && data.session) return webEnter(data.session);
  } catch (e) { console.error(e); }
  if (!WEB.entered) { WEB.screen = 'login'; render(); }
}
boot();
