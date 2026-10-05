/* ============================================================
   Events and start-up
   ============================================================ */
function go(tab) {
  V.tab = tab; V.coId = null;
  try { history.replaceState(null, '', '#' + tab); } catch (e) { /* hash is a convenience */ }
  renderNow(); window.scrollTo(0, 0);
}
function openCo(id) {
  if ($('#dlg').open) closeDialog();
  V.tab = 'companies'; V.coId = id; renderNow(); window.scrollTo(0, 0);
}
const ACTIONS = {
  'tab': t => go(t.dataset.tab),
  'dlg-close': () => closeDialog(),
  'co-new': () => openCompany(),
  'co-edit': t => openCompany(t.dataset.id),
  'co-open': t => openCo(t.dataset.id),
  'co-back': () => { V.coId = null; renderNow(); },
  'co-view': t => { V.co.view = t.dataset.view; V.co.limit = 100; renderNow(); },
  'co-sort': t => { const k = t.dataset.key; if (V.co.sort === k) V.co.dir = -V.co.dir; else { V.co.sort = k; V.co.dir = (k === 'attempts' || k === 'last') ? -1 : 1; } renderNow(); },
  'co-clear': () => { V.co = Object.assign({}, CO_FILTER0, { view: V.co.view, sort: V.co.sort, dir: V.co.dir }); renderNow(); },
  'more': t => { V[t.dataset.scope].limit += 100; renderNow(); },
  'go-view': t => { V.co = Object.assign({}, CO_FILTER0, V.tab === 'dashboard' ? V.dash : {}, { view: t.dataset.view }); if (['fu-today', 'fu-over', 'followup'].includes(t.dataset.view)) { V.co.sort = 'nextFU'; } go('companies'); },
  'go-tasks': t => { V.tk.tab = t.dataset.tk; V.tk.rep = V.dash.rep; go('tasks'); },
  'go-opps': () => { V.op = { stage: 'open', line: V.dash.line, type: '', terr: V.dash.terr, rep: V.dash.rep === 'none' ? '' : V.dash.rep, q: '' }; go('opportunities'); },
  'go-acts': t => { V.ac = { type: t.dataset.type, rep: V.dash.rep === 'none' ? '' : V.dash.rep, range: 'week', limit: 100 }; go('activity'); },
  'dash-me': () => { V.dash.rep = V.dash.rep === ME ? '' : ME; renderNow(); },
  'dash-clear': () => { V.dash = { line: '', terr: '', rep: '', industry: '', asset: '', priority: '', status: '' }; renderNow(); },
  'tk-me': () => { V.tk.rep = V.tk.rep === ME ? '' : ME; renderNow(); },
  'tk-tab': t => { V.tk.tab = t.dataset.tk; renderNow(); },
  'log': t => openActivity(t.dataset.id, t.dataset.type, null, t.dataset.ct || ''),
  'log-other': t => openActivity(t.dataset.id, 'Meeting'),
  'ac-open': t => openActivity(null, null, t.dataset.id),
  'ct-new': t => openContact(null, t.dataset.id || ''),
  'ct-open': t => openContact(t.dataset.id),
  'op-new': t => openOpp(null, t.dataset.id || ''),
  'op-open': t => openOpp(t.dataset.id),
  'tk-new': t => openTask(null, t.dataset.id || ''),
  'tk-open': t => openTask(t.dataset.id),
  'ap-new': t => openAppt(null, t.dataset.id || ''),
  'tk-snooze': t => guard(async () => { const k = S.tk.get(t.dataset.id); if (!k) return; const from = (k.due && k.due > today()) ? k.due : today(); const due = addDays(from, Number(t.dataset.days)); toast('Snoozed to ' + fmtDate(due) + '.'); await Store.patch('tk', k.id, { due, status: 'Snoozed' }); }),
  'terr-new': () => openTerritory(),
  'terr-open': t => openTerritory(t.dataset.id),
  'terr-rerun': () => guard(async () => { const n = await reassignAll(); toast(n ? n + (n === 1 ? ' company was' : ' companies were') + ' re-assigned.' : 'Every company already matches its territory. Territories set by hand were left alone.'); }),
  'rep-new': () => openRep(),
  'rep-open': t => openRep(t.dataset.id),
  'me-edit': () => openMe(),
  'fu-quick': t => { const el = document.getElementById(t.dataset.target); if (!el) return; el.value = t.dataset.days === '' ? '' : addDays(today(), Number(t.dataset.days)); },
  'copy': t => { const text = t.dataset.text; const done = () => { const old = t.textContent; t.textContent = 'Copied'; setTimeout(() => { t.textContent = old; }, 1200); }; try { navigator.clipboard.writeText(text).then(done, () => selectText(t)); } catch (e) { selectText(t); } },
  'del': t => {
    if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = t.dataset.kind === 'co' ? 'Click again: deletes the company and everything on it' : 'Click again to delete'; return; }
    const kind = t.dataset.kind, id = t.dataset.id;
    closeDialog();
    guard(async () => {
      if (kind === 'co') {
        for (const k of ['ct', 'ac', 'tk', 'op']) { const l = []; for (const r of S[k].values()) if (r.co === id) l.push([r.id, { _del: true }]); if (l.length) await Store.patchMany(k, l); }
        if (V.coId === id) V.coId = null;
      }
      await Store.remove(kind, id);
      toast('Deleted.');
    });
  },
  'dup-ok': t => guard(async () => { const g = derive().dups.find(x => x.sig === t.dataset.sig); if (!g) return; await Store.patchMany('co', g.ids.map(id => [id, { dupOk: g.sig }])); }),
  'dup-merge': t => openMerge(t.dataset.sig),
  'nurture': t => guard(() => changeStatus(S.co.get(t.dataset.id), 'Future Opportunity / Nurture')),
  'fu-in': t => guard(async () => { const due = addDays(today(), Number(t.dataset.days)); toast('Follow-up set for ' + fmtDate(due) + '.'); await Store.patch('co', t.dataset.id, { nextFU: due, updated: nowIso() }); }),
  'export': t => doExport(t.dataset.kind),
  'dr-new': t => openDraft(t.dataset.id, t.dataset.ct || ''),
  'dr-batch': () => { runBatch(); },
  'dr-stop': () => { if (V.out.run) V.out.run.stop = true; if (_outCtl) _outCtl.abort(); },
  'dr-sent': t => guard(() => markDraftSent(t.dataset.id)),
  'dr-gmail': t => { gmailDraft(t.dataset.id, t); },
  'dr-redo': t => guard(() => redraft(t.dataset.id)),
  'dr-skip': t => {
    if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = 'Click again to discard'; return; }
    if ($('#dlg').open) closeDialog();
    guard(() => Store.remove('dr', t.dataset.id));
  },
  'dr-copy': t => {
    const live = draftLive(t.dataset.id), text = live[t.dataset.part] || '';
    const old = t.textContent, done = () => { t.textContent = 'Copied'; setTimeout(() => { t.textContent = old; }, 1200); };
    const fallback = () => { const el = t.dataset.part === 'to' ? null : $('#dr-' + (t.dataset.part === 'subject' ? 'sub' : 'body') + '-' + t.dataset.id); if (el) { el.focus(); el.select(); } else selectText(t); };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  },
  'out-all': () => { V.out.all = !V.out.all; renderNow(); },
  'out-cfg': () => { V.out.cfgOpen = !V.out.cfgOpen; V.out.form = null; renderNow(); },
  'out-save': () => guard(() => saveOutreachSettings()),
  'imp-reset': () => { V.imp = { step: 'pick' }; renderNow(); },
  'imp-back': () => { V.imp.step = 'map'; renderNow(); },
  'imp-preview': () => {
    const im = V.imp;
    if (!im.map.includes('co.name')) { im.error = 'Match one column to Company Name. Every company needs a name.'; return renderNow(); }
    im.error = '';
    im.plan = planImport(im.rows, im.map, { overwrite: !!im.overwrite, source: clean(im.source) });
    im.step = 'preview'; renderNow(); window.scrollTo(0, 0);
  },
  'imp-run': () => {
    const im = V.imp;
    if (im.step !== 'preview') return;
    im.step = 'run'; im.pct = 0; renderNow();
    applyImport(im.plan, (done, total) => {
      im.pct = total ? Math.round(done / total * 100) : 100;
      const bar = $('#imp-bar'), txt = $('#imp-prog');
      if (bar) bar.style.width = im.pct + '%';
      if (txt) txt.textContent = 'Saved ' + done.toLocaleString() + ' of ' + total.toLocaleString() + '… keep this page open.';
    }).then(() => { im.step = 'done'; renderNow(); }, e => { console.error(e); im.failed = errText(e); im.step = 'done'; renderNow(); });
  },
};
function selectText(btn) {
  const span = btn.previousElementSibling;
  if (!span) return;
  const r = document.createRange(); r.selectNodeContents(span);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}

