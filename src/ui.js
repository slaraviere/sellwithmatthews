/* ============================================================
   App state, rendering, dialogs
   ============================================================ */
const CAP = { db: null, user: null, downloads: null, sample: null, mcp: null, uid: null, canWrite: true, isAdmin: false, checked: false };
let ME = null;
const CO_FILTER0 = { q: '', line: '', terr: '', rep: '', industry: '', asset: '', priority: '', status: '', view: 'all', sort: 'name', dir: 1, limit: 100 };
const V = {
  tab: 'dashboard', coId: null,
  dash: { line: '', terr: '', rep: '', industry: '', asset: '', priority: '', status: '' },
  co: Object.assign({}, CO_FILTER0),
  ct: { q: '', role: '', limit: 100 },
  op: { stage: 'open', line: '', type: '', terr: '', rep: '', q: '' },
  tk: { tab: 'today', rep: '' },
  ac: { type: '', rep: '', range: 'week', limit: 100 },
  imp: { step: 'pick' },
  out: { src: 'first', line: '', terr: '', rep: '', industry: '', asset: '', priority: '', status: '', n: '10', extra: '', run: null, all: false, cfgOpen: false, form: null },
};
const TABS = [['dashboard', 'Dashboard'], ['companies', 'Companies'], ['contacts', 'Contacts'], ['opportunities', 'Opportunities'], ['tasks', 'Tasks'], ['outreach', 'Outreach'], ['activity', 'Activity'], ['territories', 'Territories'], ['review', 'Review'], ['import', 'Import / Export']];

/* ---------- saved views ---------- */
const hasAsset = (c, list) => (c.assets || []).some(a => list.includes(a));
const VIEWS = [
  { id: 'all', name: 'All companies', fn: () => true },
  { id: 'priority', name: 'Priority Prospecting', hint: 'A+ and A prospects that are not consignors yet', fn: c => (c.priority === 'A+' || c.priority === 'A') && c.status !== 'Consignor' },
  { id: 'followup', name: 'Follow-Up Due', hint: 'Next follow-up is today or earlier', fn: c => !!c.nextFU && c.nextFU <= today() },
  { id: 'nocontact', name: 'No Contact Yet', hint: 'No contact has been logged', fn: (c, i) => !i.last },
  { id: 'hasequip', name: 'Has Equipment', hint: 'Lead status is Has Equipment', fn: c => c.status === 'Has Equipment' },
  { id: 'consign', name: 'Consignment Opportunities', hint: 'Lead status is Consignment Opportunity', fn: c => c.status === 'Consignment Opportunity' },
  { id: 'heavy', name: 'Heavy Equipment Prospects', hint: 'Heavy, construction or paving equipment', fn: c => hasAsset(c, ['Heavy Equipment', 'Construction Equipment', 'Paving Equipment']) },
  { id: 'fleet', name: 'Fleet Prospects', hint: 'Trucks, trailers or fleet vehicles', fn: c => hasAsset(c, ['Trucks', 'Trailers', 'Fleet Vehicles']) },
  { id: 'nrv', name: 'NRV Construction', hint: 'NRV territory: construction, excavation, grading, paving, utilities', fn: c => c.terr === 'NRV' && CONSTRUCTION.includes(c.industry) },
  { id: 'nc', name: 'North Carolina Prospects', hint: 'NC companies, excluding Do Not Contact', fn: c => normState(c.state) === 'NC' && c.status !== 'Do Not Contact' },
  { id: 'referral', name: 'Referral Partners', hint: 'Attorneys, banks, agents and others who send estate and real estate work', fn: c => isReferral(c) },
  { id: 'dormant', name: 'Dormant Prospects', hint: 'No contact in more than 60 days', fn: (c, i) => isDormant(c, i) },
  /* reached from the dashboard tiles */
  { id: 'fu-today', name: 'Follow-ups due today', hidden: true, fn: c => c.nextFU === today() },
  { id: 'fu-over', name: 'Overdue follow-ups', hidden: true, fn: c => !!c.nextFU && c.nextFU < today() },
  { id: 'newlead', name: 'New leads not contacted', hidden: true, fn: (c, i) => c.status === 'New' && !i.last },
  { id: 'aplus', name: 'A+ prospects', hidden: true, fn: c => c.priority === 'A+' && !DEAD_STATUSES.includes(c.status) },
  { id: 'agrade', name: 'A prospects', hidden: true, fn: c => c.priority === 'A' && !DEAD_STATUSES.includes(c.status) },
  { id: 'interested', name: 'Interested prospects', hidden: true, fn: c => c.status === 'Interested' },
  { id: 'newweek', name: 'Added this week', hidden: true, fn: c => !!c.created && isoToYmd(c.created) >= weekStart() },
  { id: 'unassigned', name: 'Unassigned territory', hidden: true, fn: c => c.terr === UNASSIGNED },
];
const viewById = id => VIEWS.find(v => v.id === id) || VIEWS[0];

function coPass(c, f, skipRep) {
  if (f.line && !coLines(c).includes(f.line)) return false;
  if (f.terr && c.terr !== f.terr) return false;
  if (!skipRep && f.rep && (f.rep === 'none' ? !!c.rep : c.rep !== f.rep)) return false;
  if (f.industry && c.industry !== f.industry) return false;
  if (f.asset && !(c.assets || []).includes(f.asset)) return false;
  if (f.priority && c.priority !== f.priority) return false;
  if (f.status && c.status !== f.status) return false;
  return true;
}
function coSearchHit(c, q) {
  if (!q) return true;
  const hay = [c.name, c.city, c.county, c.state, c.zip, c.web, c.industry, c.subIndustry].join(' ').toLowerCase();
  if (hay.includes(q)) return true;
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 4 && String(c.phone || '').replace(/\D/g, '').includes(digits)) return true;
  return (derive().ctByCo.get(c.id) || []).some(x => (ctName(x) + ' ' + (x.email || '')).toLowerCase().includes(q));
}
function filterCompanies(f) {
  const v = viewById(f.view), q = clean(f.q).toLowerCase();
  const out = [];
  for (const c of S.co.values()) {
    if (!coPass(c, f)) continue;
    const info = coInfo(c);
    if (!v.fn(c, info)) continue;
    if (!coSearchHit(c, q)) continue;
    out.push({ c, info });
  }
  const k = f.sort, dir = f.dir;
  const val = r => {
    const c = r.c;
    switch (k) {
      case 'terr': return c.terr || '~';
      case 'priority': { const i = PRIORITIES.indexOf(c.priority); return i < 0 ? 99 : i; }
      case 'status': { const i = STATUSES.indexOf(c.status); return i < 0 ? 99 : i; }
      case 'rep': return repName(c.rep).toLowerCase() || '~';
      case 'last': return r.info.last || (dir > 0 ? '9999' : '');
      case 'nextFU': return c.nextFU || (dir > 0 ? '9999' : '');
      case 'attempts': return r.info.attempts;
      default: return (c.name || '').toLowerCase();
    }
  };
  out.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : (a.c.name || '').localeCompare(b.c.name || '')) * dir; });
  return out;
}

/* ---------- rendering ---------- */
let _rt = null;
/* Changes from other people wait while a dropdown has focus; your own changes render straight away. */
let _rforce = false;
function schedule(delay, force) {
  if (force) { _rforce = true; clearTimeout(_rt); _rt = null; delay = 0; }
  if (_rt) return;
  _rt = setTimeout(() => {
    _rt = null;
    const a = document.activeElement;
    const inMain = a && $('#main').contains(a);
    /* Never redraw under a field someone is typing in; a focused dropdown only waits out other people's changes. */
    if (inMain && (a.hasAttribute('data-hold') || (a.tagName === 'SELECT' && !_rforce))) { _rt = null; return schedule(900); }
    _rforce = false;
    render();
  }, delay || 50);
}
function renderNow() { clearTimeout(_rt); _rt = null; _rforce = false; render(); }
function render() {
  renderChrome();
  const main = $('#main');
  const a = document.activeElement;
  const keep = (a && a.id && main.contains(a)) ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
  let html;
  if (!CAP.checked) html = loadingHtml('Connecting to the CRM database…');
  else if (!CAP.db) html = noDbHtml();
  else if (S.dbState === 'revoked' || S.dbState === 'error') html = `<div class="empty"><h2>The CRM lost its connection to the database</h2><p>Reload the page to reconnect. Nothing you saved before this message was lost.</p></div>`;
  else if (!S.ready) html = loadingHtml('Loading companies, contacts and activity…');
  else html = (SCREENS[V.tab] || SCREENS.dashboard)();
  main.innerHTML = html;
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.focus({ preventScroll: true }); try { if (keep.s != null) el.setSelectionRange(keep.s, keep.e); } catch (e) { /* not a text input */ } }
  }
}
const loadingHtml = msg => `<div class="empty"><div class="spin" aria-hidden="true"></div><p>${esc(msg)}</p></div>`;
const noDbHtml = () => PLATFORM === 'web' ? webGateHtml() : `<div class="empty"><h2>The CRM database isn't available in this view</h2><p>Open this page from Claude while signed in to your Matthews Auctioneers account. Companies, contacts and activity load from the shared database once you're signed in.</p></div>`;

