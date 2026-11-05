# Matthews Auction OS: Weekly Auction Marketing Playbook

How Claude runs marketing for the Matthews Auctioneers weekly online returns auctions (Galax and Dublin) and the equipment auctions. Tools live in `sellwithmatthews/tools/auction-os/`.

## 1. Accounts and systems

| System | What it's for | Notes |
|---|---|---|
| matthewsauctioneers.com | Auction catalog (public) and admin (Set Lots / sale order) | Auction URL looks like `/auctions/29948-galax-va-november-6-2026`; lots are `/auctions/<id>/lot/<lotId>` |
| Lot photos (CDN) | `https://d3j17a2r8lnfte.cloudfront.net/mat/YYYY/M/{large|medium}/<file>` | Real photos only, never AI images |
| Genie Rocket social planner | Schedules FB and IG posts from a CSV | `https://app.genierocket.com/v2/location/8hYKYxEAcjcJKA0KmkTs/marketing/social-planner/csv` |
| Constant Contact | Marketing email | Connector plus the web app for scheduling and lists |
| sellwithmatthews (GitHub, Vercel) | Hosts the graphics so Genie Rocket can fetch them | `https://sellwithmatthews-seven.vercel.app/crm/social/<folder>/<file>` (CORS open to app.genierocket.com) |

- **Pickup (Galax):** 299 E Virginia St, Galax, VA 24333
- **Phone in emails:** 276-530-1900
- **Lots close:** Galax closes Fridays and Dublin closes Wednesdays, starting at 7 PM ET. This is changing: see the biweekly restructure, which moves to Tuesday closes.

## 2. Ground rules

- **Approval:** Stephen approves before anything is scheduled or sent. When a request says to post, send, schedule or set, that request is the approval. Otherwise, build everything, show it, and ask.
- **Ask clearly:** when something needs his OK, say so in plain words at the top of the reply.
- **Photos:** real lot photos only. Check every photo on a contact sheet first, and skip any photo with a "READ DESCRIPTION" banner or a bad crop.
- **Captions:** describe condition honestly (new, open box, used/tested, as-is). Every caption ends with the standard tail (section 4).
- **Checks:** run as needed, not as recurring scheduled tasks.

## 3. Step 1: Scrape the lots

Use Chrome on any matthewsauctioneers.com page (robots.txt works well) and run the scrape in the background:

- Fetch `/auctions/<slug>?pageSize=100&page=N` for N = 1, 2, ...
- Parse each page with DOMParser on `a.imgContainer[href*="/lot/"]`.
- Store one row per lot in `window._d` as `lot|id|watch|price|cond|slug|imgpath`, and set `window._dd = 'done'` at the end.

Then rank the lots by `price + 0.5 × watchers` and read the top ~100. Write them into a `<pre>` element and read it with get_page_text.

Build `lots.json` (see `example/lots.json`):

```json
{"auction": "...", "auction_url": "...", "closes": "YYYY-MM-DD 19:00", "lot_count": N,
 "lots": {"C-33-G": {"title": "...", "cond": "Used - Tested", "href": "/auctions/29948/lot/577683",
                     "img": "https://d3j17a2r8lnfte.cloudfront.net/mat/2026/11/large/<file>.jpeg"}}}
```

Download about 20–30 candidate photos and make a contact sheet. Pick from that sheet.

## 4. Step 2: Social posts (FB and IG through Genie Rocket)

**Write `posts.json`.** `example/mkposts.py` generates a full campaign and is the easiest starting point. Each post has:
- `id`, `when` (`YYYY-MM-DD HH:MM:SS` ET), `type` (`post` or `story`), `facebook`, `instagram`
- `graphic`: file, `format` (`square` or `story`), kicker, headline, band and 6 photo keys
- optional `extra_graphics`
- `photos` (extra lot photos)
- `caption`, `followUpComment` (`"Bid here: " + auction URL`)

Limits: at most 10 images per post, and stories have one image and no caption.

**Collage layout:** with 6 photos, the first two fill the wide top cells. Put wide items (miter saws, microwaves) first and tall items (freezers, fridges) in the bottom row.

**Caption tail:**

> Lots begin closing {Friday, November 6 / tonight} at 7 PM ET. Pickup at 299 E Virginia St, Galax, VA. Condition ranges from new to open box to used and as-is, so check each listing's photos and notes before you bid.
>
> Bid at MatthewsAuctioneers.com
>
> #MatthewsAuctioneers #OnlineAuction #GalaxVA #VirginiaAuction

**Standard cadence** (built for an auction closing Friday at 7 PM):

| When | Post |
|---|---|
| Day before, 5:00 PM | MAIN post: "1,250+ Lots End Tomorrow." 10 images: main collage, 4 category collages and 5 photos. Long caption grouped by category. This is the one to boost with FB ads. |
| Day before, 5:01 PM | Story |
| Day before, 7:00 PM | Tools & Shop |
| Day before, 8:30 PM | Appliances & Kitchen |
| Close day, 9:00 AM | Ends Tonight (3 graphics + photos) |
| Close day, 11:00 AM | Yard & Outdoor |
| Close day, 1:00 PM | DeWalt & Craftsman cordless |
| Close day, 3:00 PM | Home & More |
| Close day, 6:00 PM | Final Hour |

