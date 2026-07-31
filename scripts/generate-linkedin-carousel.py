#!/usr/bin/env python3
"""
scripts/generate-linkedin-carousel.py · Solca · 30 jul 2026

Genera un carrusel LinkedIn PDF (portrait 1080x1350) desde una definición
declarativa de N slides. Todo Pillow, sin dependencias de Flow ni ilustraciones
generadas por IA (evita typos de texto y garantiza consistencia visual).

Formato de salida: PDF multi-página, un slide por página, dimensiones LinkedIn
document (1080x1350). Los slides individuales también se guardan como PNG en
_docs/linkedin-visuales/<slug>/.

Ejemplo de uso desde otro script:

    from generate_linkedin_carousel import build_carousel

    build_carousel(
        slug='jue-2026-08-13_carrusel_5_criterios_job_posting',
        slides=[...lista de dicts...],
    )

Este archivo también incluye el carrusel del jue 13 ago como demo ejecutable.

Paleta Solca (TOOLS_REGISTRY §5.1):
- Navy #1f3a5f
- Navy dark #182a44
- Orange #e77c3c
- Orange dim #d46627
- Cream #f5f0e6
- Cream dim #c8c0b0
"""
from __future__ import annotations
import os
import sys
from pathlib import Path
from typing import Callable, Sequence
from PIL import Image, ImageDraw, ImageFont
import img2pdf

# ── Constantes ────────────────────────────────────────────────────────
# LinkedIn Documents soporta 1:1, 4:5 y 16:9.
# 1:1 (1080x1080) elegido por consistencia cross-platform (Instagram/LinkedIn)
# y porque el icono/número no colisionan tanto en cuadrado.
W, H = 1080, 1080

NAVY       = (31, 58, 95)
NAVY_DARK  = (24, 42, 68)
NAVY_DEEP  = (18, 33, 56)
ORANGE     = (231, 124, 60)
ORANGE_DIM = (212, 102, 39)
CREAM      = (245, 240, 230)
CREAM_DIM  = (200, 192, 176)
WHITE      = (255, 255, 255)

FONT_CANDIDATES_BOLD = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/Library/Fonts/Arial Bold.ttf',
]
FONT_CANDIDATES_REG = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
]


def _font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    paths = FONT_CANDIDATES_BOLD if bold else FONT_CANDIDATES_REG
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    raise FileNotFoundError('No suitable font found')


def _text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def _wrap(draw, text: str, font, max_w: int) -> list[str]:
    words = text.split(' ')
    lines = ['']
    for w in words:
        cand = (lines[-1] + ' ' + w).strip() if lines[-1] else w
        if _text_width(draw, cand, font) > max_w and lines[-1]:
            lines.append(w)
        else:
            lines[-1] = cand
    return lines


# ── Iconos programáticos (línea arte simple, todos ~120x120) ──────────