const CHANGES = {
  'filter': t => { V[t.dataset.scope][t.dataset.key] = t.value; if ('limit' in V[t.dataset.scope]) V[t.dataset.scope].limit = 100; renderNow(); },
  'tk-done': t => guard(async () => { const done = t.checked; const k = S.tk.get(t.dataset.id); if (done && isAppt(k)) toast('Appointment marked done.', { action: 'Log how it went', onAction: () => openActivity(k.co || '', APPT_ACTIVITY[k.apptKind] || 'Meeting', null, k.ct || '') }); else toast(done ? 'Task completed.' : 'Task reopened.'); await Store.patch('tk', t.dataset.id, done ? { status: 'Completed', doneAt: nowIso() } : { status: 'Open', doneAt: '' }); }),
  'co-set': t => guard(() => Store.patch('co', t.dataset.id, { [t.dataset.key]: t.value, updated: nowIso() })),
  'co-status': t => guard(() => changeStatus(S.co.get(t.dataset.id), t.value)),
  'terr-set': t => { if (!t.value) return; guard(async () => { toast('Territory set to ' + t.value + '.'); await Store.patch('co', t.dataset.id, { terr: t.value, terrHow: 'Manual', updated: nowIso() }); }); },
  'dr-edit': t => { const d = S.dr.get(t.dataset.id); if (!d || t.dataset.busy) return; const v = t.dataset.key === 'subject' ? clean(t.value) : t.value.trim(); if (v === d[t.dataset.key] || !v) return; guard(() => Store.patch('dr', d.id, { [t.dataset.key]: v })); },
  'imp-map': t => { V.imp.map[Number(t.dataset.i)] = t.value; renderNow(); },
  'imp-opt': t => { V.imp[t.dataset.key] = t.type === 'checkbox' ? t.checked : t.value; },
  'imp-file': t => {
    const file = t.files && t.files[0];
    if (!file) return;
    V.imp = { step: 'pick', busy: true }; renderNow();
    readImportFile(file).then(r => { V.imp = Object.assign({ step: 'map', map: autoMap(r.headers), overwrite: false, source: '' }, r); renderNow(); },
      e => { V.imp = { step: 'pick', error: e && e.message ? e.message : 'That file couldn\'t be read. Save it as CSV and try again.' }; renderNow(); });
  },
};
let _it = null;
const INPUTS = {
  'filter': t => { V[t.dataset.scope][t.dataset.key] = t.value; if ('limit' in V[t.dataset.scope]) V[t.dataset.scope].limit = 100; clearTimeout(_it); _it = setTimeout(renderNow, 160); },
  'imp-opt': t => { V.imp[t.dataset.key] = t.value; },
  'out-opt': t => { V.out[t.dataset.key] = t.value; },
  'out-form': t => { V.out.form = V.out.form || {}; V.out.form[t.dataset.key] = t.value; },
  'dr-live': t => { const l = draftLive(t.dataset.id); const a = $('#dr-mail-' + t.dataset.id); if (a) a.href = mailtoHref(l.to, l.subject, l.body); const g = $('#dr-gm-' + t.dataset.id); if (g) g.href = gmailComposeHref(l.to, l.subject, l.body); },
};

