// Plansza 11: taran spalony płonącą strzałą, uszkodzenia bramy i przegrana po jej upadku.
// Uruchomienie: node tests/board11.mjs
import { serve, open, solve, dragFor, SHOULDER } from './harness.mjs';

const RAM_SPEED_TEST = 0.9; // RAM_SPEED w grze
const srv = await serve();
const url = `${srv.base}/index.html?test=11`;
let ok = true;
const check = (name, cond, info) => { ok &&= cond; console.log(`${cond ? 'ok  ' : 'BŁĄD'} ${name}`, info ? JSON.stringify(info) : ''); };

// 1. Taran jako następny wróg; strzał płonącą strzałą w środek belki.
let g = await open(url);
await g.game("battle.queue = ['ram', 'wargal']; battle.total = 3; return true;");
await g.key('2');
// Strzelamy, gdy belka jest na odkrytym terenie (między głazami); do 3 prób.
const notes = [];
for (let tries = 0; tries < 3; tries++) {
  let st;
  for (let i = 0; i < 120; i++) {
    st = await g.game("return battle.ram && phase === 'ready' && { x: battle.ram.x, mode: battle.ram.mode, wind, lift: archerLift() };");
    if (st && st.mode === 'move' && st.x < 560 && st.x > 360) break;
    await g.sleep(150);
  }
  if (!st || st.mode !== 'move') break;
  await g.drag(...dragFor(solve(SHOULDER.x, SHOULDER.y - st.lift, st.x + 50, 329, -RAM_SPEED_TEST, st.wind)));
  await g.sleep(900);
  notes.push(await g.game('return popup && popup.text;'));
  if (await g.game("return !battle.ram || battle.ram.mode !== 'move';")) break;
}
await g.shot('board11-taran');
const ram = { ...(await g.game('return { mode: battle.ram && battle.ram.mode, score, ammo: battle.ammo };')), notes };
check('taran płonie po płonącej strzale', ram.mode === 'burn' && ram.score >= 20, ram);
for (let i = 0; i < 160; i++) { if (await g.game("return phase === 'over';")) break; await g.sleep(500); }
const end1 = await g.game('return { unlocked, gate: battle.gate };');
check('brama stoi → plansza zaliczona', end1.unlocked === (end1.gate > 0), end1);
check('brak błędów w konsoli (1)', !g.errs.length, g.errs);
await g.close();

// 2. Bez obrony: brama pada.
g = await open(url);
await g.game("battle.queue = ['wargal', 'kalkar', 'wargal', 'kalkar']; battle.total = 5; return true;");
for (let i = 0; i < 200; i++) { if (await g.game("return phase === 'over';")) break; await g.sleep(500); }
await g.shot('board11-brama-padla');
const end2 = await g.game('return { unlocked, gate: battle.gate };');
check('brama padła → plansza niezaliczona', end2.gate === 0 && !end2.unlocked, end2);
check('brak błędów w konsoli (2)', !g.errs.length, g.errs);
await g.close();

srv.close();
process.exit(ok ? 0 : 1);
