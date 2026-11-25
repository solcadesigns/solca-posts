/**
 * Pruebas offline de la clasificación de vacantes (r9) y de los duplicados · 24 nov 2026.
 * Casos tomados de vacantes reales que salieron mal en las pruebas del curso, más casos adversarios
 * que no deben cambiar. Uso: node scripts/test-vacantes-clasificar.mjs
 */
import assert from 'node:assert/strict';
import {
  clasificarRol,
  clasificarRolEmpresa,
  clasificarNivel,
  tipoEmpresaVacante,
  ROLES_VACANTE,
} from '../src/lib/vacantes-clasificar.ts';
import { FUENTES } from '../src/lib/vacantes-fuentes.ts';
import { agruparSimilares, grupoBase, huella, similitud } from '../src/lib/vacantes-duplicados.ts';

let n = 0;
function prueba(nombre, fn) {
  try {
    fn();
    n++;
  } catch (e) {
    console.error(`FALLÓ: ${nombre}\n`, e);
    process.exit(1);
  }
}
const rol = (t, esperado) => prueba(`rol: ${t}`, () => assert.equal(clasificarRol(t), esperado));
const nivel = (t, anios, esperado) => prueba(`nivel: ${t} (${anios})`, () => assert.equal(clasificarNivel(t, anios), esperado));

// ── Hallazgos de las pruebas del curso
rol('Clinial Research Associate - All levels', 'investigacion_clinica'); // icon:JR156812, errata del portal
nivel('Clinial Research Associate - All levels', null, 'no_especificado');
rol('SMA I', 'investigacion_clinica'); // icon:JR163722
rol('SMA II', 'investigacion_clinica');
rol('Site Managament Associate I', 'investigacion_clinica');
rol('SrCRA1 - FSP | Argentina', 'investigacion_clinica');
rol('FSP Principal CTC', 'investigacion_clinica');
rol('FSP Country Approval Specialist', 'investigacion_clinica');
nivel('Associate Architect - IT Solution Design', 8, 'no_especificado'); // merckkgaa:303540
nivel('Executive Assistant – Bilingual (English/Spanish)', 5, 'no_especificado');
rol('Legal Manager, Government Affairs & Public Procurement', 'corporativo'); // novartis:REQ-10090355
rol('Operador I, Manufacturing', 'operaciones');
rol('Maintenance Associate', 'operaciones');
rol('Logistics Coordinator', 'operaciones');
rol('Técnico de Manufatura', 'operaciones');
rol('Associate Project Manager, Device Logistics', 'operaciones');
rol('Senior Statistical Programmer', 'datos_clinicos');
rol('Sr Clin Data Team Lead', 'datos_clinicos');
rol('Lead Data Manager', 'datos_ti'); // sin contexto: solo es de datos clínicos en una CRO (ver abajo)
rol('Senior Medical Coding Specialist', 'datos_clinicos');
rol('Principal Biostatistician (FSP - client embedded)', 'datos_clinicos');
rol('Proposal Developer 1', 'comercial_marketing');
rol('Business Developer', 'comercial_marketing');

// ── Adversarios: no deben moverse
rol('Senior DevOps Engineer', 'datos_ti');
rol('Data Governance & Data Management Specialist - RDT Performance and Insights', 'datos_ti'); // gobierno de datos de TI, no clínico
rol('Fresh Graduate Data Analyst (Python/SQL)', 'datos_ti');
rol('Database Operator - French Native Speaker (7 weeks contract / Madrid Office based)', 'datos_ti'); // captura de datos, no planta
rol('Sr Sourcing Recruiter', 'corporativo'); // reclutamiento, no compras
rol('Senior Start Up Maintenance Specialist - Sponsor Dedicated - Home Based Spain', 'investigacion_clinica'); // arranque de estudios
rol('Supplier Quality Specialist', 'calidad_manufactura');
rol('Manager, GMP/GDP Auditor', 'calidad_manufactura');
rol('INGENIERO DE CALIDAD I (12 meses)', 'calidad_manufactura');
rol('Clinical Research Associate II', 'investigacion_clinica');
rol('Research Associate, Formulation', 'laboratorio_rd');
rol('Drug Safety Associate', 'farmacovigilancia');
rol('Regulatory Affairs Specialist', 'regulatorio');
rol('Gerente de Producto', 'comercial_marketing');
nivel('Clinical Research Associate I', null, 'entrada');
nivel('Clinical Research Associate I', 2, 'entrada');
nivel('Clinical Research Associate I', 4, 'entrada'); // tope de entrada: 4 años
nivel('Junior Data Analyst', null, 'entrada');
nivel('Senior Statistical Programmer', 8, 'senior');
nivel('CRA II', 8, 'intermedio');
nivel('Associate Director, Data Engineer', 10, 'gerencia');

