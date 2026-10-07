// Builds from the same source:
//   dist/matthews-consignment-crm.html  the CRM as a Claude-hosted page (published as a Claude artifact)
//   public/crm/index.html               the CRM on the website (Vercel + Supabase), for the team
//   public/*.html                       the public "Sell with Matthews" pages (see site/pages.mjs)
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { buildSite } from './site/pages.mjs';

const r = f => readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const out = (p, text) => { mkdirSync(new URL(p.replace(/[^/]+$/, ''), import.meta.url), { recursive: true }); writeFileSync(new URL(p, import.meta.url), text); console.log('built', p, (text.length / 1024).toFixed(1) + ' KB'); };
const js = files => { const s = files.map(r).join('\n'); if (s.includes('</script')) throw new Error('script close tag inside JS'); return brand(s); };

const TITLE = 'Matthews Consignment CRM';
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&display=swap">';
// The logo is the company's own artwork (src/assets), embedded so each build stays a single file.
const img = f => 'data:image/png;base64,' + readFileSync(new URL('./src/assets/' + f, import.meta.url)).toString('base64');
const LOGO = { '%%LOGO_MARK%%': img('logo-mark.png'), '%%LOGO_FULL%%': img('logo-stacked.png') };
const brand = text => Object.entries(LOGO).reduce((t, [k, v]) => t.replaceAll(k, v), text);
const css = r('style.css'), body = brand(r('body.html'));

// --- Claude-hosted build: the publisher wraps this fragment in its own document skeleton.
out('./dist/matthews-consignment-crm.html',
  `<title>${TITLE}</title>\n${FONTS}\n<style>\n${css}\n</style>\n${body}<script>\n${js(['core.js', 'store-claude.js', 'ui.js', 'appointments.js', 'pipeline.js', 'report.js', 'lookup.js', 'leads.js', 'import.js', 'outreach.js', 'app.js', 'boot-claude.js'])}\n</script>\n`);

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
out('./public/crm/index.html', `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>${TITLE}</title>
<link rel="icon" type="image/png" href="${img('favicon.png')}">
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
${js(['core.js', 'store-web.js', 'ui.js', 'appointments.js', 'pipeline.js', 'report.js', 'lookup.js', 'leads.js', 'import.js', 'outreach.js', 'app.js', 'boot-web.js'])}
</script>
</body>
</html>
`);

// --- Public pages. Their form adds a row to web_leads with the same public key; visitors can
// add a row and nothing else. Real photos dropped into site/img/photos/ appear on the front page.
const photoDir = new URL('./site/img/photos/', import.meta.url);
const photos = existsSync(photoDir) ? readdirSync(photoDir).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort().map(f => ({ src: 'img/photos/' + f, alt: '' })) : [];
// A photo named after a program (site/img/equipment.jpg, dealers.jpg, estates.jpg, real-estate.jpg) appears on that program's page.
const heroPhotos = {};
for (const slug of ['equipment', 'dealers', 'estates', 'real-estate']) for (const e of ['jpg', 'jpeg', 'png', 'webp']) if (!heroPhotos[slug] && existsSync(new URL('./site/img/' + slug + '.' + e, import.meta.url))) heroPhotos[slug] = 'img/' + slug + '.' + e;
// Only programs marked published in site/pages.mjs are built. SITE_ALL=1 builds every program, for previews.
for (const f of existsSync(new URL('./public/', import.meta.url)) ? readdirSync(new URL('./public/', import.meta.url)) : []) if (f.endsWith('.html')) rmSync(new URL('./public/' + f, import.meta.url));
for (const [file, html] of Object.entries(buildSite({ config, photos, heroPhotos, all: !!env.SITE_ALL }))) out('./public/' + file, html);
for (const f of ['site.css', 'site.js']) cpSync(new URL('./site/' + f, import.meta.url), new URL('./public/' + f, import.meta.url));
for (const d of ['fonts', 'img']) cpSync(new URL('./site/' + d + '/', import.meta.url), new URL('./public/' + d + '/', import.meta.url), { recursive: true });
