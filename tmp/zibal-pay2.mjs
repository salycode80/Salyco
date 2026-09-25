/** Pay with a genuine mouse gesture, logging every gateway call and console error. */
import { writeFileSync } from "node:fs";
const CDP = 9333, URL = process.argv[2];
const target = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const log = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Network.requestWillBeSent" && /zibal/.test(m.params?.request?.url || "")) {
    log.push("REQ " + m.params.request.method + " " + m.params.request.url.slice(0, 90));
  }
  if (m.method === "Network.loadingFailed") log.push("FAIL " + (m.params.errorText || "") + " blocked=" + (m.params.blockedReason || "-"));
  if (m.method === "Runtime.consoleAPICalled") log.push("CONSOLE " + (m.params.args || []).map(a => a.value).join(" ").slice(0, 160));
  if (m.method === "Runtime.exceptionThrown") log.push("EXC " + (m.params.exceptionDetails?.exception?.description || "").split("\n")[0]);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m);
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.result?.value;

await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Network.setBlockedURLs", { urls: ["*salyco.ir*"] });
await send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: URL });
await wait(8000);

const box = await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.innerText.includes('موفق') && !x.innerText.includes('ناموفق'));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, text: b.innerText.trim() });
})()`);
console.log("TARGET", box);
if (!box) { ws.close(); process.exit(1); }
const { x, y } = JSON.parse(box);
for (const type of ["mousePressed", "mouseReleased"]) {
  await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  await wait(120);
}
await wait(10000);
console.log("URL AFTER", await ev("location.href"));
console.log("BODY", await ev("document.body.innerText.replace(/\s+/g,' ').slice(0,260)"));
console.log("--- NETWORK/CONSOLE ---");
console.log(log.slice(-18).join("\n") || "(nothing)");
const r = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("tmp/shots/zibal-paid2.png", Buffer.from(r.result.data, "base64"));
ws.close(); await fetch(`http://127.0.0.1:${CDP}/json/close/${target.id}`); process.exit(0);
