/**
 * Admin coupon panel verification over CDP (Task 7, Step 6).
 *
 * Drives the real panel against the running API: reads the list, expands the
 * redemption history, toggles a code off, tries to submit a product-scoped code
 * with nothing selected, and tries to delete a coupon an order already used.
 *
 * Needs: vite dev server on 5174, headless Chrome on 9333, STAFF_TOKEN set from
 * tmp/seed_admin_probe.py.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const CDP = 9333;
const APP = "http://localhost:5174";
const OUT = "tmp/shots";
const TOKEN = process.env.STAFF_TOKEN;
if (!TOKEN) throw new Error("STAFF_TOKEN is not set");

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
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: false,
});

await send("Page.navigate", { url: `${APP}/` });
await wait(2500);
await evaluate(
  `localStorage.setItem('access', ${JSON.stringify(TOKEN)});
   localStorage.setItem('refresh', ${JSON.stringify(TOKEN)});
   window.confirm = () => true;   // the delete is guarded by a confirm()
   'ready'`
);

await send("Page.navigate", { url: `${APP}/admin/coupons` });
await wait(4500);
// The navigation above reloads the page, so re-install the confirm stub.
await evaluate(`window.confirm = () => true; 'ok'`);

/** Read a coupon row by its code, including the status chip. */
const ROW = (code) => `(() => {
  const card = [...document.querySelectorAll('div')].find((d) =>
    d.querySelector('span[dir="ltr"]') &&
    d.querySelector('span[dir="ltr"]').textContent.trim() === ${JSON.stringify(code)} &&
    d.className.includes('rounded-xl')
  );
  if (!card) return JSON.stringify({ found: false });
  return JSON.stringify({
    found: true,
    chip: card.querySelector('span.rounded-full')?.textContent.trim() || '',
    text: card.innerText.replace(/\\s+/g, ' ').trim().slice(0, 400),
  });
})()`;

const codes = await evaluate(
  `JSON.stringify([...document.querySelectorAll('span[dir="ltr"]')]
     .map((s) => s.textContent.trim()))`
);
console.log("CODES", codes);
console.log("SALYCO10", await evaluate(ROW("SALYCO10")));
console.log("NOPE", await evaluate(ROW("NOPE")));
await shot("admin-coupons-1440.png");

// ── expansion: the redemption history ──
await evaluate(`(() => {
  const card = [...document.querySelectorAll('div.rounded-xl')]
    .find((d) => d.innerText.startsWith('NOPE') || d.innerText.includes('NOPE'));
  const btn = [...card.querySelectorAll('button')]
    .find((b) => b.textContent.includes('استفاده'));
  btn.click();
  return 'expanded';
})()`);
await wait(1800);
console.log(
  "REDEMPTIONS",
  await evaluate(`(() => {
    const table = document.querySelector('table');
    return table ? table.innerText.replace(/\\s+/g, ' ').trim() : 'no table';
  })()`)
);
await shot("admin-coupons-redemptions-1440.png");

// ── toggle SALYCO10 off ──
console.log(
  "TOGGLE",
  await evaluate(`(async () => {
    const card = [...document.querySelectorAll('div.rounded-xl')]
      .find((d) => d.innerText.includes('SALYCO10'));
    const btn = [...card.querySelectorAll('button')]
      .find((b) => b.textContent.includes('غیرفعال'));
    btn.click();
    return 'clicked';
  })()`)
);
await wait(2200);
console.log("AFTER TOGGLE", await evaluate(ROW("SALYCO10")));

// ── delete a redeemed coupon: the server must refuse ──
await evaluate(`(() => {
  const card = [...document.querySelectorAll('div.rounded-xl')]
    .find((d) => d.innerText.includes('NOPE'));
  const btn = [...card.querySelectorAll('button')]
    .find((b) => b.textContent.trim() === 'حذف');
  btn.click();
  return 'clicked';
})()`);
await wait(2200);
console.log(
  "DELETE REFUSAL",
  await evaluate(`(() => {
    const alert = document.querySelector('[role="alert"]');
    const stillThere = [...document.querySelectorAll('span[dir="ltr"]')]
      .some((s) => s.textContent.trim() === 'NOPE');
    return JSON.stringify({
      alert: alert ? alert.textContent.replace(/\\s+/g, ' ').trim() : '',
      rowSurvived: stillThere,
    });
  })()`)
);
await shot("admin-coupons-delete-refused-1440.png");

// ── the scope rule: all-products off with nothing picked ──
const submitted = await evaluate(`(() => {
  const set = (el, v) => {
    const proto = el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : null;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const form = document.querySelector('form');
  set(form.querySelector('#c-code'), 'SCOPED1');
  set(form.querySelector('#c-pct'), '15');
  // Untick «همهٔ محصولات» and submit with nothing selected.
  const all = form.querySelector('input[type="checkbox"]');
  if (all.checked) all.click();
  form.requestSubmit();
  return 'submitted';
})()`);
await wait(2500);
console.log("SCOPE SUBMIT", submitted);
console.log(
  "SCOPE ERROR",
  await evaluate(`(() => {
    const alerts = [...document.querySelectorAll('[role="alert"]')]
      .map((a) => a.textContent.replace(/\\s+/g, ' ').trim());
    const created = [...document.querySelectorAll('span[dir="ltr"]')]
      .some((s) => s.textContent.trim() === 'SCOPED1');
    return JSON.stringify({ alerts, created });
  })()`)
);
await shot("admin-coupons-scope-refused-1440.png");

// ── the order list shows the discount ──
await send("Page.navigate", { url: `${APP}/admin/orders` });
await wait(4000);
console.log(
  "ORDER DISCOUNT",
  await evaluate(`(() => {
    const t = document.body.innerText;
    const i = t.indexOf('تخفیف');
    return i === -1 ? 'no discount row' : t.slice(i, i + 60).replace(/\\s+/g, ' ');
  })()`)
);
await shot("admin-orders-1440.png");

ws.close();
process.exit(0);
