#!/usr/bin/env python3
"""
scripts/sprint_w43_w45_visuals.py · Solca · 14 oct 2026

Visuales de las semanas W43 (Regulatory), W44 (Farmacovigilancia) y W45 (Consulting)
del sprint LinkedIn W42-W45:
  - Imagen del miércoles (1200x1200).
  - Carrusel del jueves (PDF). Las láminas se leen del bloque ```python de cada
    archivo de copys, así que el PDF siempre coincide con el copy revisado.
  - Portada del Solca Insight del viernes (1280x720, sin número de edición).

Salida: _docs/linkedin-visuales/<slug>/ y _docs/covers/
Uso: python3 scripts/sprint_w43_w45_visuals.py
"""
from __future__ import annotations
import importlib.util
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
COPYS = ROOT.parent / 'estrategia-linkedin' / 'sprint-w42-w45'
OUT = ROOT / '_docs' / 'linkedin-visuales'


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


car = _load('carousel', 'generate-linkedin-carousel.py')
w42 = _load('w42', 'sprint_w42_visuals.py')
f = car._font


def _frame(kicker: str, t1: str, t2: str, sub: str):
    W = H = 1200
    img = Image.new('RGB', (W, H), car.NAVY)
    d = ImageDraw.Draw(img)
    d.rectangle([80, 84, 98, 102], fill=car.ORANGE)
    d.text((112, 78), kicker, font=f(26), fill=car.CREAM)
    d.text((80, 150), t1, font=f(60), fill=car.WHITE)
    d.text((80, 225), t2, font=f(60), fill=car.ORANGE)
    y = 320
    for ln in car._wrap(d, sub, f(26, bold=False), W - 160):
        d.text((80, y), ln, font=f(26, bold=False), fill=car.CREAM_DIM)
        y += 34
    return img, d


def _footer(img, d, left: str):
    W, H = img.size
    d.line([(80, H - 70), (W - 80, H - 70)], fill=car.ORANGE, width=1)
    d.text((80, H - 52), left, font=f(20, bold=False), fill=car.CREAM_DIM)
    t = 'solcaciencia.com'
    d.text((W - 80 - car._text_width(d, t, f(22)), H - 54), t, font=f(22), fill=car.ORANGE)
    d.rectangle([0, H - 14, W, H], fill=car.ORANGE)


def _cards(d, cards, y0=420, h=450):
    """Tres tarjetas en columna (número, título, cuerpo, fuente)."""
    gx, gap = 80, 24
    cw = (1200 - 2 * gx - 2 * gap) // 3
    for i, (num, title, body, src) in enumerate(cards):
        x = gx + i * (cw + gap)
        d.rounded_rectangle([x, y0, x + cw, y0 + h], radius=18, fill=car.NAVY_DARK)
        d.rectangle([x, y0, x + cw, y0 + 8], fill=car.ORANGE)
        d.text((x + 26, y0 + 28), num, font=f(42), fill=car.ORANGE)
        y = y0 + 90
        for ln in car._wrap(d, title, f(30), cw - 52):
            d.text((x + 26, y), ln, font=f(30), fill=car.WHITE)
            y += 38
        y += 10
        for ln in car._wrap(d, body, f(23, bold=False), cw - 52):
            d.text((x + 26, y), ln, font=f(23, bold=False), fill=car.CREAM)
            y += 30
        sy = y0 + h - 30
        for ln in reversed(car._wrap(d, src, f(18), cw - 52)):
            d.text((x + 26, sy - 4), ln, font=f(18), fill=car.ORANGE)
            sy -= 24


def _band(d, label, text, y):
    d.rounded_rectangle([80, y, 1120, y + 110], radius=18, outline=car.ORANGE, width=3)
    d.text((112, y + 20), label, font=f(20), fill=car.ORANGE)
    d.text((112, y + 52), text, font=f(26, bold=False), fill=car.WHITE)


def img_w43(path: Path):
    img, d = _frame('REGULATORY AFFAIRS EN MÉXICO', 'Registro sanitario:', 'los 3 trámites',
                    'Lo que más hace un equipo de Regulatory Affairs frente a COFEPRIS.')
    _cards(d, [
        ('01', 'Registro nuevo', 'Autorización para comercializar un medicamento.', 'RIS art. 167'),
        ('02', 'Prórroga', '5 años de vigencia y prórrogas de 10. Se pide 150 días antes.', 'LGS art. 376 · RIS art. 190 Bis 6'),
        ('03', 'Modificación', 'Menor, moderada o mayor, según el cambio.', 'RIS art. 184 · criterios COFEPRIS 2024'),
    ])
    _band(d, 'NORMAS BASE', 'NOM-059 (fabricación) · NOM-072 (etiquetado) · NOM-220 (farmacovigilancia)', 920)
    _footer(img, d, 'Vigente a octubre de 2026')
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'PNG', optimize=True)


