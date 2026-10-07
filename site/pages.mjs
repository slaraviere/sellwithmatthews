// The public "Sell with Matthews" pages: one front page and one page per program,
// all built from the template below. Edit the wording here; build.mjs writes the files.
//
// Wording marked DRAFT is a first pass for Matthews to correct. Figures and claims on the
// dealer page and in "Where equipment sells" come from the dealer trade-in brochure.

export const PHONE = { text: '(276) 235-0153', tel: '+12762350153' };
export const EMAIL = 'stephen@matthewsauctioneers.com';
export const MAIN_SITE = 'https://www.matthewsauctioneers.com/';
const OFFER = 'Start with a free consultation: no fees, no commitment.';

/* A program's page goes on the live site only when it is marked published. The others stay out of the
   build entirely (no page, no links to them) until Matthews has approved them. */
export const PROGRAMS = [
  {
    published: true,
    slug: 'equipment', nav: 'Equipment', lot: 'Equipment', pick: 'Equipment',
    blurb: 'One machine or a whole fleet. Trucks, trailers and building materials too.',
    title: 'Sell your equipment at auction',
    lead: 'One machine or a whole fleet, we handle the sale from the first look to the final payment.',
    /* Funnel page: no menu and no button to the main site at the top. Visitors arrive from a "sell your equipment" link, so the page has one job. */
    funnel: true,
    leadOnly: true,  /* the offer is already in the strip at the top and on the form, so the opening line doesn't repeat it */
    /* Three facts in one row. They replace the bullet list and the separate "Where equipment sells" section. */
    facts: [
      ['All 50 states', 'Thousands of buyers, from every state and several countries.'],
      ['3 marketplaces', 'Listed on MatthewsAuctioneers.com, EquipmentFacts.com and AuctionTime.com.'],
      ['Any size sale', 'One attachment, one machine or a full fleet.'],  // DRAFT
    ],
    /* Tap-to-pick list in the form: easier than typing on a phone. */
    chips: ['Excavator', 'Skid steer', 'Dozer', 'Loader', 'Backhoe', 'Truck', 'Trailer', 'Farm equipment', 'Forklift', 'Attachments', 'Building materials', 'Something else'],
    zip: true,
    detailsHint: 'Year, make, model and hours, if you know them',
    fit: {  // DRAFT
      title: 'Who sells with us',
      items: [
        ['Contractors', 'Upgrading a machine, thinning the fleet or closing out a job.'],
        ['Farms', 'Downsizing, changing direction or retiring.'],
        ['Fleets', 'Turning over trucks, trailers and support equipment.'],
        ['Businesses closing', 'The whole yard, shop and inventory in one sale.'],
      ],
    },
    /* Recently sold items and seller quotes go here when Matthews sends them. Empty lists show nothing.
       sold: { item, price, img, big } — the first one is the large photo at the top of the page (big is its larger file)
       quotes: [{ text: '...', who: 'Name, company, town' }] */
    sold: [
      { item: 'Kubota SVL75-2 track loader', price: '$45,000', img: 'img/sold/kubota-svl75-2.jpg', big: 'img/sold/kubota-svl75-2-large.jpg' },
      { item: 'John Deere 300G excavator', price: '$31,000', img: 'img/sold/deere-300g.jpg' },
      { item: 'JLG E450AJ boom lift', price: '$17,800', img: 'img/sold/jlg-e450aj.jpg' },
      { item: 'Better Built gooseneck trailer', price: '$7,000', img: 'img/sold/better-built-gooseneck.jpg' },
    ],
    quotes: [],
    faq: [
      ['What does the consultation cost?', 'Nothing. There are no fees and no commitment. We look at what you have and tell you how we would sell it.'],
      ['I only have one machine. Is that enough?', 'Yes. We sell single machines and whole fleets.'],  // DRAFT
      ['I\'m an equipment dealer. Is this the right page?', 'Dealers have their own program for trade-ins.', ['dealers', 'See the dealer trade-in program']],
    ],
    cta: true,
  },
  {
    slug: 'dealers', nav: 'Dealer trade-ins', lot: 'Dealer trade-ins', pick: 'Dealer trade-ins',
    blurb: 'Turn trade-ins into cash, with rates as low as 0%.',
    title: 'Turn trade-ins into cash',
    lead: 'A full-service auction program for equipment dealers. We sell the trade-ins and send you the payment.',
    points: [
      'Rates as low as 0%.',
      '14 to 30 days, on average, from first contact to payment.',
      'All types of units.',
      'Reserves set together with you.',
      'Sold discreetly or under your dealership\'s name.',
    ],
    company: 'Dealership',
    reach: true,
  },
  {
    slug: 'estates', nav: 'Estates', lot: 'An estate', pick: 'Estate',
    blurb: 'A household, a farm or a lifetime collection, handled start to finish.',
    title: 'Sell an estate at auction',
    lead: 'A household, a farm or a lifetime collection. We handle the sale from start to finish, so the family doesn\'t have to.',  // DRAFT
    points: [  // DRAFT
      'One company for the whole estate: the contents, the vehicles and equipment, and the property.',
      'We work with executors, attorneys, banks and families.',
      'A set auction date, so the estate can be settled.',
    ],
    sellsTitle: 'What we sell',
    sells: ['Household contents', 'Furniture', 'Antiques and collectibles', 'Coins and jewelry', 'Vehicles', 'Tools', 'Farm and lawn equipment', 'Building materials'],
  },
  {
    slug: 'real-estate', nav: 'Real estate', lot: 'Real estate', pick: 'Real estate',
    blurb: 'Homes, land, farms and commercial property, sold at auction.',
    title: 'Sell real estate at auction',
    lead: 'Homes, land, farms and commercial property, sold to the highest bidder on a date you know in advance.',  // DRAFT
    points: [  // DRAFT
      'A set sale date instead of an open-ended listing.',
      'Buyers bid against each other in the open.',
      'The property and what\'s in it can sell with one company.',
    ],
    sellsTitle: 'What we sell',
    sells: ['Homes', 'Land', 'Farms', 'Commercial property'],
  },
];

