/* ============================================================
   Scoreboard — how much outreach is being done, counted from the activity log.
   Nothing is stored for this screen; every number is worked out from activities,
   appointments and opportunities each time it is drawn.
   ============================================================ */
V.rp = { range: 'week', rep: '', table: false };
TABS.splice(TABS.findIndex(t => t[0] === 'activity') + 1, 0, ['report', 'Scoreboard']);

const RP_RANGES = [['week', 'This week'], ['lastweek', 'Last week'], ['month', 'This month'], ['30', 'Last 30 days'], ['year', 'This year']];
/* An outreach touch is something the team sent or dialed. */
const RP_KIND = { 'Phone Call': 'call', 'Voicemail': 'call', 'Email Sent': 'email', 'Text Message': 'text' };
const RP_KINDS = [['call', 'Calls', 'call', 'calls'], ['email', 'Emails', 'email', 'emails'], ['text', 'Texts', 'text', 'texts']];
/* Call outcomes that mean the person we wanted was on the line. */
const RP_REACHED = ['Connected', 'Interested', 'Has equipment', 'Not interested', 'Call back later', 'Correct contact found'];
const RP_TALK_TYPES = ['Meeting', 'Site Visit', 'Email Received', 'Equipment Discussion', 'Consignment Discussion'];
const rpIsConvo = a => RP_TALK_TYPES.includes(a.type) || (a.type === 'Phone Call' && RP_REACHED.includes(a.outcome));
const rpPlural = (n, one, many) => n.toLocaleString() + ' ' + (n === 1 ? one : many);

function rpPeriod(range) {
  const t = today(), ws = weekStart(), d = parseYmd(t), y = d.getFullYear(), m = d.getMonth();
  const earlier = (a, b) => (a < b ? a : b);
  if (range === 'lastweek') return { from: addDays(ws, -7), to: addDays(ws, -1), pFrom: addDays(ws, -14), pTo: addDays(ws, -8), unit: 'day', noun: 'last week', than: 'the week before', sub: 'the week before', live: false };
  if (range === 'month') {
    const pFrom = ymd(new Date(y, m - 1, 1)), pEnd = ymd(new Date(y, m, 0));
    return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)), pFrom, pTo: earlier(addDays(pFrom, d.getDate() - 1), pEnd), pEnd, unit: 'day', noun: 'this month', than: 'the same point last month', sub: 'by this point last month', prev: 'last month', live: true };
  }
  if (range === '30') return { from: addDays(t, -29), to: t, pFrom: addDays(t, -59), pTo: addDays(t, -30), unit: 'day', noun: 'in the last 30 days', than: 'the 30 days before', sub: 'in the 30 days before', live: false };
  if (range === 'year') {
    const pEnd = (y - 1) + '-12-31';
    return { from: y + '-01-01', to: y + '-12-31', pFrom: (y - 1) + '-01-01', pTo: earlier(ymd(new Date(y - 1, m, d.getDate())), pEnd), pEnd, unit: 'month', noun: 'this year', than: 'the same point last year', sub: 'by this point last year', prev: 'last year', live: true };
  }
  return { from: ws, to: addDays(ws, 6), pFrom: addDays(ws, -7), pTo: addDays(t, -7), pEnd: addDays(ws, -1), unit: 'day', noun: 'this week', than: 'the same point last week', sub: 'by this point last week', prev: 'last week', live: true };
}

