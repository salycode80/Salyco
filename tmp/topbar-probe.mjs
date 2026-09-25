// Verify the top bar's account sheet, its constancy across flows, and no double offset.
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
await send("Page.navigate", { url: "http://localhost:5174/" });
await new Promise((r) => setTimeout(r, 5000));

const STATE = `(() => {
  const hdr = document.querySelector('header');
  const bar = document.querySelector('nav[aria-label="ناوبری موبایل"]');
  const tabs = bar ? bar.querySelectorAll('a[href], button').length : 0;
  const hdrBox = hdr ? hdr.getBoundingClientRect() : null;
  // Vars resolve to the fixed bars' real heights.
  const cs = getComputedStyle(document.documentElement);
  return JSON.stringify({
    topBar: !!hdr && getComputedStyle(hdr).display !== 'none',
    topBarH: hdrBox ? Math.round(hdrBox.height) : 0,
    navVar: cs.getPropertyValue('--navbar-height').trim(),
    tabVar: cs.getPropertyValue('--tabbar-height').trim(),
    tabBar: !!bar, tabCount: tabs,
    bodyPadTop: getComputedStyle(document.body).paddingTop,
  });
})()`;

console.log("home:", (await send("Runtime.evaluate", { returnByValue: true, expression: STATE })).result.result.value);

// Open the sheet from the top bar's account button.
await send("Runtime.evaluate", {
  expression: `document.querySelector('header button[aria-haspopup="dialog"]').click()`,
});
await new Promise((r) => setTimeout(r, 800));
const sheet = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const d = document.querySelector('[role="dialog"]');
    const r = d.getBoundingClientRect();
    return JSON.stringify({
      open: !!d, focused: document.activeElement === d ? 'panel' : 'other',
      panelTop: Math.round(r.top), bodyOverflow: document.body.style.overflow,
      rows: [...d.querySelectorAll('a,button')].map(e => (e.textContent||'').trim().slice(0,18)),
    });
  })()`,
});
console.log("sheet:", sheet.result.result.value);
writeFileSync("shots/v5-sheet.png", Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));

await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await new Promise((r) => setTimeout(r, 600));
const after = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `JSON.stringify({
    closed: !document.querySelector('[role="dialog"]'),
    focusOnAccountBtn: document.activeElement === document.querySelector('header button[aria-haspopup="dialog"]'),
    bodyOverflow: document.body.style.overflow || '(restored)',
  })`,
});
console.log("after escape:", after.result.result.value);

// The top bar must survive the flows that hide the bottom bar.
for (const p of ["/auth", "/cart", "/checkout"]) {
  await send("Page.navigate", { url: "http://localhost:5174" + p });
  await new Promise((r) => setTimeout(r, 3000));
  const s = await send("Runtime.evaluate", { returnByValue: true, expression: STATE });
  console.log(p, s.result.result.value);
}
ws.close();
process.exit(0);
