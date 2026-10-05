/* ============================================================
   Lines of business, opportunity items and the pipeline.
   An opportunity belongs to one line (Equipment, Estate, Real Estate) and holds
   any number of items, each with a type that can be counted across the pipeline.
   ============================================================ */
const LINES = ['Equipment', 'Estate', 'Real Estate'];
const REFERRAL_INDUSTRIES = ['Attorney / Law Firm', 'Bank / Trust', 'Real Estate Agent / Broker', 'CPA / Financial Advisor', 'Funeral Home', 'Senior Living / Move Management'];
const isReferral = c => !!c && REFERRAL_INDUSTRIES.includes(c.industry);
const coLines = c => (c && Array.isArray(c.lines) && c.lines.length) ? c.lines : ['Equipment'];
const oppLine = o => LINES.includes(o.line) ? o.line : 'Equipment';

const ITEM_TYPES = {
  'Equipment': ['Excavator', 'Mini Excavator', 'Skid Steer', 'Compact Track Loader', 'Dozer', 'Wheel Loader', 'Backhoe', 'Motor Grader', 'Articulated Dump Truck', 'Roller / Compactor', 'Paver',
    'Telehandler', 'Forklift', 'Boom / Scissor Lift', 'Crane', 'Tractor', 'Combine / Harvester', 'Hay Equipment', 'Skidder / Forestry Machine', 'Dump Truck', 'Semi Truck', 'Service / Utility Truck',
    'Pickup Truck', 'Equipment Trailer', 'Dump Trailer', 'Semi Trailer', 'Attachment', 'Generator / Compressor', 'Shop Equipment', 'Building Materials'],
  'Estate': ['Household Contents', 'Furniture', 'Antiques / Collectibles', 'Coins / Jewelry', 'Firearms', 'Vehicle', 'Tools', 'Farm / Lawn Equipment', 'Building Materials'],
  'Real Estate': ['Home', 'Land', 'Farm', 'Commercial Property'],
};
const customTypes = () => { const l = S.outreach.types && S.outreach.types.list; return Array.isArray(l) ? l.filter(t => t && t.name) : []; };
function itemTypes(line) {
  const custom = customTypes().filter(t => t.line === line).map(t => t.name).sort((a, b) => a.localeCompare(b));
  return [...new Set((ITEM_TYPES[line] || []).concat(custom, ['Other']))];
}
async function addItemType(name, line) {
  name = cap(clean(name), 40);
  if (!name) return '';
  const hit = itemTypes(line).find(t => t.toLowerCase() === name.toLowerCase());
  if (hit) return hit;
  await Store.cfgPatch('outreach', 'types', { list: customTypes().concat([{ name, line }]) });
  return name;
}

const STAGES_BY_LINE = {
  'Equipment': STAGES,
  'Estate': ['Inquiry', 'Walk-Through Scheduled', 'Walk-Through Done', 'Proposal Sent', 'Contract Signed', 'Setup Scheduled', 'Auction', 'Settled', 'Lost'],
  'Real Estate': ['Inquiry', 'Property Visit', 'Valuation / Proposal', 'Listing Agreement Signed', 'Title / Due Diligence', 'Marketing', 'Auction', 'Under Contract', 'Closed', 'No Sale'],
};
Object.assign(STAGE_PROB, { 'Inquiry': 10, 'Walk-Through Scheduled': 25, 'Walk-Through Done': 40, 'Proposal Sent': 55, 'Contract Signed': 85, 'Setup Scheduled': 90, 'Auction': 95, 'Settled': 100,
  'Property Visit': 25, 'Valuation / Proposal': 40, 'Listing Agreement Signed': 75, 'Title / Due Diligence': 80, 'Marketing': 85, 'Under Contract': 95, 'Closed': 100 });
