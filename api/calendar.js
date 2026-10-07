// GET /api/calendar?token=...&who=mine|all  ->  an iCalendar feed of CRM appointments.
// Calendar apps (Google Calendar, Apple Calendar, Outlook) open this address on their own,
// with no sign-in, so the long random token in the link is what proves who is asking. The
// database decides what a token may see: that team member's appointments, or the team's.

const env = process.env;
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
const TZ = env.CALENDAR_TZ || 'America/New_York';

export default async function handler(req, res) {
  const say = (code, text) => { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); return res.status(code).send(text); };
  if (req.method !== 'GET' && req.method !== 'HEAD') return say(405, 'GET only');
  if (!SUPABASE_URL || !SUPABASE_KEY) return say(503, 'The calendar link is not set up on this site yet.');
  const q = req.query || {};
  const token = String(q.token || ''), who = q.who === 'all' ? 'all' : 'mine';
  if (!/^[a-f0-9]{32,80}$/.test(token)) return say(404, 'This calendar link is not valid.');

  let events;
  try {
    const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
    if (/^eyJ/.test(SUPABASE_KEY)) headers.Authorization = 'Bearer ' + SUPABASE_KEY;
    const r = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/calendar_feed', { method: 'POST', headers, body: JSON.stringify({ p_token: token, p_who: who }) });
    if (!r.ok) return say(r.status === 404 ? 503 : 502, r.status === 404 ? 'The calendar link needs a database update before it works.' : 'Could not read the appointments just now.');
    events = await r.json();
  } catch (e) {
    return say(502, 'Could not read the appointments just now.');
  }
  if (events === null) return say(404, 'This calendar link is no longer valid. Make a new one on the CRM Calendar screen.');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="matthews-appointments.ics"');
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.status(200).send(buildIcs(events, { who, tz: TZ }));
}

// ---- the calendar file itself. Appointment times are stored as local wall-clock times, so they
// are written in the business's time zone.

const pad = n => String(n).padStart(2, '0');
const esc = s => String(s == null ? '' : s).replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');

/* Lines longer than 75 bytes are folded, as the format requires. */
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, 'utf8');
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/* US Eastern rules, so calendar apps that want the definition have it. Other zones rely on the zone name. */
const EASTERN = ['BEGIN:VTIMEZONE', 'TZID:America/New_York',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
  'END:VTIMEZONE'];

function addMinutes(date, hm, minutes) {
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = hm.split(':').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h, mi + minutes));
  return t.getUTCFullYear() + pad(t.getUTCMonth() + 1) + pad(t.getUTCDate()) + 'T' + pad(t.getUTCHours()) + pad(t.getUTCMinutes()) + '00';
}
function nextDay(date) {
  const [y, mo, d] = date.split('-').map(Number), t = new Date(Date.UTC(y, mo - 1, d + 1));
  return t.getUTCFullYear() + pad(t.getUTCMonth() + 1) + pad(t.getUTCDate());
}

function buildIcs(events, { who = 'mine', tz = 'America/New_York', now = new Date() } = {}) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Matthews Auctioneers//Consignment CRM//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + esc(who === 'all' ? 'Matthews appointments (team)' : 'Matthews appointments'), 'X-WR-TIMEZONE:' + tz,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  if (tz === 'America/New_York') lines.push(...EASTERN);
  for (const e of events || []) {
    const date = String(e.due_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const timed = /^([01]?\d|2[0-3]):[0-5]\d/.test(e.due_time || '');
    const about = [
      e.contact ? 'With ' + e.contact + (e.contact_phone ? ', ' + e.contact_phone : '') : '',
      e.company_phone ? 'Company phone: ' + e.company_phone : '',
      who === 'all' && e.rep ? 'Going: ' + e.rep : '',
      e.status === 'Completed' ? 'Marked completed in the CRM.' : '',
      e.notes || '',
    ].filter(Boolean).join('\n');
    lines.push('BEGIN:VEVENT', 'UID:' + esc(e.id) + '@sellwithmatthews', 'DTSTAMP:' + stamp);
    if (timed) {
      const hm = e.due_time.slice(0, 5).padStart(5, '0');
      lines.push('DTSTART;TZID=' + tz + ':' + addMinutes(date, hm, 0), 'DTEND;TZID=' + tz + ':' + addMinutes(date, hm, e.kind === 'Phone call' ? 30 : 60));
    } else {
      lines.push('DTSTART;VALUE=DATE:' + date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + nextDay(date));
    }
    lines.push('SUMMARY:' + esc(e.name || e.kind || 'Appointment'));
    if (e.location) lines.push('LOCATION:' + esc(e.location));
    if (about) lines.push('DESCRIPTION:' + esc(about.slice(0, 1500)));
    lines.push('STATUS:CONFIRMED', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
