// The gallery panel is the part of this change the client operates by hand, so
// it gets its own pass: does the row render, and does the form expose a real
// file control plus the three fields the model has?
//
// Usage: node panel-probe.mjs <access> <refresh>
const PORT = 9333;
import { writeFileSync } from "node:fs";

const [ACCESS, REFRESH] = process.argv.slice(2);
const BASE = "http://localhost:5173";

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

const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
const shot = async (out, full = false) => {
  const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full });
  writeFileSync(out, Buffer.from(s.result.data, "base64"));
};
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
});
await send("Page.enable");
await send("Page.navigate", { url: `${BASE}/` });
await settle(2500);
await evaluate(
  `localStorage.setItem("access", ${JSON.stringify(ACCESS)});
   localStorage.setItem("refresh", ${JSON.stringify(REFRESH)});
   localStorage.setItem("salyco_last_activity", String(Date.now()));
   localStorage.setItem("salyco_last_keepalive", String(Date.now()));
   "ok"`
);

await send("Page.navigate", { url: `${BASE}/admin/gallery` });
await settle(4000);

// The empty state, before anything is added.
const empty = await evaluate(`(() => ({
  url: location.pathname,
  h1: document.querySelector('h1')?.textContent?.trim() ?? null,
  body: document.body.innerText.split('\\n').map(s => s.trim()).filter(Boolean).slice(0, 14),
}))()`);
console.log("PANEL(empty)", JSON.stringify(empty, null, 2));
await shot("tmp/shot-gallery-panel-empty.png");

// Open the create form and inspect the controls it offers.
const opened = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => /افزودن|جدید|تصویر تازه/.test(b.textContent));
  if (!btn) return { clicked: false, buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0, 12) };
  btn.click();
  return { clicked: true, label: btn.textContent.trim() };
})()`);
await settle(900);

const form = await evaluate(`(() => {
  const inputs = [...document.querySelectorAll('input, textarea, select')];
  return {
    controls: inputs.map(i => ({
      type: i.type, id: i.id, accept: i.accept || null, name: i.name || null,
    })),
    fileLabel: document.querySelector('label[for="g-image"]')?.textContent?.trim() ?? null,
    // A visually hidden input is the only way a styled <label> can drive it.
    fileInputHidden: (() => {
      const f = document.querySelector('#g-image');
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })(),
    submitLabel: [...document.querySelectorAll('button[type="submit"]')]
      .map(b => b.textContent.trim()),
  };
})()`);
console.log("FORM", JSON.stringify(form, null, 2));
await shot("tmp/shot-gallery-panel-form.png");

ws.close();
process.exit(0);
