/* ============================================================
   Start-up for the Claude-hosted build: identity comes from the viewer's Claude
   account, storage and AI from the page's runtime capabilities.
   ============================================================ */
function openMe() {
  const reps = repList(true);
  const spec = [
    { k: 'who', label: 'I am', type: 'select', opts: reps.map(id => [id, S.team[id].name]), blank: 'Someone new', full: true },
    { k: 'name', label: 'Name shown on my activity', full: true, max: 60, hint: 'Pick yourself above, or type a name to add or rename.' },
  ];
  openDialog({
    title: 'Who\'s using the CRM?', body: fieldsHtml(spec, { who: ME || '', name: ME && S.team[ME] ? S.team[ME].name : '' }),
    onSubmit: () => guard(async () => {
      const v = readFields(spec);
      if (!v.who && !v.name) return dlgMsg('Pick your name or type it.');
      closeDialog();
      await setMe(v.who, v.name);
    }),
  });
}
async function setMe(pick, name) {
  let id = pick;
  const jobs = [];
  if (id && S.team[id]) {
    const patch = {};
    if (CAP.uid && S.team[id].uid !== CAP.uid) patch.uid = CAP.uid;
    if (name && name !== S.team[id].name) patch.name = name;
    if (Object.keys(patch).length) jobs.push(Store.cfgPatch('team', id, patch));
  } else {
    const hit = Object.keys(S.team).find(k => S.team[k].name.toLowerCase() === name.toLowerCase() && (!S.team[k].uid || S.team[k].uid === CAP.uid));
    id = hit || uid();
    jobs.push(Store.cfgPatch('team', id, hit ? { uid: CAP.uid || '', active: true } : { name, active: true, uid: CAP.uid || '' }));
  }
  ME = id;
  try { localStorage.setItem('mcrm.me', id); } catch (e) { /* storage is optional */ }
  if (!V.tk.rep) V.tk.rep = id;
  renderNow();
  await Promise.all(jobs);
}
function identify() {
  if (ME && S.team[ME]) return;
  let found = null;
  if (CAP.uid) for (const id in S.team) if (S.team[id].uid === CAP.uid) { found = id; break; }
  if (!found) { try { const l = localStorage.getItem('mcrm.me'); if (l && S.team[l] && (!S.team[l].uid || !CAP.uid)) found = l; } catch (e) { /* storage is optional */ } }
  ME = found;
  if (ME && !V._meInit) { V._meInit = true; V.tk.rep = ME; V.out.rep = ME; }
}

async function boot() {
  startShell();
  const c = window.claude;
  if (c && typeof c.use === 'function') {
    const safe = name => Promise.resolve().then(() => c.use(name)).catch(() => null);
    const [db, user, downloads, sample, mcp] = await Promise.all([safe('db'), safe('user'), safe('downloads'), safe('sample'), safe('mcp')]);
    CAP.db = db; CAP.user = user; CAP.downloads = downloads; CAP.sample = typeof sample === 'function' ? sample : null;
    CAP.mcp = mcp && typeof mcp.callTool === 'function' ? mcp : null;
    if (user) {
      try { CAP.uid = await user.id(); } catch (e) { /* no identity in this view */ }
      try { if ((await user.can('data.write')) === false) CAP.canWrite = false; } catch (e) { /* let a refused write decide */ }
    }
    if (db) {
      Store.onChange = local => { if (S.ready) identify(); schedule(0, !!local); };
      Store.init(db);
    }
  }
  CAP.checked = true;
  render();
}
boot();
