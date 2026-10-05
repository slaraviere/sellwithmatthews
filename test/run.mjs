import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test', 'out');
mkdirSync(OUT, { recursive: true });
import { launch } from './browser.mjs';

const page_html = readFileSync(path.join(ROOT, 'dist', 'matthews-consignment-crm.html'), 'utf8');
const skeleton = `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page_html}</body></html>`;
writeFileSync(path.join(OUT, 'page.html'), skeleton);
const seed = { 'cfg/territories': JSON.parse(readFileSync(path.join(ROOT, 'seed', 'territories.json'), 'utf8')), 'cfg/team': { items: {} } };
const mock = readFileSync(path.join(ROOT, 'test', 'mock.js'), 'utf8');

const csv = `Company Name,Address,City,State,Zip,Website,Phone,Industry,Priority,Asset Potential,Notes,Contact Name,Title,Email,Cell
"Blue Ridge Grading, Inc.",120 Depot St,Christiansburg,VA,24073,www.blueridgegrading.example,(540) 555-0101,Grading,A+,"Heavy Equipment, Trucks",Runs 20+ dozers,Tom Hale,Owner,tom@blueridgegrading.example,540-555-0199
Blue Ridge Grading Inc,120 Depot St,Christiansburg,VA,24073,,,,,Trailers,Second note,Ann Ruiz,Fleet Manager,ann@blueridgegrading.example,
Twin County Paving,,Galax,Virginia,,twincountypaving.example,276-555-0110,asphalt paving,A,Paving Equipment,,Bill Cox,President,bill@twincountypaving.example,
Piedmont Freight Lines,,Greensboro,NC,27407,,336-555-0120,Freight,B+,"Trucks; Trailers",,,,,
Mystery Hauling,,Springfield,,,,,Trucking,B,Trucks,,Sam Doe,,sam@mystery.example,
Yadkin Valley Farms,,Elkin,NC,28621,,336-555-0130,Farm,C,tractors,,,,,
Acme Excavating,,Christiansburg,VA,24073,,540-555-0177,Excavation,A,Heavy Equipment,Imported note,,,,
,,,,,,,,,,,No Company,,nobody@example.com,
Lone Pine Logging,,Bluefield,WV,24701,,304-555-0140,Logging,B,Forestry Equipment,,,,,
`;
const CSV_PATH = path.join(OUT, 'prospects.csv');
writeFileSync(CSV_PATH, csv);

const browser = await launch();
const errors = [];
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1380, height: 900 }, colorScheme: opts.dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.addInitScript(`window.__SEED__ = ${JSON.stringify(opts.seed || seed)};\n${mock}`);
  await page.goto('file://' + path.join(OUT, 'page.html'));
  return page;
}
const check = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); if (!cond) errors.push('check failed: ' + name); };
const st = (page, expr) => page.evaluate(expr);

const page = await newPage();
await page.waitForSelector('#who-form');
check('empty dashboard shows start panel', await page.locator('.start').count() === 1);
await page.screenshot({ path: path.join(OUT, 'shot-empty.png') });
await page.fill('#who-name', 'Stephen');
await page.click('#who-form button[type=submit]');
await page.waitForFunction(() => document.querySelector('#me-chip').textContent === 'Stephen');
await page.waitForTimeout(150);
check('who banner clears after saving', await page.locator('#who-form').count() === 0);
check('rep saved with uid', await st(page, `Object.values(S.team).some(r => r.name === 'Stephen' && r.uid)`));

// --- add a company by hand
await page.click('.bar [data-act="co-new"]');
await page.fill('#f-name', 'Acme Excavating LLC');
await page.fill('#f-city', 'Christiansburg'); await page.fill('#f-state', 'virginia'); await page.fill('#f-zip', '24073');
await page.fill('#f-phone', '5405550177');
await page.selectOption('#f-industry', 'Excavation'); await page.selectOption('#f-priority', 'A');
await page.check('#f-assets-0');
await page.click('#dlg-submit');
await page.waitForSelector('.detail-head');
const acme = await st(page, `[...S.co.values()].find(c => c.name.startsWith('Acme'))`);
check('territory by ZIP → NRV', acme.terr === 'NRV' && acme.terrHow === 'ZIP' && acme.state === 'VA', acme.terr + '/' + acme.terrHow);
check('new company defaults', acme.status === 'New' && acme.attemptsBase === 0);

