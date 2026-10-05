/* ============================================================
   Storage for the website build: one row per record in Supabase (Postgres).
   Same surface as the Claude-hosted Store: init, add, addMany, patch, patchMany,
   remove, cfgPatch, and an onChange callback. The screens never see column names;
   the maps below translate between the app's short field names and the tables.
   ============================================================ */
const PLATFORM = 'web';

/* app field -> [column, type]. Types: text, ref (id of another row, '' <-> null), date, ts,
   tsd (timestamp that defaults to now), int, int0 (never null), num, bool, arr (text[]). */
const TABLES = {
  co: { table: 'companies', cols: {
    name: ['name', 'text'], terr: ['territory_code', 'text'], terrHow: ['territory_match', 'text'], addr: ['address', 'text'], city: ['city', 'text'], county: ['county', 'text'],
    state: ['state', 'text'], zip: ['zip', 'text'], web: ['website', 'text'], phone: ['main_phone', 'text'], industry: ['industry', 'text'], subIndustry: ['sub_industry', 'text'],
    source: ['lead_source', 'text'], leadType: ['lead_type', 'text'], priority: ['prospect_priority', 'text'], status: ['lead_status', 'text'], statusAt: ['lead_status_at', 'ts'],
    assets: ['asset_potential', 'arr'], rep: ['assigned_rep_id', 'ref'], lastContactBase: ['last_contact_base', 'date'], nextFU: ['next_follow_up', 'date'],
    lastMethodBase: ['last_contact_method_base', 'text'], attemptsBase: ['outreach_attempts_base', 'int0'], optOut: ['email_opt_out', 'bool'], dnc: ['do_not_call', 'bool'],
    notes: ['notes', 'text'], srcUrl: ['source_url', 'text'], dupOk: ['duplicate_ok_signature', 'text'], created: ['created_at', 'tsd'], updated: ['updated_at', 'tsd'] } },
  ct: { table: 'contacts', cols: {
    co: ['company_id', 'ref'], first: ['first_name', 'text'], last: ['last_name', 'text'], title: ['job_title', 'text'], dept: ['department', 'text'], email: ['email', 'text'],
    phone: ['phone', 'text'], mobile: ['mobile_phone', 'text'], role: ['contact_role', 'text'], primary: ['is_primary', 'bool'], optOut: ['email_opt_out', 'bool'], dnc: ['do_not_call', 'bool'],
    notes: ['notes', 'text'], nextFU: ['next_follow_up', 'date'], created: ['created_at', 'tsd'], updated: ['updated_at', 'tsd'] } },
  ac: { table: 'activities', cols: {
    co: ['company_id', 'ref'], ct: ['contact_id', 'ref'], type: ['activity_type', 'text'], at: ['occurred_at', 'tsd'], by: ['logged_by_id', 'ref'], outcome: ['outcome', 'text'],
    notes: ['notes', 'text'], nextFU: ['next_follow_up', 'date'], created: ['created_at', 'tsd'] } },
  tk: { table: 'tasks', cols: {
    name: ['name', 'text'], co: ['company_id', 'ref'], ct: ['contact_id', 'ref'], rep: ['assigned_to_id', 'ref'], due: ['due_date', 'date'], type: ['task_type', 'text'],
    priority: ['priority', 'text'], status: ['status', 'text'], notes: ['notes', 'text'], auto: ['auto_source', 'text'], doneAt: ['completed_at', 'ts'], created: ['created_at', 'tsd'] } },
  op: { table: 'opportunities', cols: {
    name: ['name', 'text'], co: ['company_id', 'ref'], ct: ['contact_id', 'ref'], rep: ['assigned_rep_id', 'ref'], category: ['equipment_category', 'text'], desc: ['equipment_description', 'text'],
    units: ['estimated_units', 'int'], value: ['estimated_value', 'num'], auctionDate: ['auction_date', 'date'], commission: ['commission_structure', 'text'], location: ['equipment_location', 'text'],
    stage: ['stage', 'text'], prob: ['probability', 'int'], closeDate: ['expected_close_date', 'date'], notes: ['notes', 'text'], created: ['created_at', 'tsd'], updated: ['updated_at', 'tsd'] } },
  dr: { table: 'email_drafts', cols: {
    co: ['company_id', 'ref'], ct: ['contact_id', 'ref'], to: ['to_email', 'text'], purpose: ['purpose', 'text'], subject: ['subject', 'text'], body: ['body', 'text'], extra: ['instructions', 'text'],
    by: ['drafted_by_id', 'ref'], gmailAt: ['gmail_at', 'ts'], gmailUrl: ['gmail_url', 'text'], created: ['created_at', 'tsd'] } },
};
const TERR_COLS = { name: ['name', 'text'], state: ['state', 'text'], owner: ['owner_id', 'ref'], active: ['active', 'bool'], notes: ['notes', 'text'], cities: ['cities', 'arr'], counties: ['counties', 'arr'], zips: ['zips', 'arr'] };
const TEAM_COLS = { name: ['name', 'text'], email: ['email', 'ref'], active: ['active', 'bool'], admin: ['is_admin', 'bool'], sig: ['signature', 'text'] };
const KIND_BY_TABLE = {};
for (const k in TABLES) KIND_BY_TABLE[TABLES[k].table] = k;

