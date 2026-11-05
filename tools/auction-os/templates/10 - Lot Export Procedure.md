# Matthews Auction OS — Lot Export Procedure

## PURPOSE

How to find auctions that need marketing on the Matthews Auctioneers admin site and download their lot exports.

Auction URLs change with every auction. Never save or reuse an auction URL from a previous run. Always start from the admin dashboard and find auctions there.

---

# 1. START AT THE ADMIN DASHBOARD

Go to: https://www.matthewsauctioneers.com/admin/

Use Stephen's Chrome, where he is already signed in. If a login page appears instead of the dashboard, stop and ask Stephen to sign in. Never type or store his password.

The dashboard shows one card per current auction. Each card shows:

- Auction thumbnail/banner
- Lot count, views, watches
- Bid count and bid total
- Invoice and statement balances
- Closing time: "ends MM/DD/YYYY H:MM PM" (timed online auctions) or "starts MM/DD/YYYY H:MM AM" (auctions that begin at a set time)
- A VIEW button

---

# 2. DECIDE WHICH AUCTIONS ARE NEW

Read every card on the dashboard. For each auction, record:

- Auction name (shown as the page heading after clicking VIEW, e.g. "Galax, VA October 16, 2026")
- Lot count
- Ends/starts date and time
- The auction's admin URL (from the browser address bar after clicking VIEW)

Compare against the auction log (Section 6).

**Current scope: weekly Galax and Dublin auctions only.**

- Galax weekly: Friday close, Galax, VA (auction name like "Galax, VA October 16, 2026")
- Dublin weekly: Wednesday close, Dublin, VA (auction name like "Dublin, VA ...")

Identify them by the auction name on the auction's page heading, not by the thumbnail banner. Skip every other auction (equipment, estate, other locations) unless Stephen asks for it by name. If a card's name is unclear, open it with VIEW to check the heading, then go back.

An in-scope auction needs work when:

- It is not in the log, **and**
- Its ends/starts date is in the future, **and**
- It has lots loaded (lot count well above the 1 informational "PLEASE READ" lot)

An auction already in the log continues only from the stage where it stopped (see Section 6). Never redo a completed stage unless Stephen asks.

If several auctions qualify, list them for Stephen with their closing dates before starting, so he can confirm or skip any.

---

# 2A. PREFERRED: READ THE PUBLIC CATALOG (no login needed)

The public auction page has everything marketing needs, plus live buyer interest:

1. Open https://www.matthewsauctioneers.com/auctions and find the Dublin/Galax auction link (e.g. `/auctions/29935-dublin-va-october-21-2026`). The auction number is in the URL.
2. Open it with `?pageSize=500` so all lots load on one page.
3. Read each lot card: lot number, title, item condition, transferable, current bid, bids, **watching**, lot URL, and image URL.
4. Watching counts are the best signal of what buyers want. Use them to choose categories and standout lots.
5. Images: the card shows `.../mat/YYYY/M/medium/<id>.jpeg`. Use the `/large/` size (about 1650 px) for posts and graphics. There is no other full-size path.
6. Each lot page has more photos. The first is usually a retailer stock photo, sometimes a screenshot of a store web page with buttons or ratings in the frame; the rest are usually photos of the sealed box. Crop out web-page clutter (hosting the cropped copy with the graphics) or choose a different lot.

Use the admin export (below) only when something the public page lacks is needed, such as the set-lots sale order.

# 3. OPEN THE AUCTION'S LOTS PAGE

1. Click VIEW on the auction's dashboard card.
2. The auction dashboard opens with the auction name at the top and a left sub-menu (Dashboard, Edit, Highlights, Documents, Contacts, Lots, Lot Photos, Lot Stats, Bidders, Consignor, Invoices, Statements, Reports, Notes, Notifications).
3. Click **Lots** in the sub-menu. Its badge shows the lot count.
4. Confirm the lots table header shows the expected total ("XXXX total record(s)") and the auction name is correct.

---

# 4. EXPORT THE FULL LOT LIST

This is the main file for marketing. It includes lot numbers, control numbers, titles, descriptions, and main image URLs.

1. On the Lots page, open the **lots actions menu**: the small dropdown arrow beside the "Create Lot" button, top right of the lots table.
2. Click **Export Lots**.
3. The file downloads to Stephen's Downloads folder. Note the exact filename and confirm the download finished before moving on.