// --- contact
await page.click('.detail-side [data-act="ct-new"]');
await page.fill('#f-first', 'Dale'); await page.fill('#f-last', 'Acme'); await page.fill('#f-email', 'Dale@AcmeEx.example'); await page.fill('#f-mobile', '540-555-0178');
await page.selectOption('#f-role', 'Owner');
await page.click('#dlg-submit');
await page.waitForFunction(() => S.ct.size === 1);
check('first contact is primary', await st(page, `[...S.ct.values()][0].primary === true && [...S.ct.values()][0].email === 'dale@acmeex.example'`));

// --- log a call with a follow-up
await page.click('.actions [data-act="log"][data-type="Phone Call"]');
check('status suggestion = Called', await page.inputValue('#f-status') === 'Called');
await page.fill('#f-outcome', 'Connected'); await page.fill('#f-notes', 'Has two older excavators he may sell this winter.');
await page.click('[data-act="fu-quick"][data-days="7"]');
await page.click('#dlg-submit');
await page.waitForFunction(() => S.ac.size === 1);
let info = await st(page, `(() => { const c = [...S.co.values()].find(c => c.name.startsWith('Acme')); return Object.assign({ status: c.status, nextFU: c.nextFU }, coInfo(c)); })()`);
check('call updates last contact / method / attempts / status / follow-up', info.method === 'Phone' && info.attempts === 1 && !!info.last && info.status === 'Called' && !!info.nextFU, info);

// --- log an email
await page.click('.actions [data-act="log"][data-type="Email Sent"]');
await page.click('#dlg-submit');
await page.waitForFunction(() => S.ac.size === 2);
info = await st(page, `coInfo([...S.co.values()].find(c => c.name.startsWith('Acme')))`);
check('email increments attempts, method Email', info.method === 'Email' && info.attempts === 2, info);

// --- Interested → task in 2 business days
await page.selectOption('#d-status', 'Interested');
await page.waitForFunction(() => S.tk.size === 1);
const task = await st(page, `[...S.tk.values()][0]`);
const expectDue = await st(page, `addBizDays(today(), 2)`);
check('Interested creates follow-up task due in 2 business days', task.due === expectDue && task.status === 'Open', task.due);
await page.waitForTimeout(120);
check('status change renders at once (task shows on page)', await page.locator('.detail-main .rows li').count() === 1);

// --- Has Equipment → prompt → opportunity
await page.selectOption('#d-status', 'Has Equipment');
await page.waitForSelector('.toast .link');
await page.click('.toast .link');
await page.waitForSelector('#f-stage');
await page.selectOption('#op-type-0', 'Excavator'); await page.fill('#op-qty-0', '2'); await page.fill('#op-desc-0', '2015 Cat 320'); await page.fill('#op-val-0', '85000');
await page.click('[data-act="op-item-add"]');
await page.selectOption('#op-type-1', 'Skid Steer');
await page.click('[data-act="op-item-add"]');
await page.selectOption('#op-type-2', 'Building Materials'); await page.fill('#op-desc-2', 'Two pallets of block');
await page.click('[data-act="op-item-add"]');
await page.selectOption('#op-type-3', '__new');
await page.fill('#op-new-3', 'Rock Truck');
await page.click('[data-act="op-type-save"]');
await page.waitForFunction(() => { const el = document.querySelector('#op-type-3'); return el && el.value === 'Rock Truck'; });
check('item editor: built-in types, Building Materials, and a new type added on the spot', (await page.textContent('#op-total')).startsWith('5 units') && await st(page, `itemTypes('Equipment').includes('Rock Truck') && itemTypes('Equipment').includes('Building Materials')`), await page.textContent('#op-total'));
await page.selectOption('#f-stage', 'Equipment Confirmed');
check('probability follows stage', await page.inputValue('#f-prob') === '35');
await page.click('#dlg-submit');
await page.waitForFunction(() => S.op.size === 1);
const opRec = await st(page, `[...S.op.values()][0]`);
check('opportunity holds several items with totals worked out', opRec.items.length === 4 && opRec.units === 5 && opRec.value === 85000 && opRec.line === 'Equipment' && opRec.items[0].desc === '2015 Cat 320', { units: opRec.units, value: opRec.value });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'shot-detail.png'), fullPage: true });

