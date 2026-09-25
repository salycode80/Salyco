// The top bar is identified by its own account button, not by tag order —
// pages render <header> elements of their own.
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
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });
await send("Page.enable");

const STATE = `(() => {
  const btn = document.querySelector('header button[aria-haspopup="dialog"]');
  const hdr = btn ? btn.closest('header') : null;
  const bar = document.querySelector('nav[aria-label="ناوبری موبایل"]');
  const r = hdr ? hdr.getBoundingClientRect() : null;
  const cs = hdr ? getComputedStyle(hdr) : null;
  // Anything painted in the top 56px that is NOT the bar means content is under it.
  const under = [];
  if (hdr) {
    for (const el of document.querySelectorAll('section h1, section h2, section p')) {
      const b = el.getBoundingClientRect();
      if (b.height && b.top < r.bottom && b.bottom > 0) under.push((el.textContent||'').trim().slice(0,18));
    }
  }
  return JSON.stringify({
    topBar: !!hdr,
    position: cs && cs.position, top: r && Math.round(r.top), h: r && Math.round(r.height),
    logoRight: (() => {
      const img = hdr && hdr.querySelector('img');
      if (!img) return null;
      const ib = img.getBoundingClientRect();
      return ib.left > window.innerWidth / 2;   // logo must sit on the right half
    })(),
    accountLeft: btn ? Math.round(btn.getBoundingClientRect().left) < 195 : null,
    tabBar: !!bar,
    overlapping: under.slice(0, 4),
  });
})()`;

for (const p of ["/", "/products", "/auth", "/cart", "/contact", "/about", "/articles"]) {
  await send("Page.navigate", { url: "http://localhost:5174" + p });
  await new Promise((r) => setTimeout(r, 3200));
  const s = await send("Runtime.evaluate", { returnByValue: true, expression: STATE });
  console.log(p.padEnd(11), s.result.result.value);
  if (p === "/auth") writeFileSync("shots/v5-auth.png", Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
}
ws.close();
process.exit(0);
