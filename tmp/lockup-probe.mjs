// Top-bar lockup after the icon-only account control, plus the relabelled tile.
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

const S = `(() => {
  const btn = document.querySelector('header button[aria-haspopup="dialog"]');
  const hdr = btn.closest('header');
  const brand = hdr.querySelector('a');
  const word = brand.querySelector('span');
  const icon = btn.querySelector('svg');
  const bb = brand.getBoundingClientRect(), cb = btn.getBoundingClientRect();
  const h1 = document.querySelector('#salyco-hero-title');
  const rg = document.createRange(); rg.selectNodeContents(h1);
  const lines = new Set([...rg.getClientRects()].filter(r => r.height).map(r => Math.round(r.top))).size;
  const tile = document.querySelector('section div.grid a[href="/products"]');
  const wrap = [...tile.querySelectorAll('span')].pop();
  const wr = document.createRange(); wr.selectNodeContents(wrap);
  return JSON.stringify({
    btn: Math.round(cb.width) + 'x' + Math.round(cb.height),
    btnLabel: btn.getAttribute('aria-label') || '(none — visible text names it)',
    btnText: btn.textContent.trim(),
    iconStroke: icon.getAttribute('stroke-width') || getComputedStyle(icon).strokeWidth,
    iconSize: Math.round(icon.getBoundingClientRect().width),
    wordWeight: getComputedStyle(word).fontWeight, wordText: word.textContent.trim(),
    brandW: Math.round(bb.width), gap: Math.round(bb.left - cb.right),
    collide: bb.left < cb.right, sloganLines: lines,
    tileLabel: wrap.textContent.trim(),
    tileLabelLines: new Set([...wr.getClientRects()].filter(r => r.height).map(r => Math.round(r.top))).size,
    pillLabel: document.querySelector('section a[href="/articles"]').textContent.trim(),
  });
})()`;

for (const w of [320, 390]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 800, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: "http://localhost:5174/" });
  await new Promise((r) => setTimeout(r, 3500));
  const r = await send("Runtime.evaluate", { returnByValue: true, expression: S });
  console.log(w, r.result.exceptionDetails ? r.result.exceptionDetails.exception.description.split("\n")[0] : r.result.result.value);
  writeFileSync(`shots/v7-${w}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
}
ws.close();
process.exit(0);
