// End-to-end test of the website build (public/crm/index.html) against the real database
// schema running in an in-memory Postgres, with row-level security enforced.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { launch } from './browser.mjs';
import { makeDb } from './pg.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test', 'out');
mkdirSync(OUT, { recursive: true });
const html = readFileSync(path.join(ROOT, 'public', 'crm', 'index.html'), 'utf8')
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
await page.fill('#lk-q', 'Acme Excavating LLC');
await page.click('#lk-add');
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
await page.click('.bar [data-act="co-new"]');
await page.fill('#lk-q', 'Mary Whitfield');
await page.click('#lk-add-alt');
await page.waitForSelector('#f-first');
await page.fill('#f-mobile', '276-555-0190'); await page.fill('#f-email', 'mary@whitfield.example'); await page.fill('#f-city', 'Galax'); await page.fill('#f-state', 'VA');
await page.click('#dlg-submit');
await page.waitForFunction(() => [...S.ct.values()].some(x => x.email === 'mary@whitfield.example'));
await st(page, `Store._chain`);
const person = await one(`select c.name, c.industry, c.lead_status, c.territory_code, c.main_phone, (select count(*)::int from contacts k where k.company_id = c.id and k.is_primary and k.first_name = 'Mary' and k.email = 'mary@whitfield.example') cts from companies c where c.name = 'Mary Whitfield'`);
check('individual saved as a record plus its contact', person && person.industry === 'Individual / Family' && person.lead_status === 'New' && person.cts === 1 && !!person.territory_code, person);
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
check('reload returns the same records the screens were showing', diff.length === 0 && after.co.length === 5 && Object.keys(after.terr).length === 7 && after.out.main.gap === 5, diff.slice(0, 6));
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
check('rep added by email is linked on first sign-in, not admin, sees the data', await st(pageB, `S.team[ME].name === 'Rep Bee' && CAP.isAdmin === false && S.co.size === 5`));
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

// --- public pages: the consultation form, and what a visitor may and may not do
const anonSql = (sql, params) => queue(async () => {
  await db.query(`select set_config('request.jwt.claims', '', false)`);
  await db.exec('set role anon');
  try { return { rows: (await db.query(sql, params || [])).rows }; }
  catch (e) { return { error: { code: e.code, message: e.message } }; }
  finally { await db.exec('reset role'); }
});
check('visitor can send a lead', !(await anonSql(`insert into web_leads (name, phone, program) values ('Direct Test', '2765550001', 'Equipment')`)).error);
check('visitor cannot read leads', !!(await anonSql(`select * from web_leads`)).error);
check('visitor cannot read companies', !!(await anonSql(`select * from companies`)).error);
check('visitor cannot mark a lead handled', !!(await anonSql(`insert into web_leads (name, phone, status) values ('X', '2765550002', 'added')`)).error);
check('visitor cannot change or delete leads', !!(await anonSql(`update web_leads set name = 'Y'`)).error && !!(await anonSql(`delete from web_leads`)).error);
check('a lead needs a way to reach the person', !!(await anonSql(`insert into web_leads (name) values ('No Contact')`)).error);
check('a stranger with an account cannot read leads', ((await runAs(C)(`select count(*)::int n from web_leads`)).rows || [{ n: -1 }])[0].n === 0);

