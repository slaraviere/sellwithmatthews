"""Full-bleed hero graphic: one photo fills the canvas, dark gradient, text + brand bar.
python3 hero.py spec.json   (list of {out, format: feed|story, photo, focus_x (0-1), kicker, headline, band, footer, logo, chips:[..]})
"""
import json, sys, os
from PIL import Image, ImageDraw, ImageOps
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render import font, fit_text, spaced, RED, BLUE, WHITE

def cover(img, w, h, fx=0.5, fy=0.5):
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = int((img.width - w) * fx); y = int((img.height - h) * fy)
    return img.crop((x, y, x + w, y + h))

def gradient(w, h, start, end, a0, a1):
    g = Image.new('L', (1, h))
    for y in range(h):
        t = 0 if y < start else 1 if y > end else (y - start) / (end - start)
        g.putpixel((0, y), int(a0 + (a1 - a0) * t ** 1.4))
    return g.resize((w, h))

def render(s):
    W, H = {'feed': (1080, 1350), 'square': (1080, 1080)}.get(s['format'], (1080, 1920))
    sq = s['format'] == 'square'
    photo = ImageOps.exif_transpose(Image.open(s['photo'])).convert('RGB')
    shade = Image.new('RGB', (W, H), (0, 0, 0))
    ph = int(H * 0.62) if sq else max(int(W * photo.height / photo.width) if s['format'] == 'feed' else int(H * 0.56), int(H * 0.56))
    c = Image.new('RGB', (W, H), (0, 0, 0))
    c.paste(cover(photo, W, ph, s.get('focus_x', 0.5), s.get('focus_y', 0.5)), (0, 0))
    c = Image.composite(shade, c, gradient(W, H, ph - 230, ph, 0, 255))
    c = Image.composite(shade, c, gradient(W, H, 0, 170, 170, 0))
    d = ImageDraw.Draw(c)
    logo = Image.open(s['logo']).convert('RGBA')
    lw = 300 if sq else 360 if s['format'] == 'feed' else 460
    lg = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    pad = 58
    plate = 18
    d.rounded_rectangle([pad - plate, 40 - plate // 2 - 4, pad + lw + plate, 40 + lg.height + plate // 2 + 4], 12, fill=(255, 255, 255))
    c.paste(lg, (pad, 40), lg)
    # bottom block, laid out upward from the brand bar
    bar_h = 80 if sq else 96
    y_bar = H - bar_h - (60 if sq else 70 if s['format'] == 'feed' else 200)
    d.rectangle([0, y_bar, W, y_bar + bar_h], fill=BLUE)
    d.rectangle([0, y_bar + bar_h, W, y_bar + bar_h + 10], fill=RED)
    bf = font('bold', 32 if sq else 40)
    while d.textlength(s['band'], font=bf) > W - 80: bf = font('bold', bf.size - 2)
    d.text((W / 2, y_bar + bar_h / 2), s['band'], font=bf, fill=WHITE, anchor='mm')
    if s.get('footer'):
        ff = font('semi', 28 if sq else 34)
        d.text((W / 2, y_bar + bar_h + 10 + (50 if sq else 70 if s['format'] == 'feed' else 90) / 2), s['footer'], font=ff, fill=WHITE, anchor='mm')
    lines = s['headline'].upper().split('\n')
    hf = min((fit_text(d, ln, 'black', W - 2 * pad, 104 if sq else 150 if s['format'] == 'feed' else 170) for ln in lines), key=lambda f: f.size)
    lh = int(hf.size * 0.98)
    y = y_bar - (26 if sq else 40) - lh * len(lines)
    if s.get('chips'):
        cf = font('bold', 26 if sq else 30); cx = pad; cy = y - (58 if sq else 70)
        for ch in s['chips']:
            tw = d.textlength(ch, font=cf)
            d.rounded_rectangle([cx, cy, cx + tw + 32, cy + (44 if sq else 52)], 8, fill=RED)
            d.text((cx + 16, cy + (22 if sq else 26)), ch, font=cf, fill=WHITE, anchor='lm')
            cx += tw + 36 + 14
        y_k = cy - (50 if sq else 62)
    else:
        y_k = y - (50 if sq else 62)
    spaced(d, (pad, y_k), s['kicker'].upper(), font('semi', 24 if sq else 30), (215, 218, 222), 5)
    for i, ln in enumerate(lines):
        d.text((pad - 4, y + i * lh), ln, font=hf, fill=WHITE)
    c.save(s['out'], quality=92)
    print('wrote', s['out'], c.size)

for s in json.load(open(sys.argv[1])):
    render(s)
