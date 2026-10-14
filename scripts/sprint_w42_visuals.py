#!/usr/bin/env python3
"""
scripts/sprint_w42_visuals.py · Solca · 14 oct 2026

Visuales de la semana W42 (CRA) del sprint LinkedIn W42-W45:
  - Mié 21 oct: imagen "4 puertas de entrada a CRA en México" (1200x1200).
  - Jue 22 oct: carrusel "5 preguntas técnicas de entrevista CRA" (8 láminas, PDF).

Copys y fuentes: plan del sprint, pestaña "Copys W42 · CRA".
Salida: _docs/linkedin-visuales/<slug>/

Uso: python3 scripts/sprint_w42_visuals.py
"""
from __future__ import annotations
import importlib.util
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('carousel', HERE / 'generate-linkedin-carousel.py')
car = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(car)

OUT_ROOT = HERE.parent / '_docs' / 'linkedin-visuales'
KICKER = 'SOLCA CIENCIA  ·  CRA  ·  ICH E6(R3)'


# ── Mié 21 oct · 4 puertas de entrada a CRA ───────────────────────────

def build_puertas_cra(out_path: Path):
    W = H = 1200
    img = Image.new('RGB', (W, H), car.NAVY)
    d = ImageDraw.Draw(img)
    f = car._font

    # Kicker
    d.rectangle([80, 84, 98, 102], fill=car.ORANGE)
    d.text((112, 78), 'CÓMO SER CRA EN MÉXICO', font=f(26), fill=car.CREAM)

    # Título
    d.text((80, 150), '4 puertas de entrada', font=f(68), fill=car.WHITE)
    d.text((80, 232), 'a CRA en México', font=f(68), fill=car.ORANGE)
    sub = 'CRA (Clinical Research Associate): el monitor del estudio clínico.'
    d.text((80, 330), sub, font=f(28, bold=False), fill=car.CREAM_DIM)

    cards = [
        ('01', 'CRO', 'Programa de entrada: CRA I o CRA trainee.'),
        ('02', 'Coordinador de estudios', 'En el sitio: preparas los documentos que el CRA revisa.'),
        ('03', 'Asistente de estudios clínicos (CTA)', 'Desde la oficina: documentos esenciales y sistemas.'),
        ('04', 'Subinvestigador', 'Si estudiaste medicina: protocolo y eventos adversos desde el lado clínico.'),
    ]
    # Grid 2x2
    gx, gy, gap = 80, 400, 30
    cw = (W - 2 * gx - gap) // 2
    ch = 250
    for i, (num, title, body) in enumerate(cards):
        x = gx + (i % 2) * (cw + gap)
        y = gy + (i // 2) * (ch + gap)
        d.rounded_rectangle([x, y, x + cw, y + ch], radius=18, fill=car.NAVY_DARK)
        d.rectangle([x, y, x + 8, y + ch], fill=car.ORANGE)
        d.text((x + 34, y + 26), num, font=f(44), fill=car.ORANGE)
        ty = y + 86
        for ln in car._wrap(d, title, f(30), cw - 60):
            d.text((x + 34, ty), ln, font=f(30), fill=car.WHITE)
            ty += 38
        ty += 8
        for ln in car._wrap(d, body, f(23, bold=False), cw - 60):
            d.text((x + 34, ty), ln, font=f(23, bold=False), fill=car.CREAM)
            ty += 31

    # Banda inferior: lo que puedes hacer hoy
    by = gy + 2 * ch + gap + 40
    d.rounded_rectangle([80, by, W - 80, by + 110], radius=18, outline=car.ORANGE, width=3)
    d.text((112, by + 20), 'LO QUE PUEDES HACER HOY', font=f(20), fill=car.ORANGE)
    d.text((112, by + 52), 'Curso GCP (Buenas Prácticas Clínicas) de acceso abierto.', font=f(28, bold=False), fill=car.WHITE)

    # Footer
    d.line([(80, H - 70), (W - 80, H - 70)], fill=car.ORANGE, width=1)
    d.text((80, H - 52), 'Guía completa: «Cómo ser CRA en México», blog Solca', font=f(20, bold=False), fill=car.CREAM_DIM)
    t = 'solcaciencia.com'
    tw = car._text_width(d, t, f(22))
    d.text((W - 80 - tw, H - 54), t, font=f(22), fill=car.ORANGE)
    d.rectangle([0, H - 14, W, H], fill=car.ORANGE)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, 'PNG', optimize=True)
    print(f'Imagen guardada: {out_path}')


# ── Jue 22 oct · carrusel 5 preguntas técnicas CRA ────────────────────