// --- appointment
await page.click('.actions [data-act="ap-new"]');
check('appointment defaults to a phone call with no place', await page.inputValue('#f-apptKind') === 'Phone call' && await page.inputValue('#f-location') === '');
await page.selectOption('#f-apptKind', 'Site visit');
check('site visit fills in the company address', (await page.inputValue('#f-location')).includes('Christiansburg'));
await page.fill('#f-due', await st(page, `addBizDays(today(), 5)`)); await page.fill('#f-time', '14:30');
await page.click('#dlg-submit');
await page.waitForFunction(() => [...S.tk.values()].some(k => k.type === 'Appointment'));
const ap = await st(page, `[...S.tk.values()].find(k => k.type === 'Appointment')`);
check('appointment saved with time, place and kind', ap.time === '14:30' && ap.apptKind === 'Site visit' && ap.location.includes('Christiansburg') && ap.name === 'Site visit with Acme Excavating LLC' && ap.status === 'Open', ap.name);
await page.waitForTimeout(150);
await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
await page.screenshot({ path: path.join(OUT, 'shot-appt.png') });
check('company page flags the appointment and offers a calendar link', await page.locator('.flag.appt').count() === 1 && (await page.getAttribute('.detail-main a.btn[href*="calendar.google.com"]', 'href')).includes('T143000/'));
await page.click('.flag.appt');
await page.waitForSelector('#f-apptKind');
check('appointment opens in its own dialog for editing', await page.inputValue('#f-time') === '14:30' && await page.locator('#dlg h2').textContent() === 'Edit appointment');
await page.click('#dlg [data-act="dlg-close"]');

