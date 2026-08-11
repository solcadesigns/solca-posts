// Verifica que las URLs criticas del funnel respondan 200 despues de cada deploy.
// Espera la propagacion de Cloudflare con reintentos antes de declarar FAIL.
const BASE = "https://solcaciencia.com";
const checks = [
  { url: "/tdah-gratis/",     mustInclude: "Capítulo gratis" },
  { url: "/tdah-gratis",      mustInclude: "Capítulo gratis" },
  { url: "/tdah-muestra.pdf", status: 200 },
];
const MAX = 6, WAIT = 12000; // hasta ~72s esperando propagacion
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function check(c) {
  const u = `${BASE}${c.url}?cb=${Date.now()}`;
  const res = await fetch(u, { redirect: "follow" });
  if (res.status !== 200) return { ok:false, note:`HTTP ${res.status}` };
  if (c.mustInclude) {
    const body = await res.text();
    if (!body.includes(c.mustInclude)) return { ok:false, note:`200 pero falta "${c.mustInclude}"` };
  }
  return { ok:true, note:"HTTP 200" };
}

let allOk = false;
for (let attempt = 1; attempt <= MAX; attempt++) {
  const results = [];
  for (const c of checks) {
    try { results.push({ c, ...(await check(c)) }); }
    catch (e) { results.push({ c, ok:false, note:e.message }); }
  }
  allOk = results.every(r => r.ok);
  if (allOk) { results.forEach(r => console.log(`PASS  ${r.c.url}  -> ${r.note}`)); break; }
  if (attempt < MAX) {
    console.log(`Intento ${attempt}/${MAX}: aun propagando, reintento en ${WAIT/1000}s...`);
    await sleep(WAIT);
  } else {
    results.forEach(r => console.log(`${r.ok?"PASS":"FAIL"}  ${r.c.url}  -> ${r.note}`));
  }
}
if (!allOk) {
  console.error(`\n❌ El funnel NO respondio 200 tras ${MAX} intentos. Revisa antes de gastar en anuncios.`);
  process.exit(1);
}
console.log("\n✅ Funnel en vivo verificado (landing + PDF responden 200).");