// ── Revisión independiente (25 nov 2026): adversarios
const noEs = (t, r, tipo = 'farma') => prueba(`no ${r}: ${t}`, () => assert.notEqual(clasificarRolEmpresa(t, tipo), r));
rol('Medical Advisor SMA', 'medical_affairs'); // SMA = atrofia muscular espinal
noEs('Brand Manager SMA', 'investigacion_clinica');
noEs('Customer Service Representative - CTC', 'investigacion_clinica');
rol('FSP Principal CTC', 'investigacion_clinica');
rol('Clinical Trial Coordinator II', 'investigacion_clinica');
rol('Site Management Associate II', 'investigacion_clinica');
rol('Clinical Trial Manager, Data Review', 'clinical_pm');
rol('Medical Information Data Review', 'medical_affairs');
noEs('Master Data Manager', 'datos_clinicos');
noEs('Master Data Manager', 'datos_clinicos', 'cro');
noEs('Statistical Process Control Engineer', 'datos_clinicos');
noEs('Sales Statistics Analyst', 'datos_clinicos');
noEs('Sales Statistics Analyst', 'datos_clinicos', 'cro');
rol('Senior Statistician I', 'datos_ti'); // sin contexto clínico en el título ni CRO
prueba('Statistician en CRO: datos clínicos', () => assert.equal(clasificarRolEmpresa('Statistical Scientist', 'cro'), 'datos_clinicos'));
prueba('Lead Data Manager en CRO: datos clínicos', () => assert.equal(clasificarRolEmpresa('Lead Data Manager', 'cro'), 'datos_clinicos'));
rol('Clinical Data Manager', 'datos_clinicos');
rol('Statistician, Clinical Trials', 'datos_clinicos');
rol('Talent Sourcing Specialist', 'corporativo');
rol('Legal Manufacturer Quality Specialist', 'calidad_manufactura');

// ── Catálogo: todo rol que asignan las reglas existe en ROLES_VACANTE
prueba('roles en catálogo', () => {
  const ids = new Set(ROLES_VACANTE.map((r) => r.id));
  for (const id of ['operaciones', 'datos_clinicos', 'calidad_manufactura', 'datos_ti', 'otro']) assert.ok(ids.has(id), id);
});

// ── Tipo de empresa (hallazgo: un empleador de químicos aparecía como CRO)
const thermo = FUENTES.find((f) => f.id === 'thermofisher');
const icon = FUENTES.find((f) => f.id === 'icon');
prueba('Thermo Fisher químicos: proveedor', () =>
  assert.equal(tipoEmpresaVacante(thermo, 'Technical Application Scientist, Chemistry', 'Support customers using our reagents and instruments.'), 'proveedor'));
prueba('Thermo Fisher PPD por descripción: cro', () =>
  assert.equal(tipoEmpresaVacante(thermo, 'Vendor Management Coordinator', 'Our PPD clinical research portfolio...'), 'cro'));
prueba('Thermo Fisher FSP en el título: cro', () => assert.equal(tipoEmpresaVacante(thermo, 'FSP Quality Manager', 'Quality systems.'), 'cro'));
prueba('Thermo Fisher rol clínico: cro', () => assert.equal(tipoEmpresaVacante(thermo, 'Clinical Research Associate II', ''), 'cro'));
prueba('ICON siempre cro', () => assert.equal(tipoEmpresaVacante(icon, 'Accountant', ''), 'cro'));
prueba('Project Manager en proveedor no es clinical_pm', () => assert.equal(clasificarRolEmpresa('Project Manager', 'proveedor'), 'otro'));
prueba('Project Manager en CRO sí es clinical_pm', () => assert.equal(clasificarRolEmpresa('Project Manager', 'cro'), 'clinical_pm'));

prueba('Thermo NGS comercial (clinical suelto): proveedor', () =>
  assert.equal(tipoEmpresaVacante(thermo, 'Senior Director, Commercial Clinical Next-Generation Sequencing', 'Grow clinical NGS sales in hospital labs.'), 'proveedor'));
prueba('Thermo regulatorio de IVD: proveedor', () =>
  assert.equal(tipoEmpresaVacante(thermo, 'Regulatory Affairs Specialist II', 'Registrations for in vitro diagnostic (IVD) reagents and instruments.'), 'proveedor'));
prueba('Thermo regulatorio de PPD: cro', () =>
  assert.equal(tipoEmpresaVacante(thermo, 'Regulatory Affairs Specialist II', 'Support submissions for clinical trials with our PPD clinical research teams.'), 'cro'));

