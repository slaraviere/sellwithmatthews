/* ============================================================
   Calendar — a month view of appointments, and optionally everything else
   with a date (open tasks and company follow-ups). Nothing is stored for it;
   it reads the same tasks and follow-up dates the rest of the CRM uses.
   ============================================================ */
V.cal = { month: '', day: '', show: 'appts', rep: '' };
TABS.splice(TABS.findIndex(t => t[0] === 'tasks') + 1, 0, ['calendar', 'Calendar']);

/* A short time for the small boxes: 9:30a, 2p */
function calTime(hm) {
  const p = hm.split(':').map(Number), h = p[0] % 12 || 12;
  return h + (p[1] ? ':' + pad2(p[1]) : '') + (p[0] < 12 ? 'a' : 'p');
}
/* day ('YYYY-MM-DD') -> items, earliest first. An item is { kind: 'appt' | 'task' | 'fu', time, label, k | c, done } */
function calItems(f) {
  const out = new Map();
  const push = (day, it) => { if (!out.has(day)) out.set(day, []); out.get(day).push(it); };
  const repOk = rep => !f.rep || rep === f.rep;
  for (const k of S.tk.values()) {
    if (!k.due || k.status === 'Cancelled' || !repOk(k.rep)) continue;
    const done = k.status === 'Completed';
    if (isAppt(k)) push(k.due, { kind: 'appt', time: validTime(k.time) ? k.time : '', label: (k.apptKind || 'Appointment') + (k.co && S.co.has(k.co) ? ' · ' + coName(k.co) : ''), k, done });
    else if (f.show === 'all' && !done) push(k.due, { kind: 'task', time: '', label: k.name || k.type || 'Task', k, done });
  }
  if (f.show === 'all') {
    for (const c of S.co.values()) if (c.nextFU && repOk(c.rep) && !DEAD_STATUSES.includes(c.status)) push(c.nextFU, { kind: 'fu', time: '', label: 'Follow up · ' + c.name, c, done: false });
  }
  const order = { appt: 0, task: 1, fu: 2 };
  for (const l of out.values()) l.sort((a, b) => (order[a.kind] - order[b.kind]) || (a.time || '99').localeCompare(b.time || '99') || a.label.localeCompare(b.label));
  return out;
}

