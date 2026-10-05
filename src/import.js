/* ============================================================
   Spreadsheet import: map columns → preview → apply.
   Matching follows the import rules: match before creating, never
   overwrite good data with blanks, keep existing notes, flag likely duplicates.
   ============================================================ */
const IMPORT_FIELDS = [
  ['co.name', 'Company Name', ['company', 'company name', 'business', 'business name', 'organization', 'account', 'account name', 'legal name', 'dba']],
  ['co.addr', 'Address', ['address', 'street', 'street address', 'address 1', 'address1', 'address line 1', 'mailing address', 'physical address']],
  ['co.city', 'City', ['city', 'town']],
  ['co.county', 'County', ['county']],
  ['co.state', 'State', ['state', 'st', 'province', 'state code']],
  ['co.zip', 'ZIP Code', ['zip', 'zip code', 'zipcode', 'postal', 'postal code']],
  ['co.web', 'Website', ['website', 'web', 'url', 'site', 'domain', 'company website', 'web site']],
  ['co.phone', 'Main Phone', ['phone', 'main phone', 'company phone', 'telephone', 'office phone', 'phone number', 'business phone']],
  ['co.industry', 'Industry', ['industry', 'category', 'sector', 'business type']],
  ['co.subIndustry', 'Sub-Industry', ['sub industry', 'subindustry', 'subcategory', 'sub category', 'specialty']],
  ['co.source', 'Lead Source', ['lead source', 'source']],
  ['co.leadType', 'Lead Type', ['lead type']],
  ['co.priority', 'Prospect Priority', ['priority', 'prospect priority', 'grade', 'rating', 'tier']],
  ['co.status', 'Lead Status', ['status', 'lead status']],
  ['co.assets', 'Asset Potential', ['asset potential', 'assets', 'equipment', 'equipment types', 'equipment type', 'asset types', 'asset type']],
  ['co.rep', 'Assigned Rep', ['assigned rep', 'rep', 'assigned to', 'sales rep', 'account owner']],
  ['co.terr', 'Territory Code', ['territory', 'territory code']],
  ['co.lines', 'Line of Business', ['line of business', 'lines of business', 'line', 'business line', 'division']],
  ['co.lastContactBase', 'Last Contact Date', ['last contact', 'last contact date', 'last contacted']],
  ['co.nextFU', 'Next Follow-Up Date', ['next follow up', 'next follow up date', 'follow up date', 'next followup', 'follow up']],
  ['co.lastMethodBase', 'Last Contact Method', ['last contact method', 'contact method']],
  ['co.attemptsBase', 'Outreach Attempt Count', ['attempts', 'outreach attempts', 'outreach attempt count', 'touches']],
  ['co.optOut', 'Email Opt-Out', ['email opt out', 'opt out', 'unsubscribed']],
  ['co.dnc', 'Do Not Call', ['do not call', 'dnc']],
  ['co.notes', 'Notes', ['notes', 'note', 'comments', 'description', 'company notes']],
  ['co.srcUrl', 'Source URL', ['source url', 'source link', 'listing url', 'profile url', 'source website']],
  ['ct.full', 'Contact Full Name', ['contact', 'contact name', 'full name', 'primary contact', 'contact full name', 'owner name', 'owner', 'principal']],
  ['ct.first', 'Contact First Name', ['first name', 'first', 'contact first name', 'fname']],
  ['ct.last', 'Contact Last Name', ['last name', 'last', 'contact last name', 'lname', 'surname']],
  ['ct.title', 'Job Title', ['title', 'job title', 'position', 'contact title']],
  ['ct.dept', 'Department', ['department', 'dept']],
  ['ct.email', 'Contact Email', ['email', 'e mail', 'email address', 'contact email']],
  ['ct.phone', 'Contact Phone', ['contact phone', 'direct phone', 'direct', 'direct line', 'direct dial']],
  ['ct.mobile', 'Mobile Phone', ['mobile', 'cell', 'cell phone', 'mobile phone']],
  ['ct.role', 'Contact Role', ['role', 'contact role']],
  ['ct.notes', 'Contact Notes', ['contact notes']],
];
const normHeader = h => clean(h).toLowerCase().replace(/[_\-\/.#?:()]+/g, ' ').replace(/\s+/g, ' ').trim();
function autoMap(headers) {
  const used = new Set(), out = headers.map(() => '');
  const hs = headers.map(normHeader);
  hs.forEach((h, i) => {
    if (!h) return;
    for (const [key, label, syn] of IMPORT_FIELDS) {
      if (used.has(key)) continue;
      if (h === normHeader(label) || syn.includes(h)) { out[i] = key; used.add(key); return; }
    }
  });
  /* A bare "Name" column is the company unless a company column was already found. */
  hs.forEach((h, i) => { if (out[i] || h !== 'name') return; const key = used.has('co.name') ? 'ct.full' : 'co.name'; if (!used.has(key)) { out[i] = key; used.add(key); } });
  return out;
}

const INDUSTRY_ALIAS = [[/excavat/, 'Excavation'], [/site\s*(dev|work|prep)/, 'Site Development'], [/grading/, 'Grading'], [/heavy civil|civil|bridge|highway/, 'Heavy Civil Construction'], [/pav|asphalt/, 'Paving'], [/utilit|pipeline|water|sewer|electric/, 'Utilities'], [/demoli/, 'Demolition'], [/construct|contractor|builder/, 'General Construction'], [/truck leas/, 'Truck Leasing'], [/truck|haul|transport/, 'Trucking'], [/freight/, 'Freight'], [/warehous/, 'Warehousing'], [/distribut/, 'Distribution'], [/logistic/, 'Logistics'], [/manufactur/, 'Manufacturing'], [/farm|agri|nursery|orchard/, 'Agriculture'], [/forest|logging|timber|sawmill/, 'Forestry'], [/municipal|government|county|city of|town of|public works|school/, 'Municipal / Government'], [/rental/, 'Rental'], [/fleet/, 'Fleet Services'], [/industrial/, 'Industrial']];
const ASSET_ALIAS = [[/heavy/, 'Heavy Equipment'], [/construct/, 'Construction Equipment'], [/truck/, 'Trucks'], [/trailer/, 'Trailers'], [/fleet|vehicle|\bvans?\b|\bcars?\b|pickup/, 'Fleet Vehicles'], [/farm|tractor|agri/, 'Farm Equipment'], [/forklift|material handling|\blifts?\b/, 'Forklifts / Material Handling'], [/industrial|machin/, 'Industrial Equipment'], [/forest|logging|timber/, 'Forestry Equipment'], [/pav|asphalt/, 'Paving Equipment'], [/shop|tool/, 'Shop Equipment'], [/attach|bucket/, 'Attachments']];
const ROLE_ALIAS = [[/owner/, 'Owner'], [/president|ceo/, 'President'], [/fleet/, 'Fleet Manager'], [/equipment/, 'Equipment Manager'], [/operations|\bops\b|coo/, 'Operations Manager'], [/surplus/, 'Surplus Asset Manager'], [/dispos/, 'Asset Disposal'], [/purchas|buyer/, 'Purchasing'], [/procure/, 'Procurement'], [/transport/, 'Transportation Manager'], [/terminal/, 'Terminal Manager'], [/shop|maintenance/, 'Shop Manager'], [/warehouse/, 'Warehouse Manager'], [/general manager|\bgm\b/, 'General Manager'], [/office/, 'Office Manager']];
const ciFind = (list, v) => { const l = clean(v).toLowerCase(); return list.find(x => x.toLowerCase() === l) || ''; };
function normPriority(v) {
  const s = clean(v).toUpperCase();
  if (!s) return '';
  if (/^UNQ/.test(s)) return 'Unqualified';
  const m = s.match(/^(A\s*\+|A|B\s*\+|B|C)(?![A-Z])/);
  return m ? m[1].replace(/\s/g, '') : '';
}
function normAssets(v) {
  const out = new Set();
  const whole = ciFind(ASSETS, v);
  if (whole) return [whole];
  for (const tok of String(v || '').split(/[,;|\n]+/).map(clean).filter(Boolean)) {
    const exact = ciFind(ASSETS, tok);
    if (exact) { out.add(exact); continue; }
    let hit = false;
    for (const [re, name] of ASSET_ALIAS) if (re.test(tok.toLowerCase())) { out.add(name); hit = true; }
    if (!hit) out.add('Other');
  }
  return ASSETS.filter(a => out.has(a));
}

const CO_SCALARS = ['addr', 'city', 'county', 'state', 'zip', 'web', 'phone', 'industry', 'subIndustry', 'source', 'leadType', 'priority', 'rep', 'srcUrl', 'nextFU', 'lastMethodBase'];
const CT_SCALARS = ['first', 'last', 'title', 'dept', 'email', 'phone', 'mobile', 'role'];

function planImport(rows, map, opts) {
  const now = nowIso();
  const stats = { rows: rows.length, newCo: 0, updCo: 0, sameCo: 0, dupFlag: 0, newCt: 0, updCt: 0, skipped: 0, unassigned: 0 };
  const byKey = new Map(), byDomain = new Map(), byName = new Map(), byPhone = new Map();
  const targets = new Map();            /* id -> {id, isNew, rec} */
  const coPatch = new Map(), ctPatch = new Map();
  const newCos = [], newCts = [], newReps = new Map();
  const repByName = new Map();
  for (const id in S.team) repByName.set(S.team[id].name.toLowerCase(), id);
  const index = (id, c) => {
    const n = normName(c.name), city = normCity(c.city), st = normState(c.state);
    if (n && city && st && !byKey.has(n + '|' + city + '|' + st)) byKey.set(n + '|' + city + '|' + st, id);
    if (n) { if (!byName.has(n)) byName.set(n, []); if (!byName.get(n).includes(id)) byName.get(n).push(id); }
    const d = matchDomain(c.web); if (d) byDomain.set(d, byDomain.has(d) && byDomain.get(d) !== id ? null : id);
    const p = normPhone(c.phone); if (p && !byPhone.has(p)) byPhone.set(p, id);
  };
  for (const c of S.co.values()) { targets.set(c.id, { id: c.id, isNew: false, rec: c }); index(c.id, c); }
  const ctByEmail = new Map(), ctByCo = new Map(), ctRec = new Map();
  const indexCt = x => {
    ctRec.set(x.id, x);
    if (x.email) ctByEmail.set(x.email.toLowerCase(), x.id);
    if (x.co) { if (!ctByCo.has(x.co)) ctByCo.set(x.co, new Map()); const k = normName(ctName(x)); if (k) ctByCo.get(x.co).set(k, x.id); else ctByCo.get(x.co).set('~' + x.id, x.id); }
  };
  for (const x of S.ct.values()) indexCt(x);
  const current = t => t.isNew ? t.rec : Object.assign({}, t.rec, coPatch.get(t.id) || {});
  const touched = new Set(), same = new Set(), touchedCt = new Set(), newCtIds = new Set();

  for (const row of rows) {
    const raw = { co: {}, ct: {} };
    map.forEach((key, i) => { if (!key) return; const v = clean(row[i]); if (v === '') return; const [g, f] = key.split('.'); raw[g][f] = raw[g][f] ? raw[g][f] + ' ' + v : v; });
    /* ---- company values ---- */
    const r = raw.co, co = {};
    co.name = cap(r.name || '', 200);
    for (const k of ['addr', 'county', 'zip', 'web', 'phone', 'subIndustry', 'source', 'leadType', 'lastMethodBase']) if (r[k]) co[k] = cap(r[k], 200);
    if (r.srcUrl) co.srcUrl = cap(r.srcUrl, 500);
    if (r.notes) co.notes = cap(r.notes, 4000);
    let city = r.city || '', state = normState(r.state) || clean(r.state || '');
    if (city && !state) { const m = city.match(/^(.*),\s*([A-Za-z. ]+)$/); if (m && normState(m[2])) { city = clean(m[1]); state = normState(m[2]); } }
    if (city) co.city = cap(city, 100);
    if (state) co.state = cap(state, 20);
    if (r.industry) {
      let ind = ciFind(INDUSTRIES, r.industry);
      if (!ind) { const l = r.industry.toLowerCase(); const hit = INDUSTRY_ALIAS.find(([re]) => re.test(l)); ind = hit ? hit[1] : 'Other'; if (!co.subIndustry) co.subIndustry = cap(r.industry, 200); }
      co.industry = ind;
    }
    if (r.priority) { const p = normPriority(r.priority); if (p) co.priority = p; }
    if (r.status) { const s = ciFind(STATUSES, r.status); if (s) co.status = s; }
    if (r.assets) co.assets = normAssets(r.assets);
    if (r.lines) { const l = r.lines.toLowerCase(), rest = l.replace(/real\s*estate/g, ''); const got = LINES.filter(x => x === 'Real Estate' ? /real\s*estate/.test(l) : x === 'Estate' ? rest.includes('estate') : rest.includes('equip')); if (got.length) co.lines = got; }
    if (r.rep) {
      const key = r.rep.toLowerCase();
      let rid = repByName.get(key);
      if (!rid) { rid = uid(); repByName.set(key, rid); newReps.set(rid, cap(r.rep, 60)); }
      co.rep = rid;
    }
    if (r.terr) { const code = r.terr.toUpperCase(); if (S.terr[code]) co.terrPick = code; }
    if (r.lastContactBase) { const d = toYmd(r.lastContactBase); if (d) co.lastContactBase = d; }
    if (r.nextFU) { const d = toYmd(r.nextFU); if (d) co.nextFU = d; }
    if (r.attemptsBase) { const n = parseInt(r.attemptsBase, 10); if (n > 0) co.attemptsBase = n; }
    if (r.optOut && truthy(r.optOut)) co.optOut = true;
    if (r.dnc && truthy(r.dnc)) co.dnc = true;
    /* ---- contact values ---- */
    const q = raw.ct, ct = {};
    if (q.first) ct.first = cap(q.first, 80);
    if (q.last) ct.last = cap(q.last, 80);
    if (!ct.first && !ct.last && q.full) { const parts = q.full.replace(/,.*$/, '').split(' ').filter(Boolean); ct.first = cap(parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '', 80); ct.last = cap(parts.length > 1 ? parts[parts.length - 1] : '', 80); }
    if (q.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.email)) ct.email = q.email.toLowerCase();
    for (const k of ['title', 'dept', 'phone', 'mobile']) if (q[k]) ct[k] = cap(q[k], 120);
    if (q.notes) ct.notes = cap(q.notes, 2000);
    if (q.role || q.title) {
      let role = ciFind(ROLES, q.role || '');
      if (!role) { const l = ((q.role || '') + ' ' + (q.title || '')).toLowerCase(); const hit = ROLE_ALIAS.find(([re]) => re.test(l)); role = hit ? hit[1] : (q.role ? 'Other' : ''); }
      if (role) ct.role = role;
    }
    const hasCt = !!(ct.first || ct.last || ct.email);

    /* ---- find or create the company ---- */
    let target = null;
    if (co.name) {
      const n = normName(co.name), nc = normCity(co.city), st = normState(co.state), dom = matchDomain(co.web);
      let tid = (n && nc && st) ? byKey.get(n + '|' + nc + '|' + st) : null;
      if (!tid && dom && byDomain.get(dom)) {
        const cand = current(targets.get(byDomain.get(dom)));
        const sameSpot = !nc || !cand.city || (normCity(cand.city) === nc && (!st || !cand.state || normState(cand.state) === st));
        if (sameSpot) tid = cand.id;
      }
      if (!tid && n) {
        /* Same name and nothing about the location disagrees (a blank city or state on either side is not a disagreement). */
        const l = (byName.get(n) || []).filter(id => { const c = current(targets.get(id)); const cc = normCity(c.city), cs = normState(c.state); return (!nc || !cc || nc === cc) && (!st || !cs || st === cs); });
        if (l.length === 1) tid = l[0];
      }
      if (tid) {
        target = targets.get(tid);
        const cur = current(target), patch = {};
        for (const k of CO_SCALARS) {
          if (co[k] == null || co[k] === '') continue;
          if (cur[k] == null || cur[k] === '') patch[k] = co[k];
          else if (opts.overwrite && String(cur[k]) !== String(co[k])) patch[k] = co[k];
        }
        if (co.assets && co.assets.length) { const u = ASSETS.filter(a => (cur.assets || []).includes(a) || co.assets.includes(a)); if (u.length !== (cur.assets || []).length) patch.assets = u; }
        if (co.lines) { const u = LINES.filter(x => coLines(cur).includes(x) || co.lines.includes(x)); if (u.join() !== coLines(cur).join()) patch.lines = u; }
        if (co.notes && !(cur.notes || '').includes(co.notes)) patch.notes = cap(cur.notes ? cur.notes + '\n\n' + co.notes : co.notes, 8000);
        if (co.optOut && !cur.optOut) patch.optOut = true;
        if (co.dnc && !cur.dnc) patch.dnc = true;
        if (co.status && !cur.status) patch.status = co.status;
        if (co.lastContactBase && co.lastContactBase > (cur.lastContactBase || '')) patch.lastContactBase = co.lastContactBase;
        if (co.attemptsBase && !cur.attemptsBase) patch.attemptsBase = co.attemptsBase;
        if (co.terrPick && cur.terr !== co.terrPick && (opts.overwrite || !cur.terr || cur.terr === UNASSIGNED)) { patch.terr = co.terrPick; patch.terrHow = 'Manual'; }
        else if (cur.terrHow !== 'Manual' && ['city', 'county', 'state', 'zip'].some(k => k in patch)) { const a = assignTerritory(Object.assign({}, cur, patch)); if (a.code !== cur.terr) { patch.terr = a.code; patch.terrHow = a.how; } }
        if (Object.keys(patch).length) {
          if (target.isNew) Object.assign(target.rec, patch);
          else { coPatch.set(tid, Object.assign(coPatch.get(tid) || {}, patch, { updated: now })); touched.add(tid); }
          index(tid, current(target));
        } else if (!target.isNew) same.add(tid);
      } else {
        const rec = Object.assign({ id: uid(), status: 'New', attemptsBase: 0, assets: [], created: now, updated: now }, co);
        if (!rec.source && opts.source) rec.source = cap(opts.source, 200);
        delete rec.terrPick;
        if (co.terrPick) { rec.terr = co.terrPick; rec.terrHow = 'Manual'; }
        else { const a = assignTerritory(rec); rec.terr = a.code; rec.terrHow = a.how; }
        const p = normPhone(rec.phone);
        if ((n && byName.has(n)) || (p && byPhone.has(p)) || (dom && byDomain.has(dom))) stats.dupFlag++;
        target = { id: rec.id, isNew: true, rec };
        targets.set(rec.id, target); newCos.push(rec); index(rec.id, rec);
      }
    }

    /* ---- find or create the contact ---- */
    if (hasCt) {
      let xid = ct.email ? ctByEmail.get(ct.email) : null;
      const nameKey = normName(clean((ct.first || '') + ' ' + (ct.last || '')));
      if (!xid && target && nameKey && ctByCo.has(target.id)) xid = ctByCo.get(target.id).get(nameKey) || null;
      if (xid) {
        const isNew = newCtIds.has(xid);
        const cur = isNew ? ctRec.get(xid) : Object.assign({}, ctRec.get(xid), ctPatch.get(xid) || {});
        const patch = {};
        for (const k of CT_SCALARS) { if (!ct[k]) continue; if (!cur[k]) patch[k] = ct[k]; else if (opts.overwrite && cur[k] !== ct[k] && k !== 'email') patch[k] = ct[k]; }
        if (ct.notes && !(cur.notes || '').includes(ct.notes)) patch.notes = cap(cur.notes ? cur.notes + '\n\n' + ct.notes : ct.notes, 4000);
        if (!cur.co && target) patch.co = target.id;
        if (Object.keys(patch).length) {
          if (isNew) Object.assign(cur, patch);
          else { ctPatch.set(xid, Object.assign(ctPatch.get(xid) || {}, patch, { updated: now })); touchedCt.add(xid); }
        }
      } else if (target) {
        const rec = Object.assign({ id: uid(), co: target.id, primary: !(ctByCo.has(target.id) && ctByCo.get(target.id).size), created: now, updated: now }, ct);
        newCts.push(rec); newCtIds.add(rec.id); indexCt(rec);
      } else stats.skipped++;
    } else if (!co.name) stats.skipped++;
  }
  stats.sameCo = [...same].filter(id => !touched.has(id)).length;
  stats.newCo = newCos.length; stats.updCo = touched.size; stats.newCt = newCts.length; stats.updCt = touchedCt.size;
  stats.unassigned = newCos.filter(c => c.terr === UNASSIGNED).length;
  return { newCos, coPatches: [...coPatch.entries()], newCts, ctPatches: [...ctPatch.entries()], newReps: [...newReps.entries()], stats };
}

async function applyImport(plan, onProgress) {
  const total = plan.newCos.length + plan.coPatches.length + plan.newCts.length + plan.ctPatches.length;
  let base = 0;
  const step = () => (done) => onProgress(Math.min(total, base + done), total);
  for (const [id, name] of plan.newReps) await Store.cfgPatch('team', id, { name, active: true });
  await Store.addMany('co', plan.newCos, step()); base += plan.newCos.length;
  await Store.patchMany('co', plan.coPatches, step()); base += plan.coPatches.length;
  await Store.addMany('ct', plan.newCts, step()); base += plan.newCts.length;
  await Store.patchMany('ct', plan.ctPatches, step());
  onProgress(total, total);
}

let _xlsxLoading = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve();
  if (_xlsxLoading) return _xlsxLoading;
  _xlsxLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve();
    s.onerror = () => { _xlsxLoading = null; reject(new Error('xlsx')); };
    document.head.appendChild(s);
  });
  return _xlsxLoading;
}
async function readImportFile(file) {
  const name = file.name || 'file';
  const ext = (name.split('.').pop() || '').toLowerCase();
  let grid, sheet = '';
  const buf = await file.arrayBuffer();
  if (['xlsx', 'xls', 'xlsm', 'ods'].includes(ext)) {
    try { await loadXLSX(); } catch (e) { throw new Error('The Excel reader couldn\'t load. Check your connection, or save the sheet as CSV and import that.'); }
    const wb = window.XLSX.read(buf, { type: 'array', cellDates: true });
    sheet = wb.SheetNames[0];
    grid = window.XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: false, defval: '', dateNF: 'yyyy-mm-dd' });
  } else {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder('windows-1252').decode(buf); }
    grid = parseCSV(text);
  }
  grid = grid.map(r => r.map(c => c == null ? '' : String(c))).filter(r => r.some(c => clean(c) !== ''));
  if (grid.length < 2) throw new Error('That file has no data rows. The first row should be column headings and each row after it one company or contact.');
  const width = Math.max(...grid.map(r => r.length));
  const headers = Array.from({ length: width }, (_, i) => clean(grid[0][i]) || 'Column ' + (i + 1));
  return { fileName: name, sheet, headers, rows: grid.slice(1) };
}