const PUB = path.join(ROOT, 'public');
const TYPES = { html: 'text/html', css: 'text/css', js: 'text/javascript', png: 'image/png', jpg: 'image/jpeg', woff2: 'font/woff2' };
const { existsSync } = await import('node:fs');
async function sitePage(viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('site pageerror: ' + e.message));
  p.__posts = []; p.__fail = false;
  await p.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (u.hostname === 'example.supabase.co') {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
      if (u.pathname !== '/rest/v1/web_leads' || req.method() !== 'POST') return route.fulfill({ status: 404, headers: cors, body: '' });
      const row = JSON.parse(req.postData() || '{}'), keys = Object.keys(row).map(k => '"' + k.replace(/"/g, '') + '"').join(', ');
      p.__posts.push({ row, headers: req.headers() });
      if (p.__fail) return route.fulfill({ status: 500, headers: cors, body: '' });
      const res = await anonSql(`insert into web_leads (${keys}) select ${keys} from jsonb_populate_record(null::web_leads, $1::jsonb)`, [JSON.stringify(row)]);
      return route.fulfill({ status: res.error ? 403 : 201, headers: cors, body: '' });
    }
    if (u.hostname !== 'site.test') return route.abort();
    if (u.pathname.startsWith('/crm')) return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>crm</title>' });
    let f = path.join(PUB, u.pathname === '/' ? 'index.html' : u.pathname);
    if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
    if (!existsSync(f)) return route.fulfill({ status: 404, body: 'not found' });
    let body = readFileSync(f);
    if (f.endsWith('.html')) body = body.toString('utf8').replace(/window\.__SITE__ = \{[^;]*\};/, 'window.__SITE__ = {"url":"https://example.supabase.co","key":"test-anon-key","phone":"(276) 235-0153"};');
    return route.fulfill({ status: 200, contentType: TYPES[f.split('.').pop()] || 'application/octet-stream', body });
  });
  return p;
}
const site = await sitePage();
await site.goto('https://site.test/');
check('front page: offer, four programs and the main-site button', (await site.textContent('.tell')).includes('free consultation') && await site.locator('.lots a').count() === 4 && await site.locator('a[href="https://www.matthewsauctioneers.com/"]').count() >= 2 && await site.locator('a[href^="tel:+1276"]').count() >= 2);
await site.click('.lots a[href="dealers"]');
await site.waitForURL('https://site.test/dealers');
check('program page: its own form with the program picked', await site.inputValue('.tell select[name=program]') === 'Dealer trade-ins' && await site.locator('.tell input[name=company]').count() === 1 && (await site.textContent('h1')).includes('trade-ins'));
await site.goto('https://site.test/dealers?src=main-site');
await site.click('.tell button[type=submit]');
check('form: asks for a name before sending', (await site.textContent('#tell-err')).includes('name') && site.__posts.length === 0);
await site.fill('.tell input[name=name]', 'Wade Turner');
await site.fill('.tell input[name=phone]', '12');
await site.click('.tell button[type=submit]');
check('form: asks for a real phone number', (await site.textContent('#tell-err')).includes('phone') && site.__posts.length === 0);
await site.fill('.tell input[name=phone]', '276-555-0142');
await site.fill('.tell input[name=company]', 'Turner Equipment Sales');
await site.fill('.tell textarea[name=details]', 'Six trade-in skid steers and a mini excavator.');
await site.waitForTimeout(1600);
await site.click('.tell button[type=submit]');
await site.waitForSelector('.tell.sent');
check('form: thanks the person and says what happens next', (await site.textContent('.tell')).includes('Thanks, Wade') && (await site.textContent('.tell')).includes('276-555-0142'));
const wade = await one(`select * from web_leads where name = 'Wade Turner'`);
check('form: lead saved with program, page and where they came from', wade && wade.company === 'Turner Equipment Sales' && wade.program === 'Dealer trade-ins' && wade.source === 'main-site' && wade.page === '/dealers' && wade.status === 'new' && wade.details.includes('skid steers'), wade);
check('form: sends the public key and nothing else', site.__posts[0].headers.apikey === 'test-anon-key' && !site.__posts[0].headers.authorization);
await site.goto('https://site.test/equipment');
site.__fail = true;
await site.fill('.tell input[name=name]', 'Chip Test'); await site.fill('.tell input[name=phone]', '2765550145'); await site.fill('.tell input[name=zip]', '24333');
await site.check('.tell input[name=has][value="Excavator"]'); await site.check('.tell input[name=has][value="Trailer"]');
await site.fill('.tell textarea[name=details]', '2015 model, 4,200 hours');
await site.waitForTimeout(1600);
await site.click('.tell button[type=submit]');
await site.waitForFunction(() => !document.querySelector('#tell-err').hidden);
const chip = site.__posts[site.__posts.length - 1].row;
check('equipment page: tapped choices, ZIP and details are sent together', chip.program === 'Equipment' && chip.zip === '24333' && chip.details === 'Has: Excavator, Trailer.\n2015 model, 4,200 hours' && chip.page === '/equipment' && await site.locator('.tell select').count() === 0, chip);
check('equipment page: a visitor may fill in the ZIP column', !(await anonSql(`insert into web_leads (name, phone, zip, details) values ('Zip Probe', '2765550146', '24333', 'Has: Dozer.')`)).error);
await admin(`delete from web_leads where name = 'Zip Probe'`);
check('equipment page: questions, who it is for and a closing call to action', await site.locator('.faq details').count() >= 3 && await site.locator('.fit-list li').count() === 4 && await site.locator('.cta a[href="#tell"]').count() === 1);
check('equipment page: real sale results at the top and in the cards, no sample placeholders', await site.locator('.tape li').count() === 4 && (await site.textContent('.hero-photo figcaption')).includes('$45,000') && await site.locator('.sold-list li').count() === 3 && await site.locator('.sold-list img').count() === 3 && !(await site.textContent('main')).includes('Sample') && await site.evaluate(() => [...document.querySelectorAll('.hero-photo img, .sold-list img')].every(i => !i.complete || i.naturalWidth > 0)));
check('equipment page is a funnel: no menu, no way out at the top, one quiet link at the bottom', await site.locator('.top-nav').count() === 0 && await site.locator('.top a[href^="http"]').count() === 0 && await site.locator('.top a[href="#tell"]').count() === 1 && await site.locator('.top a[href^="tel:"]').count() === 1 && await site.locator('.buy').count() === 0 && await site.locator('.more').count() === 0 && await site.locator('.foot a[href="https://www.matthewsauctioneers.com/"]').count() === 1);
check('equipment page: each fact is stated once', (await site.textContent('main')).split('EquipmentFacts.com').length === 2 && await site.locator('.facts li').count() === 3 && await site.locator('.reach').count() === 0 && (await site.textContent('.tell button[type=submit]')).trim() === 'Get my free consultation');
site.__fail = false;
await site.goto('https://site.test/estates');
check('where they came from is kept across pages', await site.evaluate(() => sessionStorage.getItem('swm-src')) === 'main-site');
site.__fail = true;
await site.fill('.tell input[name=name]', 'Fail Case'); await site.fill('.tell input[name=phone]', '2765550143');
await site.waitForTimeout(1600);
await site.click('.tell button[type=submit]');
await site.waitForFunction(() => !document.querySelector('#tell-err').hidden);
check('form: a failed send says so and gives the phone number', (await site.textContent('#tell-err')).includes('(276) 235-0153') && await site.locator('.tell input[name=name]').count() === 1 && await site.isEnabled('.tell button[type=submit]'));
site.__fail = false;
const before2 = site.__posts.length;
await site.goto('https://site.test/');
await site.fill('.tell input[name=name]', 'Spam Bot'); await site.fill('.tell input[name=phone]', '2765550144');
await site.evaluate(() => { document.querySelector('.tell input[name=website]').value = 'http://spam.example'; });
await site.waitForTimeout(1600);
await site.click('.tell button[type=submit]');
await site.waitForSelector('.tell.sent');
check('form: a filled trap field sends nothing', site.__posts.length === before2 && (await one(`select count(*)::int n from web_leads where name = 'Spam Bot'`)).n === 0);
await site.goto('about:blank');
await site.goto('https://site.test/#access_token=abc&type=recovery');
await site.waitForURL(/\/crm\//);
check('team email links that land on the front page are passed to the CRM', site.url() === 'https://site.test/crm/#access_token=abc&type=recovery');
const sphone = await sitePage({ width: 390, height: 800 });
for (const pg of ['', 'equipment', 'dealers', 'estates', 'real-estate']) {
  await sphone.goto('https://site.test/' + pg);
  check('public phone layout fits: ' + (pg || 'front page'), await sphone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) && await sphone.locator('.callbar').isVisible());
}