// --- estate opportunity referred by an attorney
await st(page, `Store.add('co', { id: 'rlaw00001', name: 'Hale & Finch Law', city: 'Christiansburg', state: 'VA', zip: '24073', terr: 'NRV', terrHow: 'ZIP', industry: 'Attorney / Law Firm', lines: ['Estate', 'Real Estate'], status: 'New', assets: [], attemptsBase: 0, created: nowIso(), updated: nowIso() })`);
await st(page, `Store.add('co', { id: 'rfam00001', name: 'Estate of Ruth Carter', city: 'Radford', state: 'VA', terr: 'NRV', terrHow: 'City', industry: 'Estate', lines: ['Estate'], status: 'New', assets: [], attemptsBase: 0, created: nowIso(), updated: nowIso() })`);
await page.waitForFunction(() => S.co.has('rfam00001') && S.co.has('rlaw00001'));
await st(page, `openOpp(null, 'rfam00001')`);
check('estate client opens on the Estate line with estate stages and questions', await page.inputValue('#f-line') === 'Estate' && await page.inputValue('#f-stage') === 'Inquiry' && await page.locator('#f-d_owner').count() === 1 && await st(page, `[...document.querySelectorAll('#op-type-0 option')].some(o => o.value === 'Household Contents')`));
await page.fill('#f-name', 'Carter estate');
await page.selectOption('#f-line', 'Real Estate');
await page.waitForSelector('#f-d_parcel');
check('switching line keeps what was typed and swaps stages and questions', await page.inputValue('#f-name') === 'Carter estate' && await page.inputValue('#f-stage') === 'Inquiry' && await st(page, `[...document.querySelectorAll('#f-stage option')].some(o => o.value === 'Listing Agreement Signed')`));
await page.selectOption('#f-line', 'Estate');
await page.waitForSelector('#f-d_owner');
await page.selectOption('#op-type-0', 'Household Contents');
await page.click('[data-act="op-item-add"]'); await page.selectOption('#op-type-1', 'Firearms'); await page.fill('#op-qty-1', '12');
await page.fill('#f-d_owner', 'Ruth Carter'); await page.selectOption('#f-d_authority', 'Executor'); await page.check('#f-d_hasRE');
await page.fill('#f-refPick', await st(page, `refLabelFor('rlaw00001')`));
await page.selectOption('#f-stage', 'Walk-Through Scheduled');
await page.click('#dlg-submit');
await page.waitForFunction(() => S.op.size === 2);
const est = await st(page, `[...S.op.values()].find(o => o.line === 'Estate')`);
check('estate opportunity saved with details, items and who referred it', est.details.owner === 'Ruth Carter' && est.details.authority === 'Executor' && est.details.hasRE === true && est.ref === 'rlaw00001' && est.items.length === 2 && est.units === 13 && est.stage === 'Walk-Through Scheduled' && est.prob === 25, est.details);
await st(page, `go('opportunities')`);
const bars = await page.locator('.bar-row').evaluateAll(els => els.map(e => e.querySelector('.bar-l').textContent.trim() + '=' + e.querySelector('.bar-n').textContent));
console.log('pipeline:', bars.join(' | '));
check('pipeline counts items by type across opportunities', bars.includes('Firearms=12') && bars.includes('Excavator=2') && bars.includes('Building Materials=1') && bars.includes('Rock Truck=1'));
await page.selectOption('#flt-op-line', 'Estate');
check('line filter narrows the list and the counts', await page.locator('.tbl tbody tr').count() === 1 && await page.locator('.bar-row').count() === 2);
await page.selectOption('#flt-op-line', '');
await page.selectOption('#flt-op-type', 'Excavator');
check('item type filter', await page.locator('.tbl tbody tr').count() === 1 && (await page.textContent('.tbl tbody tr')).includes('Acme'));
await page.selectOption('#flt-op-type', '');
await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
await page.screenshot({ path: path.join(OUT, 'shot-pipeline.png'), fullPage: true });
check('referral partners get a referral email, not a seller email', await st(page, `purposeText(S.co.get('rlaw00001'), 'intro').includes('referral partner') && !purposeText([...S.co.values()].find(c => c.name.startsWith('Acme')), 'intro').includes('referral')`));
await st(page, `Promise.all([Store.remove('op', [...S.op.values()].find(o => o.line === 'Estate').id), Store.remove('co', 'rlaw00001'), Store.remove('co', 'rfam00001')])`);
await st(page, `openCo([...S.co.values()].find(c => c.name.startsWith('Acme')).id)`);

// --- import
await page.click('#tabs [data-tab="import"]');
await page.setInputFiles('#imp-file', CSV_PATH);
await page.waitForSelector('.maptbl');
const map = await st(page, `V.imp.map`);
console.log('automap:', JSON.stringify(map));
check('automap covers the key columns', ['co.name', 'co.city', 'co.state', 'co.zip', 'co.web', 'co.phone', 'co.industry', 'co.priority', 'co.assets', 'co.notes', 'ct.full', 'ct.title', 'ct.email', 'ct.mobile'].every(k => map.includes(k)));
await page.screenshot({ path: path.join(OUT, 'shot-map.png'), fullPage: true });
await page.click('[data-act="imp-preview"]');
await page.waitForSelector('[data-act="imp-run"]');
const stats = await st(page, `V.imp.plan.stats`);
console.log('stats:', JSON.stringify(stats));
check('import plan counts', stats.newCo === 6 && stats.updCo === 1 && stats.newCt === 4 && stats.skipped === 1 && stats.unassigned === 2, stats);
await page.screenshot({ path: path.join(OUT, 'shot-preview.png'), fullPage: true });
await page.click('[data-act="imp-run"]');
await page.waitForFunction(() => V.imp.step === 'done', null, { timeout: 15000 });
await page.waitForTimeout(200);
const after = await st(page, `(() => { const by = n => [...S.co.values()].find(c => c.name.startsWith(n)); const f = c => c && ({ terr: c.terr, how: c.terrHow, ind: c.industry, sub: c.subIndustry, pri: c.priority, assets: c.assets, notes: c.notes, status: c.status, state: c.state });
  return { n: S.co.size, ct: S.ct.size, blue: f(by('Blue Ridge')), twin: f(by('Twin')), pied: f(by('Piedmont')), myst: f(by('Mystery')), yad: f(by('Yadkin')), acme: f(by('Acme')), lone: f(by('Lone')), blueCts: (derive().ctByCo.get(by('Blue Ridge').id) || []).map(x => ctName(x) + (x.primary ? '*' : '') + '/' + (x.role || '')) }; })()`);