The menu also contains Import Lots, Quick Lot, Mass Update, Return To Inventory, Transfer Lots, and Print Auction Catalog. Do not click any of these. Import, Mass Update, Return To Inventory, and Transfer Lots change live auction data.

---

# 5. EXPORT THE SET-LOTS (SALE ORDER) SPREADSHEET — WHEN NEEDED

Only needed for sale-order work (see Sale Order Optimization). Skip it for marketing-only runs.

1. Open the lots actions menu again.
2. Click **Set Lots**. A "Set Lots" dialog opens with a drag-and-drop upload area.
3. Click the **Export Lots** button in the bottom-left of that dialog. The set-lots spreadsheet downloads.
4. Click **Cancel** to close the dialog.

Never drag or browse a file into this dialog unless Stephen has approved a finished sale order. Uploading a file here changes the live sale order.

---

# 6. AUCTION LOG

Keep a log file named `auction-log.csv` in the Matthews Auction OS folder on Stephen's computer.

Columns:

Auction Name, Auction Admin URL, Public Auction URL, Lot Count, Closes, Export File, Marketing Built, Social Sheet Updated, CRM Imported, Notes

- Fill in the first five columns when an auction is first found.
- Record the export filename once it has downloaded.
- Mark each stage with its completion date as it finishes. Leave a stage blank until it is truly done.
- If a run stops partway (for example, waiting on Stephen's approval before CRM import), the next run resumes at the first blank stage.
- Write a short reason in Notes whenever a stage is skipped or blocked.

The Public Auction URL is the buyer-facing page used in posts and emails. Get it from the export or the public site, never by editing the admin URL by hand.

---

# 7. WEEKLY RUN SCHEDULE

All lots must be on the auction by the evening before it closes.

## Galax (closes Friday)

Lots added Tuesday, Wednesday, Thursday. Deadline Thursday evening.

- Tuesday late afternoon: opening announcement + gallery of first lots loaded
- Wednesday late afternoon: posts from lots added since Tuesday
- Thursday evening (after deadline): Thursday's new lots + final-day posts (Ends Tomorrow / Ends Tonight / Final Hours) + buyer email from the full catalog

## Dublin (closes Wednesday)

First batch Friday evening; rest added Monday and Tuesday; most lots in by Monday night. Deadline Tuesday evening.

- Saturday morning: opening announcement + gallery from Friday's batch
- Monday evening: main build from the nearly complete catalog (category and item features)
- Tuesday evening (after deadline): any late lots + final-day posts + buyer email from the full catalog

## Posting calendar (Instagram)

The weekly auctions get at most **2 Instagram items per day combined**: normally **1 feed post + 1 story**. Feed posts carry galleries, features, and the most important deadline posts (they reach new people). Stories carry reminders (they reach current followers). When both auctions are open, the slots alternate between them. Default slots: 11:00 AM and 6:30 PM ET, except where noted.

| Day | 11:00 AM | 6:30 PM |
|---|---|---|
| Sat | Dublin — opening gallery (FEED) | — |
| Sun | — | Dublin — category feature (FEED) |
| Mon | Dublin — category feature (FEED) | Dublin — "Ends Wednesday" reminder (STORY) |
| Tue | **Dublin — MAIN POST (FEED)** | Galax — opening gallery (FEED) |
| Wed | Dublin — Final Hours (STORY, 4:00 PM, posted manually by Stephen) | Galax — category feature (FEED, 7:30 PM, after Dublin closes) |
| Thu | **Galax — MAIN POST (FEED)** | Galax — Ends Tomorrow (STORY) |
| Fri | Galax — Ends Tonight at 7 PM (FEED) | Galax — Final Hours (STORY, 4:00 PM) |

12 items a week: 8 feed posts and 4 stories (Dublin 4 feed + 2 stories; Galax 4 feed + 2 stories).

**MAIN POST — the day before each auction closes (Dublin Tuesday, Galax Thursday, 11:00 AM).** This is the post Stephen shares to groups and pays to promote, so it gets the most care:

- A broad mix, not one category: the strongest lots across 4–6 different categories, with at least one big-ticket item.
- Collage graphic: auction name, lot count, "ENDS TOMORROW AT 7 PM" with the day and date, and 6–9 of the best photos across categories. Then 9 lot photos (10 images max), each from a different category where possible.
- Caption works for strangers as well as followers: what the auction is, where it is (town), the categories in it, 3–5 standout lots by name, the exact closing day and time, pickup location, and how to bid.
- Build it from the most complete catalog available at the time (Dublin: Monday-evening run; Galax: Wednesday run).
- **Posts to Facebook and Instagram.** It is the only weekly post that also goes to the Matthews Auctioneers Facebook page (so Stephen can share it to groups and boost it). Because Genie Rocket applies the selected accounts to every row in an upload, the main post goes in its **own CSV upload** with both the Facebook page and Instagram selected. In that row: Facebook type = post, Instagram type = post, OGmetaUrl = auction URL, followUpComment = "Bid here: <auction URL>". Same caption on both (no URL in the caption itself).
- When it is scheduled, alert Stephen with: the graphic, the caption, the auction URL, and a short version of the caption with the URL included, ready to paste when sharing to groups. Saturday and Sunday get one Dublin feed post each. Never schedule anything for an auction after it closes.

Feed posts: collage graphic first, then up to 9 lot photos (10 images max), caption written per the Social Campaign Playbook.

**Category features are the default content.** Every "category feature" slot showcases one buyer category from the current auction, not a single item:

- Pick categories with real depth in that auction's lots (e.g. Appliances, Furniture, Tools & Hardware, Outdoor & Lawn, Building Materials, Home Décor, Electronics, Kitchen). Choose from what the export actually contains, never a fixed list.
- Collage graphic: the category name as the headline (e.g. "APPLIANCES"), the auction name and closing day, 4–6 of the category's best lot photos. Then 5–9 lot photos from that category.
- Caption: category hook, 3–5 specific standout lots by name, closing day and time, call to action.
- Rotate categories: never feature the same category twice in one week for the same auction, and avoid repeating last week's lead category when another has depth.
- A single-item feature replaces a category slot only when one lot is a true standout (major appliance, vehicle, equipment, unusual find). At most one single-item feature per auction per week.
- Stories may also take a category angle (e.g. "Ends Tomorrow — Furniture & Appliances").

Stories: one vertical 1080×1920 collage graphic, a single image. Stories show no caption and the CRM cannot add link stickers, so everything goes on the graphic itself: the auction name, the deadline ("Ends Tomorrow at 7 PM"), 3–6 lot photos, and "Bid at MatthewsAuctioneers.com". In the CSV, set Instagram type = story and leave content short (it is not shown).

**Exception: each auction's "Final Hours" story is posted manually by Stephen** so he can add a link sticker: Dublin on Wednesday at 4:00 PM, Galax on Friday at 4:00 PM. Do not put these in the CSV. In the final run before each close (Dublin Tuesday evening, Galax Thursday evening):

1. Build the 1080×1920 Final Hours story graphic. Leave clear space in the lower third for the link sticker.
2. Save it to the Matthews OS folder on Stephen's computer under `To Post/` as `YYYY-MM-DD <Auction> Final Hours Story.jpg`, and send it to him in the conversation.
3. Alert Stephen with: the graphic, the auction URL for the link sticker, and the post time (4:00 PM on closing day).
4. Mark it in the auction log Notes as "Final Hours story sent to Stephen."

Which run builds which posts:

- Dublin Saturday-morning run: Sat–Mon Dublin posts (from Friday's batch)
- Dublin Monday-evening run: Tue Dublin MAIN POST, Wed Dublin posts, plus the Dublin email
- Galax Tuesday late-afternoon run (must finish before 6:30 PM): Tue and Wed Galax posts
- Galax Wednesday run: Thu Galax MAIN POST and story
- Galax Thursday-evening run: Fri Galax posts, plus the Galax email

## Each run

1. Read the lot count on the auction's dashboard card and compare it to the last count in the auction log.
2. If only a handful of lots are new and it is not the final run, log the count and stop.
3. Otherwise export lots, identify lots added since the last run (by lot/control number), and build posts mainly from those.
4. Never rebuild posts already approved or imported.
5. Always confirm the actual closing date and time from the export before writing any urgency posts.
6. End by alerting Stephen that posts are ready for his approval before CRM import.

---

# 8. SAFETY RULES

- Read-only on the admin site except for downloading exports.
- Never edit lots, alert text, highlights, or auction settings.
- Never upload files to Import Lots or Set Lots without Stephen's explicit approval.
- Dismiss pop-up notices (for example, the green "Shipping Report" banner) only with their close (×) button.
- If the page layout no longer matches these steps, stop and tell Stephen what changed rather than guessing.