/* The programs this build includes: the published ones, or all of them for previews and tests. */
let LIVE = PROGRAMS;
const isLive = slug => LIVE.some(p => p.slug === slug);

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ext is '' on the live site (clean addresses) and '.html' when the files are opened straight from disk. */
function layout({ title, description, body, ext, config, current, funnel }) {
  const href = p => p.slug + ext;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<link rel="icon" type="image/png" href="img/favicon.png">
<link rel="preload" href="fonts/archivo-wdth.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="site.css">
<script>
/* Sign-in, invite and password links from the team's email land on this address; hand them to the CRM. */
if (/(access_token|refresh_token|error_description|type=(invite|recovery|signup|magiclink))/.test(location.hash)) location.replace('crm/' + location.hash);
</script>
</head>
<body${funnel ? ' class="funnel"' : ''}>

<div class="reachbar">
  <div class="wrap">
    <span class="reachbar-offer">Free consultation. No fees, no commitment.</span>
    <a class="reachbar-phone" href="tel:${PHONE.tel}">Call <b>${PHONE.text}</b></a>
    <a class="reachbar-mail" href="mailto:${EMAIL}">${EMAIL}</a>
  </div>
</div>

${funnel ? `<header class="top">
  <div class="wrap">
    <span class="top-logo"><img src="img/logo-wide.png" alt="Matthews Auctioneers. Consider it sold." width="242" height="74"></span>
    <a class="top-call" href="tel:${PHONE.tel}">Call <b>${PHONE.text}</b></a>
    <a class="btn red" href="#tell">Free consultation</a>
  </div>
</header>` : `<header class="top">
  <div class="wrap">
    <a class="top-logo" href="./"><img src="img/logo-wide.png" alt="Matthews Auctioneers. Consider it sold." width="242" height="74"></a>
    <nav class="top-nav" aria-label="Programs">
      ${LIVE.map(p => `<a href="${href(p)}"${current === p.slug ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`).join('\n      ')}
    </nav>
    <a class="btn" href="${MAIN_SITE}">Bid at MatthewsAuctioneers.com</a>
  </div>
</header>`}

<main>
${body}
${funnel ? '' : `  <section class="buy">
    <div class="wrap">
      <div>
        <h2 class="wide">Here to buy?</h2>
        <p>Current auctions and bidding are on our main site.</p>
      </div>
      <a class="btn solid" href="${MAIN_SITE}">Go to MatthewsAuctioneers.com</a>
    </div>
  </section>`}
</main>

${funnel ? `<footer class="foot quiet">
  <div class="wrap">
    <img src="img/logo-stacked.png" alt="Matthews Auctioneers" width="150" height="129">
    <div>
      <h3>Talk to us</h3>
      <ul>
        <li><a href="tel:${PHONE.tel}">${PHONE.text}</a></li>
        <li><a href="mailto:${EMAIL}">${EMAIL}</a></li>
      </ul>
    </div>
    <div class="foot-end">
      <ul>
        <li>Here to buy? <a href="${MAIN_SITE}">Go to MatthewsAuctioneers.com</a></li>
        ${LIVE.length > 1 ? `<li>Selling something else? <a href="./">See everything we sell</a></li>` : ''}
        <li><a href="crm/">Team sign-in</a></li>
      </ul>
    </div>
  </div>
</footer>` : `<footer class="foot">
  <div class="wrap">
    <img src="img/logo-stacked.png" alt="Matthews Auctioneers" width="150" height="129">
    <div>
      <h3>Sell with us</h3>
      <ul>
        ${LIVE.map(p => `<li><a href="${href(p)}">${esc(p.nav)}</a></li>`).join('\n        ')}
      </ul>
    </div>
    <div>
      <h3>Talk to us</h3>
      <ul>
        <li><a href="tel:${PHONE.tel}">${PHONE.text}</a></li>
        <li><a href="mailto:${EMAIL}">${EMAIL}</a></li>
      </ul>
    </div>
    <div class="foot-end">
      <ul>
        <li><a href="${MAIN_SITE}">MatthewsAuctioneers.com</a></li>
        <li><a href="crm/">Team sign-in</a></li>
      </ul>
    </div>
  </div>
</footer>`}

<div class="callbar">
  <a class="btn red" href="tel:${PHONE.tel}">Call ${PHONE.text}</a>
  <a class="btn" href="#tell">Free consultation</a>
</div>

<script>window.__SITE__ = ${JSON.stringify({ url: config.url, key: config.key, phone: PHONE.text }).replace(/</g, '\\u003c')};</script>
<script src="site.js" defer></script>
</body>
</html>
`;
}

/* Phone and email, large, near the top of every page. */
const reachMe = `<div class="reach-me">
          <span>Talk to us directly</span>
          <a class="reach-phone wide" href="tel:${PHONE.tel}">${PHONE.text}</a>
          <a class="reach-mail" href="mailto:${EMAIL}">${EMAIL}</a>
        </div>`;

/* The form is the same everywhere; a program page preselects what the person has. */
function form(program) {
  const picks = LIVE.map(p => p.pick).concat('Something else');
  const p = program || {};
  const what = p.chips
    ? `<fieldset class="chips"><legend>What do you have? <small>tap any that apply</small></legend>
          ${p.chips.map((c, i) => `<label><input type="checkbox" name="has" value="${esc(c)}"><span>${esc(c)}</span></label>`).join('')}
        </fieldset><input type="hidden" name="program" value="${esc(p.pick)}">`
    : `<label>What do you have?
          <select name="program">
            ${picks.map(v => `<option${p.pick === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}
          </select>
        </label>`;
  return `<form class="tell" id="tell" novalidate>
        <h2>Get a free consultation</h2>
        <p>No fees and no commitment. Tell us what you have and we'll call you.</p>
        <p class="tell-err" id="tell-err" role="alert" hidden></p>
        <label>Your name<input type="text" name="name" autocomplete="name" maxlength="120" required></label>
        ${p.zip ? `<div class="pair wide-left">
          <label>Phone<input type="tel" name="phone" autocomplete="tel" inputmode="tel" maxlength="40" required></label>
          <label>ZIP code<input type="text" name="zip" autocomplete="postal-code" inputmode="numeric" maxlength="10" placeholder="Where it sits"></label>
        </div>` : `<label>Phone<input type="tel" name="phone" autocomplete="tel" inputmode="tel" maxlength="40" required></label>`}
        ${p.company ? `<label><span>${esc(p.company)} <small>optional</small></span><input type="text" name="company" autocomplete="organization" maxlength="160"></label>` : ''}
        ${what}
        <label><span>A few details <small>optional</small></span><textarea name="details" maxlength="1800" placeholder="${esc(p.detailsHint || 'For example: 2015 excavator, two dump trailers, located near Galax')}"></textarea></label>
        <label class="hp" aria-hidden="true">Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        <button class="btn red" type="submit">Get my free consultation</button>
        <p class="tell-call">Prefer to talk? Call <a href="tel:${PHONE.tel}">${PHONE.text}</a></p>
      </form>`;
}

/* Optional sections. Each returns nothing when the program has no content for it. */
const soldOf = p => (p.sold || []).filter(x => x.item && x.price);
/* The large photo at the top: a photo file named after the program if there is one, otherwise the first sold item. */
function heroPhoto(p, o) {
  const own = o.heroPhotos && o.heroPhotos[p.slug], top = soldOf(p).find(x => x.img);
  if (own) return `<figure class="hero-photo"><img src="${esc(own)}" alt="" width="1280" height="960"></figure>`;
  if (!top) return '';
  return `<figure class="hero-photo"><img src="${esc(top.big || top.img)}" alt="${esc(top.item)}" width="1280" height="960"><figcaption><span>${esc(top.item)}</span><b>Sold for ${esc(top.price)}</b></figcaption></figure>`;
}
function soldBand(p, o) {
  const own = o.heroPhotos && o.heroPhotos[p.slug];
  /* the first sold item is already the large photo at the top, so the cards start with the second */
  const real = soldOf(p), rest = own ? real : real.slice(real.length && real[0].img ? 1 : 0);
  const list = rest.length ? rest : (o.samples && !real.length ? [1, 2, 3, 4].map(() => ({ sample: true, item: 'Item name', price: '$ Sale price' })) : []);
  if (!list.length) return '';
  return `<section class="band sold">
    <div class="wrap">
      <h2 class="wide">Recently sold</h2>
      <ul class="sold-list n${Math.min(list.length, 4)}">
        ${list.slice(0, 8).map(x => `<li>${x.img ? `<img src="${esc(x.img)}" alt="${esc(x.item)}" loading="lazy" width="880" height="660">` : `<div class="sold-ph">${x.sample ? 'Your photo' : ''}</div>`}
          <div class="sold-t"><b>${esc(x.item)}</b><span class="sold-p">${esc(x.price)}</span>${x.sample ? '<i>Sample layout</i>' : ''}</div></li>`).join('\n        ')}
      </ul>
    </div>
  </section>`;
}
function factsBand(p) {
  if (!p.facts || !p.facts.length) return '';
  return `<section class="facts">
    <div class="wrap">
      <ul>
        ${p.facts.map(([t, d]) => `<li><b class="wide">${esc(t)}</b><span>${esc(d)}</span></li>`).join('\n        ')}
      </ul>
    </div>
  </section>`;
}
function quotesBand(p) {
  if (!p.quotes || !p.quotes.length) return '';
  return `<section class="band quotes">
    <div class="wrap">
      ${p.quotes.slice(0, 3).map(q => `<figure><blockquote>${esc(q.text)}</blockquote><figcaption>${esc(q.who)}</figcaption></figure>`).join('\n      ')}
    </div>
  </section>`;
}
function fitBand(p) {
  if (!p.fit) return '';
  return `<section class="band fit">
    <div class="wrap">
      <h2 class="wide minor">${esc(p.fit.title)}</h2>
      <ul class="fit-list">
        ${p.fit.items.map(([t, d]) => `<li><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join('\n        ')}
      </ul>
    </div>
  </section>`;
}
function faqBand(p, o) {
  if (!p.faq || !p.faq.length) return '';
  return `<section class="band faq">
    <div class="wrap">
      <h2 class="wide minor">Questions sellers ask</h2>
      <div class="faq-list">
        ${p.faq.filter(f => !f[2] || isLive(f[2][0])).map(([q, a, link]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}${link ? ` <a href="${link[0] + o.ext}">${esc(link[1])}</a>.` : ''}</p></details>`).join('\n        ')}
      </div>
    </div>
  </section>`;
}
function ctaBand(p) {
  if (!p.cta) return '';
  return `<section class="cta">
    <div class="wrap">
      <h2 class="wide">Start with a free consultation</h2>
      <p>No fees and no commitment.</p>
      <div class="cta-row"><a class="btn solid" href="#tell">Tell us what you have</a><a class="btn" href="tel:${PHONE.tel}">Call ${PHONE.text}</a></div>
    </div>
  </section>`;
}

const steps = `<section class="band">
    <div class="wrap">
      <h2 class="wide">How selling works</h2>
      <ol class="steps">
        <li><h3>Free consultation</h3><p>Send the form or call. We talk through what you have, with no fees and no commitment.</p></li>
        <li><h3>We look it over</h3><p>We come see it or work from your photos, then agree on terms and any reserve with you.</p></li>
        <li><h3>It goes to auction</h3><p>We photograph it, advertise it and put it in front of bidders.</p></li>
        <li><h3>You get paid</h3><p>When the sale closes, we collect from the buyers and pay you.</p></li>
      </ol>
    </div>
  </section>`;

const reach = `<section class="band reach">
    <div class="wrap">
      <div>
        <h2 class="wide">Where equipment sells</h2>
        <p>Your equipment is listed in front of thousands of buyers from all 50 states and several countries.</p>
      </div>
      <ul class="sites wide">
        <li>MatthewsAuctioneers.com</li>
        <li>EquipmentFacts.com</li>
        <li>AuctionTime.com</li>
      </ul>
    </div>
  </section>`;

/* photos: [{ src, alt }] — real photos only. With none, the band is left out. */
function photoBand(photos) {
  if (!photos || !photos.length) return '';
  return `<section aria-label="Photos"><div class="shots n${Math.min(photos.length, 3)}">${photos.slice(0, 3).map(p => `<figure><img src="${esc(p.src)}" alt="${esc(p.alt || '')}" loading="lazy"></figure>`).join('')}</div></section>`;
}

function frontPage(o) {
  const body = `  <section class="hero">
    <div class="wrap">
      <h1 class="wide">Consider it sold.</h1>
      <div class="hero-cols">
      <div class="hero-left">
        <p class="hero-sub">We sell equipment, dealer trade-ins, estates and real estate at auction. ${OFFER}</p>
        ${reachMe}
        <p class="ask" id="ask">What do you have to sell?</p>
        <nav class="lots" aria-labelledby="ask">
          ${LIVE.map(p => `<a href="${p.slug + o.ext}"><span class="wide">${esc(p.lot)}</span><span>${esc(p.blurb)}</span></a>`).join('\n          ')}
        </nav>
      </div>
      ${form(null)}
      </div>
    </div>
  </section>
  ${photoBand(o.photos)}
  ${steps}
  ${reach}
`;
  return layout(Object.assign({}, o, { title: 'Sell with Matthews Auctioneers', description: 'Sell equipment, dealer trade-ins, estates and real estate at auction with Matthews Auctioneers. Free consultation, no fees, no commitment.', body, current: '' }));
}

function programPage(p, o) {
  const others = LIVE.filter(x => x.slug !== p.slug);
  const body = `  <section class="hero prog">
    <div class="wrap">
      <h1 class="wide">${esc(p.title)}</h1>
      <div class="hero-cols">
      <div class="hero-left">
        <p class="hero-sub">${esc(p.lead)}${p.leadOnly ? '' : ' ' + OFFER}</p>
        ${reachMe}
        ${heroPhoto(p, o)}
        ${p.points ? `<ul class="points">
          ${p.points.map(t => `<li>${esc(t)}</li>`).join('\n          ')}
        </ul>` : ''}
        ${p.sells ? `<div class="sells-box"><h2 class="sells-h">${esc(p.sellsTitle)}</h2>
        <ul class="sells">${p.sells.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      </div>
      ${form(p)}
      </div>
    </div>
  </section>
  ${factsBand(p)}
  ${soldBand(p, o)}
  ${fitBand(p)}
  ${steps}
  ${p.reach ? reach : ''}
  ${quotesBand(p)}
  ${faqBand(p, o)}
  ${ctaBand(p)}
  ${p.funnel || !others.length ? '' : `<section class="band more">
    <div class="wrap">
      <p class="ask" id="more">Have something else to sell?</p>
      <nav class="lots" aria-labelledby="more">
        ${others.map(x => `<a href="${x.slug + o.ext}"><span class="wide">${esc(x.lot)}</span><span>${esc(x.blurb)}</span></a>`).join('\n        ')}
      </nav>
    </div>
  </section>`}
`;
  return layout(Object.assign({}, o, { title: p.title + ' | Matthews Auctioneers', description: p.lead + ' Free consultation, no fees, no commitment.', body, current: p.slug, funnel: !!p.funnel }));
}

/* With a single live program there is nothing to choose between, so the site's front address forwards to it.
   Team sign-in links that land here are still handed to the CRM first. A tag such as ?src=main-site is kept. */
function forwardPage(p, o) {
  const to = p.slug + o.ext;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>${esc(p.title)} | Matthews Auctioneers</title>
<script>
if (/(access_token|refresh_token|error_description|type=(invite|recovery|signup|magiclink))/.test(location.hash)) location.replace('crm/' + location.hash);
else location.replace(${JSON.stringify(to)} + location.search);
</script>
<noscript><meta http-equiv="refresh" content="0; url=${esc(to)}"></noscript>
</head>
<body><p><a href="${esc(to)}">${esc(p.title)}</a></p></body>
</html>
`;
}

/* Returns { 'index.html': html, 'equipment.html': html, ... }
   all: include every program, published or not (previews and tests only; the live build leaves it off).
   samples: show the empty "recently sold" layout with placeholders, for previews only. */
export function buildSite({ config = { url: '', key: '' }, ext = '', photos = [], heroPhotos = {}, samples = false, all = false } = {}) {
  const o = { config, ext, photos, heroPhotos, samples };
  LIVE = PROGRAMS.filter(p => all || p.published);
  const out = { 'index.html': LIVE.length === 1 ? forwardPage(LIVE[0], o) : frontPage(o) };
  for (const p of LIVE) out[p.slug + '.html'] = programPage(p, o);
  LIVE = PROGRAMS;
  return out;
}
