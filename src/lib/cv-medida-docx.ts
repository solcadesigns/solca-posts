/**
 * CV a la medida · documento Word (DOCX) · 6 nov 2026.
 *
 * Se arma en el Worker con el paquete `docx` (empaqueta con fflate; sin APIs de Node). Formato compatible con ATS,
 * según ../consultoria/investigacion/2026-11-cv-mejores-practicas.md (C1, C2, C3).
 * 10 nov 2026 (pedido de Oscar): estilo tipo Harvard, plantilla propia inspirada en las guías de carrera
 * universitarias (no se copia ningún archivo de Harvard ni de MIT):
 *   - una sola columna, sin tablas, cuadros de texto ni imágenes; las fechas y ubicaciones van a la derecha con un
 *     tabulador (no con tablas), así el ATS lee el texto en orden;
 *   - Garamond 11 pt en negro, nombre centrado de 16 pt, contacto centrado, encabezados de sección en mayúsculas con
 *     línea inferior; carta con márgenes de 0.75";
 *   - cada puesto: organización en negritas y ubicación a la derecha; cargo en cursiva y fechas a la derecha;
 *   - orden: contacto, resumen, experiencia, educación, habilidades, certificaciones, publicaciones, idiomas;
 *   - los marcadores `[...]` van resaltados en amarillo para que la persona los complete o borre antes de enviar.
 *
 * Probado offline con `node scripts/test-cv-medida.mjs` (el resultado es un zip válido con word/document.xml).
 */

import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, Tab, TabStopType, TextRun } from 'docx';
import type { CvMedida, Idioma } from './cv-medida.ts';

const FUENTE = 'Garamond';
const TAM = 22; // medios puntos: 11 pt
const NEGRO = '000000';
// Carta (8.5 x 11 in) con márgenes de 0.75 in: ancho útil 10,080 twips; ahí va el tabulador derecho.
const PAGINA = { width: 12240, height: 15840 };
const MARGEN = 1080;
const DERECHA = PAGINA.width - 2 * MARGEN;

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
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NEGRO, space: 1 } },
    children: [new TextRun({ text: texto.toUpperCase(), font: FUENTE, size: 22, bold: true, color: NEGRO })],
  });
}

/** Línea con texto a la izquierda y otro alineado a la derecha (tabulador, no tabla). */
function lineaDoble(
  izq: string,
  der: string,
  opts: { bold?: boolean; italics?: boolean; before?: number; after?: number } = {},
): Paragraph {
  const hijos = tramos(izq, { bold: opts.bold, italics: opts.italics });
  // Ubicación y fechas sin negritas ni cursiva, como en las plantillas de guías de carrera.
  if (der) hijos.push(new TextRun({ children: [new Tab()], font: FUENTE, size: TAM }), ...tramos(der));
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: DERECHA }],
    spacing: { before: opts.before ?? 0, after: opts.after ?? 0 },
    children: hijos,
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
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: tramos(c.nombre, { bold: true, size: 32 }),
    }),
  );
  const contacto = unir([c.ubicacion, c.telefono, c.correo, c.linkedin], ' • ');
  if (contacto) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: tramos(contacto) }));
  if (c.titular) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: tramos(c.titular, { italics: true }) }));

  out.push(titulo(L.resumen), parrafo(cv.resumen, { after: 80 }));

  if (cv.experiencia.length) {
    out.push(titulo(L.experiencia));
    for (const e of cv.experiencia) {
      const fechas = unir([e.inicio, e.fin], ' – ');
      if (e.organizacion) {
        out.push(lineaDoble(e.organizacion, e.ubicacion, { bold: true, before: 100 }));
        out.push(lineaDoble(e.puesto, fechas, { italics: true, after: 40 }));
      } else {
        out.push(lineaDoble(e.puesto, fechas, { bold: true, before: 100, after: 40 }));
      }
      for (const v of e.vinetas) out.push(vineta(v.texto));
    }
  }

  if (cv.educacion.length) {
    out.push(titulo(L.educacion));
    for (const e of cv.educacion) {
      const fechas = unir([e.inicio, e.fin], ' – ');
      if (e.institucion) {
        out.push(lineaDoble(e.institucion, e.ubicacion, { bold: true, before: 80 }));
        out.push(lineaDoble(e.titulo, fechas, { italics: true, after: 20 }));
      } else {
        out.push(lineaDoble(e.titulo, unir([fechas, e.ubicacion], ' | '), { bold: true, before: 80, after: 20 }));
      }
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
    styles: { default: { document: { run: { font: FUENTE, size: TAM, color: NEGRO } } } },
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
        properties: { page: { size: PAGINA, margin: { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN } } },
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
