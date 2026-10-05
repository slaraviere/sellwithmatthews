// Builds two single-file pages from the same source:
//   dist/matthews-consignment-crm.html  the Claude-hosted build (published as a Claude artifact)
//   public/index.html                   the website build (Vercel + Supabase)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const r = f => readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const out = (p, text) => { mkdirSync(new URL(p.replace(/[^/]+$/, ''), import.meta.url), { recursive: true }); writeFileSync(new URL(p, import.meta.url), text); console.log('built', p, (text.length / 1024).toFixed(1) + ' KB'); };
const js = files => { const s = files.map(r).join('\n'); if (s.includes('</script')) throw new Error('script close tag inside JS'); return s; };

const TITLE = 'Matthews Consignment CRM';
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&display=swap">';
const css = r('style.css'), body = r('body.html');

// --- Claude-hosted build: the publisher wraps this fragment in its own document skeleton.
out('./dist/matthews-consignment-crm.html',
  `<title>${TITLE}</title>\n${FONTS}\n<style>\n${css}\n</style>\n${body}<script>\n${js(['core.js', 'store-claude.js', 'ui.js', 'appointments.js', 'pipeline.js', 'import.js', 'outreach.js', 'app.js', 'boot-claude.js'])}\n</script>\n`);

// --- Website build: a complete document. The Supabase project URL and public (anon /
// publishable) key come from the environment at build time; both are safe to ship to browsers
// because row-level security decides what a signed-in user may read or change.
const env = process.env;
const config = {
  url: env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '',
  key: env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '',
};
if (!config.url || !config.key) console.warn('note: SUPABASE_URL / SUPABASE_ANON_KEY are not set; the website build will show a "not configured" message.');
const RESET = ':root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}';
out('./public/index.html', `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>${TITLE}</title>
${FONTS}
<style>${RESET}</style>
<style>
${css}
</style>
</head>
<body class="anon">
${body}<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>window.__CRM_CONFIG__ = ${JSON.stringify(config).replace(/</g, '\\u003c')};</script>
<script>
${js(['core.js', 'store-web.js', 'ui.js', 'appointments.js', 'pipeline.js', 'import.js', 'outreach.js', 'app.js', 'boot-web.js'])}
</script>
</body>
</html>
`);
