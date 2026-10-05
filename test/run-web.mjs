// End-to-end test of the website build (public/index.html) against the real database
// schema running in an in-memory Postgres, with row-level security enforced.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { launch } from './browser.mjs';
import { makeDb } from './pg.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test', 'out');
mkdirSync(OUT, { recursive: true });
const html = readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8')
  .replace(/window\.__CRM_CONFIG__ = [^;]*;/, 'window.__CRM_CONFIG__ = {"url":"https://example.supabase.co","key":"test-anon-key"};');
const mock = readFileSync(path.join(ROOT, 'test', 'mock-supabase.js'), 'utf8');

const db = await makeDb();
let lock = Promise.resolve();
const queue = fn => { const p = lock.then(fn, fn); lock = p.catch(() => {}); return p; };
const admin = (sql, params) => queue(async () => (await db.query(sql, params || [])).rows);
const runAs = user => (sql, params) => queue(async () => {
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated' })]);
  await db.exec('set role authenticated');
  try { return { rows: (await db.query(sql, params || [])).rows }; }
  catch (e) { return { error: { code: e.code, message: e.message } }; }
  finally { await db.exec('reset role'); }
});
const A = { id: '11111111-1111-1111-1111-111111111111', email: 'stephen@example.com' };
const B = { id: '22222222-2222-2222-2222-222222222222', email: 'rep@example.com' };
const C = { id: '33333333-3333-3333-3333-333333333333', email: 'stranger@example.com' };
for (const u of [A, B, C]) await admin(`insert into auth.users (id, email) values ($1, $2)`, [u.id, u.email]);

const csv = `Company Name,Address,City,State,Zip,Website,Phone,Industry,Priority,Asset Potential,Notes,Contact Name,Title,Email,Cell,Assigned Rep
"Blue Ridge Grading, Inc.",120 Depot St,Christiansburg,VA,24073,www.blueridgegrading.example,(540) 555-0101,Grading,A+,"Heavy Equipment, Trucks",Runs 20+ dozers,Tom Hale,Owner,tom@blueridgegrading.example,540-555-0199,Dana Imported
Blue Ridge Grading Inc,120 Depot St,Christiansburg,VA,24073,,,,,Trailers,Second note,Ann Ruiz,Fleet Manager,ann@blueridgegrading.example,,
Twin County Paving,,Galax,Virginia,,twincountypaving.example,276-555-0110,asphalt paving,A,Paving Equipment,,Bill Cox,President,bill@twincountypaving.example,,
Piedmont Freight Lines,,Greensboro,NC,27407,,336-555-0120,Freight,B+,"Trucks; Trailers",,,,,,
Mystery Hauling,,Springfield,,,,,Trucking,B,Trucks,,Sam Doe,,sam@mystery.example,,
Acme Excavating,,Christiansburg,VA,24073,,540-555-0177,Excavation,A,Heavy Equipment,Imported note,,,,,
`;
const CSV_PATH = path.join(OUT, 'prospects-web.csv');
writeFileSync(CSV_PATH, csv);

