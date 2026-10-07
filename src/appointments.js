/* ============================================================
   Appointments: a scheduled call, visit or meeting with a prospect.
   Stored as a task of type "Appointment" with a time, a place and a kind, so it
   shows up everywhere tasks do (dashboard, company page, Tasks tab).
   ============================================================ */
const APPT_KINDS = ['Phone call', 'Site visit', 'In-person meeting', 'Video call'];
const APPT_ACTIVITY = { 'Phone call': 'Phone Call', 'Site visit': 'Site Visit', 'In-person meeting': 'Meeting', 'Video call': 'Meeting' };
const isAppt = k => !!k && k.type === 'Appointment';
const isOpenTask = k => k.status === 'Open' || k.status === 'Snoozed';
const validTime = hm => /^([01]?\d|2[0-3]):[0-5]\d/.test(hm || '');
function fmtTime(hm) {
  if (!validTime(hm)) return '';
  const p = hm.split(':').map(Number);
  return new Date(2000, 0, 1, p[0], p[1]).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
const apptWhen = k => [k.due ? fmtDate(k.due) : '', fmtTime(k.time)].filter(Boolean).join(', ');
const apptSort = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.time || '99').localeCompare(b.time || '99');
function nextAppt(coId) {
  const t = today();
  return (derive().tkByCo.get(coId) || []).filter(k => isAppt(k) && isOpenTask(k) && k.due && k.due >= t).sort(apptSort)[0] || null;
}
function companyAddress(c) {
  return c ? [c.addr, clean((c.city || '') + (c.state ? ', ' + c.state : '') + ' ' + (c.zip || ''))].filter(Boolean).join(', ') : '';
}
/* A link that opens Google Calendar with the appointment filled in. Times are the rep's local time. */
function calendarHref(k) {
  if (!k.due) return '';
  const enc = encodeURIComponent, day = s => s.replace(/-/g, '');
  let dates;
  if (validTime(k.time)) {
    const p = k.time.split(':').map(Number), start = parseYmd(k.due);
    start.setHours(p[0], p[1], 0, 0);
    const end = new Date(start.getTime() + (k.apptKind === 'Phone call' ? 30 : 60) * 60000);
    const f = d => day(ymd(d)) + 'T' + pad2(d.getHours()) + pad2(d.getMinutes()) + '00';
    dates = f(start) + '/' + f(end);
  } else dates = day(k.due) + '/' + day(addDays(k.due, 1));
  const c = k.co && S.co.get(k.co), ct = k.ct && S.ct.get(k.ct);
  const details = [ct ? 'With ' + ctName(ct) + ((ct.mobile || ct.phone) ? ', ' + fmtPhone(ct.mobile || ct.phone) : '') : '', c && c.phone ? 'Company phone: ' + fmtPhone(c.phone) : '', k.notes || ''].filter(Boolean).join('\n');
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + enc(k.name || 'Appointment') + '&dates=' + dates + '&details=' + enc(cap(details, 1500)) + '&location=' + enc(k.location || '');
}
function apptName(kind, coId, ctId) {
  const c = coId && S.co.get(coId), ct = ctId && S.ct.get(ctId);
  return (kind || 'Appointment') + (c ? ' with ' + c.name : ct ? ' with ' + ctName(ct) : '');
}
function apptKindChanged() {
  const kind = $('#f-apptKind'), loc = $('#f-location');
  if (!kind || !loc) return;
  const addr = loc.dataset.addr || '';
  const inPerson = kind.value === 'Site visit' || kind.value === 'In-person meeting';
  if (inPerson && !clean(loc.value)) loc.value = addr;
  else if (!inPerson && clean(loc.value) === addr) loc.value = '';
}
function openAppt(id, coId, ctId, onDay) {
  const t = id ? S.tk.get(id) : null;
  if (t) coId = t.co;
  const c = coId ? S.co.get(coId) : null;
  const contacts = coId ? (derive().ctByCo.get(coId) || []) : [];
  const prim = coId ? primaryContact(coId) : null;
  const spec = [
    coPickerField(coId),
    { k: 'apptKind', label: 'Kind of appointment', type: 'select', opts: APPT_KINDS, noBlank: true },
    { k: 'ct', label: 'With', type: 'select', opts: contacts.map(x => [x.id, ctName(x) + (x.title ? ' · ' + x.title : '')]), blank: 'No specific contact' },
    { k: 'due', label: 'Date', type: 'date', req: true },
    { k: 'time', label: 'Time', type: 'time', req: true },
    { k: 'rep', label: 'Who is going', type: 'select', opts: repOpts(false) },
    { html: `<div class="fld full"><label for="f-location">Where</label><input id="f-location" type="text" maxlength="200" autocomplete="off" data-addr="${esc(companyAddress(c))}" value="${esc(t ? t.location || '' : '')}" placeholder="Address, or leave blank for a call"><small>Fills in the company's address for a site visit or in-person meeting.</small></div>` },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true, ph: 'What to bring, what they want to sell, gate codes' },
  ];
  if (t) spec.push({ k: 'status', label: 'Status', type: 'select', opts: ['Open', 'Completed', 'Cancelled'], noBlank: true, full: true });
  const vals = t ? Object.assign({}, t, { status: t.status === 'Snoozed' ? 'Open' : t.status }) : { apptKind: 'Phone call', ct: ctId || (prim ? prim.id : ''), rep: ME || (c && c.rep) || '', due: onDay && onDay >= today() ? onDay : addBizDays(today(), 1), time: '10:00' };
  openDialog({
    title: t ? 'Edit appointment' : 'Schedule appointment', wide: true, body: fieldsHtml(spec, vals), submitLabel: t ? 'Save' : 'Schedule',
    extra: t ? `<button type="button" class="btn danger" data-act="del" data-kind="tk" data-id="${esc(t.id)}">Delete</button>` : '',
    onSubmit: () => guard(async () => {
      const v = readFields(spec);
      const pick = readCoPicker(coId);
      if (pick.error) return dlgMsg(pick.error);
      if (!v.due) return dlgMsg('Pick the date of the appointment.');
      if (!validTime(v.time)) return dlgMsg('Pick the time of the appointment.');
      if (!t && v.due < today()) return dlgMsg('Pick today or a later date. To record a meeting that already happened, use Other activity on the company page.');
      const rec = { name: apptName(v.apptKind, pick.id, v.ct), co: pick.id, ct: v.ct || '', rep: v.rep || '', due: v.due, time: v.time.slice(0, 5), location: cap(clean($('#f-location').value), 200), apptKind: v.apptKind, type: 'Appointment', notes: v.notes };
      if (t) { rec.status = v.status; if (v.status === 'Completed' && !t.doneAt) rec.doneAt = nowIso(); if (v.status !== 'Completed') rec.doneAt = ''; }
      closeDialog();
      toast('Appointment ' + (t ? 'saved' : 'set') + ' for ' + apptWhen(rec) + '.');
      if (t) await Store.patch('tk', t.id, rec);
      else await Store.add('tk', Object.assign({ id: uid(), priority: 'Normal', status: 'Open', created: nowIso() }, rec));
    }),
  });
}
