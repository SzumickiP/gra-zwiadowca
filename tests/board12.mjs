// Plansza 12: kołczany, nóż w hełm, tarcza (klawisz 4) odpycha wilczura i odbija czar,
// saksa (klawisz 3) zabija bliskiego wilczura, a 3 trafienia w szczelinę wygrywają walkę.
// Uruchomienie: node tests/board12.mjs
import { serve, open, solve, dragFor, SHOULDER } from './harness.mjs';

const srv = await serve();
const url = `${srv.base}/index.html?test=12`;
let ok = true;
const check = (name, cond, info) => { ok &&= cond; console.log(`${cond ? 'ok  ' : 'BŁĄD'} ${name}`, info ? JSON.stringify(info) : ''); };
const waitReady = async g => { for (let i = 0; i < 60; i++) { if (await g.game("return phase === 'ready';")) return; await g.sleep(100); } };

// 1. Uzbrojenie.
let g = await open(url);
await g.game('boss.summonDue = false; return true;');
for (let i = 0; i < 12; i++) { await waitReady(g); await g.drag(600, 200, 560, 160); await g.sleep(150); }
await g.sleep(1500);
const q = await g.game('return { arrows: kit.arrows, quiver2: kit.quiver2 };');
check('po 12 strzałach sięga po drugi kołczan', q.arrows === 12 && q.quiver2, q);
await waitReady(g);
await g.key('2');
for (let i = 0; i < 300; i++) {
  const s = await g.game("const gg = bossGeo(boss); return { mode: boss.mode, head: gg.head, phase };");
  if (s.phase === 'ready' && s.mode === 'guard') { await g.click(s.head.x, s.head.y); break; }
  await g.sleep(60);
}
await g.sleep(900);
const kn = await g.game('return { knives: kit.knives, helm: boss.helm };');
check('nóż trafia w hełm', kn.knives === 2 && kn.helm === 2, kn);
await g.key('1');
await g.game('blades = []; if (!warg) spawnWargal(); return true;');
const waitClose = async () => { for (let i = 0; i < 400; i++) { if (await g.game('return !!meleeFoe();')) return; await g.sleep(50); } };
await waitClose();
await g.key('4');
await g.sleep(100);
const push = await g.game('return { x: warg && warg.x, push: PUSH_X };');
check('tarcza odpycha wilczura', push.x > push.push - 40, push);
await waitClose();
await g.key('3');
await g.sleep(100);
await g.shot('board12-saksa');
const sx = await g.game("return { saxe: kit.saxe, warg: warg && warg.mode };");
check('saksa zabija bliskiego wilczura', sx.saxe === 2 && sx.warg === 'dead', sx);
let parry = null;
for (let i = 0; i < 600 && !parry; i++) {
  const b = await g.game('return blades.length ? blades[0].x : null;');
  if (b !== null && b < 220) { const before = await g.game('return score;'); await g.key('4'); await g.sleep(800); parry = { before, after: await g.game('return score;') }; }
  await g.sleep(30);
}
check('tarcza odbija ostrze cienia', parry && parry.before === parry.after, parry);
check('brak błędów w konsoli (1)', !g.errs.length, g.errs);
await g.close();

// 2. Wygrana: strzały w świecącą szczelinę, gdy Czarny Pan unosi miecz albo tarczę.
g = await open(url);
for (let i = 0; i < 700; i++) {
  const s = await g.game('const gg = bossGeo(boss); return { mode: boss.mode, r: boss.r, s: boss.s, helped: boss.helped, weak: gg.weak, phase, over: phase === "over" };');
  if (s.over) break;
  const exposed = (s.mode === 'raise' && s.r > 0.2 && s.r < 0.55) || (s.mode === 'summon' && (s.s > 0.25 || s.helped));
  if (s.phase === 'ready' && exposed) { await g.drag(...dragFor(solve(SHOULDER.x, SHOULDER.y, s.weak.x, s.weak.y))); await g.sleep(900); }
  await g.sleep(60);
}
await g.sleep(1500);
await g.shot('board12-koniec');
const win = await g.game('return { unlocked, hp: boss.hp, score };');
check('3 trafienia w szczelinę → wygrana', win.unlocked && win.hp === 0, win);
check('brak błędów w konsoli (2)', !g.errs.length, g.errs);
await g.close();

srv.close();
process.exit(ok ? 0 : 1);