function rpData(f) {
  const p = rpPeriod(f.range), t = today();
  const zero = () => ({ call: 0, email: 0, text: 0, total: 0, first: 0, convo: 0 });
  const inCur = day => day >= p.from && day <= p.to, inPrev = day => day >= p.pFrom && day <= p.pTo;

  /* A first-time contact is the first outreach ever logged for a company that had no earlier contact on file. */
  const earliest = new Map();
  for (const a of S.ac.values()) {
    if (!a.co || !RP_KIND[a.type]) continue;
    const k = a.at + '|' + (a.created || ''), cur = earliest.get(a.co);
    if (!cur || k < cur.k) earliest.set(a.co, { k, id: a.id });
  }
  const firstIds = new Set();
  for (const [coId, v] of earliest) { const c = S.co.get(coId); if (c && !c.lastContactBase && !(Number(c.attemptsBase) > 0)) firstIds.add(v.id); }

  const cur = zero(), prev = zero(), byRep = new Map(), byDay = new Map(), outcomes = new Map(), cos = new Set();
  let prevFull = 0, callsReached = 0;
  for (const a of S.ac.values()) {
    const day = isoToYmd(a.at);
    if (!day) continue;
    const kind = RP_KIND[a.type], convo = rpIsConvo(a), first = firstIds.has(a.id);
    if (!kind && !convo) continue;
    const mine = !f.rep || a.by === f.rep;
    const add = o => { if (kind) { o[kind]++; o.total++; } if (convo) o.convo++; if (first) o.first++; };
    if (inCur(day)) {
      const rid = a.by && S.team[a.by] ? a.by : '';
      if (!byRep.has(rid)) byRep.set(rid, zero());
      add(byRep.get(rid));
    }
    if (!mine) continue;
    if (kind) {
      let b = byDay.get(day);
      if (!b) { b = { call: 0, email: 0, text: 0, total: 0 }; byDay.set(day, b); }
      b[kind]++; b.total++;
      if (p.pEnd && day >= p.pFrom && day <= p.pEnd) prevFull++;
    }
    if (inCur(day)) {
      add(cur);
      if (kind && a.co) cos.add(a.co);
      if (kind === 'call') { const o = a.outcome || 'No outcome recorded'; outcomes.set(o, (outcomes.get(o) || 0) + 1); if (RP_REACHED.includes(a.outcome)) callsReached++; }
    } else if (inPrev(day)) add(prev);
  }

  let appts = 0, opps = 0;
  for (const k of S.tk.values()) { if (!isAppt(k) || k.status === 'Cancelled') continue; if (f.rep && k.rep !== f.rep) continue; if (inCur(isoToYmd(k.created))) appts++; }
  for (const o of S.op.values()) { if (f.rep && oppRep(o) !== f.rep) continue; if (inCur(isoToYmd(o.created))) opps++; }

  /* chart buckets */
  const buckets = [];
  if (p.unit === 'month') {
    const y = Number(p.from.slice(0, 4));
    for (let m = 0; m < 12; m++) {
      const key = y + '-' + pad2(m + 1), b = { call: 0, email: 0, text: 0, total: 0 };
      for (const [day, v] of byDay) if (day.slice(0, 7) === key) { b.call += v.call; b.email += v.email; b.text += v.text; b.total += v.total; }
      const dt = new Date(y, m, 1);
      buckets.push(Object.assign(b, { x: dt.toLocaleDateString(undefined, { month: 'short' }), full: dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), now: t.slice(0, 7) === key, future: key > t.slice(0, 7), show: true }));
    }
  } else {
    const n = daysBetween(p.from, p.to) + 1, weekly = n <= 7;
    for (let i = 0; i < n; i++) {
      const day = addDays(p.from, i), dt = parseYmd(day), v = byDay.get(day) || { call: 0, email: 0, text: 0, total: 0 };
      buckets.push(Object.assign({}, v, {
        x: weekly ? dt.toLocaleDateString(undefined, { weekday: 'short' }) : (f.range === '30' ? dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : String(dt.getDate())),
        full: dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
        now: day === t, future: day > t, show: weekly || (f.range === '30' ? (n - 1 - i) % 7 === 0 : (dt.getDate() === 1 || dt.getDate() % 5 === 0)),
      }));
    }
  }

  /* workdays in a row with at least one touch; today doesn't break the run until it's over */
  let streak = 0, c = t;
  for (let i = 0; i < 800; i++) {
    const wd = parseYmd(c).getDay();
    if (wd !== 0 && wd !== 6) { if (byDay.has(c)) streak++; else if (c !== t) break; }
    c = addDays(c, -1);
  }
  let best = null;
  for (const [day, v] of byDay) if (!best || v.total > best.n || (v.total === best.n && day > best.day)) best = { day, n: v.total };
  const todayN = (byDay.get(t) || { total: 0 }).total;

  const board = new Set(repList(true)); for (const id of byRep.keys()) board.add(id);
  const reps = [...board].map(id => Object.assign({ id, name: id ? repName(id) : 'Not recorded' }, byRep.get(id) || zero()))
    .filter(r => r.id || r.total || r.convo)
    .sort((a, b) => b.total - a.total || b.convo - a.convo || a.name.localeCompare(b.name));

  return { p, cur, prev, prevFull, cos: cos.size, appts, opps, buckets, streak, best, todayN, days: byDay.size, reps, outcomes, callsReached };
}

