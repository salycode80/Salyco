/** Look at Zibal's test-merchant payment page without paying yet. */
import { writeFileSync } from "node:fs";
const CDP = 9333, URL = process.argv[2];
const target = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m); };
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.result?.value;

await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
// Never let this browser reach the production site: Zibal redirects the payer to
// ZIBAL_CALLBACK_BASE_URL, which is https://salyco.ir in this .env.
await send("Network.setBlockedURLs", { urls: ["*salyco.ir*"] });
await send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: URL });
await wait(8000);
console.log("URL   ", await ev("location.href"));
console.log("TITLE ", await ev("document.title"));
console.log("TEXT  ", await ev("document.body.innerText.replace(/\s+/g,' ').slice(0,700)"));
console.log("BUTTONS", await ev(`JSON.stringify([...document.querySelectorAll('button,input[type=submit],a.btn')].map(b=>b.innerText||b.value).filter(Boolean).slice(0,15))`));
console.log("FIELDS", await ev(`JSON.stringify([...document.querySelectorAll('input,select')].map(i=>({t:i.type,n:i.name,p:i.placeholder})).slice(0,15))`));
const r = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("tmp/shots/zibal-pay.png", Buffer.from(r.result.data, "base64"));
ws.close(); await fetch(`http://127.0.0.1:${CDP}/json/close/${target.id}`); process.exit(0);