CLOSED_STAGES.push('Settled', 'Closed');
const ALL_STAGES = [...new Set([].concat(STAGES_BY_LINE.Equipment, STAGES_BY_LINE.Estate, STAGES_BY_LINE['Real Estate']))];
const WON_STAGES = ['Sold', 'Settled', 'Closed'];

/* The few extra questions each line needs. Stored together on the opportunity as "details". */
const LINE_FIELDS = {
  'Equipment': [],
  'Estate': [
    { k: 'owner', label: 'Owner or decedent' },
    { k: 'authority', label: 'Who can sign', type: 'select', opts: ['Executor', 'Administrator', 'Power of Attorney', 'Trustee', 'Heir', 'Owner'] },
    { k: 'saleType', label: 'How it will sell', type: 'select', opts: ['On-site auction', 'Haul-in to our facility', 'Online only'] },
    { k: 'clearBy', label: 'Must be cleared out by', type: 'date' },
    { k: 'hasRE', label: 'Real estate is part of it', type: 'check', full: true },
  ],
  'Real Estate': [
    { k: 'county', label: 'County' }, { k: 'parcel', label: 'Parcel or tax ID' },
    { k: 'size', label: 'Acreage or square footage' }, { k: 'owner', label: 'Owners on title' },
    { k: 'occupancy', label: 'Occupancy', type: 'select', opts: ['Vacant', 'Owner-occupied', 'Tenant-occupied'] },
    { k: 'liens', label: 'Known liens or mortgage' },
    { k: 'auctionType', label: 'Auction type', type: 'select', opts: ['Absolute', 'With reserve'] },
    { k: 'reserve', label: 'Reserve price ($)', type: 'number' },
    { k: 'listingDate', label: 'Listing agreement signed', type: 'date' },
    { k: 'titleStatus', label: 'Title work', type: 'select', opts: ['Not started', 'Ordered', 'Clear', 'Issues found'] },
  ],
};
const LOCATION_LABEL = { 'Equipment': 'Where the equipment is', 'Estate': 'Property address', 'Real Estate': 'Property address' };

