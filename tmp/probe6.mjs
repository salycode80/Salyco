import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9511, BASE = "http://localhost:5173";
const profile = mkdtempSync(join(tmpdir(), "cdp-p6-"));
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

const P = `(() => {
  const cs = getComputedStyle(document.documentElement);
  const nav = document.querySelector("header");
  const top = document.querySelector("main, #root > *");
  return {
    vw: innerWidth,
    navbarHeight: cs.getPropertyValue("--navbar-height").trim(),
    tabbarHeight: cs.getPropertyValue("--tabbar-height").trim(),
    navy: cs.getPropertyValue("--salyco-navy").trim(),
    fontsLoaded: [...document.fonts].filter(f => f.status === "loaded").length,
    headerH: nav ? Math.round(nav.getBoundingClientRect().height) : null,
    firstContentTop: top ? Math.round(top.getBoundingClientRect().top) : null,
    sw: document.documentElement.scrollWidth,
  };
})()`;

for (const [w, url] of [[1440, "/"], [390, "/"], [1440, "/articles/"]] ) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 });
  await send("Page.navigate", { url: BASE + url });
  await sleep(3200);
  const r = await send("Runtime.evaluate", { expression: P, returnByValue: true });
  const v = r.result?.result?.value;
  console.log(`${String(w).padStart(4)} ${url.padEnd(11)} navbar=${v.navbarHeight.padEnd(34)} tabbar=${v.tabbarHeight.padEnd(34)} navy=${v.navy} fonts=${v.fontsLoaded} headerH=${v.headerH} contentTop=${v.firstContentTop} sw=${v.sw}`);
}
ws.close(); chrome.kill(); await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
