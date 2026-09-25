// Find the largest slogan size that renders on ONE line at each phone width,
// and check how the tile labels wrap in the narrower tiles.
const PORT = 9333;

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

const PROBE = (sizes, sel, kind) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return 'missing';
  const out = [];
  const orig = el.style.cssText;
  for (const size of ${JSON.stringify(sizes)}) {
    if (${JSON.stringify(kind)} === 'h1') {
      el.style.fontSize = size + 'px';
      el.style.lineHeight = Math.round(size * 1.45) + 'px';
    } else {
      el.style.fontSize = size + 'px';
    }
    const r = document.createRange();
    r.selectNodeContents(el);
    const rects = [...r.getClientRects()].filter(x => x.width > 0.5);
    // Merge rects on the same line (Range yields one per text run, not per line).
    const lines = new Set(rects.map(x => Math.round(x.top)));
    out.push({ size, lines: lines.size, maxW: Math.round(Math.max(...rects.map(x => x.width))) });
  }
  el.style.cssText = orig;
  return JSON.stringify(out);
})()`;

for (const w of [320, 360, 390, 430]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: "http://localhost:5174/" });
  await new Promise((r) => setTimeout(r, 4000));

  const fonts = await send("Runtime.evaluate", { awaitPromise: true, returnByValue: true,
    expression: `document.fonts.ready.then(() => document.fonts.check('700 30px Vazirmatn'))` });

  const h1 = await send("Runtime.evaluate", { returnByValue: true, expression: PROBE([30,28,27,26,25,24,23,22,21,20,19,18], "#salyco-hero-title", "h1") });
  const avail = await send("Runtime.evaluate", { returnByValue: true,
    expression: `(() => { const s = document.querySelector('#salyco-hero-title'); return Math.round(s.getBoundingClientRect().width); })()` });

  const rows = JSON.parse(h1.result.result.value);
  const oneLine = rows.filter((r) => r.lines === 1).map((r) => r.size);
  console.log(`\n=== ${w}px (font loaded: ${fonts.result.result.value}, h1 box ${avail.result.result.value}px) ===`);
  console.log("sizes that fit one line:", oneLine.join(", ") || "NONE");
  console.log("detail:", rows.map((r) => `${r.size}->${r.lines}L/${r.maxW}px`).join("  "));
}

// How the longest tile label wraps at candidate sizes, in a 3-col grid.
const TILE = `(() => {
  const span = [...document.querySelectorAll('a[href="/products"], a[href="/articles"]')]
    .map(a => a.querySelector('span')).filter(Boolean)
    .find(s => (s.textContent||'').includes('مشاهده'));
  if (!span) return 'missing';
  const out = [];
  for (const size of [16, 15, 14, 13, 12]) {
    span.style.fontSize = size + 'px';
    const r = document.createRange();
    r.selectNodeContents(span);
    const rects = [...r.getClientRects()].filter(x => x.width > 0.5);
    out.push({ size, lines: new Set(rects.map(x => Math.round(x.top))).size, maxW: Math.round(Math.max(...rects.map(x => x.width))) });
  }
  return JSON.stringify(out);
})()`;
const tile = await send("Runtime.evaluate", { returnByValue: true, expression: TILE });
console.log("\n=== tile label «مشاهدهٔ مدل‌ها» (tile inner width ~98px at 390) ===");
console.log(tile.result.result.value);

ws.close();
process.exit(0);
