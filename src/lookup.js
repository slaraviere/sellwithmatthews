/* ============================================================
   Check first — before a company or contact is added, search the CRM for it.
   The + New and + Contact buttons open this search. If nothing matches, the
   form opens with what was typed already filled in.

   A person who isn't part of any company gets a record of their own, the same
   kind a company has (so calls, follow-ups, appointments and opportunities all
   work), marked by the industry "Individual / Family". Adding one creates the
   record and its contact together.
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

const PERSON_INDUSTRY = 'Individual / Family';
const isPerson = c => !!c && c.industry === PERSON_INDUSTRY;
const personChip = c => (isPerson(c) ? '<span class="st st-out">Individual</span>' : '');

function lookupRender() {
  const out = $('#lk-out');
  if (!out || !_lk) return;
  const q = clean(_lk.q), ct = _lk.kind === 'ct', loose = ct && !_lk.coId;
  if (q.length < 2) { _lk.n = 0; _lk.ok = false; out.innerHTML = `<p class="muted">${S.co.size || S.ct.size ? 'Type a name, phone number, email address or website. Anything already in the CRM shows up here.' : 'Nothing is in the CRM yet. Type the name to get started.'}</p>`; return; }
  const { cos, cts } = lookupHits(q), n = cos.length + cts.length, MAX = 8;
  _lk.n = n; _lk.ok = true;
  const coRow = h => { const c = h.c, p = primaryContact(c.id);
    return `<li class="lk-item"><button type="button" class="lk-main" data-act="lk-open" data-kind="co" data-id="${esc(c.id)}"><span><b>${esc(c.name)}</b> ${personChip(c)} ${statusChip(c.status)}</span>
      <span class="muted">${esc([clean((c.city || '') + (c.state ? ', ' + c.state : '')), c.phone ? fmtPhone(c.phone) : '', p && !isPerson(c) ? ctName(p) : '', h.why !== 'name' ? h.why : ''].filter(Boolean).join(' · ') || 'No details yet')}</span></button>
      ${ct && c.id !== _lk.coId && !isPerson(c) ? `<button type="button" class="btn sm w" data-act="lk-here" data-id="${esc(c.id)}">+ Contact here</button>` : ''}</li>`; };
  const ctRow = h => { const x = h.x;
    return `<li class="lk-item"><button type="button" class="lk-main" data-act="lk-open" data-kind="ct" data-id="${esc(x.id)}"><span><b>${esc(ctName(x))}</b>${x.title ? ' <span class="muted">' + esc(x.title) + '</span>' : ''}${_lk.coId && x.co === _lk.coId ? ' <span class="st st-warn">Already on this company</span>' : ''}</span>
      <span class="muted">${esc([x.co ? coName(x.co) : 'Not attached to anything', x.email, (x.mobile || x.phone) ? fmtPhone(x.mobile || x.phone) : '', h.why !== 'name' ? h.why : ''].filter(Boolean).join(' · '))}</span></button></li>`; };
  const more = (list) => list.length > MAX ? `<li class="lk-more muted">and ${list.length - MAX} more. Keep typing to narrow it down.</li>` : '';
  const short = q.length > 40 ? q.slice(0, 40) + '…' : q;
  /* the first button is what Enter does; the second is the other kind of record */
  const btn = (id, what, label, primary) => `<button type="button" class="btn${primary ? ' primary' : ''} w" id="${id}" data-act="lk-add" data-what="${what}">${esc(label)}</button>`;
  const buttons = _lk.coId ? btn('lk-add', 'ct', `Add “${short}” as a new contact`, !n)
    : loose ? btn('lk-add', 'person', `Add “${short}” as an individual`, !n) + btn('lk-add-alt', 'co', 'Add as a company', false)
    : btn('lk-add', 'co', `Add “${short}” as a company`, !n) + btn('lk-add-alt', 'person', 'Add as an individual', false);
  out.innerHTML = (n
      ? (cos.length ? `<div class="gr-h">Companies and individuals already in the CRM (${cos.length})</div><ul class="lk-list" id="lk-cos">${cos.slice(0, MAX).map(coRow).join('')}${more(cos)}</ul>` : '') +
        (cts.length ? `<div class="gr-h">Contacts already in the CRM (${cts.length})</div><ul class="lk-list" id="lk-cts">${cts.slice(0, MAX).map(ctRow).join('')}${more(cts)}</ul>` : '')
      : `<p class="lk-none" id="lk-none"><b>Nothing in the CRM matches “${esc(short)}”.</b> It looks new.</p>`) +
    `<div class="lk-new">${n ? `<span class="muted">Open one to use it. If none of these is who you mean:</span>` : ''}${buttons}</div>` +
    (_lk.coId ? '' : `<p class="muted fine">${loose ? 'Works at a company? Find the company and click + Contact here, or add the company first. ' : ''}An individual is a person who isn't part of a company, such as a homeowner, an heir or a retiring farmer.</p>`);
}

function openLookup(kind, coId) {
  _lk = { kind, coId: coId || '', q: '', n: 0, ok: false };
  const ct = kind === 'ct';
  openDialog({
    title: ct ? 'New contact' : 'Add new', wide: true,
    sub: (coId ? 'Adding a contact to ' + coName(coId) + '. ' : '') + 'Search first, so nobody gets added twice.',
    body: `<div class="fld"><label for="lk-q">Is this ${ct ? 'person' : 'company or person'} already in the CRM?</label><input id="lk-q" type="search" data-input="lookup" placeholder="Name, phone, email or website" maxlength="200" autocomplete="off"></div><div id="lk-out" class="lk-out" aria-live="polite"></div>`,
  });
  /* Enter adds the record only when the search found nothing */
  $('#dlg')._submit = () => { if (_lk && _lk.ok && !_lk.n) lookupAdd($('#lk-add').dataset.what); };
  lookupRender();
}
/* what: 'co' company form, 'person' individual form, 'ct' contact on the company this search started from */
function lookupAdd(what, coId) {
  if (!_lk) return;
  const q = _lk.q, to = coId || _lk.coId;
  _lk = null;
  /* "+ Contact here" was found by searching for the company, so what was typed isn't the person's name */
  if (coId) return openContact(null, coId, {});
  if (what === 'co') return openCompany(null, lookupPrefill('co', q));
  if (what === 'person') return openPerson(lookupPrefill('ct', q));
  openContact(null, to, lookupPrefill('ct', q));
}

