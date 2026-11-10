/**
 * Genera un DOCX de muestra del CV a la medida con datos ficticios, para revisar el formato a ojo.
 * Uso: node scripts/muestra-cv-medida.mjs <salida.docx>
 */
import { writeFileSync } from 'node:fs';
import { construirDocx } from '../src/lib/cv-medida-docx.ts';

const v = (texto) => ({ texto, fuente: 'cv', cita: '' });
const i = (texto) => ({ texto, cita: '' });
const cv = {
  idioma: 'es',
  rol: 'CRA',
  puesto_vacante: 'Clinical Research Associate I',
  contacto: {
    nombre: 'Ana Prueba Ficticia',
    titular: 'Bióloga con maestría en biotecnología y certificación en Buenas Prácticas Clínicas (GCP)',
    correo: 'ana.prueba@example.com',
    telefono: '',
    ubicacion: 'Monterrey, México',
    linkedin: 'linkedin.com/in/ejemplo3',
  },
  resumen:
    'Bióloga con maestría en biotecnología y cinco años coordinando un laboratorio de investigación. Experiencia en redacción de protocolos para comité de ética, control documental y capacitación de personal en buenas prácticas. Certificación en Buenas Prácticas Clínicas (GCP) e inglés avanzado; busco aplicar esta base en el monitoreo de estudios clínicos.',
  experiencia: [
    {
      puesto: 'Coordinadora de laboratorio',
      organizacion: 'Centro de Investigación Ejemplo',
      ubicacion: 'Monterrey, México',
      inicio: '2020',
      fin: '2025',
      cita: '',
      vinetas: [
        v('Coordiné el inventario y las compras del laboratorio para 12 investigadores, con registros trazables.'),
        v('Redacté protocolos de investigación para su revisión por el comité de ética.'),
        v('Capacité a [n de técnicos] en buenas prácticas de laboratorio y en el cumplimiento de procedimientos.'),
        v('Administré las bases de datos de muestras en Excel y verifiqué su consistencia.'),
      ],
    },
  ],
  educacion: [
    { titulo: 'Maestría en Biotecnología', institucion: 'Universidad Ejemplo', ubicacion: 'México', inicio: '', fin: '2019', detalle: '', cita: '' },
    { titulo: 'Licenciatura en Biología', institucion: 'Universidad Ejemplo', ubicacion: 'México', inicio: '', fin: '2016', detalle: '', cita: '' },
  ],
  habilidades: [i('ICH-GCP'), i('Control documental'), i('PCR'), i('Cultivo celular'), i('Excel')],
  certificaciones: [i('Buenas Prácticas Clínicas (GCP), 2025')],
  publicaciones: [],
  idiomas: [i('Español (nativo)'), i('Inglés (avanzado)')],
  coincidencia: [],
};
const out = process.argv[2] ?? 'muestra-cv-medida.docx';
writeFileSync(out, await construirDocx(cv));
console.log('ok', out);
