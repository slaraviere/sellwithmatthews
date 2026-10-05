/* ============================================================
   Check first — before a company or contact is added, search the CRM for it.
   The + Company and + Contact buttons open this search. If nothing matches,
   the usual form opens with what was typed already filled in.
   ============================================================ */
let _lk = null;

/* Matches by name (ignoring Inc, LLC and punctuation), phone digits, email or website. */
function lookupHits(q) {
  const raw = clean(q), low = raw.toLowerCase();
  if (raw.length < 2) return { cos: [], cts: [] };
  const hasLetters = /[a-z]/i.test(raw.replace(/\b(x|ext)\b\.?/gi, ''));
  const digits = hasLetters ? '' : raw.replace(/\D/g, '');
  const phoneQ = digits.length >= 4 ? (digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits) : '';
  const dom = /[@.]/.test(low) ? matchDomain(low) : '';
  const nameTokens = normName(raw).split(' ').filter(Boolean);
  const words = low.split(/\s+/).filter(Boolean);
  const phoneHit = (...vals) => !!phoneQ && vals.some(v => String(v || '').replace(/\D/g, '').includes(phoneQ));
  const allIn = (tokens, hay) => tokens.length > 0 && tokens.every(t => hay.includes(t));
  const rank = (name, q2) => (name === q2 ? 0 : name.startsWith(q2) ? 1 : 2);

  const cos = [], cts = [];
  for (const c of S.co.values()) {
    const nn = normName(c.name), web = (c.web || '').toLowerCase();
    let why = '';
    if (!phoneQ && allIn(nameTokens, nn + ' ' + normCity(c.city))) why = 'name';
    else if (phoneHit(c.phone)) why = 'Same phone number';
    else if (dom && matchDomain(c.web) === dom) why = 'Same website';
    else if (/[@.]/.test(low) && web && web.includes(low)) why = 'Same website';
    if (why) cos.push({ c, why, r: why === 'name' ? rank(nn, nameTokens.join(' ')) : 0 });
  }
  for (const x of S.ct.values()) {
    const nm = ctName(x).toLowerCase(), email = (x.email || '').toLowerCase();
    let why = '';
    if (!phoneQ && allIn(words, nm + ' ' + email)) why = 'name';
    else if (phoneHit(x.phone, x.mobile)) why = 'Same phone number';
    else if (dom && email.endsWith('@' + dom)) why = 'Same email domain';
    if (why) cts.push({ x, why, r: why === 'name' ? rank(nm, low) : 0 });
  }
  /* a contact match also surfaces their company, so nobody adds the company a second time */
  const seen = new Set(cos.map(h => h.c.id));
  for (const h of cts) { const c = h.x.co && S.co.get(h.x.co); if (c && !seen.has(c.id) && h.why !== 'name') { seen.add(c.id); cos.push({ c, why: h.why === 'Same phone number' ? 'A contact here has this number' : 'A contact here uses this email domain', r: 3 }); } }
  cos.sort((a, b) => a.r - b.r || a.c.name.localeCompare(b.c.name));
  cts.sort((a, b) => a.r - b.r || ctName(a.x).localeCompare(ctName(b.x)));
  return { cos, cts };
}