console.log(JSON.stringify(after, null, 1));
check('company count', after.n === 7 && after.ct === 5);
check('repeated company rows merge + two contacts kept', after.blue.assets.length === 3 && after.blue.notes.includes('Second note') && after.blueCts.length === 2, after.blueCts);
check('city+state match (Galax, Virginia → SWVA-W)', after.twin.terr === 'SWVA-W' && after.twin.how === 'City' && after.twin.ind === 'Paving');
check('ZIP match TRIAD', after.pied.terr === 'TRIAD');
check('city without state → UNASSIGNED', after.myst.terr === 'UNASSIGNED' && after.myst.how === 'State missing');
check('out-of-footprint → UNASSIGNED', after.lone.terr === 'UNASSIGNED' && after.lone.ind === 'Forestry');
check('existing company matched: notes kept + appended, status untouched', after.acme.notes.includes('Imported note') && after.acme.status === 'Has Equipment', after.acme);
check('asset alias tractors → Farm Equipment', after.yad.assets[0] === 'Farm Equipment' && after.yad.ind === 'Agriculture');
console.log('writes:', JSON.stringify(await st(page, `window.__writes.slice(-8)`)));

// --- re-import same file: nothing new
await page.click('[data-act="imp-reset"]');
await page.setInputFiles('#imp-file', CSV_PATH);
await page.waitForSelector('.maptbl');
await page.click('[data-act="imp-preview"]');
await page.waitForSelector('[data-act="imp-run"]');
const stats2 = await st(page, `V.imp.plan.stats`);
check('re-import creates nothing', stats2.newCo === 0 && stats2.newCt === 0 && stats2.updCo === 0, stats2);

// --- duplicates + merge
await st(page, `Store.add('co', { id: 'rdupe0001', name: 'Twin County Paving Co.', city: 'Hillsville', state: 'VA', terr: 'SWVA-W', terrHow: 'City', status: 'New', assets: ['Trucks'], phone: '276-555-0999', created: nowIso() })`);
await page.click('#tabs [data-tab="review"]');
await page.waitForSelector('.dupes');
check('duplicate group detected', await st(page, `derive().dups.length === 1`));
await page.screenshot({ path: path.join(OUT, 'shot-review.png'), fullPage: true });
await page.click('[data-act="dup-merge"]');
await page.waitForSelector('.merge');
await page.click('#dlg-submit');
await page.waitForFunction(() => derive().dups.length === 0 && S.co.size === 7);
const merged = await st(page, `[...S.co.values()].find(c => c.name.startsWith('Twin'))`);
check('merge unions assets and keeps one record', merged.assets.includes('Trucks') && merged.assets.includes('Paving Equipment'), merged.assets);

// --- unassigned → manual territory
const unId = await st(page, `[...S.co.values()].find(c => c.name.startsWith('Mystery')).id`);
await page.selectOption('#un-' + unId, 'NRV');
await page.waitForFunction(id => S.co.get(id).terr === 'NRV', unId);
check('manual territory sticks through re-run', await st(page, `reassignAll().then(() => [...S.co.values()].find(c => c.name.startsWith('Mystery')).terr === 'NRV')`));