const browser = await launch();
process.on('exit', () => { if (process.exitCode !== 0 && errors.length) console.log('ERRORS SO FAR:\n' + errors.join('\n')); });
const errors = [];
async function newPage(user, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1380, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|ERR_|net::|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.exposeFunction('__sql', runAs(user));
  const session = { access_token: 'tok-' + user.email, user: { id: user.id, email: user.email } };
  await page.addInitScript(`window.__session = ${opts.signedOut ? 'null' : JSON.stringify(session)}; window.__sessionOnLogin = ${JSON.stringify(session)};\n${mock}`);
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('https://crm.test/api/draft')) {
      const auth = route.request().headers().authorization || '';
      const input = JSON.parse(route.request().postData() || '{}').input || '';
      page.__drafts = (page.__drafts || 0) + 1;
      if (opts.aiNotConfigured) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'not_configured' }) });
      const m = input.match(/<prospects>(.*)<\/prospects>/s);
      const text = m ? JSON.stringify(JSON.parse(m[1]).map(p => ({ id: p.id, subject: 'Equipment at ' + p.company, body: 'Hi ' + (p.contact_first_name || 'there') + ',\n\nBody.\n\nStephen' })))
        : 'Subject: Surplus equipment at your yard\n\nHi Tom,\n\nShort note about equipment.\n\nStephen\nMatthews Auctioneers';
      return route.fulfill({ status: auth === 'Bearer tok-' + user.email ? 200 : 401, contentType: 'application/json', body: JSON.stringify(auth ? { text, truncated: false } : { code: 'not_granted' }) });
    }
    if (url.startsWith('https://crm.test/')) return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    return route.abort();
  });
  await page.goto('https://crm.test/');
  return page;
}
const check = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); if (!cond) errors.push('check failed: ' + name); };
const st = (page, expr) => page.evaluate(expr);
const one = async (sql, params) => (await admin(sql, params))[0];

// --- sign-in screen
let page = await newPage(A, { signedOut: true });
await page.waitForSelector('#web-auth');
check('signed out: sign-in form, no CRM chrome', await page.locator('#tabs').isHidden() && await page.locator('.gate-card h2').textContent() === 'Sign in');
await page.screenshot({ path: path.join(OUT, 'web-signin.png') });
await page.fill('#web-email', 'Stephen@Example.com'); await page.fill('#web-pass', 'wrong-password');
await page.click('#web-auth button[type=submit]');
await page.waitForSelector('.gate-card .dlg-msg');
check('wrong password: plain message, email kept', (await page.textContent('.gate-card .dlg-msg')).includes("don't match") && await page.inputValue('#web-email') === 'stephen@example.com');
await page.fill('#web-pass', 'correct-horse');
await page.click('#web-auth button[type=submit]');
await page.waitForSelector('.start', { timeout: 10000 });
const me = await one(`select * from team_members`);
check('first person to sign in becomes the admin', me.is_admin === true && me.user_id === A.id && me.email === A.email && await st(page, `CAP.isAdmin === true && S.team[ME].name === 'Stephen'`), me.name);
check('territories load from the migration seed', await st(page, `Object.keys(S.terr).length === 7 && S.terr.NRV.zips.includes('24073') && S.terr.TRIAD.cities.length === 5`));

// --- company, contact, activity, task, opportunity through the screens
await page.click('.bar [data-act="co-new"]');
await page.fill('#f-name', 'Acme Excavating LLC');
await page.fill('#f-city', 'Christiansburg'); await page.fill('#f-state', 'va'); await page.fill('#f-zip', '24073'); await page.fill('#f-phone', '5405550177');
await page.selectOption('#f-industry', 'Excavation'); await page.selectOption('#f-priority', 'A');
await page.check('#f-assets-0'); await page.check('#f-assets-2');
await page.click('#dlg-submit');
await page.waitForSelector('.detail-head');
await st(page, `Store._chain`);
let co = await one(`select * from companies where name like 'Acme%'`);
check('company row: territory by ZIP, defaults, array column', co.territory_code === 'NRV' && co.territory_match === 'ZIP' && co.state === 'VA' && co.lead_status === 'New' && co.outreach_attempts_base === 0 && JSON.stringify(co.asset_potential) === '["Heavy Equipment","Trucks"]' && co.assigned_rep_id === me.id && co.next_follow_up === null, { terr: co.territory_code, assets: co.asset_potential });

