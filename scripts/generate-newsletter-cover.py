#!/usr/bin/env python3
"""
scripts/generate-newsletter-cover.py · Solca Insight cover generator
====================================================================

Genera la portada PNG (1280×720) de un newsletter Solca Insight siguiendo
la paleta y layout documentados en _docs/TOOLS_REGISTRY.md sección 5.2.

Por qué este archivo existe (lección 23 jun 2026): las covers de Insight
#01–#07 se generaron ad-hoc en chat con Pillow pero NUNCA se commitearon
como script. Resultado: cada vez que arrancábamos una edición nueva había
que reconstruir el código desde la documentación, perdiendo tiempo y
arriesgando inconsistencia visual. Este script congela el layout canónico.

Uso CLI
-------

    python3 scripts/generate-newsletter-cover.py \\
        --numero 8 \\
        --titulo "IA en clinical research: deployment vs hype" \\
        --keyword "IA" \\
        --subtitulo "Lo que las vacantes muestran sobre dónde ya entró y dónde sigue siendo promesa." \\
        --card1 Deployed --card2 Hype --card3 Vacantes \\
        --output _docs/covers/newsletter_2026_06_26.png

La palabra `--keyword` aparece coloreada en naranja dentro del título (sirve
como ancla visual). Debe estar contenida literalmente en `--titulo`.

Requisitos
----------

- Pillow: `pip install pillow --break-system-packages`
- Fuentes DejaVu Sans (preinstaladas en macOS y Linux estándar). En macOS:
  /Library/Fonts/Arial Bold.ttf o /System/Library/Fonts/. Si no encuentra
  ninguna, lanza error claro.

Paleta canónica (debe coincidir con TOOLS_REGISTRY.md §5.1)
"""
from __future__ import annotations
import argparse
import os
from PIL import Image, ImageDraw, ImageFont

# ── Paleta Solca (TOOLS_REGISTRY.md §5.1) ────────────────────────────
NAVY       = (31, 58, 95)
NAVY_DARK  = (24, 42, 68)
NAVY_DEEP  = (18, 33, 56)
ORANGE     = (231, 124, 60)
ORANGE_DIM = (212, 102, 39)
CREAM      = (245, 240, 230)
WHITE      = (255, 255, 255)

# ── Dimensiones ──────────────────────────────────────────────────────
W, H = 1280, 720

# ── Fuentes (fallback por OS) ────────────────────────────────────────
FONT_CANDIDATES_BOLD = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",   # Linux
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",      # macOS
    "/Library/Fonts/Arial Bold.ttf",                          # macOS legacy
    "/Library/Fonts/Microsoft/Arial Bold.ttf",                # Office on macOS
    "C:\\Windows\\Fonts\\arialbd.ttf",                        # Windows
]
FONT_CANDIDATES_REGULAR = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
]


def _font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    candidates = FONT_CANDIDATES_BOLD if bold else FONT_CANDIDATES_REGULAR
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    raise FileNotFoundError(
        f"No font found in: {candidates}. "
        "Install DejaVu (Linux/macOS) or use system Arial."
    )


def _text_width(draw: ImageDraw.ImageDraw, txt: str, font: ImageFont.FreeTypeFont) -> int:
    bbox = draw.textbbox((0, 0), txt, font=font)
    return bbox[2] - bbox[0]


def _wrap_title_with_keyword(
    draw: ImageDraw.ImageDraw,
    title: str,
    keyword: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> list[list[tuple[str, tuple[int, int, int]]]]:
    """
    Wrappea el título en N líneas que entren en max_width, marcando los
    tokens que pertenecen al `keyword` con color naranja.

    Devuelve lista de líneas, cada línea es lista de (token, color).
    """
    tokens = title.split(" ")
    kw_norm = keyword.strip()
    # Marca cada token si forma parte del keyword (case-insensitive simple).
    colored = [
        (tok, ORANGE if tok.strip(".,:;").lower() == kw_norm.lower() else WHITE)
        for tok in tokens
    ]
    lines: list[list[tuple[str, tuple[int, int, int]]]] = [[]]
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


def _draw_title_lines(
    draw: ImageDraw.ImageDraw,
    lines: list[list[tuple[str, tuple[int, int, int]]]],
    x: int,
    y: int,
    font: ImageFont.FreeTypeFont,
    line_height: int,
) -> int:
    """Renderiza las líneas, devuelve la y final tras la última línea."""
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


def _fit_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    max_width: int,
    start_size: int,
    min_size: int = 22,
    bold: bool = True,
) -> ImageFont.FreeTypeFont:
    """
    Devuelve una fuente cuyo tamaño se reduce desde start_size hasta que el
    ancho renderizado de `text` entre en max_width. No baja de min_size.
    """
    size = start_size
    while size > min_size:
        f = _font(size, bold=bold)
        if _text_width(draw, text, f) <= max_width:
            return f
        size -= 2
    return _font(min_size, bold=bold)


