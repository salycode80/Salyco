// Confirm the footer pill is an unloaded external image, and check /auth has no tab bar.
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
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
await send("Page.enable");

// 1. Enamad image state on the home page.
await send("Page.navigate", { url: "http://localhost:5174/" });
await new Promise((r) => setTimeout(r, 5000));
const img = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const i = document.querySelector('img[alt="نماد اعتماد الکترونیکی"]');
    if (!i) return 'not found';
    const r = i.getBoundingClientRect();
    return JSON.stringify({ complete: i.complete, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, boxW: Math.round(r.width), boxH: Math.round(r.height) });
  })()`,
});
console.log("enamad:", img.result.result.value);

// 2. /auth must not show the tab bar.
for (const [path, name] of [["/auth", "auth"], ["/about", "about"], ["/cart", "cart"]]) {
  await send("Page.navigate", { url: "http://localhost:5174" + path });
  await new Promise((r) => setTimeout(r, 3500));
  const s = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const bar = document.querySelector('nav[aria-label="ناوبری موبایل"]');
      const wrap = document.querySelector('div.pb-\\\\[var\\\\(--tabbar-height\\\\)\\\\]');
      const nav = document.querySelector('header');
      const navHidden = nav ? getComputedStyle(nav).display === 'none' : true;
      return JSON.stringify({ tabBar: !!bar, bottomPad: wrap ? getComputedStyle(wrap).paddingBottom : 'none', navbarHidden: navHidden });
    })()`,
  });
  console.log(path, s.result.result.value);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`shots/${name}-390.png`, Buffer.from(shot.result.data, "base64"));
}
ws.close();
process.exit(0);