await page.click('.detail-side [data-act="ct-new"]');
await page.fill('#lk-q', 'acme');
check('new contact: search first finds the existing company', (await page.textContent('#lk-cos')).includes('Acme'));
await page.fill('#lk-q', 'Dale Acme');
await page.click('#lk-add');
await page.fill('#f-first', 'Dale'); await page.fill('#f-last', 'Acme'); await page.fill('#f-email', 'Dale@AcmeEx.example'); await page.selectOption('#f-role', 'Owner');
await page.click('#dlg-submit');
await page.waitForFunction(() => S.ct.size === 1);
await page.click('.actions [data-act="log"][data-type="Phone Call"]');
await page.fill('#f-notes', 'Has two older excavators.');
await page.click('[data-act="fu-quick"][data-days="7"]');
await page.click('#dlg-submit');
await page.waitForFunction(() => S.ac.size === 1);
await page.selectOption('#d-status', 'Interested');
await page.waitForFunction(() => S.tk.size === 1);
await st(page, `Store._chain`);
co = await one(`select lead_status, next_follow_up::text as fu, lead_status_at from companies where name like 'Acme%'`);
const ct = await one(`select * from contacts`), ac = await one(`select * from activities`), tk = await one(`select *, due_date::text as due from tasks where task_type <> 'Appointment'`);
const exp = await st(page, `({ fu: addDays(today(), 7), due: addBizDays(today(), 2) })`);
check('contact, activity and task rows with links and dates', ct.company_id && ct.is_primary === true && ct.email === 'dale@acmeex.example' && ac.activity_type === 'Phone Call' && ac.contact_id === ct.id && ac.logged_by_id === me.id && tk.due === exp.due && tk.assigned_to_id === me.id && tk.auto_source === 'interested', { tk: tk.due });
check('company follow-up date and status saved', co.fu === exp.fu && co.lead_status === 'Interested' && !!co.lead_status_at, co);
// --- appointment: new columns on the tasks table
await page.click('.actions [data-act="ap-new"]');
await page.selectOption('#f-apptKind', 'Site visit');
await page.fill('#f-due', '2026-12-01'); await page.fill('#f-time', '09:15');
await page.click('#dlg-submit');
await page.waitForFunction(() => [...S.tk.values()].some(k => k.type === 'Appointment'));
await st(page, `Store._chain`);
const apRow = await one(`select *, due_date::text as due from tasks where task_type = 'Appointment'`);
check('appointment row: time, place and kind columns', apRow.due === '2026-12-01' && apRow.due_time === '09:15' && apRow.appointment_kind === 'Site visit' && apRow.location.includes('Christiansburg') && apRow.name === 'Site visit with Acme Excavating LLC', { t: apRow.due_time, loc: apRow.location });
// a database that has not had the appointments update yet still saves the task
await queue(() => db.exec(`alter table public.tasks drop column due_time, drop column location, drop column appointment_kind`));
const coId0 = await st(page, `[...S.co.values()][0].id`);
await st(page, `Store.add('tk', { id: 'rbehind1', name: 'Phone call with Acme', co: '${coId0}', type: 'Appointment', due: '2026-12-02', time: '11:00', location: '', apptKind: 'Phone call', priority: 'Normal', status: 'Open', notes: '', created: nowIso() }).then(() => 'ok', e => e.code + ' ' + e.message)`).then(r => check('database without the update: task still saves', r === 'ok', r));
check('...and the rep is told the time was not stored', await st(page, `Store.behind === true`) && (await page.textContent('.toast.err')).includes('database gets its update'));
await queue(() => db.exec(readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261005200000_appointments.sql'), 'utf8')));
check('running the update twice is harmless', (await one(`select count(*)::int n from information_schema.columns where table_name = 'tasks' and column_name in ('due_time', 'location', 'appointment_kind')`)).n === 3);
await queue(() => db.exec(readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261005200000_appointments.sql'), 'utf8')));
await st(page, `document.querySelectorAll('.toast').forEach(t => t.remove())`);

await st(page, `openOpp(null, [...S.co.values()][0].id)`);
await page.selectOption('#op-type-0', 'Excavator'); await page.fill('#op-qty-0', '2'); await page.fill('#op-val-0', '85000.50');
await page.click('[data-act="op-item-add"]'); await page.selectOption('#op-type-1', 'Building Materials'); await page.fill('#op-desc-1', 'Trusses, one load');
await page.selectOption('#f-stage', 'Equipment Confirmed'); await page.fill('#f-auctionDate', '2026-11-14');
await page.click('#dlg-submit');
await page.waitForFunction(() => S.op.size === 1);
await st(page, `Store._chain`);
const op = await one(`select *, auction_date::text as ad from opportunities`);
check('opportunity row: items, line and details columns', op.line === 'Equipment' && Array.isArray(op.items) && op.items.length === 2 && op.items[0].type === 'Excavator' && op.items[0].qty === 2 && op.items[1].desc === 'Trusses, one load' && JSON.stringify(op.details) === '{}' && op.referred_by_id === null, op.items);
const pv = await admin(`select item_type, units::int as units, estimated_value::float as v from pipeline_items order by item_type`);
check('pipeline_items view counts the same thing in SQL', pv.length === 2 && pv[0].item_type === 'Building Materials' && pv[0].units === 1 && pv[1].item_type === 'Excavator' && pv[1].units === 2 && pv[1].v === 85000.5, pv);
check('opportunity row: integer, numeric and date columns', op.estimated_units === 3 && Number(op.estimated_value) === 85000.5 && op.probability === 35 && op.ad === '2026-11-14' && op.expected_close_date === null, { v: op.estimated_value });

// --- estate line: company lines, details, referred-by and a custom item type
await st(page, `Store.add('co', { id: 'rlaw00001', name: 'Hale & Finch Law', city: 'Radford', state: 'VA', terr: 'NRV', terrHow: 'City', industry: 'Attorney / Law Firm', lines: ['Estate', 'Real Estate'], status: 'New', assets: [], attemptsBase: 0, created: nowIso(), updated: nowIso() })`);
await st(page, `addItemType('Rock Truck', 'Equipment')`);
await st(page, `Store.add('op', { id: 'rest00001', name: 'Carter estate', line: 'Estate', co: 'rlaw00001', ref: 'rlaw00001', stage: 'Walk-Through Scheduled', prob: 25, items: [{ type: 'Firearms', qty: 12 }, { type: 'Household Contents', qty: 1 }], units: 13, value: null, details: { owner: 'Ruth Carter', authority: 'Executor', hasRE: true }, created: nowIso(), updated: nowIso() })`);
const lawRow = await one(`select lines from companies where id = 'rlaw00001'`), estRow = await one(`select * from opportunities where id = 'rest00001'`), typesRow = await one(`select value from settings where key = 'outreach'`);
check('estate rows: lines array, details, referred-by link, custom type saved', JSON.stringify(lawRow.lines) === '["Estate","Real Estate"]' && estRow.line === 'Estate' && estRow.details.owner === 'Ruth Carter' && estRow.details.hasRE === true && estRow.referred_by_id === 'rlaw00001' && estRow.items.length === 2 && typesRow.value.types.list[0].name === 'Rock Truck', { lines: lawRow.lines, details: estRow.details });
await st(page, `Promise.all([Store.remove('op', 'rest00001')]).then(() => Store.remove('co', 'rlaw00001'))`);

// --- import (bulk insert, a matched update, a new name-only rep)
await page.click('#tabs [data-tab="import"]');
await page.setInputFiles('#imp-file', CSV_PATH);
await page.waitForSelector('.maptbl');
await page.click('[data-act="imp-preview"]');
await page.waitForSelector('[data-act="imp-run"]');
const stats = await st(page, `V.imp.plan.stats`);
await page.click('[data-act="imp-run"]');
await page.waitForFunction(() => V.imp.step === 'done', null, { timeout: 15000 });
check('import finished without an error', await st(page, `!V.imp.failed`), await st(page, `V.imp.failed || ''`));
const counts = await one(`select (select count(*)::int from companies) co, (select count(*)::int from contacts) ct, (select count(*)::int from team_members) tm`);
const blue = await one(`select c.*, t.name as rep_name from companies c left join team_members t on t.id = c.assigned_rep_id where c.name like 'Blue Ridge%'`);
const acme2 = await one(`select notes, lead_status from companies where name like 'Acme%'`);
check('import rows in the database', stats.newCo === 4 && stats.updCo === 1 && counts.co === 5 && counts.ct === 5 && counts.tm === 2, { stats, counts });
check('imported company: merged assets, notes, new rep linked', blue.asset_potential.length === 3 && blue.notes.includes('Second note') && blue.rep_name === 'Dana Imported' && blue.prospect_priority === 'A+' && acme2.notes === 'Imported note' && acme2.lead_status === 'Interested', { rep: blue.rep_name });
await page.click('[data-act="imp-reset"]');
await page.setInputFiles('#imp-file', CSV_PATH);
await page.waitForSelector('.maptbl');
await page.click('[data-act="imp-preview"]');
await page.waitForSelector('[data-act="imp-run"]');
check('re-import creates nothing', await st(page, `V.imp.plan.stats.newCo === 0 && V.imp.plan.stats.newCt === 0 && V.imp.plan.stats.updCo === 0`));

// --- bulk paths: 60 inserts in one request, 60 whole-row updates, 60 deletes
await st(page, `Store.addMany('co', Array.from({ length: 60 }, (_, i) => ({ id: 'rbulk' + i, name: 'Bulk Co ' + i, city: 'Roanoke', state: 'VA', terr: 'ROA', terrHow: 'City', status: 'New', assets: ['Trucks'], attemptsBase: 0, created: nowIso(), updated: nowIso() })))`);
await st(page, `Store.patchMany('co', Array.from({ length: 60 }, (_, i) => ['rbulk' + i, { leadType: 'Fleet', nextFU: '2026-12-01', assets: ['Trucks', 'Trailers'] }]))`);
let bulk = await one(`select count(*)::int n, count(*) filter (where lead_type = 'Fleet' and next_follow_up = '2026-12-01' and array_length(asset_potential, 1) = 2 and name like 'Bulk Co%' and city = 'Roanoke')::int ok from companies where id like 'rbulk%'`);
check('bulk insert and bulk update keep every column', bulk.n === 60 && bulk.ok === 60, bulk);
await st(page, `Store.patchMany('co', Array.from({ length: 60 }, (_, i) => ['rbulk' + i, { _del: true }]))`);
check('bulk delete', (await one(`select count(*)::int n from companies where id like 'rbulk%'`)).n === 0 && await st(page, `S.co.size === 5`));

// --- team and territories (admin)
await page.click('#tabs [data-tab="territories"]');
await page.click('[data-act="rep-new"]');
await page.fill('#f-name', 'Rep Bee'); await page.fill('#f-email', 'Rep@Example.com');
await page.click('#dlg-submit');
await page.waitForFunction(() => Object.keys(S.team).length === 3);
await st(page, `Store._chain`);
const repB = await one(`select * from team_members where name = 'Rep Bee'`);
check('admin adds a rep by email', repB.email === 'rep@example.com' && repB.is_admin === false && repB.user_id === null);
await st(page, `openTerritory('NRV')`);
await page.selectOption('#f-owner', repB.id);
await page.fill('#f-zips', '24073, 24060, 24141, 24301, 24084, 24087');
await page.click('#dlg-submit');
await page.waitForFunction(id => S.terr.NRV.owner === id, repB.id);
await st(page, `Store._chain`);
const nrv = await one(`select * from territories where code = 'NRV'`);
check('territory edit saved (owner, ZIP list, cities untouched)', nrv.owner_id === repB.id && nrv.zips.length === 6 && nrv.cities.length === 5 && nrv.name === 'New River Valley');
await page.screenshot({ path: path.join(OUT, 'web-territories.png'), fullPage: true });

// --- outreach through the site's /api/draft route
await st(page, `openCo([...S.co.values()].find(c => c.name.startsWith('Blue Ridge')).id)`);
await page.click('.actions [data-act="dr-new"]');
await page.click('#dlg-submit');
await page.waitForSelector('#dlg .draft');
check('web draft card offers Open in Gmail with the draft filled in', (await page.getAttribute('#dlg .draft a[id^="dr-gm-"]', 'href')).startsWith('https://mail.google.com/mail/?view=cm&fs=1&to=tom%40blueridgegrading.example&su=Surplus') && await page.locator('#dlg [data-act="dr-gmail"]').count() === 0);
await st(page, `Store._chain`);
const dr = await one(`select * from email_drafts`);
check('draft row saved', dr.subject === 'Surplus equipment at your yard' && dr.to_email === 'tom@blueridgegrading.example' && dr.purpose === 'intro' && dr.drafted_by_id === me.id);
await page.click('#dlg [data-act="dr-sent"]');
await page.waitForFunction(() => S.dr.size === 0);
await st(page, `Store._chain`);
const sent = await one(`select (select count(*)::int from email_drafts) drafts, (select count(*)::int from activities where activity_type = 'Email Sent') emails, (select lead_status from companies where name like 'Blue Ridge%') status`);
check('mark sent: draft removed, email logged, status moved', sent.drafts === 0 && sent.emails === 1 && sent.status === 'Email Sent', sent);
await page.click('#tabs [data-tab="report"]');
await page.waitForSelector('#rp-total');
const board = await one(`select (select count(*)::int from activities where activity_type in ('Phone Call', 'Voicemail', 'Email Sent', 'Text Message')) n`);
check('scoreboard counts match the activities table', await page.textContent('#rp-total') === String(board.n) && board.n >= 1 && await st(page, `rpData({ range: 'year', rep: '' }).cur.total`) === board.n, board);
check('scoreboard leaderboard lists the signed-in rep', await page.locator('.board [data-act="rp-rep"]').count() >= 1);
await page.click('#tabs [data-tab="outreach"]');
await page.selectOption('#flt-out-rep', '');
await page.click('[data-act="dr-batch"]');
await page.waitForFunction(() => !V.out.run && S.dr.size >= 1, null, { timeout: 15000 });
await st(page, `Store._chain`);
check('batch drafts saved as rows', (await one(`select count(*)::int n from email_drafts`)).n === await st(page, `S.dr.size`) && await st(page, `S.dr.size`) >= 2, await st(page, `S.dr.size`));
await page.click('[data-act="out-cfg"]');
await page.fill('#out-sig', 'Stephen\nMatthews Auctioneers'); await page.fill('#out-gap', '5');
await page.click('[data-act="out-save"]');
await page.waitForFunction(() => S.outreach.main && S.outreach.main.gap === 5);
await st(page, `Store._chain`);
const setg = await one(`select value from settings where key = 'outreach'`), sig = await one(`select signature from team_members where id = $1`, [me.id]);
check('outreach settings and signature saved', setg.value.main.gap === 5 && sig.signature.startsWith('Stephen'));
await page.screenshot({ path: path.join(OUT, 'web-outreach.png'), fullPage: true });

// --- delete a company: children go with it
await st(page, `openCompany([...S.co.values()].find(c => c.name.startsWith('Acme')).id)`);
await page.click('#dlg [data-act="del"]'); await page.click('#dlg [data-act="del"]');
await page.waitForFunction(() => ![...S.co.values()].some(c => c.name.startsWith('Acme')));
await st(page, `Store._chain`);
const gone = await one(`select (select count(*)::int from companies where name like 'Acme%') co, (select count(*)::int from contacts where email like '%acmeex%') ct, (select count(*)::int from tasks) tk, (select count(*)::int from opportunities) op, (select count(*)::int from activities where activity_type = 'Phone Call') ac`);
check('deleting a company removes its contacts, tasks, opportunities and activity', gone.co + gone.ct + gone.tk + gone.op + gone.ac === 0, gone);

// --- reload: everything comes back from the database identical
const snap = expr => `JSON.stringify((() => { const pick = m => [...m.values()].sort((a, b) => a.id < b.id ? -1 : 1); return { co: pick(S.co), ct: pick(S.ct), ac: pick(S.ac), dr: pick(S.dr), terr: S.terr, team: S.team, out: S.outreach }; })())`;
await st(page, `Store._chain`);
const before = JSON.parse(await st(page, snap()));
const dump = await st(page, `(() => { const d = { territories: S.terr, team: Object.fromEntries(Object.entries(S.team).map(([id, r]) => [id, { name: r.name, active: r.active !== false }])) }; for (const k of KINDS) d[KIND_LABEL[k]] = [...S[k].values()]; return JSON.stringify(d); })()`);
const page2 = await newPage(A);
await page2.waitForFunction(() => typeof S !== 'undefined' && S.ready, null, { timeout: 10000 });
const after = JSON.parse(await st(page2, snap()));
const norm = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'created' || k === 'updated' || k === 'at' || k === 'statusAt') && typeof v === 'string' ? v.slice(0, 19) : v));
const diff = [];
for (const k of ['co', 'ct', 'ac', 'dr']) { const a = norm(before[k]), b = norm(after[k]); if (a.length !== b.length) diff.push(k + ' count ' + a.length + ' vs ' + b.length); a.forEach((r, i) => { for (const f of new Set([...Object.keys(r), ...Object.keys(b[i] || {})])) { const x = r[f], y = (b[i] || {})[f]; const nz = v => (v == null || v === false || (Array.isArray(v) && !v.length)) ? '' : v; if (JSON.stringify(nz(x)) !== JSON.stringify(nz(y))) diff.push(k + '.' + f + ': ' + JSON.stringify(x) + ' vs ' + JSON.stringify(y)); } }); }
check('reload returns the same records the screens were showing', diff.length === 0 && after.co.length === 4 && Object.keys(after.terr).length === 7 && after.out.main.gap === 5, diff.slice(0, 6));
await page2.screenshot({ path: path.join(OUT, 'web-dashboard.png'), fullPage: true });

// --- live update from another person
const live = await one(`insert into companies (id, name, city, state, territory_code, asset_potential, next_follow_up) values ('rlive1', 'Live Update Co', 'Salem', 'VA', 'ROA', array['Trailers','Shop Equipment'], '2026-10-20') returning to_jsonb(companies.*) as row`);
await st(page2, `window.__rt(${JSON.stringify({ eventType: 'INSERT', schema: 'public', table: 'companies', new: live.row, old: {} })})`);
check('live insert appears without a reload', await st(page2, `(() => { const c = S.co.get('rlive1'); return !!c && c.assets.length === 2 && c.nextFU === '2026-10-20' && c.terr === 'ROA'; })()`));
await st(page2, `window.__rt(${JSON.stringify({ eventType: 'DELETE', schema: 'public', table: 'companies', new: {}, old: { id: 'rlive1' } })})`);
check('live delete disappears', await st(page2, `!S.co.has('rlive1')`));
await admin(`delete from companies where id = 'rlive1'`);

// --- a rep who was added by email signs in; a stranger does not get in
const pageB = await newPage(B);
await pageB.waitForFunction(() => typeof S !== 'undefined' && S.ready, null, { timeout: 10000 });
check('rep added by email is linked on first sign-in, not admin, sees the data', await st(pageB, `S.team[ME].name === 'Rep Bee' && CAP.isAdmin === false && S.co.size === 4`));
await st(pageB, `openRep(ME)`);
await pageB.fill('#f-name', 'Rep Bee Promoted'); await pageB.check('#f-admin');
await pageB.click('#dlg-submit');
check('a rep cannot edit team members or promote themselves', (await pageB.textContent('#dlg-msg')).includes('Only a CRM admin') && (await one(`select is_admin from team_members where id = $1`, [repB.id])).is_admin === false);
await st(pageB, `closeDialog(); Store.cfgPatch('team', ME, { admin: true }).then(() => 'sent', e => e.code)`);
check('a direct write to self-promote changes nothing in the database', (await one(`select is_admin from team_members where id = $1`, [repB.id])).is_admin === false);
await st(pageB, `openMe()`);
await pageB.fill('#f-name', 'Rebecca Bee');
await pageB.click('#dlg-submit');
await pageB.waitForFunction(() => S.team[ME].name === 'Rebecca Bee');
await st(pageB, `Store._chain`);
check('a rep can change their own name', (await one(`select name from team_members where id = $1`, [repB.id])).name === 'Rebecca Bee');
const pageC = await newPage(C);
await pageC.waitForSelector('.gate-card');
check('stranger with an account sees nothing', (await pageC.textContent('.gate-card')).includes('not on the team') && await st(pageC, `S.co.size === 0 && !S.ready`) && (await one(`select count(*)::int n from team_members`)).n === 3);

// --- restore from a backup into an emptied database
await queue(() => db.exec(`delete from companies; delete from contacts; delete from activities; delete from email_drafts; delete from territories where code <> 'NRV'; delete from team_members where user_id is null;`));
const page3 = await newPage(A);
await page3.waitForFunction(() => typeof S !== 'undefined' && S.ready && S.co.size === 0, null, { timeout: 10000 });
const DUMP_PATH = path.join(OUT, 'backup.json');
writeFileSync(DUMP_PATH, dump);
await page3.click('#tabs [data-tab="import"]');
await page3.setInputFiles('#backup-file', DUMP_PATH);
await page3.waitForFunction(() => /^Restored/.test(V.imp.restore || '') || /wasn't|isn't/.test(V.imp.restore || ''), null, { timeout: 15000 });
const restored = await one(`select (select count(*)::int from companies) co, (select count(*)::int from contacts) ct, (select count(*)::int from activities) ac, (select count(*)::int from email_drafts) dr, (select count(*)::int from territories) terr, (select count(*)::int from companies where assigned_rep_id is not null) with_rep`);
check('backup restore reloads every record', restored.co === before.co.length && restored.ct === before.ct.length && restored.ac === before.ac.length && restored.dr === before.dr.length && restored.terr === 7 && restored.with_rep >= 1, { restored, msg: await st(page3, `V.imp.restore`) });
await page3.setInputFiles('#backup-file', DUMP_PATH);
await page3.waitForTimeout(600);
check('restoring the same file twice adds nothing', (await one(`select count(*)::int n from companies`)).n === before.co.length);

// --- AI key missing: clear message
const page4 = await newPage(A, { aiNotConfigured: true });
await page4.waitForFunction(() => typeof S !== 'undefined' && S.ready, null, { timeout: 10000 });
await st(page4, `openCo([...S.co.values()].find(c => c.name.startsWith('Twin')).id)`);
await page4.click('.actions [data-act="dr-new"]');
await page4.click('#dlg-submit');
await page4.waitForFunction(() => { const m = document.querySelector('#dlg-msg'); return m && !m.hidden; });
check('missing AI key: says what to set', (await page4.textContent('#dlg-msg')).includes('ANTHROPIC_API_KEY'));

// --- phone layout
const phone = await newPage(A, { viewport: { width: 400, height: 800 }, signedOut: true });
await phone.waitForSelector('#web-auth');
check('phone: sign-in fits', await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

const expected = errors.filter(e => /^console: \{code: (not_configured|denied)/.test(e));
const real = errors.filter(e => !expected.includes(e));
console.log('\nERRORS:', real.length ? '\n' + real.join('\n') : 'none');
await browser.close();
process.exit(real.length ? 1 : 0);