// --- new territory picks up Bluefield, WV
await page.click('#tabs [data-tab="territories"]');
await page.click('[data-act="terr-new"]');
await page.fill('#f-code', 'swv'); await page.fill('#f-name', 'Southern West Virginia'); await page.fill('#f-state', 'WV');
await page.fill('#f-cities', 'Bluefield\nPrinceton, WV');
await page.click('#dlg-submit');
await page.waitForFunction(() => [...S.co.values()].find(c => c.name.startsWith('Lone')).terr === 'SWV');
check('new state territory re-assigns matching companies', true);
await page.screenshot({ path: path.join(OUT, 'shot-terr.png'), fullPage: true });

// --- tasks: complete
await page.click('#tabs [data-tab="tasks"]');
await page.click('[data-act="tk-tab"][data-tk="open"]');
await page.locator('.rows input[type=checkbox]').first().check();
await page.waitForFunction(() => [...S.tk.values()][0].status === 'Completed');
check('task completes', true);
await page.click('[data-act="tk-tab"][data-tk="appts"]');
check('Appointments tab lists the appointment', await page.locator('.rows li').count() === 1 && (await page.textContent('.rows li')).includes('Site visit with Acme'));
await page.locator('.rows input[type=checkbox]').first().check();
await page.click('.toast .link:has-text("Log how it went")');
await page.waitForSelector('#f-type');
check('finishing an appointment offers to log it as the matching activity', await page.inputValue('#f-type') === 'Site Visit');
await page.click('#dlg [data-act="dlg-close"]');

// --- views + dashboard
await page.click('#tabs [data-tab="companies"]');
await page.click('[data-act="co-view"][data-view="priority"]');
check('Priority Prospecting view', await page.locator('.tbl tbody tr').count() === 3, await page.locator('.tbl tbody tr').count());
await page.click('[data-act="co-view"][data-view="fleet"]');
check('Fleet view', await page.locator('.tbl tbody tr').count() >= 3, await page.locator('.tbl tbody tr').count());
await page.click('[data-act="co-view"][data-view="all"]');
await page.fill('#flt-co-q', 'tom');
await page.waitForTimeout(350);
check('search by contact name keeps focus', await page.locator('.tbl tbody tr').count() === 1 && await page.evaluate(() => document.activeElement.id === 'flt-co-q'));
await page.fill('#flt-co-q', '');
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'shot-companies.png'), fullPage: true });
await page.click('[data-act="export"][data-kind="co"]');
await page.waitForFunction(() => window.__saved.length === 1);
console.log('export:', JSON.stringify(await st(page, `window.__saved[0]`)).slice(0, 420));
await page.click('#tabs [data-tab="dashboard"]');
await page.waitForTimeout(200);
const tiles = await page.locator('.tile').evaluateAll(els => els.map(e => e.querySelector('.tile-l').textContent + '=' + e.querySelector('.tile-n').textContent));
console.log('tiles:', tiles.join(' | '));
await page.screenshot({ path: path.join(OUT, 'shot-dash.png'), fullPage: true });
await page.click('[data-act="go-view"][data-view="aplus"]');
check('tile drills into companies', await page.locator('.tbl tbody tr').count() === 1);
for (const tab of ['contacts', 'opportunities', 'activity']) { await page.click(`#tabs [data-tab="${tab}"]`); await page.waitForTimeout(80); check(tab + ' renders rows', await page.locator('.tbl tbody tr').count() >= 1); }
await page.fill('#gsearch', 'piedmont');
await page.waitForSelector('#gresults button');
await page.click('#gresults button');
await page.waitForSelector('.detail-head');
check('global search opens company', (await page.textContent('h1')).includes('Piedmont'));
const docCount = await st(page, `[...window.__docs.keys()]`);
console.log('docs:', docCount.join(', '));

