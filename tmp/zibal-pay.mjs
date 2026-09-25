/** Complete the test payment, then report where Zibal tried to send the browser. */
import { writeFileSync } from "node:fs";
const CDP = 9333, URL = process.argv[2];
const target = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const blocked = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Network.loadingFailed" && /salyco/.test(m.params?.blockedReason ? "salyco" : "")) blocked.push(m.params);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m);
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.result?.value;

await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
// Blocking salyco.ir keeps the production callback from ever being requested —
// the payment itself is complete at Zibal by then.
await send("Network.setBlockedURLs", { urls: ["*salyco.ir*"] });
await send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: URL });
await wait(7000);
console.log("CLICK", await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.innerText.includes('موفق') && !x.innerText.includes('ناموفق'));
  if (!b) return 'button not found';
  b.click(); return 'clicked: ' + b.innerText.trim();
})()`));
await wait(9000);
console.log("URL AFTER", await ev("location.href"));
console.log("BODY", await ev("document.body.innerText.replace(/\s+/g,' ').slice(0,300)"));
const r = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("tmp/shots/zibal-paid.png", Buffer.from(r.result.data, "base64"));
ws.close(); await fetch(`http://127.0.0.1:${CDP}/json/close/${target.id}`); process.exit(0);