function rpChart(d, title) {
  const max = Math.max(1, ...d.buckets.map(b => b.total));
  const n = d.buckets.length, labelAll = n <= 12;
  const peak = d.buckets.reduce((a, b) => (b.total > a.total ? b : a), d.buckets[0]);
  const cols = d.buckets.map((b, i) => {
    const tip = b.full + '\n' + (b.future ? 'Not here yet' : RP_KINDS.map(([k, , one, many]) => rpPlural(b[k], one, many)).join('\n'));
    const segs = ['text', 'email', 'call'].filter(k => b[k]);
    const stack = b.total ? `<span class="col-stack" style="height:${(b.total / max * 100).toFixed(1)}%">${labelAll || b === peak ? `<span class="col-n">${b.total}</span>` : ''}${segs.map((k, j) => `<i class="s-${k}${j === 0 ? ' top' : ''}" style="flex-grow:${b[k]}"></i>`).join('')}</span>` : '';
    return `<div class="col${b.now ? ' now' : ''}${i < n / 3 ? ' l' : i >= n * 2 / 3 ? ' r' : ''}" tabindex="0" role="listitem" data-tip="${esc(tip)}" aria-label="${esc(tip.replace(/\n/g, ', '))}">${stack}${b.show ? `<span class="col-x">${esc(b.x)}</span>` : ''}</div>`;
  }).join('');
  const table = V.rp.table ? `<div class="tbl-wrap"><table class="tbl" id="rp-table"><thead><tr><th>${d.p.unit === 'month' ? 'Month' : 'Day'}</th><th class="num">Calls</th><th class="num">Emails</th><th class="num">Texts</th><th class="num">Total</th></tr></thead><tbody>${d.buckets.filter(b => !b.future).map(b => `<tr><td>${esc(b.full)}</td><td class="num">${b.call}</td><td class="num">${b.email}</td><td class="num">${b.text}</td><td class="num">${b.total}</td></tr>`).join('')}</tbody></table></div>` : '';
  return `<section class="panel"><div class="panel-h"><h3>${esc(title)}</h3><div class="legend" aria-hidden="true">${RP_KINDS.map(([k, l]) => `<span><i class="sw s-${k}"></i>${l}</span>`).join('')}</div></div>
    ${d.cur.total || d.buckets.some(b => b.total) ? `<div class="cols" role="list" aria-label="${esc(title)}">${cols}</div>` : `<p class="muted">Nothing logged ${esc(d.p.noun)} yet. Each call, voicemail, email and text you log from a company page adds to this chart.</p>`}
    <div><button type="button" class="link" data-act="rp-table" aria-expanded="${V.rp.table}">${V.rp.table ? 'Hide the numbers' : 'Show the numbers'}</button></div>${table}</section>`;
}

