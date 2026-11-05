import re
C=[('appliance',r'freezer|fridge|refrigerator|dishwasher|mini split|ductless|beverage center|range hood|dehumidifier|microwave|air fryer|washer|ice maker|blender|coffee maker|cup seal|proofing box|vacuum and mop|robot vacuum|floor washer|tineco'),
('tools',r'miter|jointer|weld|dewalt|drill|sander|wet dry vac|stealthsonic|battery & charger|lithium ion battery|auger|post hole|axe\b|axe |shop light|hand saw|wrench|socket|ratchet|tool|saw\b|clamp|level\b|tape measure|grinder|nailer|compressor|work light|belt blank|extension cord|power strip|surge|ladder|hammer|screwdriver|bit set|blade'),
('building',r'composite rail|stair|riser|roof|ground cover|groundcover|plastic sheeting|0\.006 in|great stuff|insulating foam|surface water proofer|handrail|coaxial|baluster|post cap|lumber|drywall|flooring|underlayment|tile|caulk|sealant|paver|fence|gutter|black jack|recessed light|ceiling fan|light fixture|faucet|vanity|toilet|door\b|window|cordoba|aquatine|extra la'),
('outdoor',r'mower|grill|deck box|canopy|composter|solar|patio|sectional|rocker|wagon|planter|garden|hose|sprinkler|bird feeder|lawn|pool|water walkway|life ring|camping|tent|bike rack|trailer light|leaf|snow|trimmer|blower|chainsaw'),
('recreation',r'scooter|skateboard|bike|violin|fiddle|weight bench|crossbow|target|dartboard|karaoke|gaming chair|game|toy|treadmill|walking pad|fitness|dumbbell|kayak|fishing|gun|rifle|hunting|golf|ball\b'),
('home',r'mirror|rug|chair|mattress|pillow|shade|blind|curtain|backdrop|table|wall art|canvas|lamp|clock|shelf|organizer|rack|stool|blanket|throw|bed|sofa|couch|dresser|cabinet|desk|doormat|towel|bath|kitchen|cookware|pan\b|pot\b|utensil|storage|bin|basket|decor|frame|vase|hook|massager'),
('apparel',r'sneaker|boot|shoe|shirt|top\b|tops|jacket|hoodie|pants|jeans|under armour|adidas|nike|socks|hat\b|glove|dress|legging|crop'),
('consumable',r'coffee|k-cup|vitamin|gummies|protein|soylent|candy|rice|probiotic|supplement|softgel|laxative|miralax|snack|bar\b|bars|tea\b|drink|olly|garden of life|lotion|shampoo|lash|makeup|cosmetic|toothpaste|soap|cream|serum'),
]
def cat(t):
    t=t.lower()
    for n,r in C:
        if re.search(r,t): return n
    return 'misc'
