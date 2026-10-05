'use strict';
/* ============================================================
   Matthews Consignment CRM — options, helpers, storage, territory matching
   ============================================================ */

const INDUSTRIES = ['Excavation', 'Site Development', 'Grading', 'Heavy Civil Construction', 'General Construction', 'Paving', 'Utilities', 'Demolition', 'Trucking', 'Freight', 'Warehousing', 'Distribution', 'Logistics', 'Manufacturing', 'Agriculture', 'Forestry', 'Municipal / Government', 'Rental', 'Fleet Services', 'Truck Leasing', 'Industrial', 'Other'];
const CONSTRUCTION = ['Excavation', 'Site Development', 'Grading', 'Heavy Civil Construction', 'General Construction', 'Paving', 'Utilities'];
const PRIORITIES = ['A+', 'A', 'B+', 'B', 'C', 'Unqualified'];
const PRIORITY_HELP = { 'A+': 'Exceptional prospect / highly equipment intensive', 'A': 'Strong prospect', 'B+': 'Good prospect', 'B': 'Worth qualifying', 'C': 'Low priority', 'Unqualified': 'Unqualified' };
const STATUSES = ['New', 'Researching', 'Ready for Outreach', 'Email Sent', 'Called', 'Voicemail Left', 'Contacted', 'Correct Contact Found', 'Follow-Up Needed', 'Interested', 'Has Equipment', 'Consignment Opportunity', 'Consignor', 'Future Opportunity / Nurture', 'Not Interested', 'Do Not Contact'];
const STATUS_GROUP = { 'New': 'early', 'Researching': 'early', 'Ready for Outreach': 'early', 'Email Sent': 'out', 'Called': 'out', 'Voicemail Left': 'out', 'Contacted': 'out', 'Correct Contact Found': 'out', 'Follow-Up Needed': 'warn', 'Interested': 'hot', 'Has Equipment': 'hot', 'Consignment Opportunity': 'hot', 'Consignor': 'won', 'Future Opportunity / Nurture': 'warn', 'Not Interested': 'dead', 'Do Not Contact': 'stop' };
const EARLY_STATUSES = ['New', 'Researching', 'Ready for Outreach', 'Email Sent', 'Called', 'Voicemail Left'];
const DEAD_STATUSES = ['Not Interested', 'Do Not Contact'];
const ASSETS = ['Heavy Equipment', 'Construction Equipment', 'Trucks', 'Trailers', 'Fleet Vehicles', 'Farm Equipment', 'Forklifts / Material Handling', 'Industrial Equipment', 'Forestry Equipment', 'Paving Equipment', 'Shop Equipment', 'Attachments', 'Other'];
const ROLES = ['Owner', 'President', 'Fleet Manager', 'Equipment Manager', 'Operations Manager', 'Surplus Asset Manager', 'Asset Disposal', 'Purchasing', 'Procurement', 'Transportation Manager', 'Terminal Manager', 'Shop Manager', 'Warehouse Manager', 'General Manager', 'Office Manager', 'Other'];
const ACT_TYPES = ['Email Sent', 'Email Received', 'Phone Call', 'Voicemail', 'Text Message', 'Meeting', 'Site Visit', 'Note', 'Follow-Up', 'Equipment Discussion', 'Consignment Discussion'];
/* What logging each activity type does to the company record. */
const ACT_META = {
  'Email Sent': { method: 'Email', attempt: true, contact: true, status: 'Email Sent' },
  'Email Received': { method: 'Email', contact: true, status: 'Contacted' },
  'Phone Call': { method: 'Phone', attempt: true, contact: true, status: 'Called' },
  'Voicemail': { method: 'Phone', attempt: true, contact: true, status: 'Voicemail Left' },
  'Text Message': { method: 'Text', attempt: true, contact: true },
  'Meeting': { method: 'Meeting', contact: true, status: 'Contacted' },
  'Site Visit': { method: 'Site Visit', contact: true, status: 'Contacted' },
  'Note': {},
  'Follow-Up': {},
  'Equipment Discussion': { method: 'Conversation', contact: true },
  'Consignment Discussion': { method: 'Conversation', contact: true },
};
const OUTCOMES = ['Connected', 'No answer', 'Left voicemail', 'Sent', 'Replied', 'Gatekeeper', 'Wrong contact', 'Correct contact found', 'Call back later', 'Interested', 'Has equipment', 'Not interested'];
const TASK_TYPES = ['Call', 'Email', 'Follow-Up', 'Research', 'Site Visit', 'Equipment Review', 'Consignment Follow-Up', 'Appointment'];
const TASK_STATUS = ['Open', 'Completed', 'Snoozed', 'Cancelled'];
const TASK_PRI = ['High', 'Normal', 'Low'];
const STAGES = ['Identified', 'Initial Discussion', 'Equipment Confirmed', 'Photos / Details Requested', 'Valuation / Review', 'Terms Discussed', 'Consignment Agreed', 'Scheduled for Auction', 'Sold', 'No Sale', 'Lost', 'Future Opportunity'];
const STAGE_PROB = { 'Identified': 10, 'Initial Discussion': 20, 'Equipment Confirmed': 35, 'Photos / Details Requested': 45, 'Valuation / Review': 55, 'Terms Discussed': 70, 'Consignment Agreed': 90, 'Scheduled for Auction': 95, 'Sold': 100, 'No Sale': 0, 'Lost': 0, 'Future Opportunity': 5 };
const CLOSED_STAGES = ['Sold', 'No Sale', 'Lost', 'Future Opportunity'];
const isOpenStage = s => !CLOSED_STAGES.includes(s);
const UNASSIGNED = 'UNASSIGNED';
const DORMANT_DAYS = 60;