/* ---------- global search ---------- */
function runSearch(q) {
  const box = $('#gresults');
  q = clean(q).toLowerCase();
  if (q.length < 2 || !S.ready) { box.hidden = true; box.innerHTML = ''; return; }
  const cos = [], cts = [];
  for (const c of S.co.values()) { if (coSearchHit(c, q)) { cos.push(c); if (cos.length >= 8) break; } }
  for (const x of S.ct.values()) { if ((ctName(x) + ' ' + (x.email || '') + ' ' + (x.phone || '') + ' ' + (x.mobile || '')).toLowerCase().includes(q)) { cts.push(x); if (cts.length >= 5) break; } }
  box.innerHTML = (cos.length ? `<div class="gr-h">Companies</div>` + cos.map(c => `<button type="button" data-act="co-open" data-id="${esc(c.id)}"><b>${esc(c.name)}</b><span class="muted">${esc(clean((c.city || '') + (c.state ? ', ' + c.state : '')))}</span></button>`).join('') : '') +
    (cts.length ? `<div class="gr-h">Contacts</div>` + cts.map(x => `<button type="button" data-act="${x.co ? 'co-open' : 'ct-open'}" data-id="${esc(x.co || x.id)}"><b>${esc(ctName(x))}</b><span class="muted">${esc(coName(x.co))}</span></button>`).join('') : '') ||
    `<div class="gr-h">No companies or contacts match</div>`;
  box.hidden = false;
}

