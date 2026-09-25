/** Creates a coupon through the panel form, then checks the scope refusal. */
import { mkdirSync, writeFileSync } from "node:fs";
const CDP = 9333, APP = "http://localhost:5174", TOKEN = process.env.STAFF_TOKEN;
mkdirSync("tmp/shots", { recursive: true });
const target = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(APP)}`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m); };
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => {
  const r = await send("Runtime.evaluate", { expression: e, returnByValue: true });
  if (r.result?.exceptionDetails) return "EXC " + r.result.exceptionDetails.exception?.description?.split("\n")[0];
  return r.result?.result?.value;
};
const shot = async (n) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`tmp/shots/${n}`, Buffer.from(r.result.data, "base64")); };
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1300, deviceScaleFactor: 1, mobile: false });
await wait(2500);
await ev(`localStorage.setItem('access', ${JSON.stringify(TOKEN)}); localStorage.setItem('refresh', ${JSON.stringify(TOKEN)}); 1`);
await send("Page.navigate", { url: `${APP}/admin/coupons` }); await wait(6000);
console.log("URL", await ev("location.href"));

const FILL = (code) => `(() => {
  const form = document.querySelector('form');
  const set = (el, v) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set(form.querySelector('#c-code'), ${JSON.stringify(code)});
  set(form.querySelector('#c-desc'), 'کد ساخته‌شده در بررسی');
  set(form.querySelector('#c-pct'), '15');
  set(form.querySelector('#c-max'), '500000');
  set(form.querySelector('#c-min'), '1000000');
  set(form.querySelector('#c-start'), '2026-09-01');
  set(form.querySelector('#c-end'), '2026-12-31');
  set(form.querySelector('#c-uses'), '100');
  set(form.querySelector('#c-per'), '1');
  form.requestSubmit();
  return 'submitted';
})()`;

console.log("CREATE", await ev(FILL("PROBE15")));
await wait(3000);
console.log("CREATED", await ev(`(() => {
  const card = [...document.querySelectorAll('div.rounded-xl')]
    .find((d) => d.innerText.includes('PROBE15'));
  return card ? card.innerText.replace(/\s+/g, ' ').trim() : 'NOT FOUND';
})()`));
await shot("admin-coupons-created-1440.png");

// Scope rule: all-products off, nothing picked.
console.log("SCOPE", await ev(`(() => {
  const form = document.querySelector('form');
  const set = (el, v) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set(form.querySelector('#c-code'), 'SCOPED2');
  set(form.querySelector('#c-pct'), '20');
  const all = form.querySelector('input[type="checkbox"]');
  if (all.checked) all.click();
  form.requestSubmit();
  return 'submitted';
})()`));
await wait(3000);
console.log("SCOPE RESULT", await ev(`JSON.stringify({
  alerts: [...document.querySelectorAll('[role="alert"]')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
  created: [...document.querySelectorAll('span[dir="ltr"]')].some((s) => s.textContent.trim() === 'SCOPED2'),
})`));
await shot("admin-coupons-scope-refused-1440.png");
ws.close();
process.exit(0);
