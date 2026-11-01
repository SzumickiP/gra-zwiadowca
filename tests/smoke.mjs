// Szybki test: każda strona i każda plansza w trybie testowym działa kilka sekund bez błędów w konsoli.
// Uruchomienie: node tests/smoke.mjs
import { serve, open } from './harness.mjs';

const srv = await serve();
const pages = ['index.html', 'wyniki.html', ...Array.from({ length: 12 }, (_, i) => `index.html?test=${i + 1}`)];
let bad = 0;
for (const p of pages) {
  const g = await open(`${srv.base}/${p}`);
  await g.sleep(4000);
  if (p.includes('test=')) await g.shot(`smoke-${p.split('=')[1]}`);
  console.log(`${g.errs.length ? 'BŁĄD' : 'ok  '} ${p}${g.errs.length ? ' → ' + g.errs.join(' | ') : ''}`);
  bad += g.errs.length ? 1 : 0;
  await g.close();
}
srv.close();
console.log(bad ? `\n${bad} stron z błędami` : '\nWszystko bez błędów. Zrzuty plansz: tests/out/smoke-N.png');
process.exit(bad ? 1 : 0);