def _wrap_simple(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> list[str]:
    words = text.split(" ")
    lines: list[str] = [""]
    for w in words:
        candidate = (lines[-1] + " " + w).strip() if lines[-1] else w
        if _text_width(draw, candidate, font) > max_width and lines[-1]:
            lines.append(w)
        else:
            lines[-1] = candidate
    return lines


def generate_cover(
    numero: int,
    titulo: str,
    keyword: str,
    subtitulo: str,
    card1: str,
    card2: str,
    card3: str,
    output_path: str,
) -> None:
    img = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(img)

    # ── Kicker (arriba izq): "■ SOLCA INSIGHT · #NN" ─────────────────
    kicker_font = _font(26, bold=True)
    kicker_y = 70
    # Cuadradito naranja
    sq = 18
    draw.rectangle([80, kicker_y + 6, 80 + sq, kicker_y + 6 + sq], fill=ORANGE)
    kicker_text = f"SOLCA INSIGHT  ·  #{numero:02d}"
    draw.text((80 + sq + 16, kicker_y), kicker_text, font=kicker_font, fill=CREAM)

    # ── Título grande con keyword en naranja ─────────────────────────
    title_font = _font(76, bold=True)
    title_max_w = 770  # parte izquierda; las cards van a la derecha
    title_lines = _wrap_title_with_keyword(
        draw, titulo, keyword, title_font, title_max_w
    )
    title_y_start = 215
    line_height = 95
    final_y = _draw_title_lines(
        draw, title_lines, 80, title_y_start, title_font, line_height
    )

    # ── Subtítulo (debajo del título, en crema) ──────────────────────
    subt_font = _font(24, bold=False)
    subt_max_w = 770
    subt_lines = _wrap_simple(draw, subtitulo, subt_font, subt_max_w)
    sub_y = final_y + 30
    for ln in subt_lines:
        draw.text((80, sub_y), ln, font=subt_font, fill=CREAM)
        sub_y += 34

    # ── 3 cards a la derecha ─────────────────────────────────────────
    card_x = 870
    card_w = 330
    card_h = 120
    card_gap = 28
    card_y0 = 210
    cards_text = [(f"{i+1:02d}", t) for i, t in enumerate([card1, card2, card3])]
    num_font = _font(46, bold=True)
    for i, (num, label) in enumerate(cards_text):
        cy = card_y0 + i * (card_h + card_gap)
        # Card background
        draw.rounded_rectangle(
            [card_x, cy, card_x + card_w, cy + card_h], radius=10, fill=NAVY_DARK
        )
        # Number en naranja (izq)
        num_w = _text_width(draw, num, num_font)
        draw.text(
            (card_x + 28, cy + (card_h - 56) // 2 - 4),
            num,
            font=num_font,
            fill=ORANGE,
        )
        # Label (derecha del número) · auto-fit para no salirse del card
        lbl_x = card_x + 28 + num_w + 24
        lbl_pad_right = 24
        lbl_max_w = (card_x + card_w) - lbl_x - lbl_pad_right
        lbl_font = _fit_font(draw, label, lbl_max_w, start_size=36, min_size=22, bold=True)
        # vertical center approx
        lbl_bbox = draw.textbbox((0, 0), label, font=lbl_font)
        lbl_h = lbl_bbox[3] - lbl_bbox[1]
        draw.text(
            (lbl_x, cy + (card_h - lbl_h) // 2 - 4),
            label,
            font=lbl_font,
            fill=WHITE,
        )

    # ── Footer "solcaciencia.com" abajo derecha ──────────────────────
    foot_font = _font(28, bold=True)
    foot_text = "solcaciencia.com"
    foot_w = _text_width(draw, foot_text, foot_font)
    draw.text((W - foot_w - 80, H - 70), foot_text, font=foot_font, fill=ORANGE)

    # Save
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    img.save(output_path, "PNG", optimize=True)
    print(f"Cover guardada: {output_path}  ({W}×{H})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("--numero", type=int, required=True, help="Número de edición Insight (ej 8)")
    parser.add_argument("--titulo", required=True, help="Título completo del newsletter")
    parser.add_argument("--keyword", required=True, help="Palabra del título a destacar en naranja")
    parser.add_argument("--subtitulo", required=True, help="Subtítulo o bajada")
    parser.add_argument("--card1", required=True, help="Texto card 01")
    parser.add_argument("--card2", required=True, help="Texto card 02")
    parser.add_argument("--card3", required=True, help="Texto card 03")
    parser.add_argument("--output", required=True, help="Ruta de salida PNG")
    args = parser.parse_args()
    generate_cover(
        numero=args.numero,
        titulo=args.titulo,
        keyword=args.keyword,
        subtitulo=args.subtitulo,
        card1=args.card1,
        card2=args.card2,
        card3=args.card3,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