// --- outreach: single draft from a company page
await st(page, `go('companies')`);
await st(page, `openCo([...S.co.values()].find(c => c.name.startsWith('Blue Ridge')).id)`);
await page.click('.actions [data-act="dr-new"]');
check('purpose auto-picks Introduction', await page.inputValue('#f-purpose') === 'intro');
await page.fill('#f-extra', 'Mention the November auction');
await page.click('#dlg-submit');
await page.waitForSelector('#dlg .draft');
check('draft saved to queue with parsed subject', await st(page, `S.dr.size === 1 && [...S.dr.values()][0].subject === 'Surplus equipment at your yard' && [...S.dr.values()][0].body.startsWith('Hi Tom,')`));
check('prompt carries facts, instructions and prospect data', await st(page, `(() => { const p = window.__prompts[window.__prompts.length - 1]; return p.includes('Consider It Sold') && p.includes('Mention the November auction') && p.includes('Blue Ridge Grading') && p.includes('"contact_first_name":"Tom"'); })()`));
await page.screenshot({ path: path.join(OUT, 'shot-draft.png') });
await page.fill('#dlg textarea', 'Hi Tom,\n\nEdited by the rep.\n\nStephen');
await page.click('#dlg [data-act="dr-sent"]');
await page.waitForFunction(() => S.dr.size === 0);
const sent = await st(page, `(() => { const c = [...S.co.values()].find(c => c.name.startsWith('Blue Ridge')); const a = (derive().actByCo.get(c.id) || [])[0]; return { status: c.status, nextFU: c.nextFU, exp: addBizDays(today(), 4), type: a.type, notes: a.notes, attempts: coInfo(c).attempts }; })()`);
check('mark sent logs email with edited body, sets status + follow-up', sent.type === 'Email Sent' && sent.notes.includes('Edited by the rep') && sent.status === 'Email Sent' && sent.nextFU === sent.exp && sent.attempts === 1, sent);

// --- outreach: batch
await st(page, `(() => { const y = [...S.co.values()].find(c => c.name.startsWith('Yadkin')); const p = [...S.co.values()].find(c => c.name.startsWith('Piedmont')); return Promise.all([Store.add('ct', { id: 'rctyad', co: y.id, first: 'Joe', email: 'joe@yadkin.example', primary: true }), Store.add('ct', { id: 'rctpied', co: p.id, first: 'Pat', email: 'pat@piedmont.example', primary: true }), Store.patch('co', p.id, { optOut: true })]); })()`);
await page.click('#tabs [data-tab="outreach"]');
await page.selectOption('#flt-out-rep', '');
await page.waitForTimeout(100);
const tg = await st(page, `(() => { const t = outreachTargets(V.out); return { names: t.list.map(x => x.c.name), skipped: t.skipped }; })()`);
console.log('targets:', JSON.stringify(tg));
check('batch list excludes opt-outs and companies without an email', tg.names.includes('Yadkin Valley Farms') && tg.names.includes('Twin County Paving') && !tg.names.includes('Piedmont Freight Lines') && tg.skipped['Opted out of email'] === 1 && tg.skipped['No contact with an email address'] >= 1, tg);
await page.screenshot({ path: path.join(OUT, 'shot-outreach-0.png'), fullPage: true });
await page.click('[data-act="dr-batch"]');
await page.waitForFunction(n => S.dr.size === n && !V.out.run, tg.names.length, { timeout: 15000 });
await page.waitForTimeout(200);
check('batch drafts land in the queue', await page.locator('#main .draft').count() === tg.names.length, await page.locator('#main .draft').count());
check('already-drafted companies drop out of the list', await st(page, `outreachTargets(V.out).list.length === 0`));
await page.locator('#main .draft textarea').first().click();
await page.keyboard.type(' typed while others change');
await st(page, `Store.patch('co', [...S.co.values()][0].id, { leadType: 'x' })`);
await page.waitForTimeout(400);
check('typing in a draft survives other changes', (await page.locator('#main .draft textarea').first().inputValue()).includes('typed while others change'));
await page.screenshot({ path: path.join(OUT, 'shot-outreach.png'), fullPage: true });
// --- Gmail draft
await page.locator('#main .draft textarea').first().evaluate(el => el.blur());
await page.waitForTimeout(250);
const firstDraft = await st(page, `document.querySelector('#main .draft').id.slice(3)`);
await page.click('#dr-' + firstDraft + ' [data-act="dr-gmail"]');
await page.waitForFunction(id => !!S.dr.get(id).gmailAt, firstDraft);
const call = await st(page, `window.__mcpCalls[0]`);
check('Gmail draft: one create_draft call with recipient, subject and edited body', call.server === 'Gmail' && call.tool === 'create_draft' && Array.isArray(call.input.to) && call.input.to.length === 1 && /@/.test(call.input.to[0]) && !!call.input.subject && call.input.body.includes('typed while others change') && (await st(page, `window.__mcpCalls.length`)) === 1, call.input);
await page.waitForTimeout(200);
check('Gmail draft: card shows it is in Gmail with a link', await page.locator('#dr-' + firstDraft + ' .draft-gmail a').count() === 1);
await st(page, `window.__mcpFail = 'server_not_connected'`);
await page.locator('#main .draft [data-act="dr-gmail"]').nth(1).click();
await page.waitForSelector('.toast.err');
check('Gmail not connected: says how to connect, nothing marked', (await page.textContent('.toast.err')).includes('Connectors') && await st(page, `[...S.dr.values()].filter(d => d.gmailAt).length === 1`));
await st(page, `window.__mcpFail = ''; document.querySelectorAll('.toast').forEach(t => t.remove())`);
await page.screenshot({ path: path.join(OUT, 'shot-gmail.png'), fullPage: true });
await page.click('[data-act="out-cfg"]');
await page.fill('#out-sig', 'Stephen\nMatthews Auctioneers');
await page.fill('#out-gap', '5');
await page.click('[data-act="out-save"]');
await page.waitForFunction(() => S.outreach.main && S.outreach.main.gap === 5);
check('settings save (shared gap + own signature)', await st(page, `S.team[ME].sig.startsWith('Stephen') && outCfg().gap === 5 && !!outCfg().about`));
await st(page, `window.__aiFail = 'rate_limited'`);
await st(page, `Store.remove('dr', [...S.dr.values()][0].id)`);
await page.waitForTimeout(150);
await page.click('[data-act="dr-batch"]');
await page.waitForSelector('.toast.err');
check('AI failure stops the batch with a message', (await page.textContent('.toast.err')).includes('usage limit'));
await st(page, `window.__aiFail = ''`);