function renderChrome() {
  for (const b of $$('#tabs [data-tab]')) b.classList.toggle('on', b.dataset.tab === V.tab);
  const badge = $('#review-badge');
  if (badge) {
    let n = 0;
    if (S.ready) {
      const d = derive();
      n = d.dups.length;
      for (const c of S.co.values()) if (c.terr === UNASSIGNED) n++;
    }
    badge.textContent = n ? String(n) : '';
    badge.hidden = !n;
  }
  const ob = $('#out-badge');
  if (ob) { let n = 0; if (S.ready) for (const d of S.dr.values()) if (d.by === ME || !d.by) n++; ob.textContent = n ? String(n) : ''; ob.hidden = !n; }
  const chip = $('#me-chip');
  if (chip) { chip.textContent = ME && S.team[ME] ? (S.team[ME].name || 'Account') : 'Who are you?'; chip.hidden = !S.ready; chip.title = PLATFORM === 'web' ? 'Your account' : 'Change who you are'; }
  document.body.classList.toggle('ro', !CAP.canWrite);
  const ban = $('#banners');
  let h = '';
  if (S.ready && !CAP.canWrite) h += `<div class="banner">You have view-only access to this CRM. Ask the owner for Contributor access to log activity or edit records.</div>`;
  if (S.ready && CAP.canWrite && (!ME || !S.team[ME])) {
    const reps = repList(true).filter(id => !S.team[id].uid || S.team[id].uid === CAP.uid);
    h += `<form class="banner who" id="who-form"><b>Who's using the CRM?</b><span>Your calls, emails and tasks are logged under this name.</span>
      ${reps.length ? `<select id="who-pick" aria-label="Pick your name"><option value="">I'm new: add me</option>${reps.map(id => `<option value="${esc(id)}">${esc(S.team[id].name)}</option>`).join('')}</select>` : ''}
      <input id="who-name" type="text" maxlength="60" placeholder="Your name" aria-label="Your name">
      <button class="btn primary" type="submit">Save</button></form>`;
  }
  if (ban._h !== h) {
    const a = document.activeElement;
    if (!h || !(a && ban.contains(a))) { ban.innerHTML = h; ban._h = h; }
  }
}

/* ---------- toasts ---------- */
function toast(msg, opts) {
  opts = opts || {};
  const t = document.createElement('div');
  t.className = 'toast' + (opts.error ? ' err' : '');
  const span = document.createElement('span'); span.textContent = msg; t.appendChild(span);
  if (opts.action) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'link'; b.textContent = opts.action;
    b.addEventListener('click', () => { t.remove(); opts.onAction(); });
    t.appendChild(b);
  }
  const box = $('#toasts');
  box.appendChild(t);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => t.remove(), opts.error ? 9000 : (opts.action ? 9000 : 4200));
}
function errText(e) {
  const code = e && e.code;
  if (code === 'quota_exceeded') return "The CRM's storage is full, so this wasn't saved. Export a backup from Import / Export and tell the CRM owner.";
  if (code === 'invalid_argument') return "This wasn't saved. You may have view-only access, or the record is too large.";
  if (code === 'denied') return "This wasn't saved: your account isn't allowed to change it. Ask a CRM admin.";
  if (code === 'conflict') return "This wasn't saved because another record already uses the same value (for a team member, the same email).";
  if (code === 'missing_link') return "This wasn't saved because a record it points to was removed. Reload the page and try again.";
  if (code === 'revoked' || code === 'not_granted') return "This wasn't saved because the page lost access to the database. Reload and try again.";
  return "This wasn't saved. Check your connection, reload the page and try again.";
}
async function guard(fn) {
  try { await fn(); } catch (e) { console.error(e); toast(errText(e), { error: true }); }
}

/* ---------- small HTML builders ---------- */
const PRI_CLASS = { 'A+': 'ap', 'A': 'a', 'B+': 'bp', 'B': 'b', 'C': 'c', 'Unqualified': 'u' };
const priChip = p => p ? `<span class="pri pri-${PRI_CLASS[p] || 'u'}" title="${esc(PRIORITY_HELP[p] || p)}">${esc(p === 'Unqualified' ? 'UNQ' : p)}</span>` : '<span class="muted">–</span>';
const statusChip = s => s ? `<span class="st st-${STATUS_GROUP[s] || 'early'}">${esc(s)}</span>` : '<span class="muted">–</span>';
const terrTag = code => code ? `<span class="terr${code === UNASSIGNED ? ' terr-un' : ''}" title="${esc(terrName(code))}">${esc(code)}</span>` : '<span class="muted">–</span>';
const dueSpan = s => { if (!s) return '<span class="muted">–</span>'; const n = daysBetween(today(), s); return `<span class="due${n < 0 ? ' over' : n === 0 ? ' now' : ''}" title="${esc(fmtDate(s))}">${esc(dueLabel(s))}</span>`; };
const copyBtn = text => text ? `<button type="button" class="copy" data-act="copy" data-text="${esc(text)}" title="Copy">Copy</button>` : '';
const optList = (opts, value) => opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(value) === String(v) ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
function fsel(scope, key, label, opts) {
  const v = V[scope][key];
  return `<select id="flt-${scope}-${key}" class="${v ? 'active' : ''}" data-change="filter" data-scope="${scope}" data-key="${key}" aria-label="${esc(label)}"><option value="">${esc(label)}: All</option>${optList(opts, v)}</select>`;
}
const terrOpts = withUn => terrCodes(false).map(c => [c, c + ' · ' + S.terr[c].name]).concat(withUn ? [[UNASSIGNED, 'Unassigned']] : []);
const repOpts = withNone => repList(false).map(id => [id, S.team[id].name]).concat(withNone ? [['none', 'No rep assigned']] : []);
function coFilterBar(scope) {
  return fsel(scope, 'line', 'Line', LINES) + fsel(scope, 'terr', 'Territory', terrOpts(true)) + fsel(scope, 'rep', 'Rep', repOpts(true)) + fsel(scope, 'industry', 'Industry', INDUSTRIES) +
    fsel(scope, 'asset', 'Asset potential', ASSETS) + fsel(scope, 'priority', 'Priority', PRIORITIES) + fsel(scope, 'status', 'Lead status', STATUSES);
}
const money = n => (n == null || n === '' || isNaN(n)) ? '' : '$' + Math.round(Number(n)).toLocaleString();
const exportBtn = (kind, label) => CAP.downloads ? `<button type="button" class="btn sm" data-act="export" data-kind="${kind}">${esc(label || 'Export CSV')}</button>` : '';

/* ============================================================
   Dialog + form helpers
   ============================================================ */
function openDialog(o) {
  const d = $('#dlg');
  d.innerHTML = `<form class="dlg${o.wide ? ' wide' : ''}" id="dlg-form" novalidate>
    <header><h2>${esc(o.title)}</h2><button type="button" class="x" data-act="dlg-close" aria-label="Close">×</button></header>
    <div class="dlg-body">${o.sub ? `<p class="dlg-sub">${esc(o.sub)}</p>` : ''}<div id="dlg-msg" class="dlg-msg" hidden></div>${o.body}</div>
    <footer>${o.extra || ''}<span class="grow"></span><button type="button" class="btn" data-act="dlg-close">${esc(o.cancelLabel || 'Cancel')}</button>${o.onSubmit ? `<button type="submit" class="btn primary" id="dlg-submit">${esc(o.submitLabel || 'Save')}</button>` : ''}</footer>
  </form>`;
  d._submit = o.onSubmit; d._ctx = o.ctx || {};
  if (!d.open) d.showModal();
  const first = $('.dlg-body input:not([type=checkbox]):not([disabled]), .dlg-body select, .dlg-body textarea', d);
  if (first && !o.noFocus) first.focus();
}
function closeDialog() { const d = $('#dlg'); if (d.open) d.close(); d.innerHTML = ''; d._submit = null; }
function dlgMsg(text) { const m = $('#dlg-msg'); if (!m) return; m.textContent = text; m.hidden = !text; if (text) m.scrollIntoView({ block: 'nearest' }); }

function fieldHtml(f, vals) {
  const id = 'f-' + f.k;
  let v = vals && vals[f.k];
  if (v == null) v = f.def == null ? '' : f.def;
  const req = f.req ? ' <span class="req" aria-hidden="true">*</span>' : '';
  if (f.type === 'check') return `<label class="chk solo${f.full ? ' full' : ''}"><input type="checkbox" id="${id}"${v ? ' checked' : ''}><span>${esc(f.label)}</span></label>`;
  if (f.type === 'multi') {
    return `<fieldset class="fld full"><legend>${esc(f.label)}</legend><div class="multi" id="${id}">${f.opts.map((o, i) => `<label class="chk"><input type="checkbox" id="${id}-${i}" value="${esc(o)}"${(v || []).includes(o) ? ' checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div></fieldset>`;
  }
  let ctl;
  if (f.type === 'select') ctl = `<select id="${id}"${f.dis ? ' disabled' : ''}>${f.noBlank ? '' : `<option value="">${esc(f.blank || '')}</option>`}${optList(f.opts, v)}</select>`;
  else if (f.type === 'textarea') ctl = `<textarea id="${id}" rows="${f.rows || 3}" maxlength="${f.max || 4000}"${f.ph ? ` placeholder="${esc(f.ph)}"` : ''}>${esc(v)}</textarea>`;
  else ctl = `<input id="${id}" type="${f.type || 'text'}" value="${esc(v)}"${f.list ? ` list="${f.list}"` : ''}${f.ph ? ` placeholder="${esc(f.ph)}"` : ''}${f.dis ? ' disabled' : ''}${f.type === 'number' ? ` min="0" step="${f.step || 1}" inputmode="decimal"` : ''} maxlength="${f.max || 200}" autocomplete="off">`;
  return `<div class="fld${f.full ? ' full' : ''}"><label for="${id}">${esc(f.label)}${req}</label>${ctl}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}${f.after || ''}</div>`;
}
const fieldsHtml = (spec, vals) => `<div class="grid">${spec.map(f => f.html != null ? f.html : fieldHtml(f, vals)).join('')}</div>`;
function readFields(spec) {
  const o = {};
  for (const f of spec) {
    if (!f.k) continue;
    const el = $('#f-' + f.k);
    if (!el) continue;
    if (f.type === 'multi') o[f.k] = $$('input:checked', el).map(x => x.value);
    else if (f.type === 'check') o[f.k] = el.checked;
    else if (f.type === 'number') o[f.k] = el.value === '' ? null : Number(el.value);
    else if (f.type === 'textarea') o[f.k] = cap(el.value.trim(), f.max || 4000);
    else o[f.k] = cap(clean(el.value), f.max || 200);
  }
  return o;
}
function datalist(id, values) {
  const uniq = [...new Set(values.map(clean).filter(Boolean))].sort().slice(0, 300);
  return `<datalist id="${id}">${uniq.map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
}
const distinct = (kind, key) => { const out = []; for (const r of S[kind].values()) if (r[key]) out.push(r[key]); return out; };

/* Company picker used when a task or opportunity is created away from a company page. */
let _coLabels = new Map();
function coPickerField(coId) {
  if (coId) return { html: `<div class="fld full"><span class="lab">Company</span><div class="static">${esc(coName(coId))}</div></div>` };
  _coLabels = new Map();
  const opts = [];
  for (const c of S.co.values()) {
    let label = c.name + (c.city ? ' · ' + c.city + (c.state ? ', ' + c.state : '') : '');
    while (_coLabels.has(label)) label += ' ';
    _coLabels.set(label, c.id);
    opts.push(`<option value="${esc(label)}"></option>`);
  }
  return { html: `<div class="fld full"><label for="f-coPick">Company</label><input id="f-coPick" type="text" list="dl-co" placeholder="Start typing a company name" autocomplete="off"><datalist id="dl-co">${opts.join('')}</datalist></div>` };
}
function readCoPicker(fixedId) {
  if (fixedId) return { id: fixedId };
  const el = $('#f-coPick');
  const raw = el ? el.value : '';
  if (!clean(raw)) return { id: '' };
  if (_coLabels.has(raw)) return { id: _coLabels.get(raw) };
  const q = clean(raw).toLowerCase();
  const hits = [...S.co.values()].filter(c => (c.name || '').toLowerCase() === q);
  if (hits.length === 1) return { id: hits[0].id };
  return { error: 'Pick the company from the list, or leave it blank.' };
}

/* ============================================================
   Automations
   ============================================================ */
async function changeStatus(c, status, extra) {
  const old = c.status;
  const patch = Object.assign({}, extra || {});
  const changed = !!status && status !== old;
  if (changed) { patch.status = status; patch.statusAt = nowIso(); }
  if (!Object.keys(patch).length) return;
  patch.updated = nowIso();
  const p = Store.patch('co', c.id, patch);
  if (changed && status === 'Interested') {
    const due = addBizDays(today(), 2);
    Store.add('tk', { id: uid(), name: 'Follow up with ' + c.name + ' (interested)', co: c.id, ct: (primaryContact(c.id) || {}).id || '', rep: c.rep || ME || '', due, type: 'Follow-Up', priority: 'High', status: 'Open', notes: 'Created automatically when the lead status changed to Interested.', created: nowIso(), auto: 'interested' }).catch(e => toast(errText(e), { error: true }));
    toast('Follow-up task created, due ' + fmtDate(due) + '.');
  }
  if (changed && status === 'Has Equipment') {
    toast(c.name + ' has equipment. Create an opportunity?', { action: 'Create opportunity', onAction: () => openOpp(null, c.id) });
  }
  await p;
}

/* ============================================================
   Record dialogs
   ============================================================ */
function companySpec(c) {
  return [
    { k: 'name', label: 'Name (company, person or estate)', req: true, full: true },
    { k: 'phone', label: 'Main phone', type: 'tel' },
    { k: 'web', label: 'Website', ph: 'example.com' },
    { k: 'addr', label: 'Address', full: true },
    { k: 'city', label: 'City' }, { k: 'county', label: 'County' },
    { k: 'state', label: 'State', ph: 'VA', max: 20 }, { k: 'zip', label: 'ZIP code', max: 10 },
    { k: 'terrPick', label: 'Territory', type: 'select', opts: terrOpts(true), blank: 'Assign automatically from location', hint: 'Matched by ZIP, then city + state, then county + state.', full: true },
    { k: 'industry', label: 'Industry', type: 'select', opts: INDUSTRIES },
    { k: 'subIndustry', label: 'Sub-industry', list: 'dl-sub' },
    { k: 'source', label: 'Lead source', list: 'dl-source' },
    { k: 'leadType', label: 'Lead type', list: 'dl-type' },
    { k: 'priority', label: 'Prospect priority', type: 'select', opts: PRIORITIES.map(p => [p, p + ' · ' + PRIORITY_HELP[p]]) },
    { k: 'status', label: 'Lead status', type: 'select', opts: STATUSES, noBlank: true, def: 'New' },
    { k: 'rep', label: 'Assigned rep', type: 'select', opts: repOpts(false) },
    { k: 'nextFU', label: 'Next follow-up date', type: 'date' },
    { k: 'lines', label: 'Lines of business (leave blank for Equipment)', type: 'multi', opts: LINES },
    { k: 'assets', label: 'Asset potential', type: 'multi', opts: ASSETS },
    { k: 'optOut', label: 'Email opt-out', type: 'check' }, { k: 'dnc', label: 'Do not call', type: 'check' },
    { k: 'srcUrl', label: 'Source URL', full: true, max: 500 },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 4 },
  ];
}
function findExactCompany(v, exceptId) {
  const n = normName(v.name), city = normCity(v.city), st = normState(v.state), dom = matchDomain(v.web);
  for (const c of S.co.values()) {
    if (c.id === exceptId) continue;
    if (n && city && st && normName(c.name) === n && normCity(c.city) === city && normState(c.state) === st) return c;
    if (dom && matchDomain(c.web) === dom) return c;
  }
  return null;
}
function openCompany(id) {
  const c = id ? S.co.get(id) : null;
  const spec = companySpec(c);
  const vals = c ? Object.assign({}, c, { terrPick: c.terrHow === 'Manual' ? c.terr : '' }) : { status: 'New', rep: ME || '' };
  let confirmed = false;
  openDialog({
    title: c ? 'Edit company' : 'New company', wide: true,
    body: fieldsHtml(spec, vals) + datalist('dl-sub', distinct('co', 'subIndustry')) + datalist('dl-source', distinct('co', 'source')) + datalist('dl-type', distinct('co', 'leadType')),
    extra: c ? `<button type="button" class="btn danger" data-act="del" data-kind="co" data-id="${esc(c.id)}">Delete</button>` : '',
    onSubmit: () => guard(async () => {
      const v = readFields(spec);
      if (!v.name) return dlgMsg('Enter the name.');
      if (v.state && !normState(v.state)) return dlgMsg('Enter the state as a two-letter code, such as VA or NC.');
      if (!confirmed) {
        const dup = findExactCompany(v, c && c.id);
        if (dup) { confirmed = true; $('#dlg-submit').textContent = 'Save anyway'; return dlgMsg(dup.name + (dup.city ? ' in ' + dup.city + ', ' + (dup.state || '') : '') + ' is already in the CRM with the same name and location or the same website. Save anyway only if this is a different company.'); }
      }
      v.state = normState(v.state) || '';
      const pick = v.terrPick; delete v.terrPick;
      if (pick) { v.terr = pick; v.terrHow = 'Manual'; }
      else { const r = assignTerritory(v); v.terr = r.code; v.terrHow = r.how; }
      v.updated = nowIso();
      closeDialog();
      if (c) {
        const status = v.status; delete v.status;
        await changeStatus(c, status, v);
      } else {
        const rec = Object.assign({ id: uid(), attemptsBase: 0, created: nowIso() }, v);
        V.tab = 'companies'; V.coId = rec.id;
        const p = Store.add('co', rec);
        renderNow();
        if (rec.terr === UNASSIGNED) toast('No territory matched this location, so the company is flagged for review.');
        await p;
      }
    }),
  });
}

function contactSpec(coId) {
  return [
    { k: 'first', label: 'First name' }, { k: 'last', label: 'Last name' },
    { k: 'title', label: 'Job title' }, { k: 'dept', label: 'Department' },
    { k: 'role', label: 'Contact role', type: 'select', opts: ROLES },
    { k: 'email', label: 'Email', type: 'email' },
    { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'mobile', label: 'Mobile phone', type: 'tel' },
    { k: 'nextFU', label: 'Next follow-up date', type: 'date' },
    { k: 'primary', label: 'Primary contact for this company', type: 'check' },
    { k: 'optOut', label: 'Email opt-out', type: 'check' }, { k: 'dnc', label: 'Do not call', type: 'check' },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true },
  ];
}
function openContact(id, coId) {
  const c = id ? S.ct.get(id) : null;
  if (c) coId = c.co;
  const spec = [coPickerField(coId)].concat(contactSpec(coId));
  const others = coId ? (derive().ctByCo.get(coId) || []).filter(x => x.id !== id) : [];
  const vals = c || { primary: coId ? others.length === 0 : false };
  let hist = '';
  if (c) {
    const acts = (derive().actByCt.get(c.id) || []).slice(0, 8);
    hist = `<h3 class="dlg-h">History with this contact</h3>` + (acts.length ? `<ul class="mini">${acts.map(a => `<li><b>${esc(a.type)}</b> <span class="muted">${esc(fmtDateTime(a.at))}${a.outcome ? ' · ' + esc(a.outcome) : ''}</span>${a.notes ? `<div class="pre">${esc(cap(a.notes, 240))}</div>` : ''}</li>`).join('')}</ul>` : `<p class="muted">Nothing logged with this contact yet.</p>`);
  }
  openDialog({
    title: c ? 'Edit contact' : 'New contact', wide: true,
    body: fieldsHtml(spec, vals) + hist,
    extra: c ? `<button type="button" class="btn danger" data-act="del" data-kind="ct" data-id="${esc(c.id)}">Delete</button>` + (c.co ? `<button type="button" class="btn" data-act="co-open" data-id="${esc(c.co)}">Open company</button>` : '') : '',
    onSubmit: () => guard(async () => {
      const v = readFields(spec);
      const pick = readCoPicker(coId);
      if (pick.error) return dlgMsg(pick.error);
      if (!v.first && !v.last && !v.email) return dlgMsg('Enter a name or an email address.');
      v.email = v.email.toLowerCase();
      v.co = pick.id; v.updated = nowIso();
      closeDialog();
      const jobs = [];
      if (v.primary && v.co) {
        const demote = (derive().ctByCo.get(v.co) || []).filter(x => x.primary && x.id !== id).map(x => [x.id, { primary: false }]);
        if (demote.length) jobs.push(Store.patchMany('ct', demote));
      }
      if (c) jobs.push(Store.patch('ct', c.id, v));
      else jobs.push(Store.add('ct', Object.assign({ id: uid(), created: nowIso() }, v)));
      await Promise.all(jobs);
    }),
  });
}

const FU_QUICK = [['Tomorrow', 1, false], ['3 days', 3, false], ['1 week', 7, false], ['2 weeks', 14, false], ['1 month', 30, false], ['3 months', 90, false]];
const fuQuickHtml = target => `<div class="quick">${FU_QUICK.map(q => `<button type="button" class="pill" data-act="fu-quick" data-target="${target}" data-days="${q[1]}">${q[0]}</button>`).join('')}<button type="button" class="pill" data-act="fu-quick" data-target="${target}" data-days="">Clear</button></div>`;

function openActivity(coId, type, actId, ctId) {
  const ex = actId ? S.ac.get(actId) : null;
  if (ex) { coId = ex.co; type = ex.type; }
  const c = coId ? S.co.get(coId) : null;
  const contacts = coId ? (derive().ctByCo.get(coId) || []) : [];
  const meta = ACT_META[type] || {};
  const suggest = (!ex && c && meta.status && EARLY_STATUSES.includes(c.status) && STATUSES.indexOf(meta.status) > STATUSES.indexOf(c.status)) ? meta.status : (c ? c.status : '');
  const prim = coId ? primaryContact(coId) : null;
  const fuHint = (!ex && c && c.nextFU && c.nextFU <= today()) ? 'Leave blank to clear the follow-up that was due ' + fmtDate(c.nextFU) + '.' : (c && c.nextFU ? 'Current follow-up: ' + fmtDate(c.nextFU) + '. Leave blank to keep it.' : '');
  const spec = [
    coPickerField(coId),
    { k: 'type', label: 'Activity type', type: 'select', opts: ACT_TYPES, noBlank: true },
    { k: 'when', label: 'Date and time', type: 'datetime-local' },
    { k: 'ct', label: 'Contact', type: 'select', opts: contacts.map(x => [x.id, ctName(x) + (x.title ? ' · ' + x.title : '')]), blank: 'No specific contact' },
    { k: 'outcome', label: 'Outcome', list: 'dl-outcome' },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 4 },
    { k: 'nextFU', label: 'Next follow-up date', type: 'date', hint: fuHint, after: fuQuickHtml('f-nextFU'), full: true },
  ];
  if (c && !ex) spec.push({ k: 'status', label: 'Lead status after this', type: 'select', opts: STATUSES, noBlank: true, full: true, hint: suggest !== c.status ? 'Suggested from the activity type. Currently ' + c.status + '.' : '' });
  const whenLocal = iso => { const d = new Date(iso); return ymd(d) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const vals = ex ? { type: ex.type, when: whenLocal(ex.at), ct: ex.ct || '', outcome: ex.outcome, notes: ex.notes, nextFU: ex.nextFU }
    : { type: type || 'Phone Call', when: localInputNow(), ct: ctId || (prim ? prim.id : ''), status: suggest };
  const warn = c && !ex ? [c.status === 'Do Not Contact' ? 'This company is marked Do Not Contact.' : '', c.dnc ? 'This company is marked Do Not Call.' : '', c.optOut ? 'This company has opted out of email.' : ''].filter(Boolean).join(' ') : '';
  openDialog({
    title: ex ? 'Edit activity' : 'Log ' + (type || 'activity').toLowerCase(), wide: true,
    body: (warn ? `<div class="dlg-warn">${esc(warn)}</div>` : '') + fieldsHtml(spec, vals) + datalist('dl-outcome', OUTCOMES),
    extra: ex ? `<button type="button" class="btn danger" data-act="del" data-kind="ac" data-id="${esc(ex.id)}">Delete</button>` : '',
    submitLabel: ex ? 'Save' : 'Log it',
    onSubmit: () => guard(async () => {
      const v = readFields(spec);
      const pick = readCoPicker(coId);
      if (pick.error) return dlgMsg(pick.error);
      const d = (!ex && v.when === vals.when) || !v.when ? new Date() : new Date(v.when);
      if (isNaN(d)) return dlgMsg('Enter the date and time of the activity.');
      const rec = { co: pick.id, ct: v.ct || '', type: v.type, at: d.toISOString(), outcome: v.outcome, notes: v.notes, nextFU: v.nextFU || '' };
      closeDialog();
      if (ex) { await Store.patch('ac', ex.id, rec); return; }
      rec.id = uid(); rec.by = ME || ''; rec.created = nowIso();
      const jobs = [Store.add('ac', rec)];
      const co = pick.id ? S.co.get(pick.id) : null;
      if (co) {
        const extra = {};
        if (v.nextFU) extra.nextFU = v.nextFU;
        else if (co.nextFU && co.nextFU <= today() && (ACT_META[v.type] || {}).contact) extra.nextFU = '';
        jobs.push(changeStatus(co, v.status || co.status, extra));
        if (v.ct && v.nextFU) jobs.push(Store.patch('ct', v.ct, { nextFU: v.nextFU }));
      }
      toast(v.type + ' logged' + (v.nextFU ? '. Next follow-up ' + fmtDate(v.nextFU) + '.' : '.'));
      await Promise.all(jobs);
    }),
  });
}

function openTask(id, coId, preset) {
  const t = id ? S.tk.get(id) : null;
  if (isAppt(t)) return openAppt(id);
  if (t) coId = t.co;
  const contacts = coId ? (derive().ctByCo.get(coId) || []) : [];
  const spec = [
    { k: 'name', label: 'Task', req: true, full: true },
    coPickerField(coId),
    { k: 'ct', label: 'Contact', type: 'select', opts: contacts.map(x => [x.id, ctName(x)]), blank: 'No specific contact' },
    { k: 'rep', label: 'Assigned to', type: 'select', opts: repOpts(false) },
    { k: 'due', label: 'Due date', type: 'date', after: fuQuickHtml('f-due') },
    { k: 'type', label: 'Task type', type: 'select', opts: TASK_TYPES.filter(x => x !== 'Appointment'), noBlank: true },
    { k: 'priority', label: 'Priority', type: 'select', opts: TASK_PRI, noBlank: true },
    { k: 'status', label: 'Status', type: 'select', opts: TASK_STATUS, noBlank: true },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true },
  ];
  const vals = t || Object.assign({ rep: ME || '', due: addDays(today(), 1), type: 'Follow-Up', priority: 'Normal', status: 'Open' }, preset || {});
  openDialog({
    title: t ? 'Edit task' : 'New task', wide: true, body: fieldsHtml(spec, vals),
    extra: t ? `<button type="button" class="btn danger" data-act="del" data-kind="tk" data-id="${esc(t.id)}">Delete</button>` : '',
    onSubmit: () => guard(async () => {
      const v = readFields(spec);
      const pick = readCoPicker(coId);
      if (pick.error) return dlgMsg(pick.error);
      if (!v.name) return dlgMsg('Describe the task.');
      v.co = pick.id;
      if (v.status === 'Completed' && !(t && t.doneAt)) v.doneAt = nowIso();
      closeDialog();
      if (t) await Store.patch('tk', t.id, v);
      else await Store.add('tk', Object.assign({ id: uid(), created: nowIso() }, v));
    }),
  });
}

function openTerritory(code) {
  const t = code ? S.terr[code] : null;
  const spec = [
    { k: 'code', label: 'Territory code', req: true, dis: !!t, max: 12, hint: t ? 'The code can\'t change once companies use it.' : 'Short and unique, such as TRI-TN.' },
    { k: 'name', label: 'Territory name', req: true },
    { k: 'state', label: 'State', max: 20, ph: 'VA' },
    { k: 'owner', label: 'Territory owner', type: 'select', opts: repOpts(false) },
    { k: 'active', label: 'Active (used for automatic assignment)', type: 'check', full: true },
    { k: 'zips', label: 'ZIP codes', type: 'textarea', full: true, rows: 2, max: 6000, hint: 'Checked first. Separate with commas or new lines.' },
    { k: 'cities', label: 'Cities and towns', type: 'textarea', full: true, rows: 4, max: 6000, hint: 'Checked second. One per line as "City, ST". The state is required for a match.' },
    { k: 'counties', label: 'Counties', type: 'textarea', full: true, rows: 3, max: 6000, hint: 'Checked third. One per line as "County, ST".' },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 2 },
  ];
  const vals = t ? Object.assign({}, t, { code, zips: (t.zips || []).join(', '), cities: (t.cities || []).join('\n'), counties: (t.counties || []).join('\n'), active: t.active !== false }) : { active: true };
  openDialog({
    title: t ? 'Edit territory ' + code : 'New territory', wide: true, body: fieldsHtml(spec, vals),
    onSubmit: () => guard(async () => {
      const v = readFields(spec);
      const newCode = t ? code : clean(v.code).toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (!newCode) return dlgMsg('Enter a territory code using letters, numbers and dashes.');
      if (!t && (S.terr[newCode] || newCode === UNASSIGNED)) return dlgMsg('That territory code is already in use.');
      if (!v.name) return dlgMsg('Enter the territory name.');
      const st = normState(v.state);
      const lines = s => String(s || '').split(/\r?\n/).map(clean).filter(Boolean);
      const rec = {
        code: newCode, name: v.name, state: st || v.state, owner: v.owner, active: v.active, notes: v.notes,
        zips: [...new Set(String(v.zips || '').split(/[\s,;]+/).map(zip5).filter(Boolean))],
        cities: lines(v.cities), counties: lines(v.counties),
      };
      const bad = rec.cities.concat(rec.counties).filter(p => !parsePlace(p, st));
      if (bad.length) return dlgMsg('Add a state to "' + bad[0] + '" (for example "' + bad[0] + ', VA"), or set the territory\'s state.');
      closeDialog();
      await Store.cfgPatch('territories', newCode, rec);
      const n = await reassignAll();
      toast('Territory saved.' + (n ? ' ' + n + (n === 1 ? ' company was' : ' companies were') + ' re-assigned.' : ''));
    }),
  });
}
/* Re-run automatic assignment for every company whose territory wasn't set by hand. */
async function reassignAll() {
  const list = [];
  for (const c of S.co.values()) {
    if (c.terrHow === 'Manual') continue;
    const r = assignTerritory(c);
    if (r.code !== c.terr) list.push([c.id, { terr: r.code, terrHow: r.how }]);
  }
  if (list.length) await Store.patchMany('co', list);
  return list.length;
}

function openRep(id) {
  const r = id ? S.team[id] : null;
  const spec = [{ k: 'name', label: 'Name', req: true, full: true, max: 60 }, { k: 'active', label: 'Active', type: 'check', full: true }];
  const web = PLATFORM === 'web';
  if (web) {
    spec.splice(1, 0, { k: 'email', label: 'Sign-in email', type: 'email', full: true, max: 200, hint: 'They get access once they create an account or accept an invite with this email. Leave blank for a name-only entry with no access.' });
    spec.push({ k: 'admin', label: 'Admin: can add, change and remove team members', type: 'check', full: true });
  }
  openDialog({
    title: r ? 'Edit team member' : 'Add team member', body: fieldsHtml(spec, r ? Object.assign({}, r, { active: r.active !== false }) : { active: true }),
    onSubmit: () => guard(async () => {
      const v = readFields(spec);
      if (!v.name) return dlgMsg('Enter a name.');
      if (web) {
        if (!CAP.isAdmin) return dlgMsg('Only a CRM admin can add or change team members.');
        v.email = (v.email || '').toLowerCase();
        if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return dlgMsg('Enter a complete email address, or leave it blank.');
        if (id === ME && (!v.admin || !v.active)) return dlgMsg('You can\'t remove your own admin access or deactivate yourself. Ask another admin.');
      }
      closeDialog();
      await Store.cfgPatch('team', id || uid(), v);
    }),
  });
}

function openMerge(sig) {
  const g = derive().dups.find(x => x.sig === sig);
  if (!g) return;
  const cos = g.ids.map(id => S.co.get(id)).filter(Boolean);
  const score = c => Object.keys(c).filter(k => c[k] && (!Array.isArray(c[k]) || c[k].length)).length + ((derive().actByCo.get(c.id) || []).length * 2);
  const best = cos.slice().sort((a, b) => score(b) - score(a))[0];
  const body = `<p class="dlg-sub">Pick the record to keep. Contacts, activity, tasks and opportunities from the others move onto it, blank fields are filled in, and notes are combined. The other records are removed.</p>
    <div class="merge">${cos.map(c => { const d = derive(); return `<label class="merge-row"><input type="radio" name="keep" id="keep-${esc(c.id)}" value="${esc(c.id)}"${c.id === best.id ? ' checked' : ''}><span><b>${esc(c.name)}</b><br><span class="muted">${esc([c.addr, c.city, c.state, c.zip].filter(Boolean).join(', ') || 'No address')}<br>${esc([fmtPhone(c.phone), domainOf(c.web)].filter(Boolean).join(' · ') || 'No phone or website')}<br>${(d.ctByCo.get(c.id) || []).length} contacts · ${(d.actByCo.get(c.id) || []).length} activities · ${esc(c.status || '')}</span></span></label>`; }).join('')}</div>`;
  openDialog({
    title: 'Merge duplicate companies', wide: true, body, submitLabel: 'Merge', noFocus: true,
    onSubmit: () => guard(async () => {
      const keepEl = $('input[name=keep]:checked');
      if (!keepEl) return dlgMsg('Pick the record to keep.');
      const keep = S.co.get(keepEl.value);
      const lose = cos.filter(c => c.id !== keep.id);
      closeDialog();
      await mergeCompanies(keep, lose);
      toast('Merged into ' + keep.name + '.');
    }),
  });
}
async function mergeCompanies(keep, lose) {
  const patch = {};
  const scalar = ['addr', 'city', 'county', 'state', 'zip', 'web', 'phone', 'industry', 'subIndustry', 'source', 'leadType', 'priority', 'rep', 'srcUrl', 'lastMethodBase'];
  let assets = new Set(keep.assets || []), notes = keep.notes || '', attempts = Number(keep.attemptsBase) || 0, last = keep.lastContactBase || '', fu = keep.nextFU || '';
  const cur = Object.assign({}, keep);
  for (const l of lose) {
    for (const k of scalar) if (!cur[k] && l[k]) { patch[k] = l[k]; cur[k] = l[k]; }
    for (const a of l.assets || []) assets.add(a);
    if (l.notes && !notes.includes(l.notes)) notes = notes ? notes + '\n\n' + l.notes : l.notes;
    attempts += Number(l.attemptsBase) || 0;
    if ((l.lastContactBase || '') > last) last = l.lastContactBase;
    if (l.nextFU && (!fu || l.nextFU < fu)) fu = l.nextFU;
    if (l.optOut) patch.optOut = true;
    if (l.dnc) patch.dnc = true;
  }
  patch.assets = [...assets]; patch.notes = cap(notes, 8000); patch.attemptsBase = attempts; patch.lastContactBase = last; patch.nextFU = fu; patch.updated = nowIso();
  if (keep.terrHow !== 'Manual') { const r = assignTerritory(Object.assign({}, cur)); patch.terr = r.code; patch.terrHow = r.how; }
  const loseIds = new Set(lose.map(l => l.id));
  const keepHasPrimary = (derive().ctByCo.get(keep.id) || []).some(x => x.primary);
  const move = kind => { const list = []; for (const r of S[kind].values()) if (loseIds.has(r.co)) { const p = { co: keep.id }; if (kind === 'ct' && r.primary && keepHasPrimary) p.primary = false; list.push([r.id, p]); } return list; };
  await Store.patch('co', keep.id, patch);
  for (const kind of ['ct', 'ac', 'tk', 'op']) { const l = move(kind); if (l.length) await Store.patchMany(kind, l); }
  await Store.patchMany('co', lose.map(l => [l.id, { _del: true }]));
}

/* ============================================================
   Screens
   ============================================================ */
const SCREENS = {};

/* ---------- Dashboard ---------- */
function tile(label, value, act, attrs, tone, sub) {
  return `<button type="button" class="tile${tone ? ' ' + tone : ''}" data-act="${act}" ${attrs || ''}><span class="tile-n">${esc(value)}</span><span class="tile-l">${esc(label)}</span>${sub ? `<span class="tile-s">${esc(sub)}</span>` : ''}</button>`;
}
function barList(title, rows, emptyMsg) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return `<section class="panel"><h3>${esc(title)}</h3>${rows.length ? `<div class="bars" role="list">${rows.map(r => `<div class="bar-row" role="listitem" title="${esc(r.label + ': ' + r.n + (r.sub ? ' · ' + r.sub : ''))}"><span class="bar-l">${r.html || esc(r.label)}</span><span class="bar-t"><span class="bar-f" style="width:${(r.n / max * 100).toFixed(1)}%"></span></span><span class="bar-n">${r.n}</span><span class="bar-s">${esc(r.sub || '')}</span></div>`).join('')}</div>` : `<p class="muted">${esc(emptyMsg)}</p>`}</section>`;
}
SCREENS.dashboard = function () {
  const d = derive(), t = today(), ws = weekStart(), we = weekEnd(), f = V.dash;
  const anyCoNoLine = !!(f.terr || f.industry || f.asset || f.priority || f.status), anyCo = anyCoNoLine || !!f.line;
  const fNoLine = Object.assign({}, f, { line: '' });
  const cos = []; const coOk = new Set(), coOkNoLine = new Set();
  for (const c of S.co.values()) { if (coPass(c, fNoLine, true)) coOkNoLine.add(c.id); if (coPass(c, f, true)) { coOk.add(c.id); if (coPass(c, f)) cos.push(c); } }
  const relOk = (coId, rep) => (!anyCo || (coId && coOk.has(coId))) && (!f.rep || (f.rep === 'none' ? !rep : rep === f.rep));
  const n = { fuToday: 0, fuOver: 0, newLead: 0, aplus: 0, agrade: 0, interested: 0, hasEquip: 0, newWeek: 0 };
  const fuList = [];
  for (const c of cos) {
    const info = coInfo(c);
    if (c.nextFU === t) n.fuToday++;
    if (c.nextFU && c.nextFU < t) n.fuOver++;
    if (c.nextFU && c.nextFU <= t) fuList.push(c);
    if (c.status === 'New' && !info.last) n.newLead++;
    if (c.priority === 'A+' && !DEAD_STATUSES.includes(c.status)) n.aplus++;
    if (c.priority === 'A' && !DEAD_STATUSES.includes(c.status)) n.agrade++;
    if (c.status === 'Interested') n.interested++;
    if (c.status === 'Has Equipment') n.hasEquip++;
    if (c.created && isoToYmd(c.created) >= ws) n.newWeek++;
  }
  let tkToday = 0, tkOver = 0, tkWeek = 0, apWeek = 0, apToday = 0; const tkList = [];
  for (const k of S.tk.values()) {
    if (k.status !== 'Open' && k.status !== 'Snoozed') continue;
    if (!relOk(k.co, k.rep)) continue;
    if (!k.due) continue;
    if (k.due === t) tkToday++;
    if (k.due < t) tkOver++;
    if (k.due >= t && k.due <= we) tkWeek++;
    if (k.due <= t) tkList.push(k);
    if (isAppt(k) && k.due >= t && k.due <= we) { apWeek++; if (k.due === t) apToday++; }
  }
  let calls = 0, emails = 0;
  for (const a of S.ac.values()) {
    if (isoToYmd(a.at) < ws) continue;
    if (!relOk(a.co, a.by)) continue;
    if (a.type === 'Phone Call' || a.type === 'Voicemail') calls++;
    if (a.type === 'Email Sent') emails++;
  }
  let openOpps = 0, openVal = 0; const byTerr = new Map(), byStage = new Map(), pipeOpps = [];
  for (const o of S.op.values()) {
    /* An opportunity is matched on its own line; the company only has to pass the other filters. */
    if (anyCoNoLine && !(o.co && coOkNoLine.has(o.co))) continue;
    if (f.rep && (f.rep === 'none' ? !!oppRep(o) : oppRep(o) !== f.rep)) continue;
    if (f.line && oppLine(o) !== f.line) continue;
    pipeOpps.push(o);
    byStage.set(o.stage, (byStage.get(o.stage) || 0) + 1);
    if (!isOpenStage(o.stage)) continue;
    openOpps++; openVal += Number(o.value) || 0;
    const tc = oppTerr(o);
    const cur = byTerr.get(tc) || { n: 0, v: 0 }; cur.n++; cur.v += Number(o.value) || 0; byTerr.set(tc, cur);
  }
  fuList.sort((a, b) => a.nextFU < b.nextFU ? -1 : a.nextFU > b.nextFU ? 1 : PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
  tkList.sort(apptSort);
  const filtered = !!(anyCo || f.rep);
  const empty = S.co.size === 0;
  const head = `<div class="page-head"><div><h1>Dashboard</h1><p class="sub">${esc(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }))} · week of ${esc(fmtDate(ws))}</p></div></div>
    <div class="filters" role="group" aria-label="Dashboard filters">${ME ? `<button type="button" class="pill${f.rep === ME ? ' on' : ''}" data-act="dash-me">My accounts</button>` : ''}${coFilterBar('dash')}${filtered ? `<button type="button" class="link" data-act="dash-clear">Clear filters</button>` : ''}</div>`;
  const start = empty ? `<section class="start"><h2>Start with a prospect list</h2><p>Import a spreadsheet of companies and contacts, or add your first company by hand. Territories are assigned automatically from each company's ZIP code, city or county.</p><div class="row"><button type="button" class="btn primary w" data-act="tab" data-tab="import">Import a spreadsheet</button><button type="button" class="btn w" data-act="co-new">Add a company</button></div></section>` : '';
  const tiles = `
    <h2 class="sec">Work due</h2>
    <div class="tiles">
      ${tile('Follow-ups due today', n.fuToday, 'go-view', 'data-view="fu-today"', n.fuToday ? 'now' : '')}
      ${tile('Overdue follow-ups', n.fuOver, 'go-view', 'data-view="fu-over"', n.fuOver ? 'over' : '')}
      ${tile('Tasks due today', tkToday, 'go-tasks', 'data-tk="today"', tkToday ? 'now' : '')}
      ${tile('Overdue tasks', tkOver, 'go-tasks', 'data-tk="overdue"', tkOver ? 'over' : '')}
      ${tile('Tasks due this week', tkWeek, 'go-tasks', 'data-tk="week"')}
      ${tile('Appointments this week', apWeek, 'go-tasks', 'data-tk="appts"', apToday ? 'now' : '', apToday ? apToday + ' today' : '')}
    </div>
    <h2 class="sec">Prospects</h2>
    <div class="tiles">
      ${tile('New leads not contacted', n.newLead, 'go-view', 'data-view="newlead"')}
      ${tile('A+ prospects', n.aplus, 'go-view', 'data-view="aplus"')}
      ${tile('A prospects', n.agrade, 'go-view', 'data-view="agrade"')}
      ${tile('Interested prospects', n.interested, 'go-view', 'data-view="interested"')}
      ${tile('Companies with equipment', n.hasEquip, 'go-view', 'data-view="hasequip"')}
      ${tile('Open opportunities', openOpps, 'go-opps', '', '', openVal ? money(openVal) + ' est. value' : '')}
    </div>
    <h2 class="sec">This week</h2>
    <div class="tiles">
      ${tile('Calls this week', calls, 'go-acts', 'data-type="calls"')}
      ${tile('Emails this week', emails, 'go-acts', 'data-type="Email Sent"')}
      ${tile('New companies added', n.newWeek, 'go-view', 'data-view="newweek"')}
    </div>`;
  const terrRows = [...byTerr.entries()].sort((a, b) => b[1].n - a[1].n).map(([code, v]) => ({ label: code + ' ' + terrName(code), html: terrTag(code) + ' <span class="bar-name">' + esc(terrName(code)) + '</span>', n: v.n, sub: v.v ? money(v.v) : '' }));
  const stageRows = ALL_STAGES.filter(s => byStage.get(s)).map(s => ({ label: s, n: byStage.get(s) }));
  const fuHtml = `<section class="panel"><h3>Follow-ups due now</h3>${fuList.length ? `<ul class="rows">${fuList.slice(0, 8).map(c => { const p = primaryContact(c.id); const ph = (p && (p.mobile || p.phone)) || c.phone; return `<li><div class="rows-main"><button type="button" class="name" data-act="co-open" data-id="${esc(c.id)}">${esc(c.name)}</button><span class="muted">${esc([p ? ctName(p) : '', ph ? fmtPhone(ph) : ''].filter(Boolean).join(' · '))}</span></div><div class="rows-meta">${priChip(c.priority)}${dueSpan(c.nextFU)}<button type="button" class="btn sm w" data-act="log" data-id="${esc(c.id)}" data-type="Phone Call">Log call</button></div></li>`; }).join('')}</ul>${fuList.length > 8 ? `<button type="button" class="link" data-act="go-view" data-view="followup">See all ${fuList.length}</button>` : ''}` : `<p class="muted">${empty ? 'Companies with a follow-up date of today or earlier will be listed here.' : 'Nothing is due. Follow-ups appear here on their date.'}</p>`}</section>`;
  const tkHtml = `<section class="panel"><h3>Tasks due now</h3>${tkList.length ? `<ul class="rows">${tkList.slice(0, 8).map(taskRow).join('')}</ul>${tkList.length > 8 ? `<button type="button" class="link" data-act="go-tasks" data-tk="open">See all ${tkList.length}</button>` : ''}` : `<p class="muted">${empty ? 'Open tasks due today or earlier will be listed here.' : 'No tasks are due.'}</p>`}</section>`;
  return head + start + tiles + `<div class="two">${fuHtml}${tkHtml}</div><div class="two">${barList('Open opportunities by territory', terrRows, 'Open opportunities will be counted here by territory.')}${barList('Opportunities by stage', stageRows, 'Opportunities will be counted here by stage.')}</div>${barList('In the open pipeline, by type', pipelineByType(pipeOpps).slice(0, 12), 'Counts of what is in open opportunities: excavators, skid steers, building materials and so on.')}`;
};
function taskRow(k) {
  const done = k.status === 'Completed' || k.status === 'Cancelled';
  const ap = isAppt(k);
  const line = ap ? [apptWhen(k), k.location, k.ct && S.ct.get(k.ct) ? 'with ' + ctName(S.ct.get(k.ct)) : '', repName(k.rep)] : [k.type, k.co ? coName(k.co) : '', repName(k.rep)];
  const cal = ap && !done ? calendarHref(k) : '';
  return `<li class="${done ? 'done' : ''}"><label class="tick w" title="${done ? 'Reopen' : 'Mark complete'}"><input type="checkbox" id="tk-${esc(k.id)}" data-change="tk-done" data-id="${esc(k.id)}"${k.status === 'Completed' ? ' checked' : ''}><span class="vh">Complete ${esc(k.name)}</span></label>
    <div class="rows-main"><button type="button" class="name" data-act="tk-open" data-id="${esc(k.id)}">${esc(k.name)}</button><span class="muted">${esc(line.filter(Boolean).join(' · '))}${k.status === 'Snoozed' ? ' · Snoozed' : ''}${k.status === 'Cancelled' ? ' · Cancelled' : ''}</span></div>
    <div class="rows-meta">${ap ? '<span class="st st-out">Appointment</span>' : ''}${k.priority === 'High' ? '<span class="st st-stop">High</span>' : ''}${done ? `<span class="muted">${esc(k.doneAt ? 'Done ' + fmtDate(isoToYmd(k.doneAt)) : k.status)}</span>` : dueSpan(k.due)}${cal ? `<a class="btn sm" href="${esc(cal)}" target="_blank" rel="noopener noreferrer" title="Opens Google Calendar with this appointment filled in">Add to calendar</a>` : ''}${done || ap ? '' : `<button type="button" class="btn sm w" data-act="tk-snooze" data-id="${esc(k.id)}" data-days="1" title="Snooze 1 day">+1d</button><button type="button" class="btn sm w" data-act="tk-snooze" data-id="${esc(k.id)}" data-days="7" title="Snooze 1 week">+1w</button>`}</div></li>`;
}