const US_STATES = { alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY' };
const STATE_CODES = new Set(Object.values(US_STATES));

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => {
  const a = new Uint8Array(10);
  crypto.getRandomValues(a);
  return 'r' + Array.from(a, b => (b % 36).toString(36)).join('');
};
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const cap = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n) : s; };

/* ---------- dates (date-only values are local 'YYYY-MM-DD' strings) ---------- */
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const today = () => ymd(new Date());
const parseYmd = s => { const p = String(s).slice(0, 10).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const addBizDays = (s, n) => { const d = parseYmd(s); while (n > 0) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) n--; } return ymd(d); };
const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const weekEnd = () => addDays(weekStart(), 6);
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
const isoToYmd = iso => { const d = new Date(iso); return isNaN(d) ? '' : ymd(d); };
const nowIso = () => new Date().toISOString();
function fmtDate(s) {
  if (!s) return '';
  const d = parseYmd(s);
  if (isNaN(d)) return '';
  const o = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
  return d.toLocaleDateString(undefined, o);
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return fmtDate(ymd(d)) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function dueLabel(s) {
  if (!s) return '';
  const n = daysBetween(today(), s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return '1 day overdue';
  if (n < 0) return (-n) + ' days overdue';
  if (n < 7) return 'In ' + n + ' days';
  return fmtDate(s);
}
/* Accepts 2026-10-05, 10/5/2026, 10/5/26, Oct 5 2026, and Excel-formatted dates. */
function toYmd(v) {
  let s = clean(v);
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})/);
  if (m) { let y = +m[3]; if (y < 100) y += y < 70 ? 2000 : 1900; return y + '-' + pad2(m[1]) + '-' + pad2(m[2]); }
  const d = new Date(s);
  return isNaN(d) ? '' : ymd(d);
}
const localInputNow = () => { const d = new Date(); return ymd(d) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

/* ---------- normalizers used for matching ---------- */
function normState(s) {
  s = clean(s);
  if (!s) return '';
  const u = s.toUpperCase().replace(/\./g, '');
  if (STATE_CODES.has(u)) return u;
  return US_STATES[s.toLowerCase().replace(/\./g, '')] || '';
}
const normName = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\b(inc|incorporated|llc|l l c|co|corp|corporation|company|ltd|limited|lp|llp|pllc|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
const normCity = s => String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\bmt\b/g, 'mount').replace(/\bst\b/g, 'saint').replace(/\bft\b/g, 'fort').replace(/\s+/g, ' ').trim();
const normCounty = s => normCity(String(s || '').replace(/\b(county|co\.?)\s*$/i, ''));
const GENERIC_DOMAINS = new Set(['facebook.com', 'linkedin.com', 'instagram.com', 'google.com', 'yelp.com', 'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com', 'msn.com', 'live.com', 'comcast.net', 'bbb.org', 'mapquest.com', 'yellowpages.com', 'x.com', 'twitter.com', 'youtube.com', 'wixsite.com', 'business.site', 'godaddysites.com', 'manta.com', 'dnb.com', 'buzzfile.com']);
function domainOf(url) {
  let s = clean(url).toLowerCase();
  if (!s) return '';
  if (s.includes('@')) s = s.split('@').pop();
  s = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[\/?#:\s]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : '';
}
const matchDomain = url => { const d = domainOf(url); return d && !GENERIC_DOMAINS.has(d) ? d : ''; };
function normPhone(s) {
  const d = String(s || '').split(/x|ext/i)[0].replace(/\D/g, '');
  const t = d.length === 11 && d[0] === '1' ? d.slice(1) : d;
  return t.length === 10 ? t : '';
}
function fmtPhone(s) {
  const p = normPhone(s);
  if (!p) return clean(s);
  const ext = String(s).match(/(?:x|ext\.?)\s*(\d+)/i);
  return '(' + p.slice(0, 3) + ') ' + p.slice(3, 6) + '-' + p.slice(6) + (ext ? ' x' + ext[1] : '');
}
const zip5 = s => (String(s || '').match(/\d{5}/) || [''])[0];
function safeUrl(u) {
  u = clean(u);
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) { if (/^[a-z]+:/i.test(u)) return ''; u = 'https://' + u; }
  try { const x = new URL(u); return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : ''; } catch (e) { return ''; }
}
const truthy = v => /^(y|yes|true|1|x|checked|opt.?out|unsubscribed|dnc)$/i.test(clean(v));

/* ============================================================
   In-memory state shared by every screen. The Store that fills it lives in
   store-claude.js (Claude-hosted build) or store-web.js (Supabase build).
   ============================================================ */
const KINDS = ['co', 'ct', 'ac', 'tk', 'op', 'dr'];
const KIND_LABEL = { co: 'companies', ct: 'contacts', ac: 'activities', tk: 'tasks', op: 'opportunities', dr: 'emailDrafts' };

const S = {
  co: new Map(), ct: new Map(), ac: new Map(), tk: new Map(), op: new Map(), dr: new Map(),
  terr: {}, team: {}, outreach: {},
  loaded: {}, ready: false, ver: 0, cfgVer: 0, dbState: 'connecting',
};
/* ============================================================
   Territory assignment — one table, matched ZIP → city+state → county+state.
   ============================================================ */
let _terrIx = null, _terrIxVer = -1;
function parsePlace(s, fallbackState) {
  s = clean(s);
  if (!s) return null;
  const i = s.lastIndexOf(',');
  let name = s, st = '';
  if (i > 0) { name = s.slice(0, i); st = normState(s.slice(i + 1)); }
  if (!st) st = normState(fallbackState);
  return st ? { name, st } : null;
}
function terrIndex() {
  if (_terrIx && _terrIxVer === S.cfgVer) return _terrIx;
  const ix = { zips: new Map(), cities: new Map(), counties: new Map() };
  const put = (m, key, code) => { if (!m.has(key)) m.set(key, new Set()); m.get(key).add(code); };
  for (const code in S.terr) {
    const t = S.terr[code];
    if (t.active === false) continue;
    for (const z of t.zips || []) { const z5 = zip5(z); if (z5) put(ix.zips, z5, code); }
    for (const c of t.cities || []) { const p = parsePlace(c, t.state); if (p) put(ix.cities, normCity(p.name) + '|' + p.st, code); }
    for (const c of t.counties || []) { const p = parsePlace(c, t.state); if (p) put(ix.counties, normCounty(p.name) + '|' + p.st, code); }
  }
  _terrIx = ix; _terrIxVer = S.cfgVer;
  return ix;
}
function assignTerritory(c) {
  const ix = terrIndex();
  const one = set => (set && set.size === 1) ? [...set][0] : null;
  const z = zip5(c.zip);
  if (z) { const p = one(ix.zips.get(z)); if (p) return { code: p, how: 'ZIP' }; }
  const st = normState(c.state);
  if (st) {
    if (clean(c.city)) { const p = one(ix.cities.get(normCity(c.city) + '|' + st)); if (p) return { code: p, how: 'City' }; }
    if (clean(c.county)) { const p = one(ix.counties.get(normCounty(c.county) + '|' + st)); if (p) return { code: p, how: 'County' }; }
  }
  return { code: UNASSIGNED, how: (!st && (clean(c.city) || clean(c.county))) ? 'State missing' : 'No match' };
}
const terrName = code => code === UNASSIGNED ? 'Unassigned' : ((S.terr[code] && S.terr[code].name) || code || '');
const terrCodes = (activeOnly) => Object.keys(S.terr).filter(c => !activeOnly || S.terr[c].active !== false).sort();
const repName = id => (id && S.team[id] && S.team[id].name) || '';
const repList = (activeOnly) => Object.keys(S.team).filter(id => !activeOnly || S.team[id].active !== false)
  .sort((a, b) => S.team[a].name.localeCompare(S.team[b].name));

/* ============================================================
   Derived data — rebuilt once per data change, read by every screen.
   Last contact, contact method and outreach attempts are computed from
   the activity log (plus any imported starting values), so they can't drift.
   ============================================================ */
const D = { ver: -1 };
function derive() {
  if (D.ver === S.ver) return D;
  const actByCo = new Map(), actByCt = new Map(), stats = new Map();
  for (const a of S.ac.values()) {
    if (a.co) { if (!actByCo.has(a.co)) actByCo.set(a.co, []); actByCo.get(a.co).push(a); }
    if (a.ct) { if (!actByCt.has(a.ct)) actByCt.set(a.ct, []); actByCt.get(a.ct).push(a); }
    const m = ACT_META[a.type] || {};
    if (a.co && (m.contact || m.attempt)) {
      let st = stats.get(a.co);
      if (!st) { st = { last: '', lastAt: '', method: '', attempts: 0 }; stats.set(a.co, st); }
      if (m.attempt) st.attempts++;
      const stamp = a.at + '|' + (a.created || '');
      if (m.contact && stamp > st.lastAt) { st.lastAt = stamp; st.last = isoToYmd(a.at); st.method = m.method || ''; }
    }
  }
  const byAt = (x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0);
  for (const l of actByCo.values()) l.sort(byAt);
  for (const l of actByCt.values()) l.sort(byAt);
  const group = (map, key) => { const out = new Map(); for (const r of map.values()) { const v = r[key]; if (!v) continue; if (!out.has(v)) out.set(v, []); out.get(v).push(r); } return out; };
  D.actByCo = actByCo; D.actByCt = actByCt; D.stats = stats;
  D.ctByCo = group(S.ct, 'co'); D.tkByCo = group(S.tk, 'co'); D.opByCo = group(S.op, 'co');
  D.dups = findDuplicates();
  D.dupIds = new Set(); for (const g of D.dups) for (const id of g.ids) D.dupIds.add(id);
  D.ver = S.ver;
  return D;
}
function coInfo(c) {
  const st = derive().stats.get(c.id);
  const base = c.lastContactBase || '';
  let last = base, method = c.lastMethodBase || '';
  if (st && st.last && st.last >= base) { last = st.last; method = st.method; }
  return { last, method, attempts: (Number(c.attemptsBase) || 0) + (st ? st.attempts : 0) };
}
const isDormant = (c, info) => !!info.last && daysBetween(info.last, today()) > DORMANT_DAYS && !DEAD_STATUSES.includes(c.status);
function primaryContact(coId) {
  const l = derive().ctByCo.get(coId) || [];
  return l.find(x => x.primary) || l[0] || null;
}
const ctName = c => c ? (clean((c.first || '') + ' ' + (c.last || '')) || c.email || '(No name)') : '';
const coName = id => { const c = S.co.get(id); return c ? c.name : ''; };

/* Likely duplicates: same normalized name in the same state, same website, or same phone. */
function findDuplicates() {
  const parent = new Map();
  const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a, b); };
  const keys = new Map(), why = new Map();
  const note = (key, id, label) => {
    if (keys.has(key)) { const other = keys.get(key); union(id, other); why.set(id, label); if (!why.has(other)) why.set(other, label); }
    else keys.set(key, id);
  };
  for (const c of S.co.values()) parent.set(c.id, c.id);
  for (const c of S.co.values()) {
    const n = normName(c.name);
    if (n.length >= 3) note('n:' + n + '|' + normState(c.state), c.id, 'Same name');
    const d = matchDomain(c.web); if (d) note('d:' + d, c.id, 'Same website');
    const p = normPhone(c.phone); if (p) note('p:' + p, c.id, 'Same phone');
  }
  const groups = new Map();
  for (const id of parent.keys()) { const r = find(id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(id); }
  const out = [];
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    ids.sort();
    const sig = ids.join('+');
    if (ids.every(id => S.co.get(id).dupOk === sig)) continue;
    out.push({ ids, sig, why: [...new Set(ids.map(id => why.get(id)).filter(Boolean))].join(', ') });
  }
  return out;
}

/* ---------- CSV ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = (first.split('\t').length > first.split(',').length) ? '\t' : ((first.split(';').length > first.split(',').length) ? ';' : ',');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = ''; rows.push(row); row = [];
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => clean(c) !== ''));
}
function toCSV(header, rows) {
  const cell = v => { v = v == null ? '' : String(v); if (/^(=|@|\t|\r|[+\-](?![\d\s(.]))/.test(v)) v = "'" + v; return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return '﻿' + [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
