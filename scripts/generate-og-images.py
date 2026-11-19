#!/usr/bin/env python3
"""
scripts/generate-og-images.py · imágenes para vista previa de enlaces (Open Graph)
==================================================================================

19 nov 2026. Al compartir en LinkedIn un enlace a una herramienta, la tarjeta
salía con el espacio de imagen vacío: las páginas apuntaban a /og-image.png,
que no existía (404). Este script genera una imagen por herramienta y la
imagen general del sitio, con la paleta y tipografía de las portadas del blog.

Tamaño 1200×627 (proporción 1.91:1 de las tarjetas de enlace de LinkedIn).
Los textos solo usan afirmaciones verificadas en el código de cada página;
si cambia una herramienta (número de preguntas, criterios, etc.), se edita
TARJETAS y se vuelve a correr:

    /usr/bin/python3 scripts/generate-og-images.py

Salida: public/og/<clave>.png y public/og-image.png (copia de la general).
"""
from __future__ import annotations
import importlib.util
import os
import shutil
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("cover", os.path.join(AQUI, "generate-blog-cover.py"))
cover = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cover)

W, H = 1200, 627
PUBLIC = os.path.join(AQUI, "..", "public")

# clave → (kicker, título, palabras en naranja, subtítulo)
TARJETAS = {
    # Textos de GPT-6.1 Sol (gen-1795120109-ivBtnnv3RgTdkN7KyH8H), aprobados por Oscar el 19 nov 2026.
    "revisar-cv": ("Revisor de CV", "Revisa tu CV para la industria farmacéutica", "industria farmacéutica", "20 criterios de redacción y estructura. Sin costo."),
    "quiz-rol": ("Quiz de rol", "¿Qué rol pharma se ajusta más a ti?", "rol pharma", "12 preguntas sobre cómo trabajas. Resultado inmediato."),
    "vacantes": ("Buscador de vacantes", "Vacantes en América Latina y España", "América Latina España", "Farma, CROs, tecnología médica y consultoras. De sus portales oficiales."),
    "simulador": ("Simulador de entrevistas", "Practica con tu CV y la vacante", "tu CV vacante", "Primera sesión: 5 preguntas de llamada inicial. Sin costo ni tarjeta."),
    "comparar-cv": ("Compara tu CV", "Compara tu CV con una vacante", "una vacante", "Ve cuántos requisitos indispensables de la vacante aparecen en tu CV."),
    "solca": ("Solca Ciencia", "De la ciencia a la industria", "industria", "Acompañamos a científicos en su paso a la industria farmacéutica."),
}


def tarjeta(kicker: str, titulo: str, keyword: str, subtitulo: str, salida: str) -> None:
    img = Image.new("RGB", (W, H), cover.NAVY)
    d = ImageDraw.Draw(img)
    m = 80

    kf = cover._font(26, bold=True)
    sq = 20
    d.rectangle([m, 76, m + sq, 76 + sq], fill=cover.ORANGE)
    d.text((m + sq + 16, 70), kicker.upper(), font=kf, fill=cover.CREAM)

    for size in (64, 60, 56):  # evita una palabra sola en la última línea
        tf = cover._font(size, bold=True)
        lineas = cover._wrap_title_with_keyword(d, titulo, keyword, tf, W - 2 * m)
        if len(lineas) == 1 or len(lineas[-1]) > 1:
            break
    if len(lineas) > 3:
        raise ValueError(f"Título demasiado largo para {salida}: {len(lineas)} líneas")
    y = cover._draw_title_lines(d, lineas, m, 150, tf, 80)

    sf = cover._font(28, bold=False)
    y += 24
    for ln in cover._wrap_simple(d, subtitulo, sf, W - 2 * m):
        d.text((m, y), ln, font=sf, fill=cover.CREAM)
        y += 40
    if y > H - 110:
        raise ValueError(f"El texto se encima con el pie en {salida}")

    d.rectangle([m, H - 92, m + 150, H - 88], fill=cover.ORANGE)
    d.text((m, H - 66), "solcaciencia.com", font=cover._font(28, bold=True), fill=cover.ORANGE)

    os.makedirs(os.path.dirname(salida), exist_ok=True)
    img.save(salida, "PNG", optimize=True)
    print(f"OK {salida}")


def main() -> None:
    for clave, (k, t, kw, s) in TARJETAS.items():
        tarjeta(k, t, kw, s, os.path.abspath(os.path.join(PUBLIC, "og", f"{clave}.png")))
    shutil.copyfile(os.path.join(PUBLIC, "og", "solca.png"), os.path.join(PUBLIC, "og-image.png"))
    print("OK public/og-image.png (general)")


if __name__ == "__main__":
    main()
