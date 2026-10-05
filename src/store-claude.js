/* ============================================================
   Storage for the Claude-hosted build. Records live in "block" documents
   ({items: {id: record}}) so a prospect list of several thousand companies is a
   few dozen documents, a bulk import is a handful of writes, and edits merge
   field by field.
   ============================================================ */
const PLATFORM = 'claude';
const MAX_N = 80, MAX_B = 100000;
const Store = {
  db: null,
  where: { co: new Map(), ct: new Map(), ac: new Map(), tk: new Map(), op: new Map(), dr: new Map() },
  blocks: { co: {}, ct: {}, ac: {}, tk: {}, op: {}, dr: {} },
  cfgExists: {},
  _q: new Map(),
  _sizes: new WeakMap(),
  onChange: () => {},
  onError: () => {},

  init(db) {
    this.db = db;
    for (const k of KINDS) {
      db.collection(k).limit(1000).onSnapshot(snap => this._onKind(k, snap), e => this._subError(e));
    }
    db.collection('cfg').limit(50).onSnapshot(snap => this._onCfg(snap), e => this._subError(e));
    /* If a live subscription is slow to deliver its first snapshot, read that collection once. */
    setTimeout(() => {
      for (const k of KINDS) if (!S.loaded[k]) db.collection(k).limit(1000).get().then(snap => { if (!S.loaded[k]) this._onKind(k, snap); }, () => {});
      if (!S.loaded.cfg) db.collection('cfg').limit(50).get().then(snap => { if (!S.loaded.cfg) this._onCfg(snap); }, () => {});
    }, 7000);
  },
  _subError(e) { S.dbState = (e && e.code === 'revoked') ? 'revoked' : 'error'; this.onChange(); },
  _onKind(k, snap) {
    const map = new Map(), where = new Map(), blocks = {};
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const items = data.items || {};
      let info = this._sizes.get(data);
      if (!info) {
        let n = 0;
        for (const id in items) { const r = items[id]; if (r && !r._del) n++; }
        info = { n, bytes: JSON.stringify(items).length };
        this._sizes.set(data, info);
      }
      blocks[doc.id] = { n: info.n, bytes: info.bytes };
      for (const id in items) {
        const r = items[id];
        if (!r || r._del) continue;
        map.set(id, r); where.set(id, doc.id);
      }
    }
    S[k] = map; this.where[k] = where; this.blocks[k] = blocks;
    S.loaded[k] = true; this._bump();
  },
  _onCfg(snap) {
    const exists = {};
    let terr = {}, team = {}, outreach = {};
    for (const doc of snap.docs) {
      exists[doc.id] = true;
      const items = (doc.data() || {}).items || {};
      if (doc.id === 'territories') terr = items;
      if (doc.id === 'team') team = items;
      if (doc.id === 'outreach') outreach = items;
    }
    const liveOnly = o => { const out = {}; for (const id in o) if (o[id] && !o[id]._del) out[id] = o[id]; return out; };
    S.terr = liveOnly(terr); S.team = liveOnly(team); S.outreach = liveOnly(outreach);
    this.cfgExists = exists; S.loaded.cfg = true; S.cfgVer++; this._bump();
  },
  _bump() {
    S.ver++;
    if (!S.ready && KINDS.every(k => S.loaded[k]) && S.loaded.cfg) { S.ready = true; S.dbState = 'ok'; }
    this.onChange();
  },
  _enqueue(path, fn) {
    const prev = this._q.get(path) || Promise.resolve();
    const p = prev.then(fn, fn);
    this._q.set(path, p.catch(() => {}));
    return p;
  },
  async _try(fn) {
    const waits = [700, 1800, 4500];
    for (let i = 0; ; i++) {
      try { return await fn(); } catch (e) {
        const code = e && e.code;
        if ((code === 'unavailable' || code === 'resource_exhausted') && i < waits.length) {
          await new Promise(r => setTimeout(r, waits[i] + Math.random() * 400));
          continue;
        }
        throw e;
      }
    }
  },
  _write(path, op, body) {
    return this._enqueue(path, () => this._try(() => this.db.doc(path)[op](body)));
  },
  _local(k, id, rec, block) {
    if (rec && rec._del) { S[k].delete(id); this.where[k].delete(id); }
    else { S[k].set(id, rec); if (block) this.where[k].set(id, block); }
  },
  _openBlock(k) {
    let best = null;
    for (const id in this.blocks[k]) {
      const b = this.blocks[k][id];
      if (b.n < MAX_N && b.bytes < MAX_B && (!best || b.n > this.blocks[k][best].n)) best = id;
    }
    return best;
  },

  /** Create records. Each record must carry its own `id`. */
  async addMany(k, recs, onProgress) {
    if (!recs.length) return;
    let i = 0;
    const total = recs.length;
    const take = (n0, b0) => {
      const items = {}; let n = n0, b = b0;
      while (i < recs.length) {
        const sz = JSON.stringify(recs[i]).length + 24;
        if (n > n0 && (n >= MAX_N || b + sz > MAX_B)) break;
        items[recs[i].id] = recs[i]; n++; b += sz; i++;
      }
      return { items, n, b };
    };
    const open = this._openBlock(k);
    if (open) {
      const blk = this.blocks[k][open];
      const t = take(blk.n, blk.bytes);
      for (const id in t.items) this._local(k, id, t.items[id], open);
      blk.n = t.n; blk.bytes = t.b;
      S.ver++; this.onChange(true);
      await this._write(k + '/' + open, 'update', { items: t.items });
      if (onProgress) onProgress(i, total);
    }
    while (i < recs.length) {
      const t = take(0, 0);
      const bid = 'b' + uid();
      for (const id in t.items) this._local(k, id, t.items[id], bid);
      this.blocks[k][bid] = { n: t.n, bytes: t.b };
      S.ver++; this.onChange(true);
      await this._write(k + '/' + bid, 'set', { items: t.items });
      if (onProgress) onProgress(i, total);
    }
  },
  add(k, rec) { return this.addMany(k, [rec]); },

  /** Merge fields into existing records: list of [id, fields]. */
  async patchMany(k, list, onProgress) {
    const byBlock = new Map();
    for (const [id, fields] of list) {
      const blk = this.where[k].get(id);
      if (!blk) continue;
      if (!byBlock.has(blk)) byBlock.set(blk, {});
      const cur = byBlock.get(blk);
      cur[id] = Object.assign(cur[id] || {}, fields);
      const old = S[k].get(id);
      if (old) this._local(k, id, fields._del ? { _del: true } : Object.assign({}, old, fields));
    }
    S.ver++; this.onChange(true);
    let done = 0;
    for (const [blk, items] of byBlock) {
      await this._write(k + '/' + blk, 'update', { items });
      done += Object.keys(items).length;
      if (onProgress) onProgress(done, list.length);
    }
  },
  patch(k, id, fields) { return this.patchMany(k, [[id, fields]]); },
  remove(k, id) { return this.patch(k, id, { _del: true }); },

  /** Settings documents: cfg/territories, cfg/team and cfg/outreach. */
  async cfgPatch(name, id, fields) {
    const target = name === 'territories' ? S.terr : name === 'team' ? S.team : S.outreach;
    if (fields._del) delete target[id]; else target[id] = Object.assign({}, target[id] || {}, fields);
    S.cfgVer++; S.ver++; this.onChange(true);
    const path = 'cfg/' + name;
    const exists = this.cfgExists[name];
    this.cfgExists[name] = true;
    await this._write(path, exists ? 'update' : 'set', { items: { [id]: fields } });
  },
};
