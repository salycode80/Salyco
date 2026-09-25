// Clean visual capture of the AccountSheet entry, over the home page.
const PORT = 9333;
import { writeFileSync } from "node:fs";
async function target() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  return list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
}
const t = await target();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m); };
await new Promise((r) => (ws.onopen = r));
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shoot = async (out) => {
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(s.result.data, "base64"));
};

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send("Page.enable");
await send("Page.navigate", { url: "http://localhost:5173/" });
await new Promise((r) => setTimeout(r, 1500));
await ev(`localStorage.clear(); sessionStorage.clear();`);
await send("Page.navigate", { url: "http://localhost:5173/" });
await new Promise((r) => setTimeout(r, 4500));
console.log("url:", await ev(`location.pathname + location.search`));

const open = async (freezeAt) => {
  const r = await ev(`(async () => {
    const menu = [...document.querySelectorAll('header button')].find(b => b.getAttribute('aria-label') === 'منو');
    if (!menu) return 'no hamburger';
    menu.click();
    await new Promise(r => setTimeout(r, 34));
    if (${freezeAt} !== null) document.getAnimations().forEach(a => { a.pause(); a.currentTime = ${freezeAt}; });
    return 'ok';
  })()`);
  if (r !== "ok") console.log("open:", r);
};
const close = async () => {
  await ev(`(() => { const b = document.querySelector('.sheet-backdrop-enter'); if (b) b.click(); })()`);
  await new Promise((r) => setTimeout(r, 450));
};

// t=60ms: a third of the way in. t=110ms: mostly arrived.
await open(60);   await shoot("shot-sheet-t060.png");
await ev(`document.getAnimations().forEach(a => { a.currentTime = 110 })`); await shoot("shot-sheet-t110.png");
await ev(`document.getAnimations().forEach(a => a.finish())`); await new Promise(r => setTimeout(r, 200));
await shoot("shot-sheet-tfinal.png");
await close();
console.log("done");
ws.close(); process.exit(0);