SCREENS.report = function () {
  const f = V.rp, d = rpData(f), p = d.p, c = d.cur, pv = d.prev;
  const who = f.rep ? (f.rep === ME ? 'you' : repName(f.rep)) : '';
  const rangeLabel = (RP_RANGES.find(r => r[0] === f.range) || RP_RANGES[0])[1];

  /* the lines under the big number */
  const facts = [];
  const diff = c.total - pv.total;
  if (c.total || pv.total) facts.push(diff > 0 ? `<span class="fact up">▲ ${diff.toLocaleString()} more than ${esc(p.than)}</span>` : diff < 0 ? `<span class="fact">▼ ${(-diff).toLocaleString()} fewer than ${esc(p.than)}</span>` : `<span class="fact">Level with ${esc(p.than)}</span>`);
  if (p.live && d.prevFull) facts.push(c.total > d.prevFull ? `<span class="fact up">Already past ${esc(p.prev)}'s ${d.prevFull.toLocaleString()}</span>` : `<span class="fact">${(d.prevFull - c.total + 1).toLocaleString()} more to beat ${esc(p.prev)}'s ${d.prevFull.toLocaleString()}</span>`);
  facts.push(`<span class="fact">${rpPlural(d.todayN, 'touch', 'touches')} today</span>`);
  if (d.streak > 1) facts.push(`<span class="fact">${d.streak} workdays in a row</span>`);
  if (d.best) facts.push(`<span class="fact">Best day: ${d.best.n.toLocaleString()} on ${esc(fmtDate(d.best.day))}</span>`);
  const record = d.best && d.days > 1 && d.best.day === today();
  const tag = record ? 'Best day yet' : (p.live && d.prevFull && c.total > d.prevFull) ? 'Ahead of ' + p.prev : d.streak >= 3 ? 'On a roll' : '';

  const stat = (n, label, sub) => `<div class="stat"><span class="tile-n">${esc(n)}</span><span class="tile-l">${esc(label)}</span>${sub ? `<span class="tile-s">${esc(sub)}</span>` : ''}</div>`;
  const was = n => (c.total || pv.total || n ? n.toLocaleString() + ' ' + p.sub : '');
  const tiles = `<div class="tiles rp-tiles">
      ${stat(c.call.toLocaleString(), 'Calls and voicemails', was(pv.call))}
      ${stat(c.email.toLocaleString(), 'Emails sent', was(pv.email))}
      ${stat(c.text.toLocaleString(), 'Texts sent', was(pv.text))}
      ${stat(c.first.toLocaleString(), 'First-time contacts', 'Cold outreach to a company never contacted before')}
      ${stat(d.cos.toLocaleString(), 'Companies touched')}
      ${stat(c.convo.toLocaleString(), 'Conversations', 'Reached the person, met, or got a reply')}
      ${stat(d.appts.toLocaleString(), 'Appointments set')}
      ${stat(d.opps.toLocaleString(), 'Opportunities opened')}
    </div>`;

  const maxRep = Math.max(1, ...d.reps.map(r => r.total));
  const board = d.reps.length ? `<div class="tbl-wrap"><table class="tbl board"><thead><tr><th class="num">#</th><th>Team member</th><th class="num">Calls</th><th class="num">Emails</th><th class="num">Texts</th><th class="num">First-time</th><th class="num">Conversations</th><th class="num">Total</th><th class="mix-h" aria-label="Mix of calls, emails and texts"></th></tr></thead><tbody>${d.reps.map((r, i) => `<tr class="${r.id && r.id === f.rep ? 'sel-row' : ''}"><td class="num">${r.total ? i + 1 : '–'}</td>
      <td class="co">${r.id ? `<button type="button" class="name" data-act="rp-rep" data-id="${esc(r.id)}" title="Show only ${esc(r.name)}">${esc(r.name)}</button>` : `<span class="muted">${esc(r.name)}</span>`}${r.id && r.id === ME ? ' <span class="muted">(you)</span>' : ''}${i === 0 && r.total && d.reps.length > 1 && r.total > d.reps[1].total ? '<span class="st st-won">Leading</span>' : ''}</td>
      <td class="num">${r.call}</td><td class="num">${r.email}</td><td class="num">${r.text}</td><td class="num">${r.first}</td><td class="num">${r.convo}</td><td class="num"><strong>${r.total}</strong></td>
      <td class="mix"><span class="mixbar" style="width:${(r.total / maxRep * 100).toFixed(1)}%">${['call', 'email', 'text'].filter(k => r[k]).map(k => `<i class="s-${k}" style="flex-grow:${r[k]}"></i>`).join('')}</span></td></tr>`).join('')}</tbody></table></div>`
    : `<div class="empty"><p>Team members appear here once they are added on the Territories screen.</p></div>`;

  const calls = c.call;
  const outRows = [...d.outcomes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label, n]) => ({ label, n, sub: Math.round(n / calls * 100) + '%' }));
  const outNote = calls ? `Reached the person on ${d.callsReached.toLocaleString()} of ${rpPlural(calls, 'call', 'calls')} (${Math.round(d.callsReached / calls * 100)}%).` : '';

  return `<div class="page-head"><div><h1>Scoreboard</h1><p class="sub">Calls, emails and cold outreach, counted from what the team logs</p></div></div>
    <div class="filters"><div class="seg" role="tablist" aria-label="Time period">${RP_RANGES.map(([id, l]) => `<button type="button" role="tab" aria-selected="${f.range === id}" class="${f.range === id ? 'on' : ''}" data-act="rp-range" data-range="${id}">${l}</button>`).join('')}</div>
      ${ME ? `<button type="button" class="pill${f.rep === ME ? ' on' : ''}" data-act="rp-me">Just me</button>` : ''}${fsel('rp', 'rep', 'Team member', repOpts(false))}</div>
    <section class="panel hero"><div class="hero-main"><span class="hero-n" id="rp-total">${c.total.toLocaleString()}</span><div class="hero-l"><strong>outreach ${c.total === 1 ? 'touch' : 'touches'} ${esc(p.noun)}${who ? ' by ' + esc(who) : ''}</strong><span class="muted">Every call, voicemail, email and text sent</span>${tag ? `<span class="st st-won hero-tag">${esc(tag)}</span>` : ''}</div></div>
      <div class="facts">${facts.join('')}</div></section>
    ${tiles}
    ${rpChart(d, (p.unit === 'month' ? 'Outreach by month' : 'Outreach by day') + ' · ' + rangeLabel.toLowerCase())}
    <div class="page-head second"><div><h2>Leaderboard</h2><p class="sub">${esc(rangeLabel)}, everyone on the team. Click a name to see just their numbers.</p></div>${f.rep ? `<button type="button" class="btn w" data-act="rp-rep" data-id="">Show everyone</button>` : ''}</div>
    ${board}
    ${barList('How the calls went', outRows, 'Pick an outcome when you log a call and the results are counted here.', outNote)}
    <p class="muted fine">Counted from the Activity log by the date on each entry. A first-time contact is the first call, voicemail, email or text ever logged for a company. Contact counts carried in from an imported spreadsheet have no dates, so they are left out.</p>`;
};

function wireReport() {
  ACTIONS['rp-range'] = t => { V.rp.range = t.dataset.range; renderNow(); };
  ACTIONS['rp-me'] = () => { V.rp.rep = V.rp.rep === ME ? '' : ME; renderNow(); };
  ACTIONS['rp-rep'] = t => { V.rp.rep = V.rp.rep === t.dataset.id ? '' : t.dataset.id; renderNow(); };
  ACTIONS['rp-table'] = () => { V.rp.table = !V.rp.table; renderNow(); };
}
