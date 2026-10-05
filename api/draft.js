// POST /api/draft  { input: string }  ->  { text, truncated }
// Writes outreach email drafts with the Claude API. The API key stays on the server.
// Only signed-in, active CRM team members may call it: the caller's Supabase session
// token is checked against the database's own is_member() rule before anything is sent.
const env = process.env;
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
const MODEL = env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const MAX_INPUT = 60000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ code: 'invalid_request', message: 'POST only' });
  if (!env.ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ code: 'not_configured', message: 'Server keys are not set' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ code: 'not_granted', message: 'Sign in first' });
  try {
    const check = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/is_member', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!check.ok || (await check.json()) !== true) return res.status(403).json({ code: 'not_granted', message: 'Not a CRM team member' });
  } catch (e) {
    return res.status(502).json({ code: 'upstream_error', message: 'Could not verify the session' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const input = typeof body.input === 'string' ? body.input : '';
  if (!input.trim()) return res.status(400).json({ code: 'invalid_request', message: 'Missing input' });
  if (input.length > MAX_INPUT) return res.status(413).json({ code: 'prompt_too_large', message: 'Input too long' });

  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 4096, messages: [{ role: 'user', content: input }] }),
    });
  } catch (e) {
    return res.status(502).json({ code: 'upstream_error', message: 'Could not reach the Claude API' });
  }
  if (!r.ok) {
    const code = r.status === 429 ? 'rate_limited' : (r.status === 401 || r.status === 403 || r.status === 404) ? 'not_configured' : 'upstream_error';
    console.error('Claude API error', r.status, (await r.text().catch(() => '')).slice(0, 500));
    return res.status(r.status === 429 ? 429 : 502).json({ code, message: 'Claude API returned ' + r.status });
  }
  const data = await r.json();
  if (data.stop_reason === 'refusal') return res.status(422).json({ code: 'refused', message: 'Declined' });
  const text = (data.content || []).filter(b => b && b.type === 'text').map(b => b.text).join('').trim();
  if (!text) return res.status(502).json({ code: 'empty_completion', message: 'No text returned' });
  return res.status(200).json({ text, truncated: data.stop_reason === 'max_tokens' });
}
function safeParse(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
