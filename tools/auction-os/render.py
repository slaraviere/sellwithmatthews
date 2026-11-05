"""Matthews Auction OS — social graphic renderer.

Usage: python3 render.py spec.json
spec: {"out": "file.jpg", "format": "feed"|"story", "kicker": str, "headline": str,
       "band": str, "footer": str, "photos": [local image paths], "logo": path}
"""
import json, sys
from PIL import Image, ImageDraw, ImageFont, ImageOps

RED, BLUE, BLACK, SILVER, WHITE = (227, 30, 36), (0, 87, 184), (0, 0, 0), (138, 141, 145), (255, 255, 255)
F = '/usr/share/fonts/opentype/inter/'
def font(w, size): return ImageFont.truetype(F + {'black': 'InterDisplay-Black.otf', 'bold': 'InterDisplay-Bold.otf', 'semi': 'Inter-SemiBold.otf'}[w], size)

def cover(img, w, h):
    return ImageOps.fit(img.convert('RGB'), (w, h), Image.LANCZOS, centering=(0.5, 0.5))

def grid(canvas, photos, x, y, w, h, gap=8):
    """Lay out 1-6 photos: big lead photo + smaller ones."""
    ims = [Image.open(p) for p in photos]
    n = len(ims)
    boxes = []
    if n == 1: boxes = [(x, y, w, h)]
    elif n == 2: boxes = [(x, y, (w - gap) // 2, h), (x + (w + gap) // 2, y, (w - gap) // 2, h)]
    elif n == 3:
        lw = int(w * 0.6); rw = w - lw - gap; rh = (h - gap) // 2
        boxes = [(x, y, lw, h), (x + lw + gap, y, rw, rh), (x + lw + gap, y + rh + gap, rw, h - rh - gap)]
    elif n == 4:
        cw, ch = (w - gap) // 2, (h - gap) // 2
        boxes = [(x, y, cw, ch), (x + cw + gap, y, w - cw - gap, ch), (x, y + ch + gap, cw, h - ch - gap), (x + cw + gap, y + ch + gap, w - cw - gap, h - ch - gap)]
    else:  # 5 or 6: lead on top half, 3-4 below... use 2 rows
        top_h = int(h * 0.55); bot_h = h - top_h - gap
        tw = (w - gap) // 2
        boxes = [(x, y, tw, top_h), (x + tw + gap, y, w - tw - gap, top_h)]
        rest = n - 2; bw = (w - gap * (rest - 1)) // rest
        for i in range(rest):
            bx = x + i * (bw + gap)
            boxes.append((bx, y + top_h + gap, bw if i < rest - 1 else x + w - bx, bot_h))
    for im, (bx, by, bw, bh) in zip(ims, boxes):
        canvas.paste(cover(im, bw, bh), (bx, by))

def fit_text(draw, text, weight, max_w, start, min_size=40):
    size = start
    while size > min_size:
        f = font(weight, size)
        if max(draw.textlength(line, font=f) for line in text.split('\n')) <= max_w: return f
        size -= 4
    return font(weight, min_size)

def spaced(draw, xy, text, f, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill); x += draw.textlength(ch, font=f) + tracking

def spaced_len(draw, text, f, tracking): return sum(draw.textlength(c, font=f) + tracking for c in text) - tracking

def render(s):
    W, H = {'feed': (1080, 1350), 'square': (1080, 1080)}.get(s['format'], (1080, 1920))
    sq = s['format'] == 'square'
    c = Image.new('RGB', (W, H), BLACK); d = ImageDraw.Draw(c)
    M = 48
    logo = Image.open(s['logo']).convert('RGBA')
    if s['format'] in ('feed', 'square'):
        ph = 600 if sq else 780
        grid(c, s['photos'], 0, 0, W, ph)
        d.rectangle([0, ph, W, ph + 10], fill=RED)
        y = ph + (34 if sq else 44)
        kf = font('semi', 24 if sq else 26); spaced(d, (M, y), s['kicker'].upper(), kf, SILVER, 5); y += 46 if sq else 52
        hf = fit_text(d, s['headline'].upper(), 'black', W - 2 * M, 92 if sq else 112)
        for line in s['headline'].upper().split('\n'):
            d.text((M - 4, y), line, font=hf, fill=WHITE); y += int(hf.size * 1.02)
        y += 14
        bf = font('bold', 30 if sq else 34); bh = 64 if sq else 74
        while d.textlength(s['band'].upper(), font=bf) > W - 60: bf = font('bold', bf.size - 2)
        d.rectangle([0, y, W, y + bh], fill=BLUE)
        d.text((W // 2, y + bh // 2), s['band'].upper(), font=bf, fill=WHITE, anchor='mm')
        # footer
        lw = 250 if sq else 300; lg = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
        fy = H - lg.height - (24 if sq else 34)
        c.paste(lg, (W - M - lw, fy), lg)
        d.text((M, fy + lg.height // 2), s.get('footer', 'MatthewsAuctioneers.com'), font=font('semi', 26 if sq else 30), fill=WHITE, anchor='lm')
    else:
        lw = 520; lg = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
        c.paste(lg, ((W - lw) // 2, 150), lg)
        y = 150 + lg.height + 50
        kf = font('semi', 30); kt = s['kicker'].upper()
        spaced(d, ((W - spaced_len(d, kt, kf, 6)) / 2, y), kt, kf, SILVER, 6); y += 64
        hf = fit_text(d, s['headline'].upper(), 'black', W - 2 * M, 150)
        for line in s['headline'].upper().split('\n'):
            d.text((W // 2, y), line, font=hf, fill=WHITE, anchor='mt'); y += int(hf.size * 1.02)
        y += 30
        gh = 760
        grid(c, s['photos'], M, y, W - 2 * M, gh)
        y += gh
        d.rectangle([0, y + 30, W, y + 30 + 90], fill=BLUE)
        d.text((W // 2, y + 75), s['band'].upper(), font=font('bold', 40), fill=WHITE, anchor='mm')
        d.rectangle([0, y + 30 + 90, W, y + 30 + 100], fill=RED)
        d.text((W // 2, y + 190), s.get('footer', 'Bid at MatthewsAuctioneers.com'), font=font('bold', 40), fill=WHITE, anchor='mm')
    c.save(s['out'], 'JPEG', quality=90, optimize=True, progressive=True)
    print('wrote', s['out'], c.size)

if __name__ == '__main__':
    for spec in json.load(open(sys.argv[1])):
        render(spec)