function toDb(type, v) {
  switch (type) {
    case 'text': return v == null ? '' : String(v);
    case 'ref': case 'date': return v == null || v === '' ? null : String(v);
    case 'ts': case 'tsd': { if (v == null || v === '') return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); }
    case 'int': { if (v == null || v === '') return null; const n = Math.round(Number(v)); return isFinite(n) ? n : null; }
    case 'int0': { const n = Math.round(Number(v)); return isFinite(n) ? n : 0; }
    case 'num': { if (v == null || v === '') return null; const n = Number(v); return isFinite(n) ? n : null; }
    case 'bool': return !!v;
    case 'arr': return Array.isArray(v) ? v.map(String) : [];
  }
  return v;
}
function fromDb(type, v) {
  switch (type) {
    case 'text': case 'ref': return v == null ? '' : String(v);
    case 'date': return v == null ? '' : String(v).slice(0, 10);
    case 'ts': case 'tsd': { if (v == null) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toISOString(); }
    case 'int': case 'num': return v == null ? null : Number(v);
    case 'int0': return Number(v) || 0;
    case 'bool': return !!v;
    case 'arr': return Array.isArray(v) ? v : (typeof v === 'string' ? parsePgArray(v) : []);
  }
  return v;
}
/* Postgres text form of an array ({a,"b c"}), in case a live update delivers one un-decoded. */
function parsePgArray(s) {
  const out = []; let cur = '', q = false, any = false;
  for (let i = 1; i < s.length - 1; i++) {
    const ch = s[i];
    if (q) { if (ch === '\\') cur += s[++i] || ''; else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') { q = true; any = true; }
    else if (ch === ',') { if (any || cur) out.push(cur); cur = ''; any = false; }
    else cur += ch;
  }
  if (any || cur) out.push(cur);
  return out;
}
/* full = every column present (needed for bulk inserts, where all rows must share the same keys). */
function toRowWith(cols, rec, full) {
  const row = {};
  for (const f in cols) {
    const [col, type] = cols[f];
    if (!full && !(f in rec)) continue;
    let v = toDb(type, rec[f]);
    if (type === 'tsd' && v == null) { if (!full) continue; v = new Date().toISOString(); }
    row[col] = v;
  }
  return row;
}
function fromRowWith(cols, row) {
  const rec = {};
  for (const f in cols) rec[f] = fromDb(cols[f][1], row[cols[f][0]]);
  return rec;
}
const recToRow = (k, rec, full) => { const row = toRowWith(TABLES[k].cols, rec, full); if (full || 'id' in rec) row.id = rec.id; return row; };
const rowToRec = (k, row) => Object.assign({ id: row.id }, fromRowWith(TABLES[k].cols, row));
const rowToTerr = row => Object.assign({ code: row.code }, fromRowWith(TERR_COLS, row));
const rowToTeam = row => Object.assign({ id: row.id, uid: row.user_id || '' }, fromRowWith(TEAM_COLS, row));

function dbError(error) {
  const pg = error && error.code, status = error && error.status;
  let code = 'unavailable';
  if (pg === '42501' || status === 401 || status === 403 || /row-level security/i.test((error && error.message) || '')) code = 'denied';
  else if (pg === '23505') code = 'conflict';
  else if (pg === '23503') code = 'missing_link';
  else if (pg && /^(22|23)/.test(pg)) code = 'invalid_argument';
  return { code, message: (error && error.message) || 'Database request failed', pg };
}

const Store = {
  client: null,
  _chain: Promise.resolve(),
  lastSync: 0,
  onChange: () => {},
  onError: () => {},

  async _all(table, orderBy) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.client.from(table).select('*').order(orderBy).range(from, from + 999);
      if (error) throw dbError(error);
      for (const row of data || []) out.push(row);
      if (!data || data.length < 1000) break;
    }
    return out;
  },
  async load() {
    const kinds = KINDS;
    const [team, terr, settings, ...rows] = await Promise.all([
      this._all('team_members', 'id'), this._all('territories', 'code'), this._all('settings', 'key'),
      ...kinds.map(k => this._all(TABLES[k].table, 'id')),
    ]);
    S.team = {}; for (const r of team) S.team[r.id] = rowToTeam(r);
    S.terr = {}; for (const r of terr) S.terr[r.code] = rowToTerr(r);
    const out = settings.find(r => r.key === 'outreach');
    S.outreach = out && out.value && typeof out.value === 'object' ? out.value : {};
    kinds.forEach((k, i) => { const m = new Map(); for (const r of rows[i]) m.set(r.id, rowToRec(k, r)); S[k] = m; S.loaded[k] = true; });
    S.loaded.cfg = true; S.cfgVer++; S.ver++; S.ready = true; S.dbState = 'ok';
    this.lastSync = Date.now();
  },
  async init(client) {
    this.client = client;
    await this.load();
    this.onChange(false);
    /* Live updates from other people. The app works without them; it reloads when the tab regains focus. */
    try {
      client.channel('crm-changes').on('postgres_changes', { event: '*', schema: 'public' }, p => this._remote(p)).subscribe();
    } catch (e) { console.warn('Live updates are off:', e); }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - this.lastSync > 120000) this._run(() => this.load()).then(() => this.onChange(false), () => {});
    });
  },
  _remote(p) {
    const type = p.eventType, row = type === 'DELETE' ? p.old : p.new;
    if (!row) return;
    const k = KIND_BY_TABLE[p.table];
    if (k) { if (type === 'DELETE') S[k].delete(row.id); else S[k].set(row.id, rowToRec(k, row)); }
    else if (p.table === 'territories') { if (type === 'DELETE') delete S.terr[row.code]; else S.terr[row.code] = rowToTerr(row); S.cfgVer++; }
    else if (p.table === 'team_members') { if (type === 'DELETE') delete S.team[row.id]; else S.team[row.id] = rowToTeam(row); S.cfgVer++; }
    else if (p.table === 'settings') { if (row.key === 'outreach' && type !== 'DELETE') S.outreach = row.value || {}; S.cfgVer++; }
    else return;
    S.ver++; this.onChange(false);
  },
  /* Every write goes through one queue, so a record always exists before something that points at it. */
  _run(fn) {
    const p = this._chain.then(fn, fn);
    this._chain = p.catch(() => {});
    return p;
  },
  async _exec(q) {
    let res;
    try { res = await q; } catch (e) { throw { code: 'unavailable', message: String(e && e.message || e) }; }
    if (res && res.error) throw dbError(res.error);
    return res ? res.data : null;
  },

  async addMany(k, recs, onProgress) {
    if (!recs.length) return;
    for (const r of recs) S[k].set(r.id, r);
    S.ver++; this.onChange(true);
    const t = TABLES[k].table;
    return this._run(async () => {
      for (let i = 0; i < recs.length; i += 500) {
        const chunk = recs.slice(i, i + 500);
        await this._exec(this.client.from(t).insert(chunk.map(r => recToRow(k, r, true))));
        if (onProgress) onProgress(Math.min(recs.length, i + 500), recs.length);
      }
    });
  },
  add(k, rec) { return this.addMany(k, [rec]); },

  async patchMany(k, list, onProgress) {
    const dels = [], ups = [];
    for (const [id, fields] of list) {
      const old = S[k].get(id);
      if (!old) continue;
      if (fields._del) { S[k].delete(id); dels.push(id); }
      else { const merged = Object.assign({}, old, fields); S[k].set(id, merged); ups.push([id, fields, merged]); }
    }
    S.ver++; this.onChange(true);
    if (!dels.length && !ups.length) return;
    const t = TABLES[k].table;
    return this._run(async () => {
      let done = 0;
      for (let i = 0; i < dels.length; i += 200) { await this._exec(this.client.from(t).delete().in('id', dels.slice(i, i + 200))); done += Math.min(200, dels.length - i); if (onProgress) onProgress(done, list.length); }
      if (ups.length > 20) {
        /* Bulk changes (imports, territory re-runs) write whole rows in a few requests. */
        for (let i = 0; i < ups.length; i += 500) {
          const chunk = ups.slice(i, i + 500);
          await this._exec(this.client.from(t).upsert(chunk.map(u => recToRow(k, u[2], true)), { onConflict: 'id' }));
          done += chunk.length; if (onProgress) onProgress(done, list.length);
        }
      } else {
        /* Ordinary edits send only the fields that changed, so two people editing one record don't overwrite each other. */
        for (const [id, fields] of ups) {
          const row = recToRow(k, fields, false); delete row.id;
          if (Object.keys(row).length) await this._exec(this.client.from(t).update(row).eq('id', id));
          done++; if (onProgress) onProgress(done, list.length);
        }
      }
    });
  },
  patch(k, id, fields) { return this.patchMany(k, [[id, fields]]); },
  remove(k, id) { return this.patch(k, id, { _del: true }); },

  /* Settings: territories, team members, outreach settings. */
  async cfgPatch(name, id, fields) {
    const c = this.client;
    if (name === 'territories') {
      if (fields._del) { delete S.terr[id]; } else S.terr[id] = Object.assign({ code: id }, S.terr[id] || {}, fields);
      S.cfgVer++; S.ver++; this.onChange(true);
      const merged = S.terr[id];
      return this._run(() => this._exec(fields._del ? c.from('territories').delete().eq('code', id) : c.from('territories').upsert(Object.assign({ code: id }, toRowWith(TERR_COLS, merged, true)), { onConflict: 'code' })));
    }
    if (name === 'team') {
      const existed = !!S.team[id];
      if (fields._del) delete S.team[id]; else S.team[id] = Object.assign({ id, uid: '' }, S.team[id] || {}, fields);
      S.cfgVer++; S.ver++; this.onChange(true);
      const merged = S.team[id];
      return this._run(() => {
        if (fields._del) return this._exec(c.from('team_members').delete().eq('id', id));
        const own = id === ME && !CAP.isAdmin && Object.keys(fields).every(f => f === 'name' || f === 'sig');
        if (own) return this._exec(c.rpc('set_my_profile', { p_name: merged.name || '', p_signature: merged.sig || '' }));
        if (existed) { const row = toRowWith(TEAM_COLS, fields, false); return Object.keys(row).length ? this._exec(c.from('team_members').update(row).eq('id', id)) : null; }
        return this._exec(c.from('team_members').insert(Object.assign({ id }, toRowWith(TEAM_COLS, Object.assign({ active: true }, merged), true))));
      });
    }
    S.outreach = Object.assign({}, S.outreach, { [id]: Object.assign({}, S.outreach[id] || {}, fields) });
    S.cfgVer++; S.ver++; this.onChange(true);
    const value = S.outreach;
    return this._run(() => this._exec(c.from('settings').upsert({ key: 'outreach', value }, { onConflict: 'key' })));
  },
};

