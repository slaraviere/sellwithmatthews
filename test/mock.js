// In-memory stand-in for the platform's window.claude (db, user, downloads) used only by local tests.
(() => {
  const docs = new Map();           // path -> object
  const subs = [];                   // {coll, limit, next}
  const SEED = window.__SEED__ || {};
  for (const p in SEED) docs.set(p, SEED[p]);
  const clone = o => JSON.parse(JSON.stringify(o));
  const freeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
  const merge = (a, b) => {
    const out = Object.assign({}, a);
    for (const k in b) {
      const v = b[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = merge(out[k], v);
      else out[k] = v;
    }
    return out;
  };
  const collOf = path => path.split('/').slice(0, -1).join('/');
  const snapFor = coll => {
    const list = [...docs.entries()].filter(([p]) => collOf(p) === coll).sort((a, b) => a[0] < b[0] ? -1 : 1)
      .map(([p, d]) => ({ id: p.split('/').pop(), exists: true, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } }));
    return { docs: list, size: list.length, empty: !list.length, docChanges: () => [], metadata: {} };
  };
  const notify = coll => { for (const s of subs) if (s.coll === coll) setTimeout(() => s.next(snapFor(coll)), 5); };
  window.__writes = [];
  const delay = () => new Promise(r => setTimeout(r, 8));
  const docRef = path => ({
    id: path.split('/').pop(), path,
    async get() { const d = docs.get(path); return { id: this.id, exists: !!d, data: () => d }; },
    async set(data) { await delay(); if (window.__failWrites) throw { code: 'unavailable', message: 'x' }; const s = JSON.stringify(data); if (s.length > 256 * 1024) throw { code: 'invalid_argument', message: 'too big' }; docs.set(path, freeze(clone(data))); window.__writes.push(['set', path, s.length]); notify(collOf(path)); },
    async update(data) { await delay(); if (!docs.has(path)) throw { code: 'invalid_argument', message: 'missing ' + path }; const m = merge(docs.get(path), clone(data)); if (JSON.stringify(m).length > 256 * 1024) throw { code: 'invalid_argument', message: 'too big' }; docs.set(path, freeze(m)); window.__writes.push(['update', path, JSON.stringify(data).length]); notify(collOf(path)); },
    async delete() { docs.delete(path); notify(collOf(path)); },
  });
  const collRef = coll => {
    const q = {
      path: coll,
      where() { return q; }, orderBy() { return q; }, limit() { return q; },
      async get() { return snapFor(coll); },
      onSnapshot(next) { const s = { coll, next }; subs.push(s); setTimeout(() => next(snapFor(coll)), 20); return () => subs.splice(subs.indexOf(s), 1); },
      doc(id) { return docRef(coll + '/' + (id || Math.random().toString(36).slice(2))); },
    };
    return q;
  };
  const db = { doc: docRef, collection: collRef };
  const user = { id: async () => 'u_testtesttesttesttest01', can: async () => true, isOwner: async () => true, canEdit: async () => true };
  window.__saved = [];
  const downloads = { save: async (r) => { window.__saved.push({ filename: r.filename, size: String(r.data).length, head: String(r.data).slice(0, 300) }); return { status: 'saved' }; } };
  window.__prompts = [];
  const sample = async (input, opts = {}) => {
    window.__prompts.push(input);
    await new Promise(r => setTimeout(r, 30));
    if (window.__aiFail) throw { code: window.__aiFail, message: 'x' };
    const text = 'Subject: Surplus equipment at your yard\n\nHi Tom,\n\nI work with contractors around the New River Valley who sell dozers and trucks they no longer run. If you have anything sitting, I can tell you what it would likely bring at auction.\n\nWorth a ten minute call this week?\n\nStephen\nMatthews Auctioneers';
    if (opts.onText) { opts.onText({ text: text.slice(0, 40), delta: text.slice(0, 40) }); await new Promise(r => setTimeout(r, 10)); opts.onText({ text, delta: text.slice(40) }); }
    return { text, truncated: false, modelTierApplied: 'default' };
  };
  sample.json = async (input) => {
    window.__prompts.push(input);
    await new Promise(r => setTimeout(r, 40));
    if (window.__aiFail) throw { code: window.__aiFail, message: 'x' };
    const m = input.match(/<prospects>(.*)<\/prospects>/s);
    return JSON.parse(m[1]).map(p => ({ id: p.id, subject: 'Equipment at ' + p.company, body: 'Hi ' + (p.contact_first_name || 'there') + ',\n\nBody for ' + p.company + '.\n\nStephen' }));
  };
  window.__docs = docs;
  window.claude = { use: name => new Promise(res => setTimeout(() => res({ db, user, downloads, sample }[name] || null), 30)) };
})();
