/**
 * Cart coupon verification over CDP (Task 6, Step 6).
 *
 * WHY CDP and not `chrome --headless --window-size`: that flag crops rather than
 * laying out at the phone width, so a 390px screenshot is a 1440px page with the
 * sides cut off. Emulation.setDeviceMetricsOverride lays out for real.
 *
 * Needs: vite dev server on 5174, headless Chrome on 9333, and PROBE_TOKEN set
 * (a JWT minted by tmp/seed_coupon_probe.py — signing in through the real
 * phone+OTP flow would send an actual SMS).
 */
import { mkdirSync, writeFileSync } from "node:fs";

const CDP = 9333;
const APP = "http://localhost:5174";
const OUT = "tmp/shots";
const TOKEN = process.env.PROBE_TOKEN;
if (!TOKEN) throw new Error("PROBE_TOKEN is not set");

mkdirSync(OUT, { recursive: true });

const list = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
const target = list.find((x) => x.type === "page" && x.webSocketDebuggerUrl);
if (!target) throw new Error("no debuggable page on 9333");

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m);
};
await new Promise((r) => (ws.onopen = r));

const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Evaluate in the page and return the value, surfacing page exceptions. */
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (r.result?.exceptionDetails) {
    throw new Error(
      r.result.exceptionDetails.exception?.description?.split("\n")[0] ||
        "page exception"
    );
  }
  return r.result?.result?.value;
}

async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${name}`, Buffer.from(r.result.data, "base64"));
}

await send("Page.enable");
await send("Runtime.enable");
// A phone, so the layout under test is the one a customer actually gets.
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 900,
  deviceScaleFactor: 2,
  mobile: true,
});

// Sign in on the app's own origin, then reload so the cart loads signed-in.
await send("Page.navigate", { url: `${APP}/` });
await wait(2500);
await evaluate(
  `localStorage.setItem('access', ${JSON.stringify(TOKEN)});
   localStorage.setItem('refresh', ${JSON.stringify(TOKEN)});
   'token set'`
);

await send("Page.navigate", { url: `${APP}/cart` });
await wait(4000);

const READ = `(() => {
  const rows = [...document.querySelectorAll('.sticky div.flex.justify-between')]
    .map((d) => d.textContent.replace(/\\s+/g, ' ').trim());
  const alert = document.querySelector('[role="alert"]');
  const payable = [...document.querySelectorAll('.sticky div')]
    .map((d) => d.textContent.replace(/\\s+/g, ' ').trim())
    .find((t) => t.startsWith('مبلغ قابل پرداخت')) || '';
  return JSON.stringify({
    hasBox: !!document.querySelector('#coupon-code'),
    hasBadge: document.body.textContent.includes('کد تخفیف:'),
    rows,
    payable,
    alert: alert ? alert.textContent.replace(/\\s+/g, ' ').trim() : '',
  });
})()`;

const before = JSON.parse(await evaluate(READ));

/** Type into the code input and submit its form the way a person would. */
const submit = (code) => `(() => {
  const input = document.querySelector('#coupon-code');
  if (!input) return 'no-coupon-box';
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  setter.call(input, ${JSON.stringify(code)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.closest('form').requestSubmit();
  return 'submitted';
})()`;

console.log("BEFORE", JSON.stringify(before));

// ── the happy path ──
await evaluate(submit("SALYCO10"));
await wait(2500);
const applied = JSON.parse(await evaluate(READ));
await shot("coupon-applied-390.png");
console.log("APPLIED", JSON.stringify(applied));

// ── the refusal path ──
await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')]
    .find((b) => b.textContent.trim() === 'حذف');
  if (btn) btn.click();
  return 'removed';
})()`);
await wait(2000);

await evaluate(submit("NOPE"));
await wait(2500);
const refused = JSON.parse(await evaluate(READ));
await shot("coupon-refused-390.png");
console.log("REFUSED", JSON.stringify(refused));

ws.close();
process.exit(0);