// --- state carried to phone + dark screenshots
const dump = await st(page, `Object.fromEntries([...window.__docs.entries()])`);
const phone = await newPage({ viewport: { width: 400, height: 800 }, dark: true, seed: dump });
await phone.waitForSelector('.tiles');
await phone.waitForTimeout(300);
check('phone: no horizontal page scroll (dashboard)', await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), await phone.evaluate(() => document.documentElement.scrollWidth));
await phone.screenshot({ path: path.join(OUT, 'shot-phone-dash.png'), fullPage: true });
await phone.click('#tabs [data-tab="companies"]');
await phone.waitForSelector('.tbl');
check('phone: no horizontal page scroll (companies)', await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), await phone.evaluate(() => document.documentElement.scrollWidth));
await phone.click('.tbl .name');
await phone.waitForSelector('.detail-head');
check('phone: no horizontal page scroll (detail)', await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), await phone.evaluate(() => document.documentElement.scrollWidth));
await phone.screenshot({ path: path.join(OUT, 'shot-phone-detail.png'), fullPage: true });
await phone.click('.actions [data-act="log"][data-type="Phone Call"]');
await phone.waitForSelector('#f-outcome');
await phone.screenshot({ path: path.join(OUT, 'shot-phone-dialog.png') });
const dark = await newPage({ dark: true, seed: dump });
await dark.waitForSelector('.tiles');
await dark.waitForTimeout(300);
await dark.screenshot({ path: path.join(OUT, 'shot-dark-dash.png'), fullPage: true });

const expected = errors.filter(e => /^console: \{code: (rate_limited|server_not_connected)/.test(e));
const real = errors.filter(e => !expected.includes(e));
console.log('\nERRORS:', real.length ? '\n' + real.join('\n') : 'none');
await browser.close();
process.exit(real.length ? 1 : 0);
