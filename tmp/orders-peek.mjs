/**
 * Looks at /admin/orders for the discount row (Task 7, Step 4 verification).
 *
 * Opens its own tab: a leftover shot.mjs automation from an earlier session
 * holds the original one and navigates it back to 5173, so sharing a tab makes
 * the URL under test race.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const CDP = 9333;
const APP = "http://localhost:5174";
const TOKEN = process.env.STAFF_TOKEN;
if (!TOKEN) throw new Error("STAFF_TOKEN is not set");
mkdirSync("tmp/shots", { recursive: true });

const target = await (
  await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(APP)}`, {
    method: "PUT",
  })
).json();
console.log("tab:", target.id);

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
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (r.result?.exceptionDetails) {
    return "EXC " + r.result.exceptionDetails.exception?.description?.split("\n")[0];
  }
  return r.result?.result?.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1400,
  deviceScaleFactor: 1,
  mobile: false,
});
await wait(2500);
await ev(
  `localStorage.setItem('access', ${JSON.stringify(TOKEN)});
   localStorage.setItem('refresh', ${JSON.stringify(TOKEN)}); 1`
);

await send("Page.navigate", { url: `${APP}/admin/orders` });
await wait(6000);

console.log("URL", await ev("location.href"));
console.log(
  "DISCOUNT LINES",
  await ev(
    `JSON.stringify(document.body.innerText.split('\\n')
       .map((l) => l.replace(/\\s+/g, ' ').trim())
       .filter((l) => l.includes('تخفیف')))`
  )
);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("tmp/shots/admin-orders-1440.png", Buffer.from(shot.result.data, "base64"));
ws.close();
await fetch(`http://127.0.0.1:${CDP}/json/close/${target.id}`);
process.exit(0);
