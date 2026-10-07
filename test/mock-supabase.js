// Browser-side stand-in for supabase-js used by test/run-web.mjs. Every query is turned
// into SQL and run by the test against an in-memory Postgres holding the real migration,
// as the signed-in user, so column names, types, constraints and row-level security are real.
(() => {
  const PK = { territories: 'code', settings: 'key' };
  const q = s => '"' + String(s).replace(/"/g, '') + '"';
  const sql = (text, params) => window.__sql(text, params || []);
  const rt = [];
  window.__rt = p => rt.forEach(h => h(p));
  window.__authLog = [];
  const authCbs = [];

  async function exec(st) {
    const t = 'public.' + q(st.table), pk = PK[st.table] || 'id';
    let res;
    if (st.op === 'select') {
      const range = st.range ? ` offset ${st.range[0]} limit ${st.range[1] - st.range[0] + 1}` : '';
      res = await sql(`select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) as r from (select * from ${t}${st.order ? ' order by ' + q(st.order) : ''}${range}) x`);
      return res.error ? { data: null, error: res.error } : { data: res.rows[0].r, error: null };
    }
    if (st.op === 'insert' || st.op === 'upsert') {
      const keys = Object.keys(st.rows[0]).sort();
      for (const r of st.rows) if (Object.keys(r).sort().join() !== keys.join()) return { data: null, error: { code: 'PGRST102', message: 'All object keys must match' } };
      const cols = keys.map(q).join(', ');
      let text = `insert into ${t} (${cols}) select ${cols} from jsonb_populate_recordset(null::${t}, $1::jsonb)`;
      if (st.op === 'upsert') text += ` on conflict (${q(st.onConflict || pk)}) do update set ${keys.filter(k => k !== (st.onConflict || pk)).map(k => q(k) + ' = excluded.' + q(k)).join(', ')}`;
      res = await sql(text, [JSON.stringify(st.rows)]);
    } else if (st.op === 'update') {
      const keys = Object.keys(st.rows[0]);
      const cols = keys.map(q).join(', ');
      const f = st.filters[0];
      res = await sql(`update ${t} set (${cols}) = (select ${cols} from jsonb_populate_record(null::${t}, $1::jsonb)) where ${q(f[0])} = $2`, [JSON.stringify(st.rows[0]), String(f[2])]);
    } else if (st.op === 'delete') {
      const f = st.filters[0];
      res = f[1] === 'in'
        ? await sql(`delete from ${t} where ${q(f[0])} in (select jsonb_array_elements_text($1::jsonb))`, [JSON.stringify(f[2])])
        : await sql(`delete from ${t} where ${q(f[0])} = $1`, [String(f[2])]);
    }
    return res.error ? { data: null, error: res.error } : { data: null, error: null };
  }
  function from(table) {
    const st = { table, op: 'select', filters: [], order: null, range: null, rows: null, onConflict: null };
    const b = {
      select() { return b; }, order(c) { st.order = c; return b; }, range(a, z) { st.range = [a, z]; return b; },
      insert(rows) { st.op = 'insert'; st.rows = Array.isArray(rows) ? rows : [rows]; return b; },
      upsert(rows, o) { st.op = 'upsert'; st.rows = Array.isArray(rows) ? rows : [rows]; st.onConflict = o && o.onConflict; return b; },
      update(row) { st.op = 'update'; st.rows = [row]; return b; },
      delete() { st.op = 'delete'; return b; },
      eq(c, v) { st.filters.push([c, '=', v]); return b; }, in(c, vs) { st.filters.push([c, 'in', vs]); return b; },
      then(res, rej) { return exec(st).then(res, rej); },
    };
    return b;
  }
  async function rpc(name, args) {
    let res;
    if (name === 'link_me') res = await sql('select public.link_me() as r');
    else if (name === 'is_member') res = await sql('select public.is_member() as r');
    else if (name === 'set_my_profile') res = await sql('select public.set_my_profile($1, $2) as r', [args.p_name, args.p_signature]);
    else if (name === 'my_calendar_token') res = await sql('select public.my_calendar_token($1) as r', [!!(args && args.p_reset)]);
    else return { data: null, error: { code: 'PGRST202', message: 'no function ' + name } };
    return res.error ? { data: null, error: res.error } : { data: res.rows[0].r, error: null };
  }
  const auth = {
    getSession: async () => ({ data: { session: window.__session || null }, error: null }),
    onAuthStateChange(cb) { authCbs.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    async signInWithPassword({ email, password }) {
      window.__authLog.push(['signin', email]);
      if (password !== 'correct-horse') return { data: {}, error: { message: 'Invalid login credentials' } };
      window.__session = Object.assign({}, window.__sessionOnLogin);
      authCbs.forEach(cb => cb('SIGNED_IN', window.__session));
      return { data: { session: window.__session }, error: null };
    },
    async signUp({ email }) { window.__authLog.push(['signup', email]); return { data: { session: null }, error: null }; },
    async resetPasswordForEmail(email) { window.__authLog.push(['reset', email]); return { data: {}, error: null }; },
    async updateUser(u) { window.__authLog.push(['update', Object.keys(u).join()]); return { data: {}, error: null }; },
    async signOut() { window.__session = null; return { error: null }; },
  };
  const client = {
    from, rpc, auth,
    channel() { const c = { on(_e, _f, h) { rt.push(h); return c; }, subscribe() { return c; } }; return c; },
  };
  window.supabase = { createClient: () => client };
})();
