#!/usr/bin/env python3
"""
scripts/generate-blog-cover.py · Solca blog SEO cover generator
================================================================

Genera la portada PNG (1280×720) de un blog SEO solcaciencia.com siguiendo
la paleta canónica documentada en _docs/TOOLS_REGISTRY.md sección 5.1.

Por qué este archivo existe (25 jun 2026): los blogs SEO necesitan covers
sin el badge "SOLCA INSIGHT · #NN" del newsletter, pero compartiendo paleta
y tipografía. Layout simplificado: kicker categoría + título grande con
keyword en naranja + footer marca.

Uso CLI
-------

    python3 scripts/generate-blog-cover.py \\
        --categoria "CARRERAS PHARMA" \\
        --titulo "Salario CRA junior en LATAM: rangos reales por nivel y país" \\
        --keyword "Salario CRA" \\
        --subtitulo "Rangos por nivel (CRA I, II, Senior) en México, Argentina y Colombia · datos 2026" \\
        --output public/blog/salario-cra-junior-latam-2026.png

`--keyword` aparece coloreada en naranja dentro del título. Debe estar
contenida literalmente.

Requisitos: Pillow (pip install pillow --break-system-packages)
"""
from __future__ import annotations
import argparse
import os
from PIL import Image, ImageDraw, ImageFont

# ── Paleta Solca (TOOLS_REGISTRY.md §5.1) ────────────────────────────
NAVY       = (31, 58, 95)
NAVY_DARK  = (24, 42, 68)
ORANGE     = (231, 124, 60)
CREAM      = (245, 240, 230)
WHITE      = (255, 255, 255)

W, H = 1280, 720

FONT_CANDIDATES_BOLD = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/Library/Fonts/Microsoft/Arial Bold.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
]
FONT_CANDIDATES_REGULAR = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
]


def _font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    cands = FONT_CANDIDATES_BOLD if bold else FONT_CANDIDATES_REGULAR
    for p in cands:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    raise FileNotFoundError(f"No font found in: {cands}")


def _text_width(draw, txt, font):
    bbox = draw.textbbox((0, 0), txt, font=font)
    return bbox[2] - bbox[0]


def _wrap_title_with_keyword(draw, title, keyword, font, max_width):
    """Wrappea título marcando tokens del keyword en naranja."""
    tokens = title.split(" ")
    kw_tokens = [t.strip(".,:;").lower() for t in keyword.split()]
    colored = [
        (tok, ORANGE if tok.strip(".,:;").lower() in kw_tokens else WHITE)
        for tok in tokens
    ]
    lines = [[]]
    cur_width = 0
    space_w = _text_width(draw, " ", font)
    for tok, color in colored:
        tok_w = _text_width(draw, tok, font)
        addition = tok_w if not lines[-1] else space_w + tok_w
        if cur_width + addition > max_width and lines[-1]:
            lines.append([(tok, color)])
            cur_width = tok_w
        else:
            lines[-1].append((tok, color))
            cur_width += addition
    return lines


def _draw_title_lines(draw, lines, x, y, font, line_height):
    space_w = _text_width(draw, " ", font)
    cy = y
    for line in lines:
        cx = x
        for i, (tok, color) in enumerate(line):
            if i > 0:
                cx += space_w
            draw.text((cx, cy), tok, font=font, fill=color)
            cx += _text_width(draw, tok, font)
        cy += line_height
    return cy


def _wrap_simple(draw, text, font, max_width):
    words = text.split(" ")
    lines = [""]
    for w in words:
        cand = (lines[-1] + " " + w).strip() if lines[-1] else w
        if _text_width(draw, cand, font) > max_width and lines[-1]:
            lines.append(w)
        else:
            lines[-1] = cand
    return lines


def generate_blog_cover(categoria, titulo, keyword, subtitulo, output_path):
    img = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(img)

    # ── Kicker: cuadradito + CATEGORÍA ──────────────────────────
    kicker_font = _font(28, bold=True)
    kicker_y = 90
    sq = 22
    draw.rectangle([90, kicker_y + 6, 90 + sq, kicker_y + 6 + sq], fill=ORANGE)
    draw.text((90 + sq + 18, kicker_y), categoria.upper(), font=kicker_font, fill=CREAM)

    # ── Título grande con keyword en naranja ────────────────────
    title_font = _font(78, bold=True)
    title_max_w = W - 180  # full width minus margins
    title_lines = _wrap_title_with_keyword(draw, titulo, keyword, title_font, title_max_w)
    title_y_start = 220
    line_height = 96
    final_y = _draw_title_lines(draw, title_lines, 90, title_y_start, title_font, line_height)

    # ── Subtítulo (debajo del título) ────────────────────────────
    subt_font = _font(28, bold=False)
    subt_max_w = W - 180
    subt_lines = _wrap_simple(draw, subtitulo, subt_font, subt_max_w)
    sub_y = final_y + 36
    for ln in subt_lines:
        draw.text((90, sub_y), ln, font=subt_font, fill=CREAM)
        sub_y += 40

    # ── Línea naranja separadora antes del footer ───────────────
    draw.rectangle([90, H - 100, 250, H - 96], fill=ORANGE)

    # ── Footer marca + revisar-cv ────────────────────────────────
    foot_font = _font(28, bold=True)
    foot_text = "solcaciencia.com  ·  revisar-cv"
    draw.text((90, H - 70), foot_text, font=foot_font, fill=ORANGE)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    img.save(output_path, "PNG", optimize=True)
    print(f"Cover guardada: {output_path}  ({W}×{H})")


def main():
    parser = argparse.ArgumentParser(description="Solca blog SEO cover generator")
    parser.add_argument("--categoria", required=True, help="Categoría (ej. CARRERAS PHARMA)")
    parser.add_argument("--titulo", required=True, help="Título del blog")
    parser.add_argument("--keyword", required=True, help="Palabras a destacar en naranja (1-3 palabras)")
    parser.add_argument("--subtitulo", required=True, help="Bajada o subtítulo")
    parser.add_argument("--output", required=True, help="Ruta de salida PNG")
    args = parser.parse_args()
    generate_blog_cover(
        categoria=args.categoria,
        titulo=args.titulo,
        keyword=args.keyword,
        subtitulo=args.subtitulo,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
