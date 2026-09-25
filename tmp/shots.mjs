// Throwaway: capture the article pages beside the existing site surfaces so the
// review compares like with like. Full-page shots via CDP, since --window-size
// does not reliably set the viewport.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 9452;
const BASE = "http://localhost:5173";

const SHOTS = [
  { name: "home-1440", url: "/", w: 1440, h: 1000 },
  { name: "product-1440", url: "/products", w: 1440, h: 1000 },
  { name: "index-1440", url: "/articles/", w: 1440, h: 1000 },
  { name: "article-1440", url: "/articles/rahnama-kamel/", w: 1440, h: 1000 },
  { name: "article-390", url: "/articles/rahnama-kamel/", w: 390, h: 844 },
];

const profile = mkdtempSync(join(tmpdir(), "cdp-shots-"));
const chrome = spawn(
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--remote-allow-origins=*",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("chrome never opened a debugging port");
}

const ws = new WebSocket(await target());
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id;
    pending.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send("Page.enable");

for (const shot of SHOTS) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: shot.w,
    height: shot.h,
    deviceScaleFactor: 1,
    mobile: shot.w < 768,
  });
  await send("Page.navigate", { url: BASE + shot.url });
  await sleep(2600);
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(`tmp/shot-${shot.name}.png`, Buffer.from(data, "base64"));
  console.log("captured", shot.name, `${shot.w}px`);
}

ws.close();
chrome.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