/* ---------- items ---------- */
const opItems = o => Array.isArray(o.items) ? o.items.filter(it => it && it.type) : [];
function itemsSummary(o, max) {
  const list = opItems(o).map(it => ((Number(it.qty) || 1) > 1 ? (Number(it.qty) || 1) + ' × ' : '') + it.type);
  if (!list.length) return o.category || '';
  return list.slice(0, max || 3).join(', ') + (list.length > (max || 3) ? ' +' + (list.length - (max || 3)) + ' more' : '');
}
function pipelineByType(opps) {
  const m = new Map();
  for (const o of opps) {
    if (!isOpenStage(o.stage)) continue;
    for (const it of opItems(o)) {
      const cur = m.get(it.type) || { n: 0, v: 0, deals: 0 };
      cur.n += Number(it.qty) || 1; cur.v += Number(it.value) || 0; cur.deals++;
      m.set(it.type, cur);
    }
  }
  return [...m.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
    .map(([type, x]) => ({ label: type, n: x.n, sub: [x.deals + (x.deals === 1 ? ' opportunity' : ' opportunities'), x.v ? money(x.v) : ''].filter(Boolean).join(' · ') }));
}

/* The item editor inside the opportunity dialog. Its rows live in _op.items until Save. */
let _op = null;
function opItemRow(it, i) {
  const types = itemTypes(_op.line);
  if (_op.adding === i) {
    return `<div class="item-row adding"><input id="op-new-${i}" type="text" maxlength="40" placeholder="Name the new type, for example Rock Truck" aria-label="New item type"><button type="button" class="btn sm primary" data-act="op-type-save" data-i="${i}">Add type</button><button type="button" class="btn sm" data-act="op-type-cancel" data-i="${i}">Cancel</button></div>`;
  }
  const opts = (it.type && !types.includes(it.type) ? [it.type] : []).concat(types);
  return `<div class="item-row">
    <select id="op-type-${i}" data-input="op-item" data-i="${i}" data-f="type" aria-label="Item ${i + 1} type"><option value="">Type…</option>${optList(opts, it.type || '')}<option value="__new">+ Add a type…</option></select>
    <input id="op-qty-${i}" class="qty" type="number" min="1" step="1" inputmode="numeric" value="${esc(it.qty == null ? 1 : it.qty)}" data-input="op-item" data-i="${i}" data-f="qty" aria-label="Item ${i + 1} quantity" title="Quantity">
    <input id="op-desc-${i}" type="text" maxlength="200" value="${esc(it.desc || '')}" placeholder="Year, make, model, hours or miles" data-input="op-item" data-i="${i}" data-f="desc" aria-label="Item ${i + 1} description">
    <input id="op-val-${i}" class="val" type="number" min="0" step="1" inputmode="decimal" value="${esc(it.value == null ? '' : it.value)}" placeholder="Est. value $" data-input="op-item" data-i="${i}" data-f="value" aria-label="Item ${i + 1} estimated value for all units" title="Estimated value for all units on this line">
    <button type="button" class="x" data-act="op-item-del" data-i="${i}" aria-label="Remove item ${i + 1}" title="Remove">×</button></div>`;
}
function opItemsTotals() {
  let units = 0, value = 0;
  for (const it of _op.items) { if (!it.type) continue; units += Math.max(1, Math.round(Number(it.qty) || 1)); value += Number(it.value) || 0; }
  return { units, value };
}
function opItemsRender(focusId) {
  const box = $('#op-items');
  if (!box) return;
  box.innerHTML = _op.items.map(opItemRow).join('');
  opItemsTotalText();
  if (focusId) { const el = document.getElementById(focusId); if (el) el.focus(); }
}
function opItemsTotalText() {
  const el = $('#op-total'); if (!el) return;
  const t = opItemsTotals();
  el.textContent = t.units ? t.units + (t.units === 1 ? ' unit' : ' units') + (t.value ? ' · ' + money(t.value) + ' estimated' : '') : 'Pick a type for each thing they have to sell.';
}
function opReadItems() {
  return _op.items.filter(it => it.type && it.type !== '__new').map(it => {
    const out = { type: cap(it.type, 40), qty: Math.max(1, Math.round(Number(it.qty) || 1)) };
    if (clean(it.desc)) out.desc = cap(clean(it.desc), 200);
    if (it.value !== '' && it.value != null && isFinite(Number(it.value))) out.value = Number(it.value);
    return out;
  });
}

/* ---------- opportunity dialog ---------- */
function oppSpec(line, coId, contacts, isNew) {
  const extra = (LINE_FIELDS[line] || []).map(f => Object.assign({}, f, { k: 'd_' + f.k }));
  return [
    { k: 'name', label: 'Opportunity name', req: true, full: true },
    { k: 'line', label: 'Line of business', type: 'select', opts: LINES, noBlank: true },
    coPickerField(coId),
    { k: 'ct', label: 'Contact', type: 'select', opts: contacts.map(x => [x.id, ctName(x)]), blank: 'No specific contact' },
    { k: 'rep', label: 'Assigned rep', type: 'select', opts: repOpts(false) },
    { html: `<fieldset class="fld full items"><legend>What they have to sell</legend><div id="op-items"></div><div class="row"><button type="button" class="btn sm" data-act="op-item-add">+ Add another item</button><span class="muted" id="op-total"></span></div></fieldset>` },
    { k: 'location', label: LOCATION_LABEL[line], full: true },
  ].concat(extra, [
    { html: `<div class="fld full"><label for="f-refPick">Referred by</label><input id="f-refPick" type="text" list="dl-ref" autocomplete="off" placeholder="Attorney, bank, agent or other company that sent this to you (optional)"><datalist id="dl-ref">${refOptions()}</datalist></div>` },
    { k: 'stage', label: 'Stage', type: 'select', opts: STAGES_BY_LINE[line], noBlank: true },
    { k: 'prob', label: 'Probability (%)', type: 'number', hint: 'Fills in from the stage. Change it if you know better.' },
    { k: 'auctionDate', label: 'Auction date', type: 'date' },
    { k: 'closeDate', label: line === 'Real Estate' ? 'Expected closing date' : 'Expected close date', type: 'date' },
    { k: 'commission', label: 'Commission structure', full: true, ph: 'For example: 10% straight commission, no reserve' },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true },
  ]);
}
let _refLabels = new Map();
function refOptions() {
  _refLabels = new Map();
  const out = [];
  const list = [...S.co.values()].sort((a, b) => (isReferral(b) ? 1 : 0) - (isReferral(a) ? 1 : 0) || (a.name || '').localeCompare(b.name || ''));
  for (const c of list) { let label = c.name + (c.city ? ' · ' + c.city + (c.state ? ', ' + c.state : '') : ''); while (_refLabels.has(label)) label += ' '; _refLabels.set(label, c.id); out.push(`<option value="${esc(label)}"></option>`); }
  return out.join('');
}
const refLabelFor = id => { for (const [label, cid] of _refLabels) if (cid === id) return label; return ''; };
function openOpp(id, coId, draft) {
  const o = id ? S.op.get(id) : null;
  if (o) coId = o.co;
  const c = coId ? S.co.get(coId) : null;
  const contacts = coId ? (derive().ctByCo.get(coId) || []) : [];
  const prim = coId ? primaryContact(coId) : null;
  const base = o ? Object.assign({}, o) : {
    name: c ? c.name + (coLines(c)[0] === 'Equipment' ? ' equipment' : coLines(c)[0] === 'Estate' ? ' estate' : ' property') : '',
    line: c ? coLines(c)[0] : 'Equipment', ct: prim ? prim.id : '', rep: (c && c.rep) || ME || '',
    location: c && !isReferral(c) ? clean((c.city || '') + (c.state ? ', ' + c.state : '')) : '',
  };
  const vals = Object.assign(base, draft || {});
  const line = vals.line = oppLine(vals);
  if (!STAGES_BY_LINE[line].includes(vals.stage)) { vals.stage = STAGES_BY_LINE[line][0]; vals.prob = STAGE_PROB[vals.stage]; }
  if (vals.prob == null) vals.prob = STAGE_PROB[vals.stage];
  const details = Object.assign({}, vals.details || {});
  for (const k in details) vals['d_' + k] = details[k];
  /* An opportunity saved before items existed shows its old category and totals as one line. */
  let items = draft && draft._items ? draft._items : opItems(vals).map(it => Object.assign({}, it));
  if (!items.length && o && (o.category || o.units || o.value || o.desc)) items = [{ type: 'Other', qty: o.units || 1, desc: [o.category, o.desc].filter(Boolean).join(': '), value: o.value == null ? '' : o.value }];
  if (!items.length) items = [{ type: '', qty: 1, desc: '', value: '' }];
  const spec = oppSpec(line, coId, contacts, !o);
  _op = { id: id || null, coId: coId || '', line, items, spec, adding: -1, details };
  openDialog({
    title: o ? 'Edit opportunity' : 'New opportunity', wide: true,
    sub: o ? '' : 'Create an opportunity only when there is something real to sell.',
    body: fieldsHtml(spec, vals),
    extra: o ? `<button type="button" class="btn danger" data-act="del" data-kind="op" data-id="${esc(o.id)}">Delete</button>` : '',
    onSubmit: () => guard(async () => {
      const v = readFields(spec);
      const pick = readCoPicker(coId);
      if (pick.error) return dlgMsg(pick.error);
      if (!v.name) return dlgMsg('Name the opportunity.');
      const refRaw = $('#f-refPick') ? $('#f-refPick').value : '';
      let ref = '';
      if (clean(refRaw)) {
        ref = _refLabels.get(refRaw) || ([...S.co.values()].find(x => (x.name || '').toLowerCase() === clean(refRaw).toLowerCase()) || {}).id || '';
        if (!ref) return dlgMsg('Pick who referred this from the list, or clear that field.');
      }
      const rec = { name: v.name, line, co: pick.id, ct: v.ct || '', rep: v.rep || '', location: v.location, stage: v.stage, auctionDate: v.auctionDate, closeDate: v.closeDate, commission: v.commission, notes: v.notes, ref, updated: nowIso() };
      rec.prob = v.prob == null ? null : Math.max(0, Math.min(100, v.prob));
      rec.items = opReadItems();
      const t = (() => { let units = 0, value = 0; for (const it of rec.items) { units += it.qty; value += it.value || 0; } return { units, value }; })();
      rec.units = rec.items.length ? t.units : null;
      rec.value = rec.items.some(it => it.value != null) ? t.value : null;
      rec.category = ''; rec.desc = '';
      rec.details = {};
      for (const f of LINE_FIELDS[line]) { const x = v['d_' + f.k]; if (x !== '' && x != null && x !== false) rec.details[f.k] = x; }
      closeDialog();
      const co = rec.co && S.co.get(rec.co);
      const jobs = [];
      if (co && !coLines(co).includes(line)) jobs.push(Store.patch('co', co.id, { lines: LINES.filter(l => coLines(co).includes(l) || l === line), updated: nowIso() }));
      if (o) jobs.push(Store.patch('op', o.id, rec));
      else {
        jobs.push(Store.add('op', Object.assign({ id: uid(), created: nowIso() }, rec)));
        toast('Opportunity created.');
        if (co && !isReferral(co) && !['Consignment Opportunity', 'Consignor'].concat(DEAD_STATUSES).includes(co.status)) {
          toast('Update ' + co.name + ' to Consignment Opportunity?', { action: 'Update status', onAction: () => guard(() => changeStatus(S.co.get(co.id), 'Consignment Opportunity')) });
        }
      }
      await Promise.all(jobs);
    }),
  });
  const refEl = $('#f-refPick');
  if (refEl && vals.ref) refEl.value = draft && draft._refRaw != null ? draft._refRaw : refLabelFor(vals.ref);
  else if (refEl && draft && draft._refRaw) refEl.value = draft._refRaw;
  opItemsRender();
}
/* Changing the line swaps the stages, item types and extra questions, keeping what was typed. */
function opLineChanged() {
  if (!_op) return;
  const v = readFields(_op.spec);
  const draft = { name: v.name, line: v.line, ct: v.ct, rep: v.rep, location: v.location, auctionDate: v.auctionDate, closeDate: v.closeDate, commission: v.commission, notes: v.notes, _items: _op.items.map(it => Object.assign({}, it, { type: '' })), _refRaw: $('#f-refPick') ? $('#f-refPick').value : '' };
  const details = Object.assign({}, _op.details);
  for (const f of LINE_FIELDS[_op.line]) { const x = v['d_' + f.k]; if (x !== '' && x != null && x !== false) details[f.k] = x; }
  draft.details = details;
  openOpp(_op.id, _op.coId, draft);
}
function wirePipeline() {
  INPUTS['op-item'] = t => {
    if (!_op) return;
    const i = Number(t.dataset.i), f = t.dataset.f, it = _op.items[i];
    if (!it) return;
    if (f === 'type' && t.value === '__new') { _op.adding = i; return opItemsRender('op-new-' + i); }
    it[f] = t.value;
    opItemsTotalText();
  };
  ACTIONS['op-item-add'] = () => { if (!_op) return; _op.items.push({ type: '', qty: 1, desc: '', value: '' }); opItemsRender('op-type-' + (_op.items.length - 1)); };
  ACTIONS['op-item-del'] = t => { if (!_op) return; _op.items.splice(Number(t.dataset.i), 1); if (!_op.items.length) _op.items.push({ type: '', qty: 1, desc: '', value: '' }); _op.adding = -1; opItemsRender(); };
  ACTIONS['op-type-cancel'] = t => { if (!_op) return; _op.adding = -1; opItemsRender('op-type-' + t.dataset.i); };
  ACTIONS['op-type-save'] = t => guard(async () => {
    if (!_op) return;
    const i = Number(t.dataset.i), el = $('#op-new-' + i);
    const name = await addItemType(el ? el.value : '', _op.line);
    if (!name) { if (el) el.focus(); return; }
    _op.items[i].type = name; _op.adding = -1;
    opItemsRender('op-qty-' + i);
  });
  ACTIONS['types-open'] = () => openItemTypes();
  ACTIONS['type-del'] = t => guard(async () => { await Store.cfgPatch('outreach', 'types', { list: customTypes().filter(x => !(x.name === t.dataset.name && x.line === t.dataset.line)) }); openItemTypes(); });
}
function openItemTypes() {
  const custom = customTypes();
  const spec = [{ k: 'newType', label: 'New type', max: 40, ph: 'For example Rock Truck' }, { k: 'newLine', label: 'For', type: 'select', opts: LINES, noBlank: true }];
  openDialog({
    title: 'Item types', wide: true, submitLabel: 'Add type', cancelLabel: 'Done',
    sub: 'Types are what the pipeline counts. The built-in ones are always there; add your own for anything missing.',
    body: `<h3 class="dlg-h">Your added types</h3>${custom.length ? `<div class="multi">${custom.map(x => `<span class="chk typ">${esc(x.name)} <span class="muted">${esc(x.line)}</span><button type="button" class="x" data-act="type-del" data-name="${esc(x.name)}" data-line="${esc(x.line)}" aria-label="Remove ${esc(x.name)}" title="Remove">×</button></span>`).join('')}</div>` : `<p class="muted">None yet.</p>`}
      ${fieldsHtml(spec, { newLine: 'Equipment' })}
      <h3 class="dlg-h">Built in</h3>${LINES.map(l => `<p class="muted"><b>${esc(l)}:</b> ${esc(ITEM_TYPES[l].join(', '))}, Other</p>`).join('')}`,
    onSubmit: () => guard(async () => {
      const v = readFields(spec);
      if (!v.newType) return dlgMsg('Type a name for the new type.');
      await addItemType(v.newType, v.newLine);
      openItemTypes();
    }),
  });
}