/* Turns what was typed into the first fields of the new record. */
function lookupPrefill(kind, q) {
  const raw = clean(q);
  if (!raw) return {};
  if (raw.includes('@') && !/\s/.test(raw)) return kind === 'ct' ? { email: raw.toLowerCase() } : (matchDomain(raw) ? { web: matchDomain(raw) } : {});
  if (!/[a-z]/i.test(raw) && normPhone(raw)) return { phone: fmtPhone(raw) };
  if (kind === 'co') return !/\s/.test(raw) && domainOf(raw) ? { web: domainOf(raw) } : { name: raw };
  const parts = raw.split(' ');
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function lookupRender() {
  const out = $('#lk-out');
  if (!out || !_lk) return;
  const q = clean(_lk.q), noun = _lk.kind === 'co' ? 'company' : 'contact';
  if (q.length < 2) { _lk.n = 0; _lk.ok = false; out.innerHTML = `<p class="muted">Type a name, phone number, email address or website. Anything already in the CRM shows up here.</p>`; return; }
  const { cos, cts } = lookupHits(q), n = cos.length + cts.length, MAX = 8;
  _lk.n = n; _lk.ok = true;
  const coRow = h => { const c = h.c, p = primaryContact(c.id);
    return `<li class="lk-item"><button type="button" class="lk-main" data-act="lk-open" data-kind="co" data-id="${esc(c.id)}"><span><b>${esc(c.name)}</b> ${statusChip(c.status)}</span>
      <span class="muted">${esc([clean((c.city || '') + (c.state ? ', ' + c.state : '')), c.phone ? fmtPhone(c.phone) : '', p ? ctName(p) : '', h.why !== 'name' ? h.why : ''].filter(Boolean).join(' · ') || 'No details yet')}</span></button>
      ${_lk.kind === 'ct' && c.id !== _lk.coId ? `<button type="button" class="btn sm w" data-act="lk-here" data-id="${esc(c.id)}">+ Contact here</button>` : ''}</li>`; };
  const ctRow = h => { const x = h.x;
    return `<li class="lk-item"><button type="button" class="lk-main" data-act="lk-open" data-kind="ct" data-id="${esc(x.id)}"><span><b>${esc(ctName(x))}</b>${x.title ? ' <span class="muted">' + esc(x.title) + '</span>' : ''}${_lk.coId && x.co === _lk.coId ? ' <span class="st st-warn">Already on this company</span>' : ''}</span>
      <span class="muted">${esc([x.co ? coName(x.co) : 'No company', x.email, (x.mobile || x.phone) ? fmtPhone(x.mobile || x.phone) : '', h.why !== 'name' ? h.why : ''].filter(Boolean).join(' · '))}</span></button></li>`; };
  const more = (list) => list.length > MAX ? `<li class="lk-more muted">and ${list.length - MAX} more. Keep typing to narrow it down.</li>` : '';
  const short = q.length > 40 ? q.slice(0, 40) + '…' : q;
  out.innerHTML = (n
      ? (cos.length ? `<div class="gr-h">Companies already in the CRM (${cos.length})</div><ul class="lk-list" id="lk-cos">${cos.slice(0, MAX).map(coRow).join('')}${more(cos)}</ul>` : '') +
        (cts.length ? `<div class="gr-h">Contacts already in the CRM (${cts.length})</div><ul class="lk-list" id="lk-cts">${cts.slice(0, MAX).map(ctRow).join('')}${more(cts)}</ul>` : '')
      : `<p class="lk-none" id="lk-none"><b>Nothing in the CRM matches “${esc(short)}”.</b> It looks new.</p>`) +
    `<div class="lk-new">${n ? `<span class="muted">Open one to use it. If none of these is who you mean:</span>` : ''}<button type="button" class="btn${n ? '' : ' primary'} w" id="lk-add" data-act="lk-add">Add “${esc(short)}” as a new ${noun}</button></div>`;
}

function openLookup(kind, coId) {
  if (!S.co.size && !S.ct.size) return kind === 'co' ? openCompany() : openContact(null, coId || '');
  _lk = { kind, coId: coId || '', q: '', n: 0, ok: false };
  const noun = kind === 'co' ? 'company' : 'contact';
  openDialog({
    title: 'New ' + noun, wide: true,
    sub: (coId ? 'Adding a contact to ' + coName(coId) + '. ' : '') + 'Search first, so nobody gets added twice.',
    body: `<div class="fld"><label for="lk-q">Is this ${noun} already in the CRM?</label><input id="lk-q" type="search" data-input="lookup" placeholder="Name, phone, email or website" maxlength="200" autocomplete="off"></div><div id="lk-out" class="lk-out" aria-live="polite"></div>`,
  });
  /* Enter adds the record only when the search found nothing */
  $('#dlg')._submit = () => { if (_lk && _lk.ok && !_lk.n) lookupAdd(); };
  lookupRender();
}
function lookupAdd(coId) {
  if (!_lk) return;
  /* "+ Contact here" was found by searching for the company, so what was typed isn't the person's name */
  const kind = _lk.kind, pre = coId ? {} : lookupPrefill(kind, _lk.q), to = coId || _lk.coId;
  _lk = null;
  if (kind === 'co') openCompany(null, pre); else openContact(null, to, pre);
}

function wireLookup() {
  ACTIONS['co-new'] = () => openLookup('co');
  ACTIONS['ct-new'] = t => openLookup('ct', t.dataset.id || '');
  INPUTS['lookup'] = t => { if (_lk) { _lk.q = t.value; lookupRender(); } };
  ACTIONS['lk-add'] = () => lookupAdd();
  ACTIONS['lk-here'] = t => lookupAdd(t.dataset.id);
  ACTIONS['lk-open'] = t => { _lk = null; if (t.dataset.kind === 'co') openCo(t.dataset.id); else openContact(t.dataset.id); };
}