/* ---------- Companies ---------- */
SCREENS.companies = function () {
  if (V.coId) { if (S.co.has(V.coId)) return companyDetail(S.co.get(V.coId)); V.coId = null; }
  const f = V.co, rows = filterCompanies(f), view = viewById(f.view);
  const counts = {};
  const infos = [];
  for (const c of S.co.values()) infos.push([c, coInfo(c)]);
  for (const v of VIEWS) { if (v.hidden && v.id !== f.view) continue; let n = 0; for (const [c, i] of infos) if (v.fn(c, i)) n++; counts[v.id] = n; }
  const rail = `<nav class="views" aria-label="Saved views">${VIEWS.filter(v => !v.hidden || v.id === f.view).map(v => `<button type="button" class="view${v.id === f.view ? ' on' : ''}" data-act="co-view" data-view="${v.id}" title="${esc(v.hint || '')}"><span>${esc(v.name)}</span><span class="cnt">${counts[v.id]}</span></button>`).join('')}</nav>`;
  const th = (key, label, cls) => `<th class="${cls || ''}"${f.sort === key ? ` aria-sort="${f.dir > 0 ? 'ascending' : 'descending'}"` : ''}><button type="button" data-act="co-sort" data-key="${key}">${esc(label)}${f.sort === key ? (f.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`;
  const d = derive();
  const body = rows.slice(0, f.limit).map(({ c, info }) => {
    const as = c.assets || [];
    const flags = (c.status === 'Do Not Contact' || c.dnc ? '<span class="flag">DNC</span>' : '') + (c.optOut ? '<span class="flag">No email</span>' : '') + (d.dupIds.has(c.id) ? '<span class="flag warn">Dup?</span>' : '');
    return `<tr data-act="co-open" data-id="${esc(c.id)}">
      <td class="co"><button type="button" class="name" data-act="co-open" data-id="${esc(c.id)}">${esc(c.name)}</button>${coLines(c).filter(l => l !== 'Equipment').map(l => `<span class="st st-warn">${esc(l)}</span>`).join('')}${flags}<div class="muted">${esc([clean((c.city || '') + (c.state ? ', ' + c.state : '')), c.industry].filter(Boolean).join(' · '))}</div></td>
      <td>${terrTag(c.terr)}</td><td>${priChip(c.priority)}</td><td>${statusChip(c.status)}</td>
      <td class="assets">${as.length ? esc(as.slice(0, 2).join(', ')) + (as.length > 2 ? ` <span class="muted">+${as.length - 2}</span>` : '') : '<span class="muted">–</span>'}</td>
      <td>${esc(repName(c.rep)) || '<span class="muted">–</span>'}</td>
      <td>${info.last ? esc(fmtDate(info.last)) : '<span class="muted">Never</span>'}<div class="muted">${esc([info.last ? info.method : '', info.attempts ? info.attempts + (info.attempts === 1 ? ' attempt' : ' attempts') : ''].filter(Boolean).join(' · '))}</div></td>
      <td>${dueSpan(c.nextFU)}</td></tr>`;
  }).join('');
  const any = f.q || f.line || f.terr || f.rep || f.industry || f.asset || f.priority || f.status;
  const emptyMsg = S.co.size === 0
    ? `<div class="empty"><h2>No companies yet</h2><p>Import a prospect list or add a company. Each company gets a territory, a lead status of New, and an activity timeline.</p><div class="row"><button type="button" class="btn primary w" data-act="tab" data-tab="import">Import a spreadsheet</button><button type="button" class="btn w" data-act="co-new">Add a company</button></div></div>`
    : `<div class="empty"><p>No companies match ${esc(view.name)}${any ? ' with these filters' : ''}.</p>${any ? '<button type="button" class="link" data-act="co-clear">Clear filters</button>' : ''}</div>`;
  return `<div class="page-head"><div><h1>Companies</h1><p class="sub">${esc(view.hint || 'Every company in the CRM')}</p></div><div class="row">${exportBtn('co')}</div></div>
    <div class="split">${rail}<section class="split-main">
      <div class="filters"><input id="flt-co-q" type="search" class="q" placeholder="Search name, city, phone, contact" value="${esc(f.q)}" data-input="filter" data-scope="co" data-key="q" aria-label="Search companies">${coFilterBar('co')}${any ? '<button type="button" class="link" data-act="co-clear">Clear filters</button>' : ''}</div>
      <p class="count">${rows.length.toLocaleString()} ${rows.length === 1 ? 'company' : 'companies'}</p>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${th('name', 'Company')}${th('terr', 'Territory')}${th('priority', 'Priority')}${th('status', 'Lead status')}<th>Asset potential</th>${th('rep', 'Rep')}${th('last', 'Last contact')}${th('nextFU', 'Next follow-up')}</tr></thead><tbody>${body}</tbody></table></div>${rows.length > f.limit ? `<button type="button" class="btn more" data-act="more" data-scope="co">Show 100 more</button>` : ''}` : emptyMsg}
    </section></div>`;
};

function companyDetail(c) {
  const d = derive(), info = coInfo(c);
  const contacts = (d.ctByCo.get(c.id) || []).slice().sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0) || ctName(a).localeCompare(ctName(b)));
  const acts = d.actByCo.get(c.id) || [];
  const tasks = (d.tkByCo.get(c.id) || []).filter(isOpenTask).sort(apptSort);
  const opps = (d.opByCo.get(c.id) || []).slice().sort((a, b) => (b.created || '') < (a.created || '') ? -1 : 1);
  const t = S.terr[c.terr], appt = nextAppt(c.id);
  const url = safeUrl(c.web), src = safeUrl(c.srcUrl);
  const flags = [
    c.status === 'Do Not Contact' ? '<span class="flag big">Do Not Contact</span>' : '',
    c.dnc ? '<span class="flag big">Do Not Call</span>' : '', c.optOut ? '<span class="flag big">Email opt-out</span>' : '',
    c.terr === UNASSIGNED ? '<span class="flag big warn">Territory needs review</span>' : '',
    d.dupIds.has(c.id) ? '<button type="button" class="flag big warn" data-act="tab" data-tab="review">Possible duplicate</button>' : '',
    isDormant(c, info) ? '<span class="flag big warn">Dormant: review for nurture</span>' : '',
    appt ? `<button type="button" class="flag big appt" data-act="tk-open" data-id="${esc(appt.id)}">${esc((appt.apptKind || 'Appointment') + ' ' + apptWhen(appt))}</button>` : '',
  ].join('');
  const row = (label, val) => `<div class="kv"><dt>${esc(label)}</dt><dd>${val || '<span class="muted">–</span>'}</dd></div>`;
  const details = `<dl class="kvs">
    ${row('Main phone', c.phone ? `<span class="sel">${esc(fmtPhone(c.phone))}</span>${copyBtn(fmtPhone(c.phone))}` : '')}
    ${row('Website', url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(domainOf(c.web) || c.web)}</a>` : esc(c.web))}
    ${row('Address', esc([c.addr, clean((c.city || '') + (c.state ? ', ' + c.state : '') + ' ' + (c.zip || ''))].filter(Boolean).join(', ')))}
    ${row('County', esc(c.county))}
    ${row('Territory', terrTag(c.terr) + ' ' + esc(c.terr === UNASSIGNED ? 'No territory matched' + (c.terrHow === 'State missing' ? ' (state is missing)' : '') : terrName(c.terr) + (t && t.state ? ', ' + t.state : '')) + (c.terrHow && c.terr !== UNASSIGNED ? ` <span class="muted">· ${c.terrHow === 'Manual' ? 'set by hand' : 'matched by ' + esc(c.terrHow)}</span>` : ''))}
    ${row('Territory owner', t ? esc(repName(t.owner)) : '')}
    ${row('Assigned rep', esc(repName(c.rep)))}
    ${row('Industry', esc([c.industry, c.subIndustry].filter(Boolean).join(' · ')))}
    ${row('Lines of business', esc(coLines(c).join(', ')))}
    ${row('Asset potential', (c.assets || []).map(a => `<span class="asset">${esc(a)}</span>`).join(''))}
    ${row('Lead source', esc(c.source))}${row('Lead type', esc(c.leadType))}
    ${row('Last contact', info.last ? esc(fmtDate(info.last) + (info.method ? ' · ' + info.method : '')) : 'Never')}
    ${row('Outreach attempts', String(info.attempts))}
    ${row('Source URL', src ? `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${esc(domainOf(c.srcUrl) || 'Open source')}</a>` : esc(c.srcUrl))}
    ${row('Added', esc(c.created ? fmtDate(isoToYmd(c.created)) : ''))}${row('Updated', esc(c.updated ? fmtDate(isoToYmd(c.updated)) : ''))}
  </dl>${c.notes ? `<h3>Notes</h3><div class="pre notes">${esc(c.notes)}</div>` : ''}`;
  const ctHtml = contacts.length ? `<ul class="cards">${contacts.map(x => `<li><div class="card-h"><button type="button" class="name" data-act="ct-open" data-id="${esc(x.id)}">${esc(ctName(x))}</button>${x.primary ? '<span class="st st-out">Primary</span>' : ''}${x.dnc ? '<span class="flag">DNC</span>' : ''}${x.optOut ? '<span class="flag">No email</span>' : ''}</div>
      <div class="muted">${esc([x.title, x.role && x.role !== x.title ? x.role : '', x.dept].filter(Boolean).join(' · '))}</div>
      ${x.email ? `<div><span class="sel">${esc(x.email)}</span>${copyBtn(x.email)}</div>` : ''}${x.phone ? `<div><span class="sel">${esc(fmtPhone(x.phone))}</span>${copyBtn(fmtPhone(x.phone))}</div>` : ''}${x.mobile ? `<div><span class="sel">${esc(fmtPhone(x.mobile))}</span> <span class="muted">mobile</span>${copyBtn(fmtPhone(x.mobile))}</div>` : ''}
      <div class="row tight"><button type="button" class="btn sm w" data-act="log" data-id="${esc(c.id)}" data-ct="${esc(x.id)}" data-type="Phone Call">Log call</button><button type="button" class="btn sm w" data-act="log" data-id="${esc(c.id)}" data-ct="${esc(x.id)}" data-type="Email Sent">Log email</button>${CAP.sample && x.email && !x.optOut ? `<button type="button" class="btn sm ai w" data-act="dr-new" data-id="${esc(c.id)}" data-ct="${esc(x.id)}">Draft email</button>` : ''}</div></li>`).join('')}</ul>` : `<p class="muted">No contacts yet. Add the person who makes equipment decisions.</p>`;
  const opHtml = opps.length ? `<ul class="cards">${opps.map(o => `<li><div class="card-h"><button type="button" class="name" data-act="op-open" data-id="${esc(o.id)}">${esc(o.name)}</button><span class="st ${isOpenStage(o.stage) ? 'st-hot' : (WON_STAGES.includes(o.stage) ? 'st-won' : 'st-early')}">${esc(o.stage)}</span></div><div class="muted">${esc([oppLine(o) !== 'Equipment' ? oppLine(o) : '', itemsSummary(o), money(o.value), o.auctionDate ? 'Auction ' + fmtDate(o.auctionDate) : ''].filter(Boolean).join(' · '))}</div></li>`).join('')}</ul>` : `<p class="muted">No opportunities. Create one when there is something real to sell.</p>`;
  const tlHtml = acts.length ? `<ol class="tl">${acts.map(a => `<li><div class="tl-h"><span class="tl-type">${esc(a.type)}</span><span class="muted">${esc([fmtDateTime(a.at), repName(a.by), a.ct && S.ct.get(a.ct) ? 'with ' + ctName(S.ct.get(a.ct)) : ''].filter(Boolean).join(' · '))}</span><button type="button" class="link w" data-act="ac-open" data-id="${esc(a.id)}">Edit</button></div>${a.outcome ? `<div class="tl-o">${esc(a.outcome)}</div>` : ''}${a.notes ? `<div class="pre">${esc(a.notes)}</div>` : ''}${a.nextFU ? `<div class="muted">Follow-up set for ${esc(fmtDate(a.nextFU))}</div>` : ''}</li>`).join('')}</ol>` : `<p class="muted">No activity yet. Log the first call or email and it appears here, newest first.</p>`;
  const logBtn = (type, label) => `<button type="button" class="btn w" data-act="log" data-id="${esc(c.id)}" data-type="${esc(type)}">${esc(label)}</button>`;
  return `<button type="button" class="back" data-act="co-back">← Companies</button>
    <div class="detail-head">
      <div class="detail-title"><h1>${esc(c.name)}</h1><p class="sub">${esc([clean((c.city || '') + (c.state ? ', ' + c.state : '')), c.industry].filter(Boolean).join(' · '))} ${terrTag(c.terr)}</p>${flags ? `<div class="flags">${flags}</div>` : ''}</div>
      <div class="detail-set">
        <label class="mini-f"><span>Priority</span><select id="d-pri" class="w" data-change="co-set" data-id="${esc(c.id)}" data-key="priority"><option value=""></option>${optList(PRIORITIES, c.priority)}</select></label>
        <label class="mini-f"><span>Lead status</span><select id="d-status" class="w" data-change="co-status" data-id="${esc(c.id)}">${optList(STATUSES, c.status)}</select></label>
        <label class="mini-f"><span>Next follow-up</span><input id="d-fu" class="w${c.nextFU && c.nextFU <= today() ? ' over' : ''}" type="date" value="${esc(c.nextFU || '')}" data-change="co-set" data-id="${esc(c.id)}" data-key="nextFU"></label>
      </div>
    </div>
    <div class="actions">${CAP.sample ? `<button type="button" class="btn ai w" data-act="dr-new" data-id="${esc(c.id)}">Draft email with AI</button>` : ''}${logBtn('Phone Call', 'Log call')}${logBtn('Email Sent', 'Log email')}${logBtn('Voicemail', 'Log voicemail')}${logBtn('Note', 'Add note')}<button type="button" class="btn w" data-act="log-other" data-id="${esc(c.id)}">Other activity</button><span class="grow"></span><button type="button" class="btn w" data-act="ap-new" data-id="${esc(c.id)}">+ Appointment</button><button type="button" class="btn w" data-act="tk-new" data-id="${esc(c.id)}">+ Task</button><button type="button" class="btn w" data-act="op-new" data-id="${esc(c.id)}">+ Opportunity</button><button type="button" class="btn w" data-act="co-edit" data-id="${esc(c.id)}">Edit</button></div>
    <div class="detail">
      <section class="detail-main">
        ${tasks.length ? `<div class="panel"><h3>Open tasks and appointments</h3><ul class="rows">${tasks.map(taskRow).join('')}</ul></div>` : ''}
        <div class="panel"><h3>Activity</h3>${tlHtml}</div>
      </section>
      <aside class="detail-side">
        <div class="panel"><div class="panel-h"><h3>Contacts</h3><button type="button" class="btn sm w" data-act="ct-new" data-id="${esc(c.id)}">+ Contact</button></div>${ctHtml}</div>
        <div class="panel"><div class="panel-h"><h3>Opportunities</h3><button type="button" class="btn sm w" data-act="op-new" data-id="${esc(c.id)}">+ Opportunity</button></div>${opHtml}</div>
        <div class="panel"><h3>Details</h3>${details}</div>
      </aside>
    </div>`;
}