/* ---------- an individual: one form that creates the record and its contact ---------- */
function personSpec() {
  return [
    { k: 'first', label: 'First name' }, { k: 'last', label: 'Last name' },
    { k: 'mobile', label: 'Phone', type: 'tel' }, { k: 'email', label: 'Email', type: 'email' },
    { k: 'addr', label: 'Address', full: true },
    { k: 'city', label: 'City' }, { k: 'county', label: 'County' },
    { k: 'state', label: 'State', ph: 'VA', max: 20 }, { k: 'zip', label: 'ZIP code', max: 10 },
    { k: 'lines', label: 'What might they sell? (leave blank for Equipment)', type: 'multi', opts: LINES },
    { k: 'source', label: 'How did we hear about them?', list: 'dl-source' },
    { k: 'rep', label: 'Assigned rep', type: 'select', opts: repOpts(false) },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 3 },
  ];
}
function findSamePerson(v, exceptCt) {
  const email = (v.email || '').toLowerCase(), ph = normPhone(v.mobile), name = clean(v.first + ' ' + v.last).toLowerCase();
  for (const x of S.ct.values()) {
    if (x.id === exceptCt) continue;
    if (email && (x.email || '').toLowerCase() === email) return ctName(x) + ' has the same email address';
    if (ph && (normPhone(x.mobile) === ph || normPhone(x.phone) === ph)) return ctName(x) + ' has the same phone number';
  }
  for (const c of S.co.values()) {
    if (ph && normPhone(c.phone) === ph) return c.name + ' has the same phone number';
    if (isPerson(c) && name && (c.name || '').toLowerCase() === name && (!v.city || !c.city || normCity(c.city) === normCity(v.city))) return c.name + (c.city ? ' in ' + c.city : '') + ' is already in the CRM';
  }
  return '';
}
/* fromCt: an existing contact that isn't attached to anything; it moves onto the new record instead of being copied. */
function openPerson(pre, fromCt) {
  const spec = personSpec(), old = fromCt ? S.ct.get(fromCt) : null;
  let confirmed = false;
  openDialog({
    title: 'New individual', wide: true,
    sub: old ? 'This gives ' + ctName(old) + ' a page of their own, so calls, follow-ups, appointments and opportunities can be logged.' : 'For a person who isn\'t part of a company. They get their own page, just like a company does.',
    body: fieldsHtml(spec, Object.assign({ rep: ME || '' }, pre || {})) + datalist('dl-source', distinct('co', 'source')),
    onSubmit: () => guard(async () => {
      const v = readFields(spec);
      const name = clean(v.first + ' ' + v.last);
      if (!name) return dlgMsg('Enter a first or last name.');
      if (v.state && !normState(v.state)) return dlgMsg('Enter the state as a two-letter code, such as VA or NC.');
      if (!confirmed) {
        const why = findSamePerson(v, fromCt);
        if (why) { confirmed = true; $('#dlg-submit').textContent = 'Save anyway'; return dlgMsg(why + '. Save anyway only if this is a different person.'); }
      }
      const now = nowIso(), id = uid();
      const rec = { id, name, industry: PERSON_INDUSTRY, phone: v.mobile, web: '', addr: v.addr, city: v.city, county: v.county, state: normState(v.state) || '', zip: v.zip,
        subIndustry: '', source: v.source, leadType: '', priority: '', status: 'New', rep: v.rep, nextFU: '', lines: v.lines, assets: [], optOut: false, dnc: false, srcUrl: '', notes: v.notes, attemptsBase: 0, created: now, updated: now };
      const t = assignTerritory(rec); rec.terr = t.code; rec.terrHow = t.how;
      const person = { first: v.first, last: v.last, email: v.email.toLowerCase(), mobile: v.mobile, co: id, primary: true, updated: now };
      closeDialog();
      V.tab = 'companies'; V.coId = id;
      const p = Store.add('co', rec).then(() => old ? Store.patch('ct', old.id, person)
        : Store.add('ct', Object.assign({ id: uid(), title: '', dept: '', role: '', phone: '', nextFU: '', optOut: false, dnc: false, notes: '', created: now }, person)));
      renderNow();
      if (rec.terr === UNASSIGNED) toast('No territory matched this location, so they are flagged for review.');
      await p;
    }),
  });
}

function wireLookup() {
  ACTIONS['co-new'] = () => openLookup('co');
  ACTIONS['ct-new'] = t => openLookup('ct', t.dataset.id || '');
  INPUTS['lookup'] = t => { if (_lk) { _lk.q = t.value; lookupRender(); } };
  ACTIONS['lk-add'] = t => lookupAdd(t.dataset.what);
  ACTIONS['lk-here'] = t => lookupAdd('ct', t.dataset.id);
  ACTIONS['lk-open'] = t => { _lk = null; if (t.dataset.kind === 'co') openCo(t.dataset.id); else openContact(t.dataset.id); };
  ACTIONS['ct-person'] = t => { const x = S.ct.get(t.dataset.id); if (x) openPerson({ first: x.first, last: x.last, email: x.email, mobile: x.mobile || x.phone }, x.id); };
}