function wire() {
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    const box = $('#gresults');
    if (!box.hidden) { if (box.contains(e.target)) { box.hidden = true; $('#gsearch').value = ''; } else if (!$('#gsearch-wrap').contains(e.target)) box.hidden = true; }
    if (!t) return;
    if (e.target.closest('input, select, textarea, label, a') && !e.target.closest('button[data-act]')) return;
    const fn = ACTIONS[t.dataset.act];
    if (fn) { e.preventDefault(); fn(t, e); }
  });
  document.addEventListener('change', e => { const t = e.target.closest('[data-change]'); if (t && CHANGES[t.dataset.change]) CHANGES[t.dataset.change](t, e); });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'gsearch') return runSearch(t.value);
    if (t.dataset && t.dataset.input && INPUTS[t.dataset.input]) INPUTS[t.dataset.input](t, e);
    if (t.id === 'f-apptKind') apptKindChanged();
    if (t.id === 'f-line' && _op) return opLineChanged();
    if (t.id === 'f-stage') { const p = $('#f-prob'); if (p && STAGE_PROB[t.value] != null) p.value = STAGE_PROB[t.value]; }
  });
  document.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.id === 'dlg-form') { const d = $('#dlg'); if (d._submit) d._submit(); }
    if (e.target.id === 'who-form') {
      const pick = $('#who-pick') ? $('#who-pick').value : '', name = clean($('#who-name').value);
      if (!pick && !name) return toast('Pick your name or type it.');
      guard(() => setMe(pick, pick ? '' : name));
    }
  });
  /* The close event arrives a moment after close(); by then another dialog may already be open, so only clear a closed one. */
  $('#dlg').addEventListener('close', () => { const d = $('#dlg'); if (!d.open) { d.innerHTML = ''; d._submit = null; } });
  $('#gsearch').addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; runSearch(''); } if (e.key === 'Enter') { const b = $('#gresults button'); if (b) b.click(); } });
  $('#gsearch').addEventListener('focus', e => runSearch(e.target.value));
}

function startShell() {
  $('#tabs').innerHTML = TABS.map(([id, l]) => `<button type="button" data-act="tab" data-tab="${id}">${l}${id === 'review' ? '<span class="badge" id="review-badge" hidden></span>' : ''}${id === 'outreach' ? '<span class="badge" id="out-badge" hidden></span>' : ''}</button>`).join('');
  const h = (location.hash || '').slice(1);
  if (TABS.some(t => t[0] === h)) V.tab = h;
  wire();
  wirePipeline();
  render();
}
