#!/usr/bin/env python3
"""
scripts/generate-mier-cover.py · Cover de la serie miércoles
============================================================

Genera la portada PNG (1280×720) del post miércoles "Lo que dicen las vacantes"
siguiendo el layout documentado en _docs/TOOLS_REGISTRY.md §5.3:
- Kicker top-left ("LO QUE DICEN LAS VACANTES · #N")
- Título 2 líneas (blanco + naranja con palabra clave)
- Subtítulo con la fuente del dato
- Gráfica de barras horizontales o comparación de columnas
- Footer: solcaciencia.com/revisar-cv (naranja) + Solca Insight (crema)
- Barra naranja inferior a H - 14 siempre

Uso CLI
-------

    python3 scripts/generate-mier-cover.py \\
        --numero 5 \\
        --titulo "28 de 59 vacantes son de CROs · big pharma es solo 15" \\
        --keyword "47%" \\
        --subtitulo "Mapa real de pharma LATAM esta semana · 59 vacantes rastreadas" \\
        --bars '[("CRO",28),("Big Pharma",15),("Farma Local",16)]' \\
        --output _docs/mier_2026_07_01.png

`--bars` recibe una lista Python de tuplas (label, valor). El script normaliza
y grafica barras horizontales etiquetadas. Si pasas más de 5 barras solo usa
las primeras 5.

Requisitos
----------

- Pillow: `pip install pillow --break-system-packages`
"""
from __future__ import annotations
import argparse
import ast
import os
from PIL import Image, ImageDraw, ImageFont

NAVY       = (31, 58, 95)
NAVY_DARK  = (24, 42, 68)
NAVY_DEEP  = (18, 33, 56)
ORANGE     = (231, 124, 60)
ORANGE_DIM = (212, 102, 39)
CREAM      = (245, 240, 230)
WHITE      = (255, 255, 255)
GRAY_BAR   = (210, 210, 215)

W, H = 1280, 720

FONT_BOLD = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
]
FONT_REG = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
]


def _font(size: int, bold: bool = True):
    candidates = FONT_BOLD if bold else FONT_REG
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    raise FileNotFoundError(f"No font found in: {candidates}")


def _tw(draw, txt, font):
    b = draw.textbbox((0, 0), txt, font=font)
    return b[2] - b[0]


def _wrap_with_keyword(draw, title, keyword, font, max_w):
    tokens = title.split(" ")
    kw = keyword.strip().lower()
    colored = [(t, ORANGE if t.strip(".,:;%").lower() == kw else WHITE) for t in tokens]
    lines = [[]]
    cur = 0
    sp = _tw(draw, " ", font)
    for tok, color in colored:
        tw = _tw(draw, tok, font)
        add = tw if not lines[-1] else sp + tw
        if cur + add > max_w and lines[-1]:
            lines.append([(tok, color)])
            cur = tw
        else:
            lines[-1].append((tok, color))
            cur += add
    return lines


def _draw_title(draw, lines, x, y, font, lh):
    sp = _tw(draw, " ", font)
    cy = y
    for line in lines:
        cx = x
        for i, (tok, color) in enumerate(line):
            if i > 0:
                cx += sp
            draw.text((cx, cy), tok, font=font, fill=color)
            cx += _tw(draw, tok, font)
        cy += lh
    return cy


def _wrap_simple(draw, text, font, max_w):
    words = text.split(" ")
    lines = [""]
    for w in words:
        c = (lines[-1] + " " + w).strip() if lines[-1] else w
        if _tw(draw, c, font) > max_w and lines[-1]:
            lines.append(w)
        else:
            lines[-1] = c
    return lines


def generate(numero, titulo, keyword, subtitulo, bars, output_path):
    img = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(img)

    # Kicker
    kf = _font(22, bold=True)
    sq = 16
    kicker_y = 60
    draw.rectangle([80, kicker_y + 6, 80 + sq, kicker_y + 6 + sq], fill=ORANGE)
    draw.text((80 + sq + 14, kicker_y), f"LO QUE DICEN LAS VACANTES  ·  #{numero:02d}",
              font=kf, fill=CREAM)

    # Título
    tf = _font(56, bold=True)
    title_lines = _wrap_with_keyword(draw, titulo, keyword, tf, 1120)
    title_y = 150
    title_end = _draw_title(draw, title_lines[:3], 80, title_y, tf, 72)

    # Subtítulo
    sf = _font(22, bold=False)
    sub_lines = _wrap_simple(draw, subtitulo, sf, 1120)
    sub_y = title_end + 25
    for ln in sub_lines[:2]:
        draw.text((80, sub_y), ln, font=sf, fill=CREAM)
        sub_y += 32

    # Bars
    bars = bars[:5]
    max_v = max(v for _, v in bars) if bars else 1
    bar_x = 80
    bar_w_max = 900
    bar_h = 42
    bar_gap = 22
    bar_y = max(sub_y + 50, 470)
    label_font = _font(22, bold=True)
    value_font = _font(26, bold=True)
    for label, val in bars:
        # background rail
        draw.rounded_rectangle([bar_x + 240, bar_y, bar_x + 240 + bar_w_max, bar_y + bar_h],
                               radius=6, fill=NAVY_DARK)
        # filled bar
        fill_w = int(bar_w_max * (val / max_v))
        draw.rounded_rectangle([bar_x + 240, bar_y, bar_x + 240 + fill_w, bar_y + bar_h],
                               radius=6, fill=ORANGE)
        # label
        lb_bbox = draw.textbbox((0, 0), label, font=label_font)
        lb_h = lb_bbox[3] - lb_bbox[1]
        draw.text((bar_x, bar_y + (bar_h - lb_h) // 2 - 2), label,
                  font=label_font, fill=WHITE)
        # value
        vstr = str(val)
        vw = _tw(draw, vstr, value_font)
        draw.text((bar_x + 240 + fill_w + 14, bar_y + (bar_h - 28) // 2 - 2),
                  vstr, font=value_font, fill=CREAM)
        bar_y += bar_h + bar_gap
        if bar_y > H - 70:
            break

    # Bottom orange thin line (H - 14)
    draw.rectangle([0, H - 14, W, H - 6], fill=ORANGE)

    # Footer text
    ff = _font(20, bold=True)
    foot_left = "solcaciencia.com/revisar-cv"
    foot_right = "Solca Insight"
    draw.text((80, H - 50), foot_left, font=ff, fill=ORANGE)
    fr_w = _tw(draw, foot_right, ff)
    draw.text((W - fr_w - 80, H - 50), foot_right, font=ff, fill=CREAM)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    img.save(output_path, "PNG", optimize=True)
    print(f"Cover guardada: {output_path}  ({W}×{H})")


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    p.add_argument("--numero", type=int, required=True)
    p.add_argument("--titulo", required=True)
    p.add_argument("--keyword", required=True, help="palabra del título coloreada en naranja (puede ser '47%')")
    p.add_argument("--subtitulo", required=True)
    p.add_argument("--bars", required=True,
                   help='Lista Python de tuplas (label,valor). Ej: \'[("CRO",28),("BP",15),("Local",16)]\'')
    p.add_argument("--output", required=True)
    args = p.parse_args()
    bars = ast.literal_eval(args.bars)
    bars = [(str(l), int(v)) for l, v in bars]
    generate(
        numero=args.numero,
        titulo=args.titulo,
        keyword=args.keyword,
        subtitulo=args.subtitulo,
        bars=bars,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
