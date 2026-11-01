// Narzędzia testów: serwer plików gry, przeglądarka headless (Chromium z Playwrighta),
// zrzuty ekranu, mysz i klawiatura oraz odczyt i zmiana stanu gry przez debugger.
// Wymaga Node 22+ (wbudowany WebSocket i fetch).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'tests', 'out');
const GY = 362;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Chromium headless z instalacji Playwrighta (albo ścieżka z CHROME).
export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).filter(d => d.startsWith('chromium_headless_shell')).sort().reverse() : [];
  for (const d of dirs) {
    const exe = path.join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error('Nie znaleziono Chromium. Zainstaluj: npx playwright install chromium-headless-shell albo ustaw zmienną CHROME.');
}

// Prosty serwer statyczny (jak GitHub Pages, ale bez 404.html).
export function serve(port = 8765) {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r({ base: `http://127.0.0.1:${port}`, close: () => server.close() })));
}

// Linia pętli klatek w index.html: tam debugger zatrzymuje grę, żeby odczytać jej stan.
function frameLine() {
  const lines = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n');
  const i = lines.findIndex(l => l.includes('while (acc >= STEP)'));
  if (i < 0) throw new Error('Nie znaleziono pętli klatek w index.html');
  return i + 1;
}

export async function open(url, { port = 9333 } = {}) {
  fs.mkdirSync(OUT, { recursive: true });
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'gra-test-'));
  const p = spawn(findChrome(), ['--headless', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1100,720', 'about:blank']);
  let ws;
  for (let i = 0; i < 40 && !ws; i++) {
    try {
      const pg = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.type === 'page');
      if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl);
    } catch {}
    if (!ws) await sleep(250);
  }
  await new Promise(r => ws.onopen = r);
  let id = 0, pausedCb = null;
  const pend = new Map(), errs = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result || d.error); pend.delete(d.id); }
    if (d.method === 'Debugger.paused' && pausedCb) { const cb = pausedCb; pausedCb = null; cb(d.params); }
    if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push(d.params.args.map(a => a.value || a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Debugger.enable');
  await send('Page.navigate', { url }); await sleep(1500);
  // Strona wyników nie ma sceny; wtedy mysz działa w zwykłych współrzędnych strony.
  const rect = JSON.parse((await send('Runtime.evaluate', { expression: 'JSON.stringify(document.getElementById("scena") ? document.getElementById("scena").getBoundingClientRect() : { left: 0, top: 0, width: 820 })' })).result.value);
  const k = rect.width / 820, sx = x => rect.left + x * k, sy = y => rect.top + y * k;
  const line = frameLine();
  return {
    sleep, errs, send,
    // Zrzut samej sceny (i kawałka strony pod nią) do tests/out/<nazwa>.png.
    shot: async name => {
      const r = await send('Page.captureScreenshot', { clip: { x: 0, y: 110, width: 1100, height: 560, scale: 1 } });
      fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
    },
    // Wykonuje kod w zasięgu gry (zmienne: level, phase, score, boss, battle, ride, warg, riders…) i zwraca wynik.
    game: async code => {
      const bp = await send('Debugger.setBreakpointByUrl', { lineNumber: line - 1, url });
      const paused = await new Promise(r => { pausedCb = r; });
      const res = await send('Debugger.evaluateOnCallFrame', { callFrameId: paused.callFrames[0].callFrameId, expression: `JSON.stringify((() => { ${code} })())`, returnByValue: true });
      await send('Debugger.removeBreakpoint', { breakpointId: bp.breakpointId });
      await send('Debugger.resume');
      if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
      return res.result.value === undefined ? undefined : JSON.parse(res.result.value);
    },
    // Przeciągnięcie myszy w układzie sceny (820 × 440), np. naciąg łuku.
    drag: async (x0, y0, x1, y1) => {
      const m = (type, x, y) => send('Input.dispatchMouseEvent', { type, x: sx(x), y: sy(y), button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
      await m('mousePressed', x0, y0); await m('mouseMoved', (x0 + x1) / 2, (y0 + y1) / 2); await m('mouseMoved', x1, y1); await m('mouseReleased', x1, y1);
    },
    click: async (x, y) => {
      for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: sx(x), y: sy(y), button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
    },
    // Klawisz, np. key('w') albo key('3').
    key: async ch => {
      const code = /\d/.test(ch) ? `Digit${ch}` : `Key${ch.toUpperCase()}`, vk = ch.toUpperCase().charCodeAt(0);
      for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: ch, code, text: type === 'keyDown' ? ch : undefined, windowsVirtualKeyCode: vk });
    },
    close: async () => { ws.close(); p.kill(); await sleep(300); try { fs.rmSync(prof, { recursive: true, force: true }); } catch {} },
  };
}

// Kąt i siła strzału z ramienia (shX, shY) w punkt (tx, ty), który przesuwa się o vx px na klatkę.
// Fizyka jak w grze: co klatkę wiatr, potem grawitacja, potem ruch.
export function solve(shX, shY, tx, ty, vx = 0, wind = 0) {
  const GRAV = 0.26, MAX_SPEED = 19;
  let best = null;
  for (let ang = -1.2; ang <= 0.6; ang += 0.005) for (let pull = 0.3; pull <= 1; pull += 0.01) {
    const R = 28 - pull * 6, th = 0.95 + pull * 0.25, reach = 24 - R + R * Math.cos(th) - pull * 30 + 46;
    let x = shX + Math.cos(ang) * reach, y = shY + Math.sin(ang) * reach, ax = Math.cos(ang) * pull * MAX_SPEED, ay = Math.sin(ang) * pull * MAX_SPEED, X = tx;
    for (let f = 0; f < 300; f++) {
      X += vx; const px = x, py = y; ax += wind; ay += GRAV; x += ax; y += ay;
      if (px < X && x >= X) { const e = Math.abs(py + (X - px) / (x - px) * (y - py) - ty); if (!best || e < best.e) best = { e, ang, pull }; break; }
      if (y > GY + 5) break;
    }
  }
  return best;
}

// Przeciągnięcie myszy dające dany kąt i siłę (w grze: kąt z kierunku odciągnięcia, siła = długość / 150).
export function dragFor(s, x0 = 600, y0 = 200) {
  const len = s.pull * 150;
  return [x0, y0, x0 - Math.cos(s.ang) * len, y0 - Math.sin(s.ang) * len];
}

// Ramię łucznika stojącego na ziemi (SHOULDER w grze).
export const SHOULDER = { x: 115, y: GY - 62 };
export { GY };