/* ---------- Contacts ---------- */
SCREENS.contacts = function () {
  const f = V.ct, q = clean(f.q).toLowerCase();
  const rows = [];
  for (const x of S.ct.values()) {
    if (f.role && x.role !== f.role) continue;
    if (q) { const hay = [ctName(x), x.email, x.title, coName(x.co), x.phone, x.mobile].join(' ').toLowerCase(); if (!hay.includes(q)) continue; }
    rows.push(x);
  }
  rows.sort((a, b) => ctName(a).localeCompare(ctName(b)));
  const body = rows.slice(0, f.limit).map(x => `<tr data-act="ct-open" data-id="${esc(x.id)}">
    <td class="co"><button type="button" class="name" data-act="ct-open" data-id="${esc(x.id)}">${esc(ctName(x))}</button>${x.primary ? '<span class="st st-out">Primary</span>' : ''}${x.dnc ? '<span class="flag">DNC</span>' : ''}${x.optOut ? '<span class="flag">No email</span>' : ''}<div class="muted">${esc([x.title, x.role && x.role !== x.title ? x.role : ''].filter(Boolean).join(' · '))}</div></td>
    <td>${x.co && S.co.has(x.co) ? `<button type="button" class="link" data-act="co-open" data-id="${esc(x.co)}">${esc(coName(x.co))}</button>` : '<span class="muted">No company</span>'}</td>
    <td><span class="sel">${esc(x.email || '')}</span></td><td><span class="sel">${esc(fmtPhone(x.phone))}</span></td><td><span class="sel">${esc(fmtPhone(x.mobile))}</span></td><td>${dueSpan(x.nextFU)}</td></tr>`).join('');
  return `<div class="page-head"><div><h1>Contacts</h1><p class="sub">Every contact, across all companies</p></div><div class="row">${exportBtn('ct')}<button type="button" class="btn primary w" data-act="ct-new" data-id="">+ Contact</button></div></div>
    <div class="filters"><input id="flt-ct-q" type="search" class="q" placeholder="Search name, company, email, phone" value="${esc(f.q)}" data-input="filter" data-scope="ct" data-key="q" aria-label="Search contacts">${fsel('ct', 'role', 'Role', ROLES)}</div>
    <p class="count">${rows.length.toLocaleString()} ${rows.length === 1 ? 'contact' : 'contacts'}</p>
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Contact</th><th>Company</th><th>Email</th><th>Phone</th><th>Mobile</th><th>Next follow-up</th></tr></thead><tbody>${body}</tbody></table></div>${rows.length > f.limit ? `<button type="button" class="btn more" data-act="more" data-scope="ct">Show 100 more</button>` : ''}`
      : `<div class="empty"><p>${S.ct.size ? 'No contacts match.' : 'Contacts appear here as you add them to companies or import them with a prospect list.'}</p></div>`}`;
};

/* ---------- Tasks ---------- */
SCREENS.tasks = function () {
  const f = V.tk, t = today(), we = weekEnd();
  const tabs = [['today', 'Due today'], ['overdue', 'Overdue'], ['week', 'This week'], ['appts', 'Appointments'], ['open', 'All open'], ['done', 'Completed']];
  const counts = { today: 0, overdue: 0, week: 0, appts: 0, open: 0, done: 0 };
  const rows = [];
  for (const k of S.tk.values()) {
    if (f.rep && (f.rep === 'none' ? !!k.rep : k.rep !== f.rep)) continue;
    const open = k.status === 'Open' || k.status === 'Snoozed';
    const which = [];
    if (open) { which.push('open'); if (isAppt(k)) which.push('appts'); if (k.due === t) which.push('today'); if (k.due && k.due < t) which.push('overdue'); if (k.due && k.due >= t && k.due <= we) which.push('week'); }
    else which.push('done');
    for (const w of which) counts[w]++;
    if (which.includes(f.tab)) rows.push(k);
  }
  if (f.tab === 'done') rows.sort((a, b) => (b.doneAt || b.created || '').localeCompare(a.doneAt || a.created || ''));
  else rows.sort((a, b) => apptSort(a, b) || TASK_PRI.indexOf(a.priority) - TASK_PRI.indexOf(b.priority));
  return `<div class="page-head"><div><h1>Tasks</h1><p class="sub">Appointments, calls, emails and follow-ups with a due date</p></div><div class="row">${exportBtn('tk')}<button type="button" class="btn w" data-act="ap-new" data-id="">+ Appointment</button><button type="button" class="btn primary w" data-act="tk-new" data-id="">+ Task</button></div></div>
    <div class="filters"><div class="seg" role="tablist">${tabs.map(([id, l]) => `<button type="button" role="tab" aria-selected="${f.tab === id}" class="${f.tab === id ? 'on' : ''}" data-act="tk-tab" data-tk="${id}">${l} <span class="cnt">${counts[id]}</span></button>`).join('')}</div>
      ${ME ? `<button type="button" class="pill${f.rep === ME ? ' on' : ''}" data-act="tk-me">Mine</button>` : ''}${fsel('tk', 'rep', 'Assigned to', repOpts(true))}</div>
    ${rows.length ? `<div class="panel flush"><ul class="rows">${rows.slice(0, 300).map(taskRow).join('')}</ul></div>` : `<div class="empty"><p>${S.tk.size ? 'Nothing in this list.' : 'No tasks yet. Add one from a company page, or change a lead to Interested and a follow-up task is created for you.'}</p></div>`}`;
};

/* ---------- Activity ---------- */
SCREENS.activity = function () {
  const f = V.ac, ws = weekStart();
  const from = f.range === 'week' ? ws : f.range === 'today' ? today() : f.range === '30' ? addDays(today(), -30) : '';
  const rows = [];
  for (const a of S.ac.values()) {
    if (f.type === 'calls' ? !(a.type === 'Phone Call' || a.type === 'Voicemail') : (f.type && a.type !== f.type)) continue;
    if (f.rep && a.by !== f.rep) continue;
    if (from && isoToYmd(a.at) < from) continue;
    rows.push(a);
  }
  rows.sort((a, b) => a.at < b.at ? 1 : -1);
  const typeOpts = [['calls', 'Calls and voicemails']].concat(ACT_TYPES.map(x => [x, x]));
  const body = rows.slice(0, f.limit).map(a => `<tr data-act="ac-open" data-id="${esc(a.id)}"><td>${esc(fmtDateTime(a.at))}</td><td><span class="tl-type">${esc(a.type)}</span></td>
    <td>${a.co && S.co.has(a.co) ? `<button type="button" class="link" data-act="co-open" data-id="${esc(a.co)}">${esc(coName(a.co))}</button>` : '<span class="muted">–</span>'}</td>
    <td>${esc(a.ct && S.ct.get(a.ct) ? ctName(S.ct.get(a.ct)) : '')}</td><td>${esc(repName(a.by))}</td><td>${esc(a.outcome || '')}</td><td class="wrap">${esc(cap(a.notes || '', 160))}</td></tr>`).join('');
  return `<div class="page-head"><div><h1>Activity</h1><p class="sub">Every call, email, visit and note, newest first</p></div><div class="row">${exportBtn('ac')}</div></div>
    <div class="filters"><select id="flt-ac-range" data-change="filter" data-scope="ac" data-key="range" aria-label="Date range">${optList([['today', 'Today'], ['week', 'This week'], ['30', 'Last 30 days'], ['all', 'All time']], f.range)}</select>${fsel('ac', 'type', 'Type', typeOpts)}${fsel('ac', 'rep', 'Logged by', repOpts(false))}</div>
    <p class="count">${rows.length.toLocaleString()} ${rows.length === 1 ? 'activity' : 'activities'}</p>
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Type</th><th>Company</th><th>Contact</th><th>Logged by</th><th>Outcome</th><th>Notes</th></tr></thead><tbody>${body}</tbody></table></div>${rows.length > f.limit ? `<button type="button" class="btn more" data-act="more" data-scope="ac">Show 100 more</button>` : ''}`
      : `<div class="empty"><p>${S.ac.size ? 'No activity in this range.' : 'Activity appears here as the team logs calls, emails and notes from company pages.'}</p></div>`}`;
};