def img_w44(path: Path):
    img, d = _frame('FARMACOVIGILANCIA EN MÉXICO', 'Dónde se hace', 'farmacovigilancia',
                    'Tres lugares donde trabaja un analista de farmacovigilancia.')
    _cards(d, [
        ('01', 'CRO', 'Graduate, trainee o Drug Safety Associate.', 'Programas de entrada de CRO'),
        ('02', 'Laboratorio', 'Unidad de farmacovigilancia del titular del registro.', 'NOM-220-SSA1-2016'),
        ('03', 'Sistema Nacional de Salud', 'Centro institucional de farmacovigilancia.', 'NOM-220, punto 4.6'),
    ])
    _band(d, 'PLAZOS PARA TITULARES · NOM-220 (MODIFICACIÓN 2020)', 'Grave fatal: 7 días · Grave no fatal: 15 días · No grave: 90 días', 920)
    _footer(img, d, 'Fuente: NOM-220-SSA1-2016, Tabla 1 (DOF 30/09/2020)')
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'PNG', optimize=True)


def img_w45(path: Path):
    img, d = _frame('CONSULTORÍA EN CIENCIAS DE LA VIDA', 'Market access:', '¿consultoría o función interna?',
                    'Las dos existen. Cambia para quién trabajas.')
    cols = [
        ('Dentro de la farmacéutica', ['Especialista, gerente o director de acceso al mercado.', 'Ejecuta la negociación de precio y cobertura de sus productos.']),
        ('En una consultora', ['Áreas como Value & Access (ZS) o Value, Pricing & Access (Putnam).', 'Asesora a varias compañías.']),
    ]
    gx, gap, y0, h = 80, 30, 420, 450
    cw = (1200 - 2 * gx - gap) // 2
    for i, (title, lines) in enumerate(cols):
        x = gx + i * (cw + gap)
        d.rounded_rectangle([x, y0, x + cw, y0 + h], radius=18, fill=car.NAVY_DARK)
        d.rectangle([x, y0, x + 8, y0 + h], fill=car.ORANGE)
        d.text((x + 34, y0 + 30), title, font=f(32), fill=car.WHITE)
        y = y0 + 100
        for para in lines:
            for ln in car._wrap(d, para, f(25, bold=False), cw - 70):
                d.text((x + 34, y), ln, font=f(25, bold=False), fill=car.CREAM)
                y += 33
            y += 18
    _band(d, 'LA DISTINCIÓN', 'Consultoría es un modelo de empleo, no una especialidad.', 920)
    _footer(img, d, 'Solca Ciencia · Consultoría en ciencias de la vida')
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'PNG', optimize=True)


def carousel_from_copys(copys_file: str, slug: str):
    text = (COPYS / copys_file).read_text()
    code = re.search(r'```python\n(.*?)```', text, re.S).group(1)
    ns: dict = {}
    exec(code, ns)
    slides = next(v for k, v in ns.items() if k.startswith('CARRUSEL'))
    for sl in slides:
        if sl.get('type') == 'question':
            sl.setdefault('source_label', 'Fuente: ')
    w42.build_w42_carousel(slug, slides, out_dir=OUT / slug)


def cover(titulo, keyword, sub, c1, c2, c3, out):
    subprocess.run(['python3', str(HERE / 'generate-newsletter-cover.py'), '--numero', '0',
                    '--titulo', titulo, '--keyword', keyword, '--subtitulo', sub,
                    '--card1', c1, '--card2', c2, '--card3', c3, '--output', str(out)], check=True)


if __name__ == '__main__':
    img_w43(OUT / 'mie-2026-10-28_regulatory_registro' / 'mie-2026-10-28_regulatory_registro.png')
    img_w44(OUT / 'mie-2026-11-04_fv_donde' / 'mie-2026-11-04_fv_donde.png')
    img_w45(OUT / 'mie-2026-11-11_consulting_market_access' / 'mie-2026-11-11_consulting_market_access.png')
    carousel_from_copys('w43-regulatory-copys.md', 'jue-2026-10-29_carrusel_regulatory_preguntas')
    carousel_from_copys('w44-fv-copys.md', 'jue-2026-11-05_carrusel_fv_preguntas')
    carousel_from_copys('w45-consulting-copys.md', 'jue-2026-11-12_carrusel_consulting_caso')
    covers = ROOT / '_docs' / 'covers'
    cover('ANMAT vs COFEPRIS al aplicar a Regulatory', 'ANMAT', 'Qué cambia entre Argentina y México: ley base, vigencia y vías de registro',
          'Ley base', 'Vigencia', 'Vías', covers / 'newsletter_2026_10_30.png')
    cover('Trainee de farmacovigilancia en una CRO', 'farmacovigilancia', 'Qué piden las vacantes de entrada y cómo prepararlo',
          'Qué piden', 'Formación', 'Cómo aplicar', covers / 'newsletter_2026_11_06.png')
    cover('De la ciencia a la consultoría', 'consultoría', 'Las puertas de entrada para doctores y médicos',
          'Programas', 'Proceso', 'Caso', covers / 'newsletter_2026_11_13.png')
