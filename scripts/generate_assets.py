"""Render the favicon, the PNG icons and the Open Graph image into public/.

Run from anywhere with a Python that has Pillow and fontTools (with brotli):
    /usr/bin/python3 scripts/generate_assets.py
"""

from io import BytesIO
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

PAPER = (251, 250, 246)
INK = (27, 27, 25)
MUTED = (107, 106, 100)
RULE = (222, 220, 211)
WELL = (243, 241, 234)
GREEN = (29, 122, 58)
GREEN_ON_INK = (111, 208, 140)


def project_root() -> Path:
    """Walk up from this file to the folder holding package.json."""
    for folder in Path(__file__).resolve().parents:
        if (folder / "package.json").exists():
            return folder
    raise SystemExit("package.json not found above scripts/")


ROOT = project_root()
PUBLIC = ROOT / "public"
FONTS = PUBLIC / "fonts"
REGULAR = "JetBrainsMono-Regular.woff2"
BOLD = "JetBrainsMono-Bold.woff2"


def open_ttfont(name: str) -> TTFont:
    """Open a woff2 font from public/fonts as a plain TrueType font."""
    font = TTFont(str(FONTS / name))
    font.flavor = None
    return font


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    """Decompress a woff2 font in memory and open it for Pillow at the given size."""
    buffer = BytesIO()
    open_ttfont(name).save(buffer)
    buffer.seek(0)
    return ImageFont.truetype(buffer, size)


def hex_color(color: tuple[int, int, int]) -> str:
    """Format an RGB tuple as a CSS hex colour."""
    return "#{:02x}{:02x}{:02x}".format(*color)


def write_favicon_svg() -> None:
    """Write favicon.svg: the bold mono dollar sign in green on an ink square, as an outline path."""
    font = open_ttfont(BOLD)
    glyph_set = font.getGlyphSet()
    glyph_name = font.getBestCmap()[ord("$")]
    bounds_pen = BoundsPen(glyph_set)
    glyph_set[glyph_name].draw(bounds_pen)
    x_min, y_min, x_max, y_max = bounds_pen.bounds
    target = 26.0
    scale = target / (y_max - y_min)
    offset_x = 16 - (x_min + x_max) / 2 * scale
    offset_y = 16 + (y_min + y_max) / 2 * scale
    svg_pen = SVGPathPen(glyph_set, ntos=lambda value: f"{value:.2f}".rstrip("0").rstrip("."))
    glyph_set[glyph_name].draw(TransformPen(svg_pen, (scale, 0, 0, -scale, offset_x, offset_y)))
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        f'<rect width="32" height="32" rx="2" fill="{hex_color(INK)}"/>'
        f'<path fill="{hex_color(GREEN_ON_INK)}" d="{svg_pen.getCommands()}"/>'
        "</svg>\n"
    )
    (PUBLIC / "favicon.svg").write_text(svg)


def render_icon(size: int, glyph_share: float, rounded: bool = True) -> Image.Image:
    """Render the dollar-sign icon at a size, supersampled for smooth edges."""
    factor = 4
    canvas = size * factor
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if rounded:
        draw.rounded_rectangle((0, 0, canvas - 1, canvas - 1), radius=canvas * 2 / 32, fill=INK)
    else:
        draw.rectangle((0, 0, canvas, canvas), fill=INK)
    font = load_font(BOLD, round(canvas * glyph_share))
    draw.text((canvas / 2, canvas / 2), "$", font=font, fill=GREEN_ON_INK, anchor="mm")
    return image.resize((size, size), Image.LANCZOS)


def write_icons() -> None:
    """Write favicon, PWA and Apple touch icons."""
    render_icon(32, 0.95).save(PUBLIC / "favicon-32.png", optimize=True)
    render_icon(192, 0.8).save(PUBLIC / "icon-192.png", optimize=True)
    render_icon(512, 0.8).save(PUBLIC / "icon-512.png", optimize=True)
    render_icon(512, 0.55, rounded=False).save(PUBLIC / "icon-maskable-512.png", optimize=True)
    render_icon(180, 0.7, rounded=False).convert("RGB").save(PUBLIC / "apple-touch-icon.png", optimize=True)


def write_og_image() -> None:
    """Write the 1200x630 social preview: wordmark, title and a sample ssh-keygen session."""
    width, height = 1200, 630
    margin = 80
    image = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(image)
    brand = load_font(BOLD, 30)
    headline = load_font(BOLD, 64)
    lead = load_font(REGULAR, 26)
    mono = load_font(REGULAR, 26)
    mono_bold = load_font(BOLD, 26)

    draw.text((margin, 78), "$", font=brand, fill=GREEN, anchor="ls")
    dollar_width = draw.textlength("$ ", font=brand)
    draw.text((margin + dollar_width, 78), "sshkeygen.dev", font=brand, fill=INK, anchor="ls")
    draw.line(((margin, 108), (width - margin, 108)), fill=RULE, width=2)

    draw.text((margin, 220), "SSH key generator", font=headline, fill=INK, anchor="ls")
    draw.text((margin, 272), "Ed25519, RSA and ECDSA keys in OpenSSH format.", font=lead, fill=MUTED, anchor="ls")

    box = (margin, 318, width - margin, 518)
    draw.rectangle(box, fill=WELL, outline=RULE, width=2)
    x, y = box[0] + 32, box[1] + 56
    draw.text((x, y), "$", font=mono_bold, fill=GREEN, anchor="ls")
    x += draw.textlength("$ ", font=mono)
    draw.text((x, y), "ssh-keygen", font=mono_bold, fill=INK, anchor="ls")
    x += draw.textlength("ssh-keygen ", font=mono)
    for flag, value in (("-t", "ed25519"), ("-C", "you@laptop")):
        draw.text((x, y), flag, font=mono, fill=MUTED, anchor="ls")
        x += draw.textlength(flag + " ", font=mono)
        draw.text((x, y), value, font=mono, fill=INK, anchor="ls")
        value_width = draw.textlength(value, font=mono)
        draw.line(((x, y + 10), (x + value_width, y + 10)), fill=MUTED, width=2)
        x += value_width + draw.textlength(" ", font=mono)
    lines = (
        "Generating public/private ed25519 key pair.",
        "Your identification has been saved in id_ed25519",
        "SHA256:Fq4Ye5MxY2nI7cW8c9Bx3ZsH2WgW2yK7r1o5ZQ3hK9U you@laptop",
    )
    for index, line in enumerate(lines):
        draw.text((box[0] + 32, y + 46 + index * 38), line, font=mono, fill=INK if index < 2 else MUTED, anchor="ls")

    draw.text((margin, 574), "Runs in your browser. Nothing is sent anywhere.", font=lead, fill=MUTED, anchor="ls")
    image.save(PUBLIC / "og-image.png", optimize=True)


if __name__ == "__main__":
    write_favicon_svg()
    write_icons()
    write_og_image()
    print("Wrote favicon.svg, icons and og-image.png to", PUBLIC)