/* ---------- Territories + team ---------- */
SCREENS.territories = function () {
  const counts = {}; let un = 0;
  for (const c of S.co.values()) { counts[c.terr] = (counts[c.terr] || 0) + 1; if (c.terr === UNASSIGNED) un++; }
  const codes = terrCodes(false);
  const body = codes.map(code => { const t = S.terr[code]; return `<tr data-act="terr-open" data-id="${esc(code)}"><td>${terrTag(code)}</td><td class="co"><button type="button" class="name" data-act="terr-open" data-id="${esc(code)}">${esc(t.name)}</button>${t.active === false ? '<span class="flag">Inactive</span>' : ''}</td><td>${esc(t.state || '')}</td><td>${esc(repName(t.owner)) || '<span class="muted">No owner</span>'}</td>
    <td class="wrap muted">${esc([(t.cities || []).length ? (t.cities || []).length + ' cities' : '', (t.counties || []).length ? (t.counties || []).length + ' counties' : '', (t.zips || []).length ? (t.zips || []).length + ' ZIPs' : ''].filter(Boolean).join(' · ') || 'No coverage set')}</td><td class="num">${counts[code] || 0}</td></tr>`; }).join('');
  const reps = repList(false);
  return `<div class="page-head"><div><h1>Territories</h1><p class="sub">One table drives territory assignment everywhere. Add states and markets here without changing anything else.</p></div><div class="row"><button type="button" class="btn w" data-act="terr-rerun">Re-run assignment</button><button type="button" class="btn primary w" data-act="terr-new">+ Territory</button></div></div>
    ${codes.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Territory</th><th>State</th><th>Owner</th><th>Coverage</th><th class="num">Companies</th></tr></thead><tbody>${body}
      <tr class="tr-un"${un ? ' data-act="go-view" data-view="unassigned"' : ''}><td>${terrTag(UNASSIGNED)}</td><td colspan="4" class="muted">No confident match by ZIP, city + state, or county + state. Flagged for review.</td><td class="num">${un}</td></tr></tbody></table></div>`
      : `<div class="empty"><h2>No territories yet</h2><p>Add a territory with its ZIP codes, cities and counties. New and imported companies are matched to it automatically.</p></div>`}
    <div class="page-head second"><div><h2>Team</h2><p class="sub">Reps who can be assigned companies, tasks, opportunities and territories</p></div><button type="button" class="btn w" data-act="rep-new">+ Team member</button></div>
    ${reps.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Status</th><th class="num">Companies</th><th class="num">Open tasks</th></tr></thead><tbody>${reps.map(id => { const r = S.team[id]; let nc = 0, nt = 0; for (const c of S.co.values()) if (c.rep === id) nc++; for (const k of S.tk.values()) if (k.rep === id && (k.status === 'Open' || k.status === 'Snoozed')) nt++; return `<tr data-act="rep-open" data-id="${esc(id)}"><td class="co"><button type="button" class="name" data-act="rep-open" data-id="${esc(id)}">${esc(r.name)}</button>${id === ME ? ' <span class="muted">(you)</span>' : ''}</td><td>${r.active === false ? '<span class="flag">Inactive</span>' : 'Active'}${PLATFORM === 'web' ? `<div class="muted">${esc(r.email || 'No sign-in email')}${r.admin ? ' · admin' : ''}${r.email && !r.uid ? ' · has not signed in yet' : ''}</div>` : ''}</td><td class="num">${nc}</td><td class="num">${nt}</td></tr>`; }).join('')}</tbody></table></div>` : `<div class="empty"><p>${PLATFORM === 'web' ? 'No team members yet. Add each rep with the email address they will sign in with.' : 'No team members yet. Each person is added the first time they open the CRM and enter their name.'}</p></div>`}`;
};

