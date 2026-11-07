/**
 * CV a la medida · documento Word (DOCX) · 6 nov 2026.
 *
 * Se arma en el Worker con el paquete `docx` (empaqueta con fflate; sin APIs de Node). Formato compatible con ATS,
 * según ../consultoria/investigacion/2026-11-cv-mejores-practicas.md (C1, C2, C3):
 *   - una sola columna, sin tablas, cuadros de texto, imágenes ni encabezados de página con datos clave;
 *   - Calibri 11 pt (nombre 18 pt), márgenes de 0.8", encabezados de sección claros, viñetas reales de Word;
 *   - orden: contacto, resumen, experiencia, educación, habilidades, certificaciones, publicaciones, idiomas;
 *   - los marcadores `[...]` van resaltados en amarillo para que la persona los complete o borre antes de enviar.
 *
 * Probado offline con `node scripts/test-cv-medida.mjs` (el resultado es un zip válido con word/document.xml).
 */

import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, TextRun } from 'docx';
import type { CvMedida, Idioma } from './cv-medida.ts';

const FUENTE = 'Calibri';
const TAM = 22; // medios puntos: 11 pt
const AZUL = '1F3A5F';

const ETIQUETAS: Record<Idioma, Record<string, string>> = {
  es: {
    resumen: 'Resumen profesional',
    experiencia: 'Experiencia',
    educacion: 'Educación',
    habilidades: 'Habilidades',
    certificaciones: 'Certificaciones',
    publicaciones: 'Publicaciones',
    idiomas: 'Idiomas',
  },
  en: {
    resumen: 'Professional Summary',
    experiencia: 'Experience',
    educacion: 'Education',
    habilidades: 'Skills',
    certificaciones: 'Certifications',
    publicaciones: 'Publications',
    idiomas: 'Languages',
  },
};

/** Corta el texto en tramos y resalta los marcadores `[...]`. */
function tramos(texto: string, opts: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}): TextRun[] {
  return texto
    .split(/(\[[^\]\n]{1,80}\])/)
    .filter((t) => t.length > 0)
    .map(
      (t) =>
        new TextRun({
          text: t,
          font: FUENTE,
          size: opts.size ?? TAM,
          bold: opts.bold,
          italics: opts.italics,
          color: opts.color,
          highlight: /^\[.*\]$/.test(t) ? 'yellow' : undefined,
        }),
    );
}

function titulo(texto: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: AZUL, space: 2 } },
    children: [new TextRun({ text: texto.toUpperCase(), font: FUENTE, size: 24, bold: true, color: AZUL })],
  });
}

function parrafo(texto: string, opts: { bold?: boolean; italics?: boolean; after?: number; before?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { before: opts.before ?? 0, after: opts.after ?? 60 },
    children: tramos(texto, opts),
  });
}

function vineta(texto: string): Paragraph {
  return new Paragraph({
    numbering: { reference: 'vinetas', level: 0 },
    spacing: { after: 40 },
    children: tramos(texto),
  });
}

function unir(partes: string[], sep: string): string {
  return partes.map((p) => p.trim()).filter(Boolean).join(sep);
}

/** Párrafos del documento, en orden. Exportado para las pruebas. */
export function parrafosCv(cv: CvMedida): Paragraph[] {
  const L = ETIQUETAS[cv.idioma];
  const out: Paragraph[] = [];
  const c = cv.contacto;

  out.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: tramos(c.nombre, { bold: true, size: 36, color: AZUL }),
    }),
  );
  if (c.titular) out.push(parrafo(c.titular, { bold: true, after: 40 }));
  const contacto = unir([c.correo, c.telefono, c.ubicacion, c.linkedin], ' | ');
  if (contacto) out.push(parrafo(contacto, { after: 120 }));

  out.push(titulo(L.resumen), parrafo(cv.resumen, { after: 80 }));

  if (cv.experiencia.length) {
    out.push(titulo(L.experiencia));
    for (const e of cv.experiencia) {
      out.push(parrafo(unir([e.puesto, e.organizacion], ' · '), { bold: true, before: 80, after: 20 }));
      const fechas = unir([e.inicio, e.fin], ' – ');
      const linea = unir([fechas, e.ubicacion], ' | ');
      if (linea) out.push(parrafo(linea, { italics: true, after: 40 }));
      for (const v of e.vinetas) out.push(vineta(v.texto));
    }
  }

  if (cv.educacion.length) {
    out.push(titulo(L.educacion));
    for (const e of cv.educacion) {
      out.push(parrafo(unir([e.titulo, e.institucion], ' · '), { bold: true, before: 60, after: 20 }));
      const linea = unir([unir([e.inicio, e.fin], ' – '), e.ubicacion], ' | ');
      if (linea) out.push(parrafo(linea, { italics: true, after: 20 }));
      if (e.detalle) out.push(parrafo(e.detalle, { after: 40 }));
    }
  }

  // Habilidades en una línea separada por comas: una lista larga de viñetas ocupa página sin aportar.
  if (cv.habilidades.length) out.push(titulo(L.habilidades), parrafo(cv.habilidades.map((h) => h.texto).join(', ')));
  if (cv.certificaciones.length) {
    out.push(titulo(L.certificaciones));
    for (const i of cv.certificaciones) out.push(vineta(i.texto));
  }
  if (cv.publicaciones.length) {
    out.push(titulo(L.publicaciones));
    for (const i of cv.publicaciones) out.push(vineta(i.texto));
  }
  if (cv.idiomas.length) out.push(titulo(L.idiomas), parrafo(cv.idiomas.map((i) => i.texto).join(' | ')));
  return out;
}

export function documentoCv(cv: CvMedida): Document {
  return new Document({
    creator: 'Solca Ciencia',
    title: cv.contacto.nombre ? `CV · ${cv.contacto.nombre}` : 'CV',
    description: 'CV redactado con asistencia de IA a partir del CV y el texto enviados por la persona.',
    styles: { default: { document: { run: { font: FUENTE, size: TAM } } } },
    numbering: {
      config: [
        {
          reference: 'vinetas',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1152, bottom: 1152, left: 1152, right: 1152 } } },
        children: parrafosCv(cv),
      },
    ],
  });
}

/** Bytes del DOCX (zip). */
export async function construirDocx(cv: CvMedida): Promise<Uint8Array> {
  const buf = await Packer.toArrayBuffer(documentoCv(cv));
  return new Uint8Array(buf);
}

/** Nombre del archivo: CV-<nombre>-<puesto>.docx, solo ASCII. */
export function nombreArchivo(cv: CvMedida): string {
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  const partes = ['CV', slug(cv.contacto.nombre), slug(cv.puesto_vacante)].filter(Boolean);
  return `${partes.join('-')}.docx`;
}

// ── base64 sin Buffer (Workers con o sin nodejs_compat) ──────────────────────────────────────────

export function aBase64(bytes: Uint8Array): string {
  let s = '';
  const paso = 0x8000;
  for (let i = 0; i < bytes.length; i += paso) s += String.fromCharCode(...bytes.subarray(i, i + paso));
  return btoa(s);
}

export function deBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
