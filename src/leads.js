/* ============================================================
   Web leads — what people send from the public pages (website build only).
   They wait in an inbox on the Dashboard until someone adds them to the CRM
   or dismisses them. Adding one creates the record, the contact, a note with
   what they wrote, and a call-back task due today.
   ============================================================ */
const WL = { map: new Map(), client: null, off: true };
const LEAD_LINE = { 'Estate': 'Estate', 'Real estate': 'Real Estate' };
const leadRec = r => ({ id: r.id, at: r.created_at, name: r.name || '', phone: r.phone || '', email: r.email || '', company: r.company || '', zip: r.zip || '',
  program: r.program || '', details: r.details || '', source: r.source || '', page: r.page || '', status: r.status || 'new', co: r.company_id || '', by: r.handled_by_id || '', handledAt: r.handled_at || '' });
const newLeads = () => [...WL.map.values()].filter(l => l.status === 'new').sort((a, b) => (a.at < b.at ? 1 : -1));

async function leadsInit(client) {
  WL.client = client;
  try {
    const { data, error } = await client.from('web_leads').select('*').order('created_at');
    if (error) throw error;
    WL.map = new Map((data || []).map(r => [r.id, leadRec(r)]));
    WL.off = false;
  } catch (e) { WL.off = true; /* the table isn't there until the database gets its update */ }
}
function leadRemote(type, row) {
  if (type === 'DELETE') { WL.map.delete(row.id); return; }
  const had = WL.map.has(row.id);
  WL.map.set(row.id, leadRec(row));
  WL.off = false;
  if (!had && row.status === 'new') toast('New from the website: ' + row.name, { action: 'Open', onAction: () => openLead(row.id) });
}
const leadAgo = iso => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' hr ago' : fmtDateTime(iso); };

function leadsPanel() {
  const list = newLeads();
  if (!list.length) return '';
  return `<section class="panel leads" id="leads-panel"><h3>New from the website (${list.length})</h3><ul class="rows">${list.slice(0, 10).map(l => `<li>
      <div class="rows-main"><button type="button" class="name" data-act="lead-open" data-id="${esc(l.id)}">${esc(l.name)}${l.company ? ' <span class="muted">' + esc(l.company) + '</span>' : ''}</button>
        <span class="muted">${esc([l.program, l.phone ? fmtPhone(l.phone) : l.email, leadAgo(l.at)].filter(Boolean).join(' · '))}</span>${l.details ? `<span class="lead-msg">${esc(cap(l.details, 160))}</span>` : ''}</div>
      <div class="rows-meta">${l.phone ? `<a class="btn sm" href="tel:${esc(l.phone.replace(/[^\d+]/g, ''))}">Call</a>` : ''}<button type="button" class="btn sm primary w" data-act="lead-open" data-id="${esc(l.id)}">Open</button></div></li>`).join('')}</ul>
    ${list.length > 10 ? `<p class="muted">${list.length - 10} more waiting.</p>` : ''}</section>`;
}

/* Records that may already be this person: same phone, email, name or company. */
function leadMatches(l) {
  const seen = new Map();
  for (const q of [l.phone, l.email, l.name, l.company]) {
    if (clean(q).length < 2) continue;
    const h = lookupHits(q);
    for (const x of h.cos) if (!seen.has(x.c.id)) seen.set(x.c.id, x.c);
    for (const x of h.cts) { const c = x.x.co && S.co.get(x.x.co); if (c && !seen.has(c.id)) seen.set(c.id, c); }
  }
  return [...seen.values()].slice(0, 5);
}
function openLead(id) {
  const l = WL.map.get(id);
  if (!l) return;
  const matches = l.status === 'new' ? leadMatches(l) : [];
  const row = (k, v) => (v ? `<div class="kv"><dt>${esc(k)}</dt><dd>${v}</dd></div>` : '');
  const as = l.company ? 'company' : 'individual';
  openDialog({
    title: 'Website lead', wide: true, cancelLabel: 'Close',
    sub: 'Sent ' + fmtDateTime(l.at) + (l.status === 'new' ? '. Call them back, then add them to the CRM.' : '. Already handled.'),
    body: `<dl class="lead-kv">${row('Name', esc(l.name))}${row('Company', esc(l.company))}${row('Phone', l.phone ? `<a href="tel:${esc(l.phone.replace(/[^\d+]/g, ''))}">${esc(fmtPhone(l.phone))}</a>` : '')}${row('Email', l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : '')}
        ${row('Has', esc(l.program))}${row('ZIP code', esc(l.zip))}${row('What they wrote', l.details ? `<span class="pre">${esc(l.details)}</span>` : '')}${row('Came from', esc([l.source, l.page].filter(Boolean).join(' · ')))}</dl>
      ${matches.length ? `<h3 class="dlg-h">Already in the CRM?</h3><ul class="lk-list" id="lead-matches">${matches.map(c => `<li class="lk-item"><button type="button" class="lk-main" data-act="lk-open" data-kind="co" data-id="${esc(c.id)}"><span><b>${esc(c.name)}</b> ${personChip(c)} ${statusChip(c.status)}</span><span class="muted">${esc([clean((c.city || '') + (c.state ? ', ' + c.state : '')), c.phone ? fmtPhone(c.phone) : ''].filter(Boolean).join(' · ') || 'No details yet')}</span></button><button type="button" class="btn sm w" data-act="lead-add" data-id="${esc(l.id)}" data-co="${esc(c.id)}">Add to this record</button></li>`).join('')}</ul>` : ''}`,
    extra: l.status === 'new' ? `<button type="button" class="btn danger w" data-act="lead-dismiss" data-id="${esc(l.id)}">Dismiss</button><button type="button" class="btn primary w" id="lead-add" data-act="lead-add" data-id="${esc(l.id)}">Add to the CRM as ${as === 'company' ? 'a company' : 'an individual'}</button>` : (l.co && S.co.has(l.co) ? `<button type="button" class="btn" data-act="co-open" data-id="${esc(l.co)}">Open their page</button>` : ''),
  });
}