// ── Duplicados
// Texto de plantilla sin repeticiones, del largo típico de una ficha (los fragmentos repetidos no cuentan dos veces).
const cuerpo = Array.from({ length: 220 }, (_, i) => `palabra${i}`).join(' ');
prueba('grupoBase conserva la fórmula de r8', () =>
  assert.equal(grupoBase('icon', '  Lead  Data Manager ', 'abc'), huella('icon|lead data manager|abc')));
prueba('subtítulo distinto, misma oferta: un grupo', () => {
  const g = agruparSimilares([
    { id: 'icon:1', fuente: 'icon', titulo: 'Graduate Pharmacovigilance Associate', descripcion: 'Home Based - CDMX - Intake Case Exp.' + cuerpo, primera_vez: '2026-11-01' },
    { id: 'icon:2', fuente: 'icon', titulo: 'Graduate Pharmacovigilance Associate', descripcion: 'Home Based - Mexico' + cuerpo, primera_vez: '2026-11-05' },
  ]);
  assert.equal(g.get('icon:1'), g.get('icon:2'));
  assert.equal(g.get('icon:1'), grupoBase('icon', 'Graduate Pharmacovigilance Associate', 'Home Based - CDMX - Intake Case Exp.' + cuerpo)); // la más antigua nombra el grupo
});
prueba('tabulador contra espacio: un grupo', () => {
  const g = agruparSimilares([
    { id: 't:1', fuente: 't', titulo: 'Safety Reporting Specialist', descripcion: cuerpo.replace(/ /g, '\t'), primera_vez: '2026-11-01' },
    { id: 't:2', fuente: 't', titulo: 'Safety Reporting Specialist', descripcion: cuerpo, primera_vez: '2026-11-02' },
  ]);
  assert.equal(g.get('t:1'), g.get('t:2'));
});
prueba('mismo título, otra descripción: dos grupos', () => {
  const g = agruparSimilares([
    { id: 'a:1', fuente: 'a', titulo: 'Clinical Research Associate', descripcion: cuerpo, primera_vez: '2026-11-01' },
    { id: 'a:2', fuente: 'a', titulo: 'Clinical Research Associate', descripcion: 'Unblinded CRA for an oncology sponsor in São Paulo. Monitor sites, review source data and manage drug accountability. '.repeat(3), primera_vez: '2026-11-02' },
  ]);
  assert.notEqual(g.get('a:1'), g.get('a:2'));
});
prueba('mismo inicio y requisitos distintos al final: dos grupos (ICON JR162256/JR163401)', () => {
  const inicio = Array.from({ length: 220 }, (_, i) => `plantilla${i}`).join(' ');
  const g = agruparSimilares([
    { id: 'icon:JR162256', fuente: 'icon', titulo: 'Clinical Trial Manager', descripcion: inicio + ' ' + Array.from({ length: 60 }, (_, i) => `cvrm${i}`).join(' '), primera_vez: '2026-11-01' },
    { id: 'icon:JR163401', fuente: 'icon', titulo: 'Clinical Trial Manager', descripcion: inicio + ' ' + Array.from({ length: 60 }, (_, i) => `oncologia${i}`).join(' '), primera_vez: '2026-11-02' },
  ]);
  assert.notEqual(g.get('icon:JR162256'), g.get('icon:JR163401'));
});
prueba('plantilla final larga compartida no basta: dos grupos', () => {
  const pie = Array.from({ length: 600 }, (_, i) => `beneficios${i}`).join(' ');
  const g = agruparSimilares([
    { id: 'x:1', fuente: 'x', titulo: 'Analyst', descripcion: Array.from({ length: 220 }, (_, i) => `finanzas${i}`).join(' ') + ' ' + pie, primera_vez: '2026-11-01' },
    { id: 'x:2', fuente: 'x', titulo: 'Analyst', descripcion: Array.from({ length: 220 }, (_, i) => `ventas${i}`).join(' ') + ' ' + pie, primera_vez: '2026-11-02' },
  ]);
  assert.notEqual(g.get('x:1'), g.get('x:2'));
});
prueba('misma descripción, otra empresa: dos grupos', () => {
  const g = agruparSimilares([
    { id: 'a:1', fuente: 'a', titulo: 'CRA II', descripcion: cuerpo, primera_vez: '2026-11-01' },
    { id: 'b:1', fuente: 'b', titulo: 'CRA II', descripcion: cuerpo, primera_vez: '2026-11-01' },
  ]);
  assert.notEqual(g.get('a:1'), g.get('b:1'));
});
prueba('similitud simétrica y acotada', () => {
  assert.equal(similitud(cuerpo, cuerpo), 1);
  assert.equal(similitud('uno dos tres cuatro', 'cinco seis siete ocho'), 0);
});

console.log(`ok: ${n} pruebas`);