def render_question_slide(slide: dict, page_indicator: str, out_path: Path):
    """Lámina de pregunta: número, pregunta, respuesta grande y la sección de la guía abajo."""
    W, H = car.W, car.H
    img = Image.new('RGB', (W, H), car.NAVY)
    d = ImageDraw.Draw(img)
    f = car._font
    car._draw_header(d, slide['kicker'], page_indicator)
    d.text((70, 140), slide['number'], font=f(110), fill=car.ORANGE)
    y = 290
    for ln in car._wrap(d, slide['title'], f(48), W - 140):
        d.text((70, y), ln, font=f(48), fill=car.WHITE)
        y += 60
    y += 40
    d.text((70, y), 'LA RESPUESTA', font=f(20), fill=car.ORANGE)
    y += 38
    for ln in car._wrap(d, slide['answer'], f(36, bold=False), W - 140):
        d.text((70, y), ln, font=f(36, bold=False), fill=car.CREAM)
        y += 48
    # Fuente en caja fija al pie
    src = slide.get('source_label', 'Dónde lo dice ICH E6(R3): ') + slide['source']
    sf = f(28)
    lines = car._wrap(d, src, sf, W - 140 - 56)
    bx = 70
    bh = 34 * len(lines) + 36
    by = H - 130 - bh
    bw = max(car._text_width(d, ln, sf) for ln in lines) + 56
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=min(35, bh // 2), outline=car.ORANGE, width=3)
    for i, ln in enumerate(lines):
        d.text((bx + 28, by + 18 + i * 34), ln, font=sf, fill=car.ORANGE)
    car._draw_footer(d, left_text=slide.get('footer_left', ''))
    img.save(out_path, 'PNG', optimize=True)


def build_w42_carousel(slug: str, slides, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    n = len(slides)
    paths = []
    for i, sl in enumerate(slides, start=1):
        pth = out_dir / f'slide-{i:02d}.png'
        pi = f'{i} / {n}'
        {'cover': car.render_cover_slide, 'question': render_question_slide, 'cta': car.render_cta_slide}[sl['type']](sl, pi, pth)
        paths.append(pth)
    pdf = out_dir / f'{slug}.pdf'
    imgs = [Image.open(p).convert('RGB') for p in paths]
    imgs[0].save(pdf, 'PDF', save_all=True, append_images=imgs[1:], resolution=150)
    print(f'PDF guardado: {pdf}')


def _q(n, title, answer, source, footer='Pregunta técnica de entrevista CRA'):
    return {'type': 'question', 'kicker': KICKER, 'number': n, 'title': title,
            'answer': answer, 'source': source, 'footer_left': footer}


CARRUSEL_W42 = [
    {
        'type': 'cover', 'kicker': KICKER,
        'title': '5 preguntas técnicas de entrevista CRA y la sección de E6(R3) que sostiene cada respuesta',
        'highlight': ['5', 'E6(R3)'],
        'subtitle': 'E6(R3) · vigente en la UE desde el 23 de julio de 2025. Más una trampa sobre las CRO.',
        'hint': 'Desliza  →',
    },
    _q('01', '¿Qué significa calidad en E6(R3)?',
       'Aptitud para el propósito. No es "cero hallazgos": es que el ensayo sirva para lo que fue diseñado.',
       'Principio 6.1'),
    _q('02', '¿Qué son los factores críticos de calidad?',
       'Atributos clave para proteger a los participantes y para que los resultados sean confiables. Se identifican de forma prospectiva, antes de empezar.',
       'Principio 6.2'),
    _q('03', '¿Qué es el monitoreo centralizado?',
       'Evaluación oportuna de datos acumulados por personal calificado del patrocinador. Puede reducir el monitoreo en sitio o usarse solo, y sirve para elegir sitios para monitoreo dirigido.',
       'Sección 3.11.4.2'),
    _q('04', '¿El monitoreo en sitio tiene que ser presencial?',
       'No. Puede ser en sitio, remoto o ambos. La frecuencia depende de los riesgos identificados del estudio.',
       'Sección 3.11.4.1'),
    _q('05', '¿Qué haces ante una desviación de protocolo?',
       'Documentar todas, explicar las importantes y prevenir su recurrencia. Desviarse por iniciativa propia solo para eliminar un riesgo inmediato, avisando al patrocinador.',
       'Secciones 2.5.3 y 2.5.4'),
    _q('+1', 'La trampa: si el patrocinador transfiere el monitoreo a una CRO, ¿de quién es la responsabilidad de la calidad de los datos?',
       'Del patrocinador. Puede transferir actividades, pero retiene la responsabilidad general.',
       'Principio 10', footer='CRO: Contract Research Organization'),
    {
        'type': 'cta', 'kicker': KICKER,
        'title': 'Practica en voz alta tu entrevista de CRA',
        'body': 'Primera sesión sin costo: llamada inicial con reclutador, 5 preguntas, con tu CV. Simulador de Entrevistas Pharma.',
        'cta': 'solcaciencia.com/simulador-entrevistas',
    },
]


if __name__ == '__main__':
    build_puertas_cra(OUT_ROOT / 'mie-2026-10-21_cra_4_puertas' / 'mie-2026-10-21_cra_4_puertas.png')
    build_w42_carousel('jue-2026-10-22_carrusel_cra_preguntas_e6r3', CARRUSEL_W42, out_dir=OUT_ROOT / 'jue-2026-10-22_carrusel_cra_preguntas_e6r3')
