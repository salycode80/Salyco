// Open the account sheet and report focus/stacking, then screenshot it.
const PORT = 9333;
import { writeFileSync } from "node:fs";

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.find((x) => x.type === "page" && x.webSocketDebuggerUrl);
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m);
};
await new Promise((r) => (ws.onopen = r));

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 900,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.enable");
await send("Page.navigate", { url: "http://localhost:5174/" });
await new Promise((r) => setTimeout(r, 5000));

// Click the حساب من tab.
await send("Runtime.evaluate", {
  expression: `document.querySelector('nav[aria-label="ناوبری موبایل"] button').click()`,
});
await new Promise((r) => setTimeout(r, 800));

const report = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const panel = dlg;
    const r = panel.getBoundingClientRect();
    const bar = document.querySelector('nav[aria-label="ناوبری موبایل"]');
    const sheetZ = getComputedStyle(dlg.parentElement).zIndex;
    const barZ = getComputedStyle(bar).zIndex;
    const rows = [...panel.querySelectorAll('a,button')].map(e => (e.textContent||'').trim().slice(0,24));
    return JSON.stringify({
      open: !!dlg,
      dialogLabel: dlg.getAttribute('aria-labelledby'),
      panelTop: Math.round(r.top), panelBottom: Math.round(r.bottom), panelH: Math.round(r.height),
      focused: document.activeElement === panel ? 'panel' : document.activeElement.tagName + ':' + (document.activeElement.textContent||'').trim().slice(0,20),
      sheetZ, barZ,
      bodyOverflow: document.body.style.overflow,
      rows,
    }, null, 1);
  })()`,
});
console.log(report.result.result.value);

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("shots/sheet-390.png", Buffer.from(shot.result.data, "base64"));

// Escape should close and return focus to the account tab.
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await new Promise((r) => setTimeout(r, 600));
const after = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `JSON.stringify({
    closed: !document.querySelector('[role="dialog"]'),
    bodyOverflow: document.body.style.overflow || '(restored)',
    focusReturnedTo: (document.activeElement.textContent||'').trim().slice(0,20),
  })`,
});
console.log(after.result.result.value);
ws.close();
process.exit(0);
