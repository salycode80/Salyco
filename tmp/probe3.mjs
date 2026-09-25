import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9477, BASE = "http://localhost:5173";
const profile = mkdtempSync(join(tmpdir(), "cdp-p3-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe",
  ["--headless=new", `--remote-debugging-port=${PORT}`, "--remote-allow-origins=*",
   "--no-first-run", "--no-default-browser-check", "--disable-gpu",
   `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 40; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = l.find((t) => t.type === "page");
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl; } catch {}
    await sleep(250);
  } throw new Error("no port");
}
const ws = new WebSocket(await target());
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const g = JSON.parse(m.data);
  if (g.id && pending.has(g.id)) { pending.get(g.id)(g); pending.delete(g.id); } };
const send = (method, params = {}) => new Promise((r) => {
  const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
await send("Page.enable");

const PROBE = `(() => {
  const out = [];
  for (const svg of document.querySelectorAll("svg")) {
    const r = svg.getBoundingClientRect();
    const c = getComputedStyle(svg);
    const host = svg.parentElement;
    out.push({
      cls: String(svg.parentElement.className||"").slice(0,44),
      w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top),
      cssW: c.width, cssH: c.height, attrs: svg.getAttribute("width") + "x" + svg.getAttribute("height"),
    });
  }
  const de = document.documentElement;
  return { vw: innerWidth, docH: de.scrollHeight, scrollW: de.scrollWidth,
           pageH: document.body.getBoundingClientRect().height,
           svgCount: out.length, svgs: out.slice(0, 20) };
})()`;

for (const [w, url] of [[1440, "/articles/"], [1440, "/articles/rahnama-kamel/"]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: BASE + url });
  await sleep(2600);
  const res = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  console.log(`\n=== ${w}px ${url} ===`);
  console.log(JSON.stringify(res.result?.result?.value, null, 1));
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const name = url === "/articles/" ? "idx" : "art";
  writeFileSync(`tmp/p3-${name}-${w}.png`, Buffer.from(shot.result.data, "base64"));
}
ws.close(); chrome.kill(); await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
