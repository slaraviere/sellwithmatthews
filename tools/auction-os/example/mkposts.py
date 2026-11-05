import json
URL="https://www.matthewsauctioneers.com/auctions/29948-galax-va-november-6-2026"
K="Galax Online Auction • 1,250+ Lots"
def tail(day): return f"\n\nLots begin closing {day} at 7 PM ET. Pickup at 299 E Virginia St, Galax, VA. Condition ranges from new to open box to used and as-is, so check each listing's photos and notes before you bid.\n\nBid at MatthewsAuctioneers.com\n\n#MatthewsAuctioneers #OnlineAuction #GalaxVA #VirginiaAuction"
FRI="Friday, November 6"; TON="tonight, Friday, November 6,"
def g(file,head,band,photos,kicker=K): return dict(file=file,format='square',kicker=kicker,headline=head,band=band,photos=photos)
def post(id_,when,gr,photos,cap,extra=None):
    d=dict(id=id_,when=when,type='post',facebook=True,instagram=True,graphic=gr,photos=photos,caption=cap,followUpComment="Bid here: "+URL)
    if extra: d['extra_graphics']=extra
    return d
TOOLS=["C-33-G","N-263-G","D-17-G","N-159-G","N-281-G","C-17-G"]
APPL=["B-441-G","D-48-G","B-457-G","B-461-G","C-28-G","C-29-G"]
YARD=["B-470-G","C-24-G","B-464-G","N-142-G","B-443-G","M-271-G"]
HOME=["C-47-G","N-303-G","B-469-G","M-555-G","B-435-G","A-5-G"]
CORD=["D-43-G","N-197-G","N-159-G","D-46-G","N-312-G","N-281-G"]
MAIN=["B-431-G","C-33-G","B-470-G","N-159-G","C-17-G","C-29-G"]
EB="Ends Friday • 7 PM ET"; TB="Ends Tonight • 7 PM ET"
main_cap=("\U0001F6A8 1,250+ LOTS END TOMORROW NIGHT \U0001F6A8\n\nThis week's Galax online auction is our biggest in a while: DeWalt and Craftsman tools, appliances, kitchen goods, yard equipment and home items from major retailer returns, closeouts and overstock. Bidding is open now, and lots start closing Friday at 7 PM.\n\n"
"\U0001F6E0️ TOOLS & SHOP\n• 12 in. sliding compound miter saw, deep cut band saw and DeWalt 18 in. scroll saw\n• DeWalt 20V XR hammer drill, 20V air inflator, circular saws and a PEX expansion tool\n• Craftsman 6 gal pancake air compressor and wet/dry shop vacs\n• Craftsman V20 4-tool combo kit plus dozens of DeWalt and Craftsman batteries and chargers\n\n"
"❄️ APPLIANCES & KITCHEN\n• Frigidaire, Whirlpool and LG over-the-range microwaves (new)\n• Frigidaire Gallery upright freezers and a 7 cu ft chest freezer\n• Frigidaire retro compact 2-door fridge\n• Nugget ice maker, soft serve maker, countertop microwaves, cast iron and dinnerware\n\n"
"\U0001F33F YARD & OUTDOOR\n• Craftsman V20 20 in. self-propelled and 15 in. battery mower kits\n• Craftsman V20 hedge trimmer and chainsaw, Kobalt 40V leaf blower\n• Kobalt 7 cu ft yard cart and a Kemimoto flip windshield for Polaris Ranger\n\n"
"\U0001F3E1 HOME & MORE\n• Cal king comforter set, king mattress topper, dehumidifier, Away carry-on\n• Pull-down kitchen faucet, insulated catering hot box, 12-egg incubator and much more\n\nTag someone who needs tools, a freezer or a new mower \U0001F447"+tail(FRI))
P=[
 post("thu-main","2026-11-05 17:00:00",g("03-ends-tomorrow.jpg","1,250+ Lots\nEnd Tomorrow","Friday, Nov 6 • Lots begin closing 7 PM ET",MAIN),
   ["B-441-G","D-48-G","C-28-G","B-464-G","C-24-G"],main_cap,
   [g("03b-tools.jpg","Tools\n& Shop",EB,TOOLS),g("03c-kitchen.jpg","Appliances\n& Kitchen",EB,APPL),g("03d-home-yard.jpg","Yard\n& Outdoor",EB,YARD),g("03e-home.jpg","Home\n& More",EB,HOME)]),
 dict(id="thu-story",when="2026-11-05 17:01:00",type="story",facebook=True,instagram=True,
   graphic=dict(file="04-story-ends-tomorrow.jpg",format="story",kicker="Galax Online Auction",headline="1,250+ Lots\nEnd Tomorrow",band="Fri Nov 6 • 7 PM ET",photos=MAIN,footer="Bid at MatthewsAuctioneers.com"),photos=[],caption="",followUpComment=""),
 post("thu-tools","2026-11-05 19:00:00",g("01-tools-shop.jpg","Tools\n& Shop",EB,TOOLS),["C-33-G","N-263-G","D-17-G","N-159-G","N-281-G","C-17-G","N-197-G","D-43-G","D-46-G"],
   "Tools and shop gear closing tomorrow night in Galax:\n\n• 12 in. double bevel sliding compound miter saw (used, tested)\n• DeWalt 20V MAX XR deep cut band saw and DeWalt 18 in. scroll saw\n• DeWalt 20V XR brushless 1/2 in. hammer drill and 20V MAX air inflator\n• Craftsman 6 gal 150 PSI pancake air compressor\n• DeWalt 7-1/4 in. circular saw, Craftsman V20 4-tool combo kit and a DeWalt 20V wet/dry vac\n• Dozens of DeWalt and Craftsman batteries and chargers"+tail(FRI)),
 post("thu-kitchen","2026-11-05 20:30:00",g("02-appliances-kitchen.jpg","Appliances\n& Kitchen",EB,APPL),["B-441-G","D-48-G","B-431-G","C-28-G","D-26-G","C-29-G","B-457-G","B-461-G","C-47-G"],
   "Appliances and kitchen lots in the Galax auction, closing tomorrow night:\n\n• Whirlpool, LG Smart and Frigidaire over-the-range microwaves (new)\n• Frigidaire Gallery 6.5 cu ft upright freezers (open box) and a 7 cu ft chest freezer (new)\n• Frigidaire retro compact 2-door fridge (open box)\n• Nugget ice maker and soft serve maker\n• Insulated catering hot box, countertop microwaves, cast iron and dinnerware"+tail(FRI)),
 post("fri-tonight","2026-11-06 09:00:00",g("05-ends-tonight.jpg","Ends\nTonight","Lots begin closing 7 PM ET",["C-33-G","B-441-G","B-470-G","N-159-G","C-28-G","C-17-G"]),
   ["B-431-G","D-48-G","C-29-G","B-464-G","N-263-G"],
   "⏰ ENDS TONIGHT ⏰\n\n1,250+ lots in the Galax online auction start closing at 7 PM tonight. Tools, freezers, microwaves, mowers, yard gear and home goods are all still open for bids.\n\n• Miter saw, band saw, scroll saw, hammer drill, air compressor\n• Over-the-range microwaves, upright and chest freezers, compact fridge\n• Craftsman V20 mower kits, hedge trimmer, Kobalt blower and yard cart\n• Comforter sets, mattress topper, carry-on, kitchen faucet and more\n\nGet your bids in and set your max before the clock runs out."+tail(TON),
   [g("05b-tools.jpg","Tools\n& Shop",TB,TOOLS),g("05c-kitchen.jpg","Appliances\n& Kitchen",TB,APPL)]),
 post("fri-yard","2026-11-06 11:00:00",g("06-yard.jpg","Yard\n& Outdoor",TB,YARD),["B-470-G","B-464-G","C-24-G","N-142-G","B-443-G","C-59-G","M-271-G"],
   "Yard and outdoor lots closing tonight in Galax:\n\n• Craftsman V20 20 in. self-propelled mower (new) and 15 in. battery mower kit (open box)\n• Craftsman V20 20 in. hedge trimmer and Kobalt 40V brushless leaf blower\n• Kobalt 7 cu ft poly yard cart\n• Kemimoto 2-in-1 flip windshield for Polaris Ranger\n• Dehumidifier, sump pump and more"+tail(TON)),
 post("fri-cordless","2026-11-06 13:00:00",g("07-cordless.jpg","DeWalt &\nCraftsman",TB,CORD),CORD+["N-263-G","D-17-G"],
   "Cordless tool lovers, this one's for you. Closing tonight in Galax:\n\n• Craftsman V20 4-tool combo kit (used, tested)\n• DeWalt 20V XR brushless 1/2 in. hammer drill\n• DeWalt 7-1/4 in. circular saw\n• DeWalt 20V MAX wet/dry vac and 20V MAX air inflator\n• 20V MAX 1 in. PEX expansion tool\n• Plus dozens of DeWalt and Craftsman batteries, chargers and bare tools"+tail(TON)),
 post("fri-home","2026-11-06 15:00:00",g("08-home.jpg","Home\n& More",TB,HOME),HOME+["C-51-G","B-455-G"],
   "Home lots worth a look before tonight's close:\n\n• Insulated catering hot box carrier (new)\n• Cal king comforter set and king mattress topper\n• Away carry-on suitcase\n• 12-egg incubator with automatic turner (new)\n• Pull-down sprayer kitchen faucet (new)\n• Heated floor mat, dinnerware and more"+tail(TON)),
 post("fri-final","2026-11-06 18:00:00",g("09-final-hour.jpg","Final\nHour","Lots begin closing 7 PM ET",["B-431-G","C-33-G","C-28-G","B-470-G","N-159-G","C-29-G"]),
   ["C-33-G","B-441-G","B-470-G","C-28-G","N-159-G","C-17-G"],
   "\U0001F6A8 FINAL HOUR \U0001F6A8\n\nThe Galax online auction starts closing at 7 PM, one hour from now. 1,250+ lots of tools, appliances, yard gear and home goods. Last call to get your bids in."+tail(TON)),
]
json.dump(P,open('posts.json','w'),indent=1)
