"""Build graphics + Genie Rocket Advanced CSV for one auction folder.

python3 build_campaign.py <auction_dir> <social_folder_name> [--csv-only]
Downloads lot photos, renders graphics into <auction_dir>/graphics, copies them into the
sellwithmatthews repo under social/<social_folder_name>/, and writes <auction_dir>/instagram.csv.
"""
import csv, json, os, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = '/home/claude/sellwithmatthews'
SITE = 'https://sellwithmatthews-seven.vercel.app'
SAMPLE = os.path.join(HERE, 'templates', 'social-planner-advance-sample.csv')
LOGO = REPO + '/site/img/logo-wide.png'
BASE = 'https://www.matthewsauctioneers.com'

adir, folder = sys.argv[1], sys.argv[2]
data = json.load(open(os.path.join(adir, 'lots.json')))
posts = json.load(open(os.path.join(adir, os.environ.get('POSTS', 'posts.json'))))
lots = data['lots']
photo_dir = os.path.join(adir, 'photos'); os.makedirs(photo_dir, exist_ok=True)
gdir = os.path.join(adir, 'graphics'); os.makedirs(gdir, exist_ok=True)

def local(lot):
    p = os.path.join(photo_dir, lot + '.jpg')
    if not os.path.exists(p):
        urllib.request.urlretrieve(lots[lot]['img'], p)
    return p

if '--csv-only' not in sys.argv:
    specs = []
    for post in posts:
      for g in [post['graphic']] + post.get('extra_graphics', []):
        specs.append({**g, 'out': os.path.join(gdir, g['file']), 'logo': LOGO, 'photos': [local(l) for l in g['photos']]})
    json.dump(specs, open(os.path.join(adir, 'render-specs.json'), 'w'), indent=1)
    subprocess.run([sys.executable, os.path.join(HERE, 'render.py'), os.path.join(adir, 'render-specs.json')], check=True)
    dest = os.path.join(REPO, 'social', folder); os.makedirs(dest, exist_ok=True)
    for post in posts:
        for g in [post['graphic']] + post.get('extra_graphics', []):
            subprocess.run(['cp', os.path.join(gdir, g['file']), dest], check=True)

# CSV from the official template's two header rows
with open(SAMPLE, encoding='utf-8-sig') as f:
    hdr = list(csv.reader(f))[:2]
ncol = len(hdr[1])
col = {name: i for i, name in enumerate(hdr[1])}
rows = []
for post in sorted(posts, key=lambda p: p['when']):
    r = [''] * ncol
    r[0] = post['when']
    r[1] = post['caption']
    r[2] = data['auction_url'] if not post.get('lot') else BASE + lots[post['lot']]['href']
    imgs = [f"{SITE}/crm/social/{folder}/{g['file']}" for g in [post['graphic']] + post.get('extra_graphics', [])] + [lots[l]['img'] for l in post['photos']]
    assert len(imgs) <= 10, post['id']
    if post['type'] == 'story': assert len(imgs) == 1, post['id']
    r[3] = ','.join(imgs)
    r[7] = 'TRUE'; r[8] = 'FALSE'
    if post.get('followUpComment'): r[11] = post['followUpComment']
    if post.get('facebook'): r[12] = post['type']
    if post.get('instagram', True): r[13] = post['type']  # Instagram
    rows.append(r)
out = os.path.join(adir, os.environ.get('CSV', 'instagram.csv'))
with open(out, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f); w.writerows(hdr); w.writerows(rows)

# validate
back = list(csv.reader(open(out, encoding='utf-8')))
assert back[:2] == hdr and all(len(x) == ncol for x in back), 'structure'
assert len(back) - 2 <= 90
print(f'{out}: {len(back) - 2} posts, {ncol} columns, headers match sample')
