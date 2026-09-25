// Both viewports in one pass: the phone's hero order + one-line slogan, and the
// desktop band that the top bar and the reordered wrapper must not have disturbed.
const PORT = 9333;
import { writeFileSync } from "node:fs";
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.find((x) => x.type === "page" && x.webSocketDebuggerUrl);
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (m, p = {}) =>
  new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m); };
await new Promise((r) => (ws.onopen = r));
await send("Page.enable");

const go = async (w, h) => {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 1024 });
  await send("Page.navigate", { url: "http://localhost:5174/" });
  await new Promise((r) => setTimeout(r, 4000));
};

// count line boxes of the slogan by merging client rects
const LINES = `(() => {
  const h1 = document.querySelector('#salyco-hero-title');
  const rg = document.createRange(); rg.selectNodeContents(h1);
  const tops = new Set([...rg.getClientRects()].filter(r => r.height).map(r => Math.round(r.top)));
  return tops.size;
})()`;

const M = `(() => {
  const h1 = document.querySelector('#salyco-hero-title');
  const img = document.querySelector('section img[alt^="تشک امپریال"]');
  const tiles = [...document.querySelectorAll('section a[href="/products"], section a[href="/catalog.pdf"]')]
    .map(a => a.getBoundingClientRect()).filter(r => r.height);
  const tileRow = tiles.length ? Math.min(...tiles.map(r => r.top)) : null;
  const hb = h1.getBoundingClientRect(), ib = img.getBoundingClientRect();
  // brand lockup vs account control in the top bar
  const btn = document.querySelector('header button[aria-haspopup="dialog"]');
  const brand = btn && btn.closest('header').querySelector('a');
  const bb = brand && brand.getBoundingClientRect(), cb = btn && btn.getBoundingClientRect();
  const mark = brand && brand.querySelector('img').getBoundingClientRect();
  const word = brand && brand.querySelector('span');
  return JSON.stringify({
    h1Top: Math.round(hb.top), h1Bottom: Math.round(hb.bottom), h1Size: getComputedStyle(h1).fontSize,
    imgTop: Math.round(ib.top), imgBottom: Math.round(ib.bottom),
    tileRowTop: tileRow && Math.round(tileRow),
    order: ib.bottom <= hb.top && hb.bottom <= tileRow ? 'image>slogan>actions' : 'UNEXPECTED',
    markH: mark && Math.round(mark.height), wordW: word && Math.round(word.getBoundingClientRect().width),
    wordSize: word && getComputedStyle(word).fontSize,
    brandLeft: bb && Math.round(bb.left), acctRight: cb && Math.round(cb.right),
    collide: !!(bb && cb && bb.left < cb.right),
    tilesShown: tiles.length,
  });
})()`;

const D = `(() => {
  const nav = [...document.querySelectorAll('header')].find(h => getComputedStyle(h).display !== 'none');
  const h1 = document.querySelector('#salyco-hero-title');
  const img = document.querySelector('section img[alt^="تشک امپریال"]');
  const cs = getComputedStyle(document.documentElement);
  const nb = nav ? nav.getBoundingClientRect() : null;
  const ib = img.getBoundingClientRect();
  return JSON.stringify({
    navbarH: nb && Math.round(nb.height), navVar: cs.getPropertyValue('--navbar-height').trim(),
    tabVar: cs.getPropertyValue('--tabbar-height').trim(),
    h1Size: getComputedStyle(h1).fontSize,
    imgCovers: getComputedStyle(img).position === 'absolute',
    imgH: Math.round(ib.height), bandH: Math.round(img.closest('section').querySelector('div').getBoundingClientRect().height),
    pills: [...document.querySelectorAll('section a[href="/products"]')].filter(a => a.getBoundingClientRect().height > 0).length,
    benefits: document.querySelectorAll('section ul li').length,
    h1Top: Math.round(h1.getBoundingClientRect().top),
  });
})()`;

for (const w of [320, 360, 390]) {
  await go(w, 780);
  const lines = (await send("Runtime.evaluate", { returnByValue: true, expression: LINES })).result.result.value;
  const m = (await send("Runtime.evaluate", { returnByValue: true, expression: M })).result.result.value;
  console.log(`MOBILE ${w}`.padEnd(11), "lines=" + lines, m);
}

for (const w of [1440, 1024, 1023]) {
  await go(w, 900);
  const d = (await send("Runtime.evaluate", { returnByValue: true, expression: D })).result.result.value;
  console.log(`DESKTOP ${w}`.padEnd(12), d);
  if (w === 1440) writeFileSync("shots/v6-1440.png", Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
}

await go(390, 844);
writeFileSync("shots/v6-390.png", Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
ws.close();
process.exit(0);