SCREENS.calendar = function () {
  const f = V.cal, t = today();
  if (!f.month) f.month = t.slice(0, 7);
  if (!f.day) f.day = t;
  const y = Number(f.month.slice(0, 4)), m = Number(f.month.slice(5, 7)) - 1;
  const first = new Date(y, m, 1), start = addDays(ymd(first), -first.getDay());
  const lastDay = ymd(new Date(y, m + 1, 0)), weeks = Math.ceil((daysBetween(start, lastDay) + 1) / 7);
  const items = calItems(f);
  let apptCount = 0;
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(start, i), list = items.get(day) || [], inMonth = day.slice(0, 7) === f.month;
    if (inMonth) apptCount += list.filter(x => x.kind === 'appt' && !x.done).length;
    const chips = list.slice(0, 3).map(x => `<span class="cal-chip ${x.kind}${x.done ? ' done' : ''}">${x.time ? esc(calTime(x.time)) + ' ' : ''}${esc(x.label)}</span>`).join('');
    const full = new Date(parseYmd(day)).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    cells.push(`<button type="button" class="cal-day${inMonth ? '' : ' out'}${day === t ? ' today' : ''}${day === f.day ? ' sel' : ''}" data-act="cal-day" data-day="${day}" aria-pressed="${day === f.day}" aria-label="${esc(full + (list.length ? ', ' + list.length + (list.length === 1 ? ' item' : ' items') : ''))}">
      <span class="cal-n">${Number(day.slice(8))}</span>${chips}${list.length > 3 ? `<span class="cal-more">+${list.length - 3} more</span>` : ''}</button>`);
  }
  const dow = [0, 1, 2, 3, 4, 5, 6].map(i => new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'short' }));
  const title = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  /* the selected day, in full */
  const sel = items.get(f.day) || [];
  const selTitle = parseYmd(f.day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const selRows = sel.map(x => x.kind === 'fu'
    ? `<li><div class="rows-main"><button type="button" class="name" data-act="co-open" data-id="${esc(x.c.id)}">${esc(x.c.name)}</button><span class="muted">Follow-up due${x.c.rep ? ' · ' + esc(repName(x.c.rep)) : ''}</span></div><div class="rows-meta"><span class="st st-warn">Follow-up</span><button type="button" class="btn sm w" data-act="log" data-id="${esc(x.c.id)}" data-type="Phone Call">Log call</button></div></li>`
    : taskRow(x.k)).join('');
  const dayPanel = `<section class="panel cal-side" id="cal-side"><div class="panel-h"><h3>${esc(selTitle)}</h3>${f.day >= t ? `<button type="button" class="btn sm primary w" data-act="cal-new" data-day="${f.day}">+ Appointment</button>` : ''}</div>
    ${sel.length ? `<ul class="rows">${selRows}</ul>` : `<p class="muted">${f.show === 'all' ? 'Nothing is due this day.' : 'No appointments this day.'}</p>`}</section>`;

  return `<div class="page-head"><div><h1>Calendar</h1><p class="sub">${apptCount} ${apptCount === 1 ? 'appointment' : 'appointments'} still to come in ${esc(title)}</p></div><div class="row"><button type="button" class="btn primary w" data-act="cal-new" data-day="${f.day >= t ? f.day : ''}">+ Appointment</button></div></div>
    <div class="filters"><div class="cal-nav"><button type="button" class="btn sm" data-act="cal-go" data-step="-1" aria-label="Previous month">‹</button><button type="button" class="btn sm" data-act="cal-go" data-step="0">Today</button><button type="button" class="btn sm" data-act="cal-go" data-step="1" aria-label="Next month">›</button><span class="cal-title" id="cal-title">${esc(title)}</span></div>
      <div class="seg" role="tablist" aria-label="What to show"><button type="button" role="tab" aria-selected="${f.show === 'appts'}" class="${f.show === 'appts' ? 'on' : ''}" data-act="cal-show" data-show="appts">Appointments</button><button type="button" role="tab" aria-selected="${f.show === 'all'}" class="${f.show === 'all' ? 'on' : ''}" data-act="cal-show" data-show="all">Everything due</button></div>
      ${ME ? `<button type="button" class="pill${f.rep === ME ? ' on' : ''}" data-act="cal-me">Mine</button>` : ''}${fsel('cal', 'rep', 'Whose', repOpts(false))}</div>
    <div class="cal-wrap"><div class="cal"><div class="cal-dow" aria-hidden="true">${dow.map(d => `<span>${esc(d)}</span>`).join('')}</div><div class="cal-grid" id="cal-grid">${cells.join('')}</div>
      ${f.show === 'all' ? `<div class="cal-key"><span><i class="cal-chip appt"></i>Appointment</span><span><i class="cal-chip task"></i>Task</span><span><i class="cal-chip fu"></i>Follow-up</span></div>` : ''}</div>${dayPanel}</div>`;
};

function wireCalendar() {
  ACTIONS['cal-go'] = t => {
    const step = Number(t.dataset.step), f = V.cal;
    if (!step) { f.month = today().slice(0, 7); f.day = today(); }
    else { const d = new Date(Number(f.month.slice(0, 4)), Number(f.month.slice(5, 7)) - 1 + step, 1); f.month = ymd(d).slice(0, 7); f.day = f.month === today().slice(0, 7) ? today() : ymd(d); }
    renderNow();
  };
  ACTIONS['cal-day'] = t => { V.cal.day = t.dataset.day; V.cal.month = t.dataset.day.slice(0, 7); renderNow(); const b = $('#cal-grid .sel'); if (b) b.focus(); };
  ACTIONS['cal-show'] = t => { V.cal.show = t.dataset.show; renderNow(); };
  ACTIONS['cal-me'] = () => { V.cal.rep = V.cal.rep === ME ? '' : ME; renderNow(); };
  ACTIONS['cal-new'] = t => openAppt(null, '', '', t.dataset.day || '');
}