// --- the CRM side: the inbox, the live alert, adding and dismissing
const page5 = await newPage(A);
await page5.waitForFunction(() => typeof S !== 'undefined' && S.ready, null, { timeout: 10000 });
await page5.waitForSelector('#leads-panel');
check('CRM: waiting web leads show on the dashboard with a count', (await page5.textContent('#leads-panel')).includes('Wade Turner') && (await page5.textContent('#leads-panel')).includes('Direct Test') && await page5.textContent('#lead-badge') === '2');
await anonSql(`insert into web_leads (name, phone, program, details, source, page) values ('Nora Fields', '3365550170', 'Estate', 'My mother''s farmhouse and its contents.', 'Direct', '/estates')`);
const nora = await one(`select * from web_leads where name = 'Nora Fields'`);
await st(page5, `window.__rt(${JSON.stringify({ eventType: 'INSERT', schema: 'public', table: 'web_leads', new: nora, old: {} })})`);
await page5.waitForFunction(() => document.querySelector('#lead-badge').textContent === '3');
check('CRM: a new lead alerts whoever is signed in', (await page5.textContent('#toasts')).includes('New from the website: Nora Fields'));
await page5.click(`#leads-panel [data-act="lead-open"][data-id="${wade.id}"] >> nth=0`);
await page5.waitForSelector('#lead-add');
check('CRM: the lead shows what they sent', (await page5.textContent('#dlg')).includes('Six trade-in skid steers') && (await page5.textContent('#dlg')).includes('main-site') && (await page5.textContent('#lead-add')).includes('a company'));
await page5.screenshot({ path: path.join(OUT, 'web-lead.png') });
await page5.click('#lead-add');
await page5.waitForSelector('.detail-head');
await st(page5, `Store._chain`);
await page5.waitForFunction(() => document.querySelector('#lead-badge').textContent === '2');
const tid = (await one(`select id from team_members where user_id = $1`, [A.id])).id;
const added = await one(`select c.id, c.name, c.lead_source, c.lead_status, c.assigned_rep_id,
  (select count(*)::int from contacts k where k.company_id = c.id and k.first_name = 'Wade' and k.last_name = 'Turner' and k.mobile_phone = '276-555-0142' and k.is_primary) ct,
  (select count(*)::int from activities a where a.company_id = c.id and a.activity_type = 'Note' and a.notes like '%Six trade-in skid steers%') notes,
  (select count(*)::int from tasks t where t.company_id = c.id and t.name like 'Call back Wade Turner%' and t.due_date = current_date and t.priority = 'High' and t.assigned_to_id = $1) tasks
  from companies c where c.name = 'Turner Equipment Sales'`, [tid]);
