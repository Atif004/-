#!/usr/bin/env python3
"""يولّد أيقونة التطبيق 1024×1024 (بدون شفافية كما تشترط Apple).

التصميم: خلفية كحلية عميقة، وقوس ذهبي يشبه مؤشر قياس (رمز "القدرة")،
وحرف «ق» في المنتصف.

الاستخدام:
    pip install pillow
    python3 scripts/generate_app_icon.py [path/to/arabic-font.ttf]
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 1024
SCALE = 4  # رسم بدقة أعلى ثم تصغير لنعومة الحواف
ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "Qudra/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"

NAVY_TOP = (16, 23, 42)
NAVY_BOTTOM = (8, 11, 22)
GOLD_LIGHT = (230, 207, 154)
GOLD = (201, 168, 106)
TRACK = (255, 255, 255, 22)

FONT_CANDIDATES = [
    "/System/Library/Fonts/SFArabic.ttf",
    "/System/Library/Fonts/Supplemental/GeezaPro.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def find_font(size):
    paths = sys.argv[1:] + FONT_CANDIDATES
    for path in paths:
        if Path(path).exists():
            return ImageFont.truetype(path, size, layout_engine=ImageFont.Layout.RAQM)
    raise SystemExit("لم يُعثر على خط عربي. مرّر مسار الخط كمعامل.")


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def main():
    s = SIZE * SCALE
    img = Image.new("RGB", (s, s))
    draw = ImageDraw.Draw(img)

    # خلفية بتدرّج عمودي.
    for y in range(s):
        draw.line([(0, y), (s, y)], fill=lerp(NAVY_TOP, NAVY_BOTTOM, y / s))

    center = (s / 2, s / 2 + s * 0.02)
    radius = s * 0.33
    width = round(s * 0.055)
    box = [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius]
    start, end, fill_end = 135, 405, 345  # قوس 270° ممتلئ حتى ~78%

    overlay = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    # PIL يرسم سُمك القوس إلى الداخل من حافة الصندوق، فمركز الخط عند (radius - width/2).
    stroke_center = radius - width / 2

    def cap(angle, color):
        rad = math.radians(angle)
        cx = center[0] + stroke_center * math.cos(rad)
        cy = center[1] + stroke_center * math.sin(rad)
        r = width / 2
        od.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

    od.arc(box, fill_end, end, fill=TRACK, width=width)
    cap(end, TRACK)

    # القوس الذهبي بتدرّج على طوله.
    steps = 240
    for i in range(steps):
        a0 = start + (fill_end - start) * i / steps
        a1 = start + (fill_end - start) * (i + 1) / steps + 0.4
        od.arc(box, a0, a1, fill=lerp(GOLD, GOLD_LIGHT, i / steps) + (255,), width=width)

    # رؤوس دائرية لطرفي القوس الذهبي.
    cap(start, GOLD + (255,))
    cap(fill_end, GOLD_LIGHT + (255,))

    # توهج خفيف خلف القوس.
    glow = overlay.filter(ImageFilter.GaussianBlur(s * 0.02))
    img.paste(glow, (0, 0), glow)
    img.paste(overlay, (0, 0), overlay)

    # حرف «ق».
    font = find_font(round(s * 0.36))
    text = "ق"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pos = (center[0] - tw / 2 - bbox[0], center[1] - th / 2 - bbox[1])
    draw.text(pos, text, font=font, fill=GOLD_LIGHT)

    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUTPUT, "PNG", optimize=True)
    print(f"saved {OUTPUT.relative_to(ROOT)} ({img.mode}, {img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