/* ---------- Review queue ---------- */
SCREENS.review = function () {
  const d = derive();
  const un = [...S.co.values()].filter(c => c.terr === UNASSIGNED).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const dorm = [];
  for (const c of S.co.values()) { const i = coInfo(c); if (isDormant(c, i) && c.status !== 'Future Opportunity / Nurture' && c.status !== 'Consignor') dorm.push({ c, i }); }
  dorm.sort((a, b) => a.i.last < b.i.last ? -1 : 1);
  const tOpts = terrOpts(false);
  const unHtml = un.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Company</th><th>Location on file</th><th>Why</th><th>Assign territory</th></tr></thead><tbody>${un.slice(0, 100).map(c => `<tr><td class="co"><button type="button" class="name" data-act="co-open" data-id="${esc(c.id)}">${esc(c.name)}</button></td><td>${esc([c.city, c.county ? c.county + ' County' : '', c.state, c.zip].filter(Boolean).join(', ') || 'No location')}</td><td class="muted">${esc(c.terrHow === 'State missing' ? 'State is missing, so the city can\'t be trusted' : 'No territory covers this location')}</td>
      <td><select id="un-${esc(c.id)}" class="w" data-change="terr-set" data-id="${esc(c.id)}" aria-label="Assign territory to ${esc(c.name)}"><option value="">Choose…</option>${optList(tOpts, '')}</select></td></tr>`).join('')}</tbody></table></div>${un.length > 100 ? `<p class="muted">Showing 100 of ${un.length}.</p>` : ''}` : `<p class="muted">Every company has a territory.</p>`;
  const dupHtml = d.dups.length ? `<ul class="cards dupes">${d.dups.slice(0, 50).map(g => `<li><div class="card-h"><span class="flag warn">${esc(g.why || 'Similar')}</span><span class="grow"></span><button type="button" class="btn sm w" data-act="dup-ok" data-sig="${esc(g.sig)}">Not duplicates</button><button type="button" class="btn sm primary w" data-act="dup-merge" data-sig="${esc(g.sig)}">Merge…</button></div>
      ${g.ids.map(id => { const c = S.co.get(id); return `<div class="dupe"><button type="button" class="name" data-act="co-open" data-id="${esc(id)}">${esc(c.name)}</button><span class="muted">${esc([clean((c.city || '') + (c.state ? ', ' + c.state : '')), fmtPhone(c.phone), domainOf(c.web)].filter(Boolean).join(' · '))}</span></div>`; }).join('')}</li>`).join('')}</ul>` : `<p class="muted">No likely duplicates found.</p>`;
  const dormHtml = dorm.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Company</th><th>Priority</th><th>Lead status</th><th>Last contact</th><th></th></tr></thead><tbody>${dorm.slice(0, 100).map(({ c, i }) => `<tr><td class="co"><button type="button" class="name" data-act="co-open" data-id="${esc(c.id)}">${esc(c.name)}</button></td><td>${priChip(c.priority)}</td><td>${statusChip(c.status)}</td><td>${esc(fmtDate(i.last))} <span class="muted">· ${daysBetween(i.last, today())} days ago</span></td>
      <td class="row tight"><button type="button" class="btn sm w" data-act="nurture" data-id="${esc(c.id)}">Move to nurture</button><button type="button" class="btn sm w" data-act="fu-in" data-id="${esc(c.id)}" data-days="7">Follow up in a week</button></td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">No dormant prospects. Companies with no contact in more than ${DORMANT_DAYS} days are listed here.</p>`;
  return `<div class="page-head"><div><h1>Review</h1><p class="sub">Records the CRM couldn't settle on its own. Nothing here is changed or removed until you decide.</p></div></div>
    <section class="panel"><h3>Unassigned territory <span class="cnt">${un.length}</span></h3>${unHtml}</section>
    <section class="panel"><h3>Possible duplicates <span class="cnt">${d.dups.length}</span></h3>${dupHtml}</section>
    <section class="panel"><h3>Dormant: review for nurture <span class="cnt">${dorm.length}</span></h3>${dormHtml}</section>`;
};