**Build:**

```
cd tools/auction-os
POSTS=posts.json CSV=galax.csv python3 -I build_campaign.py <auction_dir> <YYYY-MM-DD-galax> [--csv-only]
```

This renders the graphics, copies them into `social/<folder>/` in the repo and writes the Advanced CSV. Review a contact sheet of the graphics before going further.

**Split into FB and IG CSVs.** Keep the two header rows as they are and edit data rows only:
- **FB:** clear column 13 (IG type).
- **IG:** clear column 12 (FB type), column 2 (OG url) and column 11 (follow-up comment). Replace "Bid at MatthewsAuctioneers.com" with "Bid now (link in bio)".

**Host:** copy the CSVs into `social/<folder>/`, then `git pull`, commit and push to main. Vercel deploys in about a minute; check that one image URL returns 200 before uploading.

**Upload to Genie Rocket, once per CSV:**
1. Open the CSV page and click the "Advance Format" card (the leaf text node, 4 parents up).
2. Fetch the CSV from the Vercel URL, put it in the `input[type=file]` with a DataTransfer, and click Next.
3. Click "Select a social account" and use find to list the checkboxes. FB is the first "Matthews Auctioneers"; IG is "matthewsauctioneers". Click the one you need, then press Escape.
4. Verify the right platform shows under "Post to".
5. Click Create and wait for the URL to change to `csv/<id>`. Check the post count, dates and image count.
6. Click Schedule (wait until it's enabled), then Import.
7. Confirm the CSV list shows Completed with the right post count.

## 5. Step 3: Constant Contact email

**Template:** `templates/email-ends-tonight.html`. Swap in the auction URL, date, lot count, intro paragraph and the 8 lot cards (2 per row). The page must include `[[trackingImage]]`. Preview it with `templates/email-screenshot.js` (Playwright) and send Stephen the PNG.

**Create** with the Constant Contact connector `create_email`:
- `format_type` 5
- `physical_address_in_footer`: Matthews Auctioneers, 299 E Virginia St, Galax, VA 24333, US
- Subject example: "Ends Tonight: 1,250+ Lots in Galax"

**Schedule in the web app:**
1. Open `app.constantcontact.com/pages/campaigns/view/schedule/campaignId/<campaign_id>`.
2. Click the "Schedule for later" label.
3. Open the date field, click the day, then find, scroll to and click the time option.
4. Click "Type to search" and select the lists by exact name. Never use Select all.
5. Click Schedule and confirm the status reads Scheduled.

**Lists:**
- **Weekly returns auctions (8):** Auction Addicts, Auctions, Christiansburg Auctions, Dublin, Galax, North carolina, Text Marketing, Website. About 18,300 recipients.
- **Equipment auctions:** Tool & Equipment and Website.

**Typical timing:** an "Ends Tomorrow" email the evening before (optional, needs Stephen's OK) and an "Ends Tonight" email at noon on closing day.

## 6. Step 4: Set the sale order (lot close sequence)

See `templates/02 - Sale Order Optimization.md` and `templates/10 - Lot Export Procedure.md`.

1. **Export:** Admin → auction → Lots → Set Lots → Export Lots. This needs a real coordinate click; a JS click won't download. To convert CSS coordinates to screenshot coordinates, multiply by 1568 / innerWidth. The file saves as `Downloads\setlots-template (N).xlsx`; bring it in through the device bridge.
2. **Build the order:** `saleorder/order.py` with `cat.py`. Inputs are `interest.txt` (`lot|watch|bids|price`) and the template.
   - Heavy-interest lots go in the middle of the sale.
   - Grills, pressure washers, freezers, refrigerators, e-bikes and snow throwers are spaced at least 20 apart.
   - Building-material runs are grouped around the 0.50 point.
3. **Upload:**
   - Temporarily add a `/crm/social/xfer/(.*)` CORS header for `https://www.matthewsauctioneers.com` in `vercel.json` and push the file.
   - Fetch it into a DataTransfer on the file input, then make a real click on Update.
   - Afterwards, remove the xfer folder and the header.
4. **End times:** uploading a sale order does not re-stagger end times. Re-saving the stagger on the Edit page (Qty 1000 / 240 min) changes live end times, so only do it with Stephen's explicit OK.

## 7. Known issues

- **Chrome tab hangs:** open a new tab and run long work async in the background, then poll for the result.
- **Genie Rocket refs:** the checkbox refs can change, so run find every time. Picking the wrong account once left a stray "In Review" draft.
- **Account banner:** Genie Rocket shows an expired connection for the "Auctions in Virginia" FB page. It's separate from the Matthews Auctioneers page and doesn't affect these uploads.
- **Constant Contact page load:** the schedule page can redirect during load. Wait a few seconds, then take the screenshot.