async function leadSet(id, patch) {
  const { error } = await WL.client.from('web_leads').update(patch).eq('id', id);
  if (error) throw error;
  const l = WL.map.get(id);
  if (l) { l.status = patch.status; l.co = patch.company_id || ''; l.by = patch.handled_by_id || ''; l.handledAt = patch.handled_at || ''; }
}
function leadAdd(id, coId) {
  const l = WL.map.get(id);
  if (!l || l.status !== 'new') return;
  closeDialog();
  return guard(async () => {
    const now = nowIso(), parts = clean(l.name).split(' '), line = LEAD_LINE[l.program] || 'Equipment';
    let co = coId ? S.co.get(coId) : null;
    if (!co) {
      const person = !clean(l.company);
      co = { id: uid(), name: person ? clean(l.name) : clean(l.company), industry: person ? PERSON_INDUSTRY : '', phone: l.phone, web: '', addr: '', city: '', county: '', state: '', zip: l.zip,
        subIndustry: '', source: 'Website' + (l.source ? ': ' + cap(l.source, 60) : ''), leadType: l.program, priority: '', status: 'New', rep: ME || '', nextFU: '',
        lines: line === 'Equipment' ? [] : [line], assets: [], optOut: false, dnc: false, srcUrl: '', notes: '', attemptsBase: 0, created: now, updated: now };
      const t = assignTerritory(co); co.terr = t.code; co.terrHow = t.how;
      await Store.add('co', co);
    } else if (!coLines(co).includes(line)) {
      await Store.patch('co', co.id, { lines: coLines(co).concat(line), updated: now });
    }
    const email = l.email.toLowerCase(), ph = normPhone(l.phone), here = derive().ctByCo.get(co.id) || [];
    let ct = here.find(x => (email && (x.email || '').toLowerCase() === email) || (ph && (normPhone(x.mobile) === ph || normPhone(x.phone) === ph)));
    if (!ct) {
      ct = { id: uid(), co: co.id, first: parts[0] || '', last: parts.slice(1).join(' '), title: '', dept: '', role: '', email, phone: '', mobile: l.phone, nextFU: '', primary: here.length === 0, optOut: false, dnc: false, notes: '', created: now, updated: now };
      await Store.add('ct', ct);
    }
    await Store.add('ac', { id: uid(), co: co.id, ct: ct.id, type: 'Note', at: now, by: ME || '', outcome: '', created: now,
      notes: 'Asked for a free consultation on the website' + (l.program ? ' (' + l.program + ')' : '') + ', ' + fmtDateTime(l.at) + '.' + (l.details ? '\n\n' + l.details : '') });
    await Store.add('tk', { id: uid(), name: 'Call back ' + clean(l.name) + ' (website lead)', co: co.id, ct: ct.id, rep: ME || '', due: today(), type: 'Call', priority: 'High', status: 'Open', notes: 'Free consultation requested on the website.', created: now });
    await leadSet(id, { status: 'added', company_id: co.id, handled_by_id: ME || null, handled_at: now });
    openCo(co.id);
    toast('Added, with a call-back task due today.');
  });
}

function wireLeads() {
  ACTIONS['lead-open'] = t => openLead(t.dataset.id);
  ACTIONS['lead-add'] = t => leadAdd(t.dataset.id, t.dataset.co || '');
  ACTIONS['lead-dismiss'] = t => {
    if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = 'Click again to dismiss'; return; }
    const id = t.dataset.id;
    closeDialog();
    guard(async () => { await leadSet(id, { status: 'dismissed', company_id: null, handled_by_id: ME || null, handled_at: nowIso() }); renderNow(); });
  };
}
