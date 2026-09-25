// Screenshot a URL at a real phone/desktop layout width via CDP emulation.
// Usage: node shot.mjs <url> <width> <height> <outfile> [fullPage]
const PORT = 9333;
import { writeFileSync } from "node:fs";

const [url, w, h, out, full] = process.argv.slice(2);

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("no devtools target");
}

const t = await target();
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

const width = Number(w);
const height = Number(h);
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: width < 1024,
});
await send("Page.enable");
await send("Page.navigate", { url });
await new Promise((r) => setTimeout(r, 5000));

const shot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: full === "full",
});
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log(`wrote ${out}`);
ws.close();
process.exit(0);