/* Restore from a "Full backup (JSON)" exported by either build. Existing records are kept;
   only records whose ids are not already present are added. */
async function restoreBackup(dump, onProgress) {
  if (!dump || typeof dump !== 'object') throw { code: 'invalid_argument', message: 'Not a CRM backup file' };
  const added = { team: 0, territories: 0 };
  const idMap = {}, byName = {};
  for (const id in S.team) byName[(S.team[id].name || '').toLowerCase()] = id;
  for (const oldId in dump.team || {}) {
    const r = dump.team[oldId] || {};
    const hit = byName[(r.name || '').toLowerCase()];
    if (hit) idMap[oldId] = hit;
    else if (!S.team[oldId] && r.name) { await Store.cfgPatch('team', oldId, { name: cap(r.name, 60), active: r.active !== false }); byName[r.name.toLowerCase()] = oldId; added.team++; }
  }
  const rep = v => { const id = idMap[v] || v; return id && S.team[id] ? id : ''; };
  for (const code in dump.territories || {}) {
    if (S.terr[code]) continue;
    const t = dump.territories[code] || {};
    await Store.cfgPatch('territories', code, { name: t.name || code, state: t.state || '', owner: rep(t.owner), active: t.active !== false, notes: t.notes || '', cities: t.cities || [], counties: t.counties || [], zips: t.zips || [] });
    added.territories++;
  }
  const repField = { co: 'rep', ac: 'by', tk: 'rep', op: 'rep', dr: 'by' };
  for (const k of KINDS) {
    const list = [];
    for (const r0 of dump[KIND_LABEL[k]] || []) {
      if (!r0 || !r0.id || S[k].has(r0.id)) continue;
      const r = Object.assign({}, r0);
      if (repField[k]) r[repField[k]] = rep(r[repField[k]]);
      if (k !== 'co') { if (r.co && !S.co.has(r.co)) { if (k === 'ct' || k === 'dr') continue; r.co = ''; } }
      if (r.ct && !S.ct.has(r.ct)) r.ct = '';
      list.push(r);
    }
    added[KIND_LABEL[k]] = list.length;
    if (list.length) await Store.addMany(k, list);
    if (onProgress) onProgress(k);
  }
  return added;
}