/* ---------- Opportunities screen ---------- */
const oppTerr = o => { const c = o.co && S.co.get(o.co); return (c && c.terr) || UNASSIGNED; };
const oppRep = o => o.rep || ((o.co && S.co.get(o.co)) || {}).rep || '';
SCREENS.opportunities = function () {
  const f = V.op, q = clean(f.q).toLowerCase();
  const rows = [], scope = [];
  let val = 0, weighted = 0;
  const typesSeen = new Set();
  for (const o of S.op.values()) {
    if (f.line && oppLine(o) !== f.line) continue;
    if (f.terr && oppTerr(o) !== f.terr) continue;
    if (f.rep && oppRep(o) !== f.rep) continue;
    if (q && ![o.name, coName(o.co), o.location, opItems(o).map(it => it.type + ' ' + (it.desc || '')).join(' ')].join(' ').toLowerCase().includes(q)) continue;
    for (const it of opItems(o)) typesSeen.add(it.type);
    if (f.type && !opItems(o).some(it => it.type === f.type)) continue;
    scope.push(o);
    if (f.stage === 'open' ? !isOpenStage(o.stage) : (f.stage && f.stage !== 'all' && o.stage !== f.stage)) continue;
    rows.push(o); val += Number(o.value) || 0; weighted += (Number(o.value) || 0) * (Number(o.prob) || 0) / 100;
  }
  rows.sort((a, b) => LINES.indexOf(oppLine(a)) - LINES.indexOf(oppLine(b)) || ALL_STAGES.indexOf(a.stage) - ALL_STAGES.indexOf(b.stage) || (a.closeDate || '9').localeCompare(b.closeDate || '9'));
  const stageOpts = [['open', 'Open stages'], ['all', 'All stages']].concat((f.line ? STAGES_BY_LINE[f.line] : ALL_STAGES).map(s => [s, s]));
  const typeOpts = [...typesSeen].sort((a, b) => a.localeCompare(b));
  if (f.type && !typeOpts.includes(f.type)) typeOpts.push(f.type);
  const pipe = pipelineByType(scope);
  const body = rows.map(o => `<tr data-act="op-open" data-id="${esc(o.id)}">
    <td class="co"><button type="button" class="name" data-act="op-open" data-id="${esc(o.id)}">${esc(o.name)}</button>${oppLine(o) !== 'Equipment' ? `<span class="st st-warn">${esc(oppLine(o))}</span>` : ''}<div class="muted">${esc(itemsSummary(o))}</div></td>
    <td>${o.co && S.co.has(o.co) ? `<button type="button" class="link" data-act="co-open" data-id="${esc(o.co)}">${esc(coName(o.co))}</button>` : '<span class="muted">–</span>'}${o.ref && S.co.has(o.ref) ? `<div class="muted">via ${esc(coName(o.ref))}</div>` : ''}</td>
    <td>${terrTag(oppTerr(o))}</td><td><span class="st ${isOpenStage(o.stage) ? 'st-hot' : (WON_STAGES.includes(o.stage) ? 'st-won' : 'st-early')}">${esc(o.stage)}</span></td>
    <td class="num">${o.units != null ? esc(o.units) : ''}</td><td class="num">${esc(money(o.value))}</td><td class="num">${o.prob != null ? esc(o.prob) + '%' : ''}</td>
    <td>${esc(fmtDate(o.auctionDate))}</td><td>${esc(fmtDate(o.closeDate))}</td><td>${esc(repName(oppRep(o)))}</td></tr>`).join('');
  return `<div class="page-head"><div><h1>Opportunities</h1><p class="sub">Everything real that's in play, with a count of what's in it</p></div><div class="row">${exportBtn('op')}<button type="button" class="btn w" data-act="types-open">Item types</button><button type="button" class="btn primary w" data-act="op-new" data-id="">+ Opportunity</button></div></div>
    <div class="filters"><input id="flt-op-q" type="search" class="q" placeholder="Search opportunity, company, item" value="${esc(f.q)}" data-input="filter" data-scope="op" data-key="q" aria-label="Search opportunities">
      ${fsel('op', 'line', 'Line', LINES)}<select id="flt-op-stage" data-change="filter" data-scope="op" data-key="stage" aria-label="Stage">${optList(stageOpts, f.stage)}</select>${fsel('op', 'type', 'Item type', typeOpts)}${fsel('op', 'terr', 'Territory', terrOpts(true))}${fsel('op', 'rep', 'Rep', repOpts(false))}</div>
    ${barList('In the open pipeline, by type', pipe, S.op.size ? 'No open opportunities with items match these filters.' : 'Once opportunities have items, this counts them: how many excavators, skid steers, loads of building materials and so on.')}
    <p class="count">${rows.length} ${rows.length === 1 ? 'opportunity' : 'opportunities'}${val ? ' · ' + esc(money(val)) + ' estimated value · ' + esc(money(weighted)) + ' weighted by probability' : ''}</p>
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Opportunity</th><th>Company</th><th>Territory</th><th>Stage</th><th class="num">Units</th><th class="num">Est. value</th><th class="num">Prob.</th><th>Auction date</th><th>Expected close</th><th>Rep</th></tr></thead><tbody>${body}</tbody></table></div>`
      : `<div class="empty"><p>${S.op.size ? 'No opportunities match.' : 'No opportunities yet. When someone confirms they have something to sell, open their company page and click + Opportunity.'}</p></div>`}`;
};
