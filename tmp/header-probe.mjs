// Focused re-check of the header identity block after the duplicate-phone fix:
// the account control must still show the number beside the circle, and the
// dropdown must not print that same number twice.
//
// Usage: node header-probe.mjs <access> <refresh>
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
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};

await send("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});
await send("Page.enable");
await send("Page.navigate", { url: `${BASE}/` });
await new Promise((r) => setTimeout(r, 2500));
await evaluate(
  `localStorage.setItem("access", ${JSON.stringify(ACCESS)});
   localStorage.setItem("refresh", ${JSON.stringify(REFRESH)});
   localStorage.setItem("salyco_last_activity", String(Date.now()));
   localStorage.setItem("salyco_last_keepalive", String(Date.now()));
   "ok"`
);
await send("Page.navigate", { url: `${BASE}/` });
await new Promise((r) => setTimeout(r, 3500));

const btn = await evaluate(`(() => {
  const b = document.querySelector('header button[aria-label="منوی حساب کاربری"]');
  return { present: !!b, text: b?.textContent?.trim() ?? null };
})()`);

await evaluate(`document.querySelector('header button[aria-label="منوی حساب کاربری"]')?.click(); 1`);
await new Promise((r) => setTimeout(r, 800));

const panel = await evaluate(`(() => {
  const hdr = document.querySelector('header .w-10.h-10')?.closest('div.flex-1, div.min-w-0')
    || document.querySelector('header .w-10.h-10')?.parentElement?.nextElementSibling;
  const box = document.querySelector('header .w-10.h-10')?.closest('.flex.items-center.gap-3');
  const lines = box ? [...box.querySelectorAll('p')].map(p => p.textContent.trim()) : [];
  return { lines, lineCount: lines.length,
           phoneRepeated: lines.length === 2 && lines[0] === lines[1] };
})()`);

const s = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("tmp/shot-header-dropdown-after.png", Buffer.from(s.result.data, "base64"));

console.log("BUTTON ", JSON.stringify(btn));
console.log("DROPDOWN", JSON.stringify(panel));
ws.close();
process.exit(0);
