// The public "Sell with Matthews" pages: one front page and one page per program,
// all built from the template below. Edit the wording here; build.mjs writes the files.
//
// Wording marked DRAFT is a first pass for Matthews to correct. Figures and claims on the
// dealer page and in "Where equipment sells" come from the dealer trade-in brochure.

export const PHONE = { text: '(276) 235-0153', tel: '+12762350153' };
export const EMAIL = 'stephen@matthewsauctioneers.com';
export const MAIN_SITE = 'https://www.matthewsauctioneers.com/';
const OFFER = 'Start with a free consultation: no fees, no commitment.';

export const PROGRAMS = [
  {
    slug: 'equipment', nav: 'Equipment', lot: 'Equipment', pick: 'Equipment',
    blurb: 'One machine or a whole fleet. Trucks, trailers and building materials too.',
    title: 'Sell your equipment at auction',
    lead: 'One machine or a whole fleet, we handle the sale from the first look to the final payment.',
    points: [
      'Sold online to thousands of buyers from all 50 states and several countries.',
      'Listed on MatthewsAuctioneers.com, EquipmentFacts.com and AuctionTime.com.',
      'We take all types of units, from a single attachment to a full fleet.',  // DRAFT
    ],
    sellsTitle: 'What we sell',
    sells: ['Excavators', 'Skid steers', 'Dozers', 'Wheel loaders', 'Backhoes', 'Trucks', 'Trailers', 'Farm equipment', 'Forklifts', 'Attachments', 'Building materials'],
    reach: true,
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

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ext is '' on the live site (clean addresses) and '.html' when the files are opened straight from disk. */
function layout({ title, description, body, ext, config, current }) {
  const href = p => p.slug + ext;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" type="image/png" href="img/favicon.png">
<link rel="preload" href="fonts/archivo-wdth.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="site.css">
<script>
/* Sign-in, invite and password links from the team's email land on this address; hand them to the CRM. */
if (/(access_token|refresh_token|error_description|type=(invite|recovery|signup|magiclink))/.test(location.hash)) location.replace('crm/' + location.hash);
</script>
</head>
<body>

<header class="top">
  <div class="wrap">
    <a class="top-logo" href="./"><img src="img/logo-wide.png" alt="Matthews Auctioneers. Consider it sold." width="242" height="74"></a>
    <nav class="top-nav" aria-label="Programs">
      ${PROGRAMS.map(p => `<a href="${href(p)}"${current === p.slug ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`).join('\n      ')}
    </nav>
    <a class="top-phone" href="tel:${PHONE.tel}">${PHONE.text}</a>
    <a class="btn" href="${MAIN_SITE}">Bid at MatthewsAuctioneers.com</a>
  </div>
</header>

<main>
${body}
  <section class="buy">
    <div class="wrap">
      <div>
        <h2 class="wide">Here to buy?</h2>
        <p>Current auctions and bidding are on our main site.</p>
      </div>
      <a class="btn solid" href="${MAIN_SITE}">Go to MatthewsAuctioneers.com</a>
    </div>
  </section>
</main>

<footer class="foot">
  <div class="wrap">
    <img src="img/logo-stacked.png" alt="Matthews Auctioneers" width="150" height="129">
    <div>
      <h3>Sell with us</h3>
      <ul>
        ${PROGRAMS.map(p => `<li><a href="${href(p)}">${esc(p.nav)}</a></li>`).join('\n        ')}
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
</footer>

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

/* The form is the same everywhere; a program page preselects what the person has. */
function form(program) {
  const picks = PROGRAMS.map(p => p.pick).concat('Something else');
  return `<form class="tell" id="tell" novalidate>
        <h2>Get a free consultation</h2>
        <p>No fees and no commitment. Tell us what you have and we'll call you.</p>
        <p class="tell-err" id="tell-err" role="alert" hidden></p>
        <label>Your name<input type="text" name="name" autocomplete="name" maxlength="120" required></label>
        <label>Phone<input type="tel" name="phone" autocomplete="tel" inputmode="tel" maxlength="40" required></label>
        ${program && program.company ? `<label><span>${esc(program.company)} <small>optional</small></span><input type="text" name="company" autocomplete="organization" maxlength="160"></label>` : ''}
        <label>What do you have?
          <select name="program">
            ${picks.map(v => `<option${program && program.pick === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}
          </select>
        </label>
        <label><span>A few details <small>optional</small></span><textarea name="details" maxlength="2000" placeholder="For example: 2015 excavator, two dump trailers, located near Galax"></textarea></label>
        <label class="hp" aria-hidden="true">Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        <button class="btn red" type="submit">Request my free consultation</button>
        <p class="tell-call">Prefer to talk? Call <a href="tel:${PHONE.tel}">${PHONE.text}</a></p>
      </form>`;
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
      <div>
        <p class="hero-sub">We sell equipment, dealer trade-ins, estates and real estate at auction. ${OFFER}</p>
        <p class="ask" id="ask">What do you have to sell?</p>
        <nav class="lots" aria-labelledby="ask">
          ${PROGRAMS.map(p => `<a href="${p.slug + o.ext}"><span class="wide">${esc(p.lot)}</span><span>${esc(p.blurb)}</span></a>`).join('\n          ')}
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
  const others = PROGRAMS.filter(x => x.slug !== p.slug);
  const body = `  <section class="hero prog">
    <div class="wrap">
      <h1 class="wide">${esc(p.title)}</h1>
      <div class="hero-cols">
      <div>
        <p class="hero-sub">${esc(p.lead)} ${OFFER}</p>
        <ul class="points">
          ${p.points.map(t => `<li>${esc(t)}</li>`).join('\n          ')}
        </ul>
        ${p.sells ? `<h2 class="sells-h">${esc(p.sellsTitle)}</h2>
        <ul class="sells">${p.sells.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      </div>
      ${form(p)}
      </div>
    </div>
  </section>
  ${steps}
  ${p.reach ? reach : ''}
  <section class="band more">
    <div class="wrap">
      <p class="ask" id="more">Have something else to sell?</p>
      <nav class="lots" aria-labelledby="more">
        ${others.map(x => `<a href="${x.slug + o.ext}"><span class="wide">${esc(x.lot)}</span><span>${esc(x.blurb)}</span></a>`).join('\n        ')}
      </nav>
    </div>
  </section>
`;
  return layout(Object.assign({}, o, { title: p.title + ' | Matthews Auctioneers', description: p.lead + ' Free consultation, no fees, no commitment.', body, current: p.slug }));
}

/* Returns { 'index.html': html, 'equipment.html': html, ... } */
export function buildSite({ config = { url: '', key: '' }, ext = '', photos = [] } = {}) {
  const o = { config, ext, photos };
  const out = { 'index.html': frontPage(o) };
  for (const p of PROGRAMS) out[p.slug + '.html'] = programPage(p, o);
  return out;
}