/* ============================================================
   Exports
   ============================================================ */
function exportData(kind) {
  const d = derive();
  if (kind === 'co') {
    const head = ['Company Name', 'Territory Code', 'Territory Name', 'Territory State', 'Territory Owner', 'Address', 'City', 'County', 'State', 'ZIP Code', 'Website', 'Main Phone', 'Industry', 'Sub-Industry', 'Lead Source', 'Lead Type', 'Prospect Priority', 'Lead Status', 'Asset Potential', 'Assigned Rep', 'Primary Contact', 'Last Contact Date', 'Next Follow-Up Date', 'Last Contact Method', 'Outreach Attempt Count', 'Email Opt-Out', 'Do Not Call', 'Notes', 'Source URL', 'Date Created', 'Date Updated', 'Lines of Business'];
    const list = V.tab === 'companies' && !V.coId ? filterCompanies(V.co).map(r => r.c) : [...S.co.values()];
    return { name: 'matthews-companies', head, rows: list.map(c => { const i = coInfo(c), t = S.terr[c.terr] || {}, p = primaryContact(c.id); return [c.name, c.terr, c.terr === UNASSIGNED ? '' : t.name, t.state, repName(t.owner), c.addr, c.city, c.county, c.state, c.zip, c.web, c.phone, c.industry, c.subIndustry, c.source, c.leadType, c.priority, c.status, (c.assets || []).join('; '), repName(c.rep), ctName(p), i.last, c.nextFU, i.method, i.attempts, c.optOut ? 'Yes' : 'No', c.dnc ? 'Yes' : 'No', c.notes, c.srcUrl, isoToYmd(c.created || ''), isoToYmd(c.updated || ''), coLines(c).join('; ')]; }) };
  }
  if (kind === 'ct') return { name: 'matthews-contacts', head: ['First Name', 'Last Name', 'Full Name', 'Company', 'Job Title', 'Department', 'Email', 'Phone', 'Mobile Phone', 'Contact Role', 'Primary Contact?', 'Email Opt-Out', 'Do Not Call', 'Notes', 'Last Contact Date', 'Next Follow-Up Date'],
    rows: [...S.ct.values()].map(x => { const a = (d.actByCt.get(x.id) || [])[0]; return [x.first, x.last, ctName(x), coName(x.co), x.title, x.dept, x.email, x.phone, x.mobile, x.role, x.primary ? 'Yes' : 'No', x.optOut ? 'Yes' : 'No', x.dnc ? 'Yes' : 'No', x.notes, a ? isoToYmd(a.at) : '', x.nextFU]; }) };
  if (kind === 'op') return { name: 'matthews-opportunities', head: ['Opportunity Name', 'Line of Business', 'Company', 'Contact', 'Referred By', 'Territory', 'Assigned Rep', 'Items', 'Number of Units', 'Estimated Value', 'Auction Date', 'Commission Structure', 'Location', 'Opportunity Stage', 'Probability', 'Expected Close Date', 'Details', 'Notes', 'Date Created', 'Date Updated'],
    rows: [...S.op.values()].map(o => [o.name, oppLine(o), coName(o.co), ctName(S.ct.get(o.ct)), coName(o.ref), oppTerr(o), repName(oppRep(o)), opItems(o).map(it => it.qty + ' x ' + it.type + (it.desc ? ' (' + it.desc + ')' : '') + (it.value != null ? ' $' + it.value : '')).join('; ') || [o.category, o.desc].filter(Boolean).join(': '), o.units, o.value, o.auctionDate, o.commission, o.location, o.stage, o.prob, o.closeDate,
      (LINE_FIELDS[oppLine(o)] || []).filter(f => o.details && o.details[f.k] != null && o.details[f.k] !== '').map(f => f.label + ': ' + (o.details[f.k] === true ? 'Yes' : o.details[f.k])).join('; '), o.notes, isoToYmd(o.created || ''), isoToYmd(o.updated || '')]) };
  if (kind === 'tk') return { name: 'matthews-tasks', head: ['Task Name', 'Company', 'Contact', 'Assigned User', 'Due Date', 'Time', 'Location', 'Task Type', 'Appointment Kind', 'Priority', 'Status', 'Notes'],
    rows: [...S.tk.values()].map(k => [k.name, coName(k.co), ctName(S.ct.get(k.ct)), repName(k.rep), k.due, k.time || '', k.location || '', k.type, k.apptKind || '', k.priority, k.status, k.notes]) };
  if (kind === 'ac') return { name: 'matthews-activities', head: ['Company', 'Contact', 'Activity Type', 'Date / Time', 'User', 'Outcome', 'Notes', 'Next Follow-Up Date'],
    rows: [...S.ac.values()].sort((a, b) => a.at < b.at ? 1 : -1).map(a => [coName(a.co), ctName(S.ct.get(a.ct)), a.type, a.at ? new Date(a.at).toLocaleString() : '', repName(a.by), a.outcome, a.notes, a.nextFU]) };
  return null;
}
async function saveFile(filename, data) {
  if (!CAP.downloads) return toast('Saving files isn\'t available in this view.', { error: true });
  try { await CAP.downloads.save({ filename, data }); toast('Saved ' + filename + '.'); }
  catch (e) { if (e && e.code === 'declined') return; toast(e && e.code === 'rate_limited' ? 'Finish the open save prompt first, then try again.' : 'The file couldn\'t be saved from this view.', { error: true }); }
}
function doExport(kind) {
  if (kind === 'backup') {
    const dump = { exported: nowIso(), territories: S.terr, team: Object.fromEntries(Object.entries(S.team).map(([id, r]) => [id, { name: r.name, active: r.active !== false }])) };
    for (const k of KINDS) dump[KIND_LABEL[k]] = [...S[k].values()];
    return saveFile('matthews-crm-backup-' + today() + '.json', JSON.stringify(dump, null, 1));
  }
  if (kind === 'template') {
    return saveFile('matthews-import-template.csv', toCSV(['Company Name', 'Address', 'City', 'County', 'State', 'ZIP Code', 'Website', 'Main Phone', 'Industry', 'Sub-Industry', 'Lead Source', 'Lead Type', 'Prospect Priority', 'Asset Potential', 'Assigned Rep', 'Notes', 'Source URL', 'Contact First Name', 'Contact Last Name', 'Job Title', 'Contact Role', 'Contact Email', 'Contact Phone', 'Mobile Phone'], []));
  }
  const x = exportData(kind);
  if (!x) return;
  if (!x.rows.length) return toast('There is nothing to export yet.');
  saveFile(x.name + '-' + today() + '.csv', toCSV(x.head, x.rows));
}