SCREENS.import = function () {
  const im = V.imp;
  const head = `<div class="page-head"><div><h1>Import / Export</h1><p class="sub">Bring in prospect lists from CSV or Excel, and take your data out whenever you want it</p></div></div>`;
  const steps = [['pick', 'Choose file'], ['map', 'Match columns'], ['preview', 'Preview'], ['done', 'Done']];
  const cur = im.step === 'run' ? 'preview' : im.step;
  const stepper = `<ol class="steps">${steps.map(([id, l], i) => `<li class="${id === cur ? 'on' : ''}${steps.findIndex(s => s[0] === cur) > i ? ' past' : ''}"><span>${i + 1}</span>${l}</li>`).join('')}</ol>`;
  let body = '';
  if (im.step === 'pick') {
    body = `<section class="panel"><h3>Import a prospect list</h3>
      <p>One row per company, or one row per contact with the company name repeated. Column names don't need to match exactly; you confirm the matching on the next step.</p>
      <label class="drop w" for="imp-file"><b>Choose a CSV or Excel file</b><span class="muted">.csv, .xlsx or .xls. The first row should be column headings.</span><input id="imp-file" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm" data-change="imp-file"></label>
      ${im.error ? `<p class="err-text">${esc(im.error)}</p>` : ''}${im.busy ? `<p class="muted">Reading the file…</p>` : ''}
      <ul class="rules"><li>Existing companies are matched by name + city/state, then by website, before anything new is created.</li><li>Contacts are matched by email address. Secondary contacts are never overwritten or removed.</li><li>Blank cells never replace existing data, and existing notes are kept.</li><li>Territory is assigned by ZIP, then city + state, then county + state. No match means Unassigned and flagged for review.</li><li>New companies start as lead status New with zero outreach attempts. Likely duplicates are imported and flagged for review.</li></ul>
      ${CAP.downloads ? `<button type="button" class="btn sm" data-act="export" data-kind="template">Download a blank template</button>` : ''}</section>
      <section class="panel"><h3>Export</h3><p>Exports open in Excel. The backup holds everything in one file.</p>
      ${CAP.downloads ? `<div class="row"><button type="button" class="btn" data-act="export" data-kind="co">Companies (CSV)</button><button type="button" class="btn" data-act="export" data-kind="ct">Contacts (CSV)</button><button type="button" class="btn" data-act="export" data-kind="op">Opportunities (CSV)</button><button type="button" class="btn" data-act="export" data-kind="tk">Tasks (CSV)</button><button type="button" class="btn" data-act="export" data-kind="ac">Activities (CSV)</button><button type="button" class="btn" data-act="export" data-kind="backup">Full backup (JSON)</button></div>` : `<p class="muted">Saving files isn't available in this view.</p>`}
      <p class="muted">${S.co.size.toLocaleString()} companies · ${S.ct.size.toLocaleString()} contacts · ${S.ac.size.toLocaleString()} activities · ${S.tk.size.toLocaleString()} tasks · ${S.op.size.toLocaleString()} opportunities</p></section>
      ${PLATFORM === 'web' ? `<section class="panel"><h3>Restore from a backup</h3><p>Load a Full backup (JSON) file exported from this CRM or from the Claude-hosted version. Records already here are left alone, so loading the same file twice adds nothing.</p>
      <label class="drop w" for="backup-file"><b>Choose a backup file</b><span class="muted">The .json file from Full backup</span><input id="backup-file" type="file" accept=".json,application/json" data-change="backup-file"></label>${im.restore ? `<p>${esc(im.restore)}</p>` : ''}</section>` : ''}`;
  } else if (im.step === 'map') {
    const groups = `<option value="">Don't import</option><optgroup label="Company">${IMPORT_FIELDS.filter(f => f[0].startsWith('co.')).map(f => `<option value="${f[0]}">${esc(f[1])}</option>`).join('')}</optgroup><optgroup label="Contact">${IMPORT_FIELDS.filter(f => f[0].startsWith('ct.')).map(f => `<option value="${f[0]}">${esc(f[1])}</option>`).join('')}</optgroup>`;
    const mapped = im.map.filter(Boolean).length;
    body = `<section class="panel"><h3>Match columns from ${esc(im.fileName)}${im.sheet ? ' (sheet "' + esc(im.sheet) + '")' : ''}</h3>
      <p>${im.rows.length.toLocaleString()} rows. ${mapped} of ${im.headers.length} columns matched automatically. Check each one and fix any that are wrong.</p>
      <div class="tbl-wrap"><table class="tbl maptbl"><thead><tr><th>Column in your file</th><th>Sample values</th><th>Goes to</th></tr></thead><tbody>${im.headers.map((h, i) => {
        const samples = []; for (const r of im.rows) { const v = clean(r[i]); if (v && !samples.includes(v)) samples.push(v); if (samples.length >= 3) break; }
        return `<tr class="${im.map[i] ? '' : 'skip'}"><td><b>${esc(h)}</b></td><td class="wrap muted">${esc(samples.map(s => cap(s, 40)).join(' · ') || 'Empty')}</td><td><select id="map-${i}" data-change="imp-map" data-i="${i}" aria-label="Field for ${esc(h)}">${groups.replace(`value="${im.map[i]}"`, `value="${im.map[i]}" selected`)}</select></td></tr>`;
      }).join('')}</tbody></table></div>
      <div class="grid opts"><div class="fld"><label for="imp-source">Lead source for rows that don't have one</label><input id="imp-source" type="text" maxlength="200" value="${esc(im.source || '')}" data-input="imp-opt" data-key="source" placeholder="For example: VDOT contractor list, Oct 2026"></div>
      <label class="chk solo"><input type="checkbox" id="imp-over" data-change="imp-opt" data-key="overwrite"${im.overwrite ? ' checked' : ''}><span>When a matched company or contact already has a different value, replace it with the imported one. Leave unticked to keep what's in the CRM. Blanks never replace data and notes are always kept.</span></label></div>
      ${im.error ? `<p class="err-text">${esc(im.error)}</p>` : ''}
      <div class="row end"><button type="button" class="btn" data-act="imp-reset">Start over</button><button type="button" class="btn primary" data-act="imp-preview">Preview import</button></div></section>`;
  } else if (im.step === 'preview' || im.step === 'run') {
    const s = im.plan.stats, running = im.step === 'run';
    const stat = (n, l, tone) => `<div class="stat${tone && n ? ' ' + tone : ''}"><span class="tile-n">${n.toLocaleString()}</span><span class="tile-l">${esc(l)}</span></div>`;
    const sample = im.plan.newCos.slice(0, 8);
    body = `<section class="panel"><h3>Preview: ${esc(im.fileName)}</h3><p>Nothing has been saved yet.</p>
      <div class="tiles">${stat(s.newCo, 'New companies')}${stat(s.updCo, 'Existing companies updated')}${stat(s.sameCo, 'Already in the CRM, nothing new')}${stat(s.newCt, 'New contacts')}${stat(s.updCt, 'Existing contacts updated')}${stat(s.dupFlag, 'Likely duplicates, flagged for review', 'warn')}${stat(s.unassigned, 'No territory match, flagged for review', 'warn')}${stat(s.skipped, 'Rows skipped: no company name', 'warn')}</div>
      ${im.plan.newReps.length ? `<p>New team members will be added for assigned reps: ${esc(im.plan.newReps.map(r => r[1]).join(', '))}.</p>` : ''}
      ${sample.length ? `<h3>First new companies</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Company</th><th>Location</th><th>Territory</th><th>Industry</th><th>Priority</th><th>Asset potential</th></tr></thead><tbody>${sample.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${esc([c.city, c.state, c.zip].filter(Boolean).join(', '))}</td><td>${terrTag(c.terr)} <span class="muted">${esc(c.terr === UNASSIGNED ? '' : 'by ' + c.terrHow)}</span></td><td>${esc(c.industry || '')}</td><td>${priChip(c.priority)}</td><td>${esc((c.assets || []).join(', '))}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${running ? `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${im.pct || 0}"><span id="imp-bar" style="width:${im.pct || 0}%"></span></div><p class="muted" id="imp-prog">Saving… keep this page open.</p>`
        : `<div class="row end"><button type="button" class="btn" data-act="imp-back">Back to columns</button><button type="button" class="btn primary w" data-act="imp-run"${(s.newCo + s.updCo + s.newCt + s.updCt) ? '' : ' disabled'}>Import ${s.newCo.toLocaleString()} ${s.newCo === 1 ? 'company' : 'companies'} and ${s.newCt.toLocaleString()} ${s.newCt === 1 ? 'contact' : 'contacts'}${(s.updCo + s.updCt) ? ', update ' + (s.updCo + s.updCt).toLocaleString() : ''}</button></div>`}</section>`;
  } else if (im.step === 'done') {
    const s = im.plan.stats;
    body = `<section class="panel"><h3>${im.failed ? 'Import stopped partway' : 'Import finished'}</h3>
      ${im.failed ? `<p class="err-text">${esc(im.failed)} Records saved before the error are in the CRM. Importing the same file again is safe: rows already saved are matched and not duplicated.</p>` : `<p>${s.newCo.toLocaleString()} companies and ${s.newCt.toLocaleString()} contacts added. ${s.updCo.toLocaleString()} companies and ${s.updCt.toLocaleString()} contacts updated.</p>`}
      <div class="row"><button type="button" class="btn primary" data-act="go-view" data-view="newweek">See companies added this week</button>${(s.dupFlag || s.unassigned) ? `<button type="button" class="btn" data-act="tab" data-tab="review">Open the review queue</button>` : ''}<button type="button" class="btn" data-act="imp-reset">Import another file</button></div></section>`;
  }
  return head + stepper + body;
};