const wade2 = await one(`select status, company_id, handled_by_id, handled_at from web_leads where name = 'Wade Turner'`);
check('CRM: adding a lead creates the company, contact, note and a call-back task for today', added && added.lead_source === 'Website: main-site' && added.lead_status === 'New' && added.assigned_rep_id === tid && added.ct === 1 && added.notes === 1 && added.tasks === 1, added);
check('CRM: the lead is marked handled and tied to the record', wade2.status === 'added' && wade2.company_id === added.id && wade2.handled_by_id === tid && !!wade2.handled_at, wade2);
check('CRM: lands on the new page', (await page5.textContent('.detail-head h1')).includes('Turner Equipment Sales'));
await page5.click('#tabs [data-tab="dashboard"]');
await page5.click(`#leads-panel [data-act="lead-open"][data-id="${nora.id}"] >> nth=0`);
await page5.waitForSelector('#lead-add');
check('CRM: a lead with no company is offered as an individual', (await page5.textContent('#lead-add')).includes('an individual'));
await page5.click('#lead-add');
await page5.waitForSelector('.detail-head');
await st(page5, `Store._chain`);
const noraCo = await one(`select industry, lines, lead_type from companies where name = 'Nora Fields'`);
check('CRM: an estate lead becomes an individual on the Estate line', noraCo && noraCo.industry === 'Individual / Family' && JSON.stringify(noraCo.lines) === '["Estate"]' && noraCo.lead_type === 'Estate', noraCo);
await anonSql(`insert into web_leads (name, phone, program) values ('Tom Hale', '540-555-0199', 'Equipment')`);
const tom = await one(`select * from web_leads where name = 'Tom Hale'`);
await st(page5, `window.__rt(${JSON.stringify({ eventType: 'INSERT', schema: 'public', table: 'web_leads', new: tom, old: {} })})`);
const brg = await one(`select c.id, (select count(*)::int from contacts k where k.company_id = c.id) ct from companies c where c.name like 'Blue Ridge Grading%' order by c.created_at limit 1`);
await st(page5, `openLead(${JSON.stringify(tom.id)})`);
await page5.waitForSelector('#lead-matches');
check('CRM: a lead from someone already in the CRM shows the match', (await page5.textContent('#lead-matches')).includes('Blue Ridge Grading'));
await page5.click(`#lead-matches [data-act="lead-add"][data-co="${brg.id}"]`);
await page5.waitForSelector('.detail-head');
await st(page5, `Store._chain`);
const brg2 = await one(`select (select count(*)::int from contacts k where k.company_id = $1) ct, (select count(*)::int from companies where name = 'Tom Hale') dup, (select count(*)::int from tasks t where t.company_id = $1 and t.name like 'Call back Tom Hale%') tasks, (select company_id from web_leads where name = 'Tom Hale') lead_co`, [brg.id]);
check('CRM: adding to an existing record makes no duplicate company or contact', brg2.ct === brg.ct && brg2.dup === 0 && brg2.tasks === 1 && brg2.lead_co === brg.id, brg2);
const direct = await one(`select id from web_leads where name = 'Direct Test'`);
await st(page5, `openLead(${JSON.stringify(direct.id)})`);
await page5.click('[data-act="lead-dismiss"]');
await page5.click('[data-act="lead-dismiss"]');
await page5.waitForFunction(() => document.querySelector('#lead-badge').hidden);
check('CRM: a dismissed lead leaves the inbox and is kept in the database', (await one(`select status from web_leads where name = 'Direct Test'`)).status === 'dismissed' && await st(page5, `newLeads().length`) === 0);

const expected = errors.filter(e => /^console: \{code: (not_configured|denied)/.test(e));
const real = errors.filter(e => !expected.includes(e));
console.log('\nERRORS:', real.length ? '\n' + real.join('\n') : 'none');
await browser.close();
process.exit(real.length ? 1 : 0);