def icon_checklist(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 120, color=ORANGE):
    """Icono: dos columnas comparativas con checkmarks."""
    w, h = size, size
    lw = max(3, size // 40)
    # Marco exterior
    draw.rounded_rectangle([x, y, x + w, y + h], radius=size // 12, outline=color, width=lw)
    # Divisor vertical
    draw.line([(x + w // 2, y + 10), (x + w // 2, y + h - 10)], fill=color, width=lw)
    # Ticks en columna izquierda (2)
    for i, ty in enumerate([y + h * 0.28, y + h * 0.58]):
        cx = x + w * 0.25
        draw.line([(cx - 12, ty), (cx - 4, ty + 8)], fill=color, width=lw)
        draw.line([(cx - 4, ty + 8), (cx + 12, ty - 10)], fill=color, width=lw)
    # X en columna derecha (1)
    cx = x + w * 0.75
    ty = y + h * 0.43
    draw.line([(cx - 10, ty - 10), (cx + 10, ty + 10)], fill=color, width=lw)
    draw.line([(cx + 10, ty - 10), (cx - 10, ty + 10)], fill=color, width=lw)


def icon_compass(draw, x: int, y: int, size: int = 120, color=ORANGE):
    """Icono: brújula (círculo con aguja diagonal)."""
    lw = max(3, size // 40)
    draw.ellipse([x, y, x + size, y + size], outline=color, width=lw)
    cx, cy = x + size // 2, y + size // 2
    # Aguja: rombo diagonal
    r = size // 3
    pts = [(cx, cy - r), (cx + r // 3, cy), (cx, cy + r), (cx - r // 3, cy)]
    draw.polygon(pts, outline=color, width=lw)
    # Punto centro
    draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=color)


def icon_speech_en(draw, x: int, y: int, size: int = 120, color=ORANGE):
    """Icono: bocadillo con 'EN'."""
    lw = max(3, size // 40)
    draw.rounded_rectangle([x, y, x + size, y + int(size * 0.75)], radius=size // 10, outline=color, width=lw)
    # Cola del bocadillo
    tail = [(x + size * 0.25, y + size * 0.75), (x + size * 0.30, y + size * 0.92), (x + size * 0.42, y + size * 0.75)]
    draw.polygon(tail, outline=color, fill=NAVY, width=lw)
    # Texto EN dentro
    f = _font(int(size * 0.32), bold=True)
    txt = 'EN'
    b = draw.textbbox((0, 0), txt, font=f)
    tw, th = b[2] - b[0], b[3] - b[1]
    draw.text((x + (size - tw) // 2, y + (int(size * 0.75) - th) // 2 - 4), txt, font=f, fill=color)


def icon_molecule(draw, x: int, y: int, size: int = 120, color=ORANGE):
    """Icono: molécula (3 círculos conectados)."""
    lw = max(3, size // 40)
    r = size // 8
    cx, cy = x + size // 2, y + size // 2
    # Nodos: uno arriba, dos abajo
    nodes = [
        (cx, cy - size // 3),
        (cx - size // 3, cy + size // 4),
        (cx + size // 3, cy + size // 4),
    ]
    # Enlaces
    draw.line([nodes[0], nodes[1]], fill=color, width=lw)
    draw.line([nodes[0], nodes[2]], fill=color, width=lw)
    draw.line([nodes[1], nodes[2]], fill=color, width=lw)
    # Nodos círculos
    for nx, ny in nodes:
        draw.ellipse([nx - r, ny - r, nx + r, ny + r], fill=NAVY, outline=color, width=lw)


def icon_magnifier(draw, x: int, y: int, size: int = 120, color=ORANGE):
    """Icono: lupa."""
    lw = max(3, size // 40)
    r = size // 3
    cx = x + r + size // 12
    cy = y + r + size // 12
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=lw)
    # Mango
    from math import cos, sin, radians
    angle = radians(45)
    hx1 = cx + int(r * cos(angle))
    hy1 = cy + int(r * sin(angle))
    hx2 = hx1 + int(size * 0.30 * cos(angle))
    hy2 = hy1 + int(size * 0.30 * sin(angle))
    draw.line([(hx1, hy1), (hx2, hy2)], fill=color, width=lw + 2)


def icon_arrow_right(draw, x: int, y: int, size: int = 120, color=ORANGE):
    """Icono: flecha derecha (para CTA)."""
    lw = max(3, size // 40)
    cy = y + size // 2
    # Línea horizontal
    draw.line([(x + 10, cy), (x + size - 10, cy)], fill=color, width=lw + 2)
    # Punta
    pts = [(x + size - 30, cy - 20), (x + size - 5, cy), (x + size - 30, cy + 20)]
    draw.polygon(pts, fill=color)


def icon_speech_bubble(draw, x: int, y: int, size: int = 120, color=ORANGE):
    """Icono: bocadillo genérico con tres puntos suspensivos (buzzwords/lenguaje vago)."""
    lw = max(3, size // 40)
    draw.rounded_rectangle([x, y, x + size, y + int(size * 0.75)], radius=size // 10, outline=color, width=lw)
    # Cola del bocadillo
    tail = [(x + size * 0.25, y + size * 0.75), (x + size * 0.30, y + size * 0.92), (x + size * 0.42, y + size * 0.75)]
    draw.polygon(tail, outline=color, fill=NAVY, width=lw)
    # Tres puntos suspensivos horizontales dentro
    cy = y + int(size * 0.375)
    r = size // 22
    for i, cx in enumerate([x + size * 0.30, x + size * 0.50, x + size * 0.70]):
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)


def icon_hourglass(draw, x: int, y: int, size: int = 120, color=ORANGE):
    """Icono: reloj de arena (tiempo/persistencia)."""
    lw = max(3, size // 40)
    # Marco superior e inferior (barras horizontales)
    draw.line([(x + size * 0.15, y + 8), (x + size * 0.85, y + 8)], fill=color, width=lw + 1)
    draw.line([(x + size * 0.15, y + size - 8), (x + size * 0.85, y + size - 8)], fill=color, width=lw + 1)
    # Cuerpo triangular (dos triángulos que se tocan en el centro)
    cx = x + size // 2
    cy = y + size // 2
    top_tri = [(x + size * 0.15, y + 12), (x + size * 0.85, y + 12), (cx, cy)]
    bot_tri = [(x + size * 0.15, y + size - 12), (x + size * 0.85, y + size - 12), (cx, cy)]
    draw.polygon(top_tri, outline=color, width=lw)
    draw.polygon(bot_tri, outline=color, width=lw)
    # Arena cayendo (línea vertical delgada en el cuello)
    draw.line([(cx, cy - 4), (cx, cy + 4)], fill=color, width=lw)


ICON_MAP: dict[str, Callable] = {
    'checklist': icon_checklist,
    'compass': icon_compass,
    'speech_en': icon_speech_en,
    'speech_bubble': icon_speech_bubble,
    'molecule': icon_molecule,
    'magnifier': icon_magnifier,
    'hourglass': icon_hourglass,
    'arrow_right': icon_arrow_right,
}


# ── Render de slides ──────────────────────────────────────────────────

def _draw_header(draw, kicker: str, page_indicator: str):
    """Header con cuadrito naranja + kicker + indicador de página derecha."""
    kf = _font(24, bold=True)
    sq = 18
    y = 60
    draw.rectangle([70, y + 4, 70 + sq, y + 4 + sq], fill=ORANGE)
    draw.text((70 + sq + 14, y), kicker, font=kf, fill=CREAM)
    # Indicador de página (derecha)
    pf = _font(20, bold=True)
    bbox = draw.textbbox((0, 0), page_indicator, font=pf)
    pw = bbox[2] - bbox[0]
    draw.text((W - pw - 70, y + 2), page_indicator, font=pf, fill=CREAM_DIM)


def _draw_footer(draw, left_text: str = '', right_text: str = 'solcaciencia.com'):
    # Línea divisoria
    draw.line([(70, H - 90), (W - 70, H - 90)], fill=(ORANGE[0], ORANGE[1], ORANGE[2]), width=1)
    lf = _font(18, bold=False)
    rf = _font(20, bold=True)
    draw.text((70, H - 60), left_text, font=lf, fill=CREAM_DIM)
    b = draw.textbbox((0, 0), right_text, font=rf)
    rw = b[2] - b[0]
    draw.text((W - rw - 70, H - 62), right_text, font=rf, fill=ORANGE)


def render_cover_slide(slide: dict, page_indicator: str, out_path: Path):
    img = Image.new('RGB', (W, H), NAVY)
    draw = ImageDraw.Draw(img)
    _draw_header(draw, slide.get('kicker', ''), page_indicator)

    # Título centrado, tipografía grande
    title = slide['title']
    tf = _font(60, bold=True)
    lines = _wrap(draw, title, tf, W - 140)
    total_h = len(lines) * 72
    ty = (H - total_h) // 2 - 100
    for ln in lines:
        highlights = slide.get('highlight', [])
        if highlights and any(h.lower() in ln.lower() for h in highlights):
            cx = 70
            for tok in ln.split(' '):
                col = ORANGE if any(h.lower() == tok.strip('.,:;¿?"').lower() for h in highlights) else WHITE
                draw.text((cx, ty), tok, font=tf, fill=col)
                cx += _text_width(draw, tok, tf) + _text_width(draw, ' ', tf)
        else:
            draw.text((70, ty), ln, font=tf, fill=WHITE)
        ty += 72

    # Subtítulo
    if slide.get('subtitle'):
        sf = _font(26, bold=False)
        sub_lines = _wrap(draw, slide['subtitle'], sf, W - 140)
        sy = ty + 30
        for ln in sub_lines:
            draw.text((70, sy), ln, font=sf, fill=CREAM_DIM)
            sy += 36

    # Indicador visual "Desliza →" en la parte baja
    hint_f = _font(20, bold=True)
    hint = slide.get('hint', 'Desliza  →')
    b = draw.textbbox((0, 0), hint, font=hint_f)
    hw = b[2] - b[0]
    draw.text(((W - hw) // 2, H - 180), hint, font=hint_f, fill=ORANGE)

    _draw_footer(draw)
    img.save(out_path, 'PNG', optimize=True)


def render_criterion_slide(slide: dict, page_indicator: str, out_path: Path):
    img = Image.new('RGB', (W, H), NAVY)
    draw = ImageDraw.Draw(img)
    _draw_header(draw, slide.get('kicker', ''), page_indicator)

    # Numeral grande arriba izquierda
    num = slide['number']
    nf = _font(120, bold=True)
    draw.text((70, 170), num, font=nf, fill=ORANGE)

    # Icono al lado del numeral (mismo bloque visual arriba)
    icon_name = slide.get('icon')
    if icon_name and icon_name in ICON_MAP:
        # Posicionado a la derecha del numeral, misma altura
        ICON_MAP[icon_name](draw, W - 200, 190, size=110)

    # Título de sección DEBAJO del numeral/icono, ancho completo
    tf = _font(44, bold=True)
    title = slide['title']
    title_lines = _wrap(draw, title, tf, W - 140)
    ty = 340
    for ln in title_lines:
        draw.text((70, ty), ln, font=tf, fill=WHITE)
        ty += 54

    # Body: dos bloques etiquetados
    body_y = ty + 40

    lbl_f = _font(16, bold=True)
    body_f = _font(26, bold=False)

    label1 = slide.get('label1', 'QUÉ ES')
    label2 = slide.get('label2', 'POR QUÉ TE IMPORTA')

    draw.text((70, body_y), label1, font=lbl_f, fill=ORANGE)
    body_y += 28
    text1 = slide['body1']
    text1_lines = _wrap(draw, text1, body_f, W - 140)
    for ln in text1_lines:
        draw.text((70, body_y), ln, font=body_f, fill=CREAM)
        body_y += 36

    body_y += 30

    # Separador delgado
    draw.line([(70, body_y - 15), (W - 70, body_y - 15)], fill=(74, 92, 118), width=1)

    draw.text((70, body_y), label2, font=lbl_f, fill=ORANGE)
    body_y += 28
    text2 = slide['body2']
    text2_lines = _wrap(draw, text2, body_f, W - 140)
    for ln in text2_lines:
        draw.text((70, body_y), ln, font=body_f, fill=CREAM)
        body_y += 36

    _draw_footer(draw, left_text=slide.get('footer_left', ''))
    img.save(out_path, 'PNG', optimize=True)


def render_cta_slide(slide: dict, page_indicator: str, out_path: Path):
    img = Image.new('RGB', (W, H), NAVY)
    draw = ImageDraw.Draw(img)
    _draw_header(draw, slide.get('kicker', ''), page_indicator)

    # Título central
    title = slide['title']
    tf = _font(52, bold=True)
    lines = _wrap(draw, title, tf, W - 140)
    total_h = len(lines) * 66
    ty = (H - total_h) // 2 - 120
    for ln in lines:
        b = draw.textbbox((0, 0), ln, font=tf)
        lw = b[2] - b[0]
        draw.text(((W - lw) // 2, ty), ln, font=tf, fill=WHITE)
        ty += 66

    # Body
    body_f = _font(26, bold=False)
    body_lines = _wrap(draw, slide['body'], body_f, W - 200)
    by = ty + 30
    for ln in body_lines:
        b = draw.textbbox((0, 0), ln, font=body_f)
        lw = b[2] - b[0]
        draw.text(((W - lw) // 2, by), ln, font=body_f, fill=CREAM)
        by += 38

    # CTA button-like
    cta = slide.get('cta', 'solcaciencia.com')
    cf = _font(30, bold=True)
    b = draw.textbbox((0, 0), cta, font=cf)
    cw = b[2] - b[0]
    padding_x, padding_y = 44, 22
    btn_w = cw + padding_x * 2
    btn_h = b[3] - b[1] + padding_y * 2
    btn_x = (W - btn_w) // 2
    btn_y = by + 50
    draw.rounded_rectangle([btn_x, btn_y, btn_x + btn_w, btn_y + btn_h], radius=btn_h // 2, fill=ORANGE)
    draw.text((btn_x + padding_x, btn_y + padding_y - 8), cta, font=cf, fill=NAVY)

    _draw_footer(draw)
    img.save(out_path, 'PNG', optimize=True)


# ── Orquestador ──────────────────────────────────────────────────────

def build_carousel(slug: str, slides: Sequence[dict], out_dir: Path | None = None):
    """
    slides: lista de dicts con 'type' ∈ {'cover', 'criterion', 'cta'} y sus fields.
    Genera PNG por slide + PDF final.
    """
    if out_dir is None:
        out_dir = Path('/Users/oscar/Downloads/solca/website/_docs/linkedin-visuales') / slug
    out_dir.mkdir(parents=True, exist_ok=True)

    n = len(slides)
    png_paths: list[Path] = []
    for i, slide in enumerate(slides, start=1):
        page_indicator = f'{i} / {n}'
        png_path = out_dir / f'slide-{i:02d}.png'
        if slide['type'] == 'cover':
            render_cover_slide(slide, page_indicator, png_path)
        elif slide['type'] == 'criterion':
            render_criterion_slide(slide, page_indicator, png_path)
        elif slide['type'] == 'cta':
            render_cta_slide(slide, page_indicator, png_path)
        else:
            raise ValueError(f"Unknown slide type: {slide['type']}")
        png_paths.append(png_path)
        print(f'  Rendered: {png_path.name}')

    # PDF final
    pdf_path = out_dir / f'{slug}.pdf'
    with open(pdf_path, 'wb') as f:
        f.write(img2pdf.convert([str(p) for p in png_paths]))
    print(f'PDF guardado: {pdf_path}')
    return pdf_path


# ── Definición del carrusel Jue 13 ago ────────────────────────────────
# Contenido standalone. Tema tangente al Insight #15 (viernes 14 ago) sin
# duplicarlo: 5 red flags en job postings pharma. Autocontenido, cierra con
# CTA neutro al blog.

CARROUSEL_JUE_13_AGO = [
    {
        'type': 'cover',
        'kicker': 'SOLCA CIENCIA  ·  JUE 13 AGO',
        'title': '5 red flags en un job posting pharma',
        'highlight': ['5', 'red', 'flags'],
        'subtitle': 'Señales que te ahorran horas de aplicaciones perdidas y aprendizaje caro sobre culturas de empresa.',
        'hint': 'Desliza  →',
    },
    {
        'type': 'criterion',
        'kicker': 'SOLCA CIENCIA  ·  JUE 13 AGO',
        'number': '01',
        'title': 'Descripción sin área ni a quién reporta',
        'icon': 'compass',
        'label1': 'QUÉ ES',
        'label2': 'POR QUÉ TE IMPORTA',
        'body1': '"Buscamos QFB para importante empresa farmacéutica" sin especificar si es Regulatorio, Farmacovigilancia, Calidad o Comercial. Sin nombre del área ni del rol que le reporta.',
        'body2': 'En empresas medianas o grandes suele indicar caos organizacional o que HR publicó sin briefing del manager. Aplicarás sin saber a qué te postulas realmente.',
        'footer_left': '1 de 5 red flags',
    },
    {
        'type': 'criterion',
        'kicker': 'SOLCA CIENCIA  ·  JUE 13 AGO',
        'number': '02',
        'title': 'Requisitos combinados imposibles',
        'icon': 'checklist',
        'label1': 'QUÉ ES',
        'label2': 'POR QUÉ TE IMPORTA',
        'body1': '"5 años de experiencia en [tecnología que existe hace 3]" o "PhD + MBA + 10 años en pharma industrial para rol Manager entry".',
        'body2': 'Indica que la descripción del puesto la escribió alguien sin claridad del rol, o que la vacante ya tiene candidato interno predeterminado y se publica por política de HR.',
        'footer_left': '2 de 5 red flags',
    },
    {
        'type': 'criterion',
        'kicker': 'SOLCA CIENCIA  ·  JUE 13 AGO',
        'number': '03',
        'title': 'Buzzwords sin un día típico descrito',
        'icon': 'speech_bubble',
        'label1': 'QUÉ ES',
        'label2': 'POR QUÉ TE IMPORTA',
        'body1': 'Ejemplo real: "Buscamos un hunter comercial 360°, apasionado por la excelencia farmacéutica" y ninguna línea sobre responsabilidades concretas ni qué harías en un día típico.',
        'body2': 'En startups o farmacéuticas pequeñas puede ser legítimo porque el rol sí es multifacético. En corporativos suele indicar que el manager no sabe qué necesita, y el scope cambia mes a mes.',
        'footer_left': '3 de 5 red flags',
    },
    {
        'type': 'criterion',
        'kicker': 'SOLCA CIENCIA  ·  JUE 13 AGO',
        'number': '04',
        'title': 'Proceso de aplicación ambiguo',
        'icon': 'magnifier',
        'label1': 'QUÉ ES',
        'label2': 'POR QUÉ TE IMPORTA',
        'body1': '"Envía tu CV a esta dirección de gmail" en lugar de portal formal. Sin nombre del reclutador, sin timeline del proceso, sin pasos siguientes descritos.',
        'body2': 'En empresas pequeñas o farmacéuticas locales puede ser normal operar así. Pero en multinacionales sugiere que la vacante no está sistematizada. Vale la pena preguntar al aplicar por los pasos siguientes.',
        'footer_left': '4 de 5 red flags',
    },
    {
        'type': 'criterion',
        'kicker': 'SOLCA CIENCIA  ·  JUE 13 AGO',
        'number': '05',
        'title': 'Publicada hace más de 90 días sin cambios',
        'icon': 'hourglass',
        'label1': 'QUÉ ES',
        'label2': 'POR QUÉ TE IMPORTA',
        'body1': 'Descripciones que llevan más de tres meses activas con la misma redacción exacta, sin nunca actualizarse ni marcar ediciones a la vacante.',
        'body2': 'Puede ser rol legítimo con búsqueda difícil de perfil especializado. Pero también puede indicar que ya se llenó, o requisitos irreales. Si aplicas, pregunta en entrevista cuánto lleva abierta y qué candidatos han visto.',
        'footer_left': '5 de 5 red flags',
    },
    {
        'type': 'cta',
        'kicker': 'SOLCA CIENCIA  ·  JUE 13 AGO',
        'title': 'Aplicar mejor, no aplicar más',
        'body': 'Cada red flag detectada libera 30 minutos que puedes gastar en la aplicación que sí importa. Más análisis pharma LATAM en el blog.',
        'cta': 'solcaciencia.com/blog',
    },
]


def main():
    build_carousel(
        slug='jue-2026-08-13_carrusel_5_red_flags_job_posting',
        slides=CARROUSEL_JUE_13_AGO,
    )


if __name__ == '__main__':
    main()
