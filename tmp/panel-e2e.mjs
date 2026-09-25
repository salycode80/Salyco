// End-to-end pass over the gallery panel through the real UI: open the form,
// attach a file with the same CDP call the file chooser uses, submit, and check
// that the row appears in the list with a servable image. Then removes it again
// so the local database is left as it was found.
//
// Usage: node panel-e2e.mjs <access> <refresh>
const PORT = 9333;
import { writeFileSync } from "node:fs";

const [ACCESS, REFRESH] = process.argv.slice(2);
const BASE = "http://localhost:5173";
const FILE = "E:/salyco-fullstack/Frontend/salyco-front/public/prestige-main.png";
const TITLE = "نمای کارگاه (آزمون)";

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

await send("Page.enable");
await send("DOM.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false,
});
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

// 1. open the create form
await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => b.textContent.trim().includes('افزودن تصویر'));
  btn?.click();
  return !!btn;
})()`);
await settle(800);

// 2. attach the file the way the picker does, so the onChange chain is real
const doc = await send("DOM.getDocument", { depth: -1 });
const node = await send("DOM.querySelector", {
  nodeId: doc.result.root.nodeId,
  selector: "#g-image",
});
await send("DOM.setFileInputFiles", { nodeId: node.result.nodeId, files: [FILE] });
await settle(600);

// 3. fill the title through React's own setter, then submit
const filled = await evaluate(`(() => {
  const el = document.querySelector('#g-title');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(TITLE)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  const name = [...document.querySelectorAll('span')]
    .map(s => s.textContent.trim())
    .find(t => t.endsWith('.png'));
  return { name };
})()`);
console.log("PICKED", JSON.stringify(filled));
await shot("tmp/shot-gallery-panel-filled.png");

await evaluate(`(() => {
  const submit = [...document.querySelectorAll('button[type="submit"]')]
    .find(b => b.textContent.trim().includes('افزودن تصویر'));
  submit?.click();
  return !!submit;
})()`);
await settle(3000);

// 4. what the list shows now
const after = await evaluate(`(() => {
  const img = [...document.querySelectorAll('img')]
    .find(i => (i.getAttribute('src') || '').includes('/media/gallery/'));
  return {
    hasRow: document.body.innerText.includes(${JSON.stringify(TITLE)}),
    formClosed: !document.querySelector('#g-title'),
    imgSrc: img?.getAttribute('src') ?? null,
    imgRendered: img ? { w: Math.round(img.getBoundingClientRect().width),
                         h: Math.round(img.getBoundingClientRect().height) } : null,
    imgLoaded: img ? img.naturalWidth > 0 : null,
  };
})()`);
console.log("AFTER SUBMIT", JSON.stringify(after, null, 2));
await shot("tmp/shot-gallery-panel-list.png", true);

// 5. the public endpoint the About page reads
const publicRows = await evaluate(
  `fetch('/api/gallery/').then(r => r.json()).then(d => d.map(x => x.title))`
);
console.log("PUBLIC /api/gallery/", JSON.stringify(publicRows));

// 6. take it back out, so the local database ends where it started
const cleaned = await evaluate(`(async () => {
  const rows = await (await fetch('/api/admin/gallery/', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('access') } })).json();
  const mine = rows.filter(r => r.title === ${JSON.stringify(TITLE)});
  const out = [];
  for (const r of mine) {
    const res = await fetch('/api/admin/gallery/' + r.id + '/', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + localStorage.getItem('access') } });
    out.push(res.status);
  }
  const left = await (await fetch('/api/admin/gallery/', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('access') } })).json();
  return { deleted: out, remaining: left.length };
})()`);
console.log("CLEANUP", JSON.stringify(cleaned));

ws.close();
process.exit(0);
