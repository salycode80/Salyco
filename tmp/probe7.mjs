import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9522, BASE = "http://localhost:5173";
const profile = mkdtempSync(join(tmpdir(), "cdp-p7-"));
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
  const f = document.querySelector(".site-footer, footer");
  const r = f.getBoundingClientRect();
  const h = f.querySelector("h2, h3, .site-footer__title, strong");
  return {
    footerCls: f.className,
    rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    bg: getComputedStyle(f).backgroundColor,
    color: getComputedStyle(f).color,
    heading: h ? { text: h.textContent.trim().slice(0,20), color: getComputedStyle(h).color } : null,
    linkColor: (() => { const a = f.querySelector("nav a"); return a ? getComputedStyle(a).color : null; })(),
    contactColor: (() => { const c = f.querySelector(".site-footer__contact a, .site-footer__badge"); return c ? getComputedStyle(c).color : null; })(),
    bodyBgAtFooter: (() => { const b = document.body; return getComputedStyle(b).backgroundColor; })(),
  };
})()`;
for (const [w, url] of [[1440, "/articles/rahnama-kamel/"], [1440, "/articles/"], [390, "/articles/rahnama-kamel/"]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 });
  await send("Page.navigate", { url: BASE + url });
  await sleep(2600);
  const r = await send("Runtime.evaluate", { expression: P, returnByValue: true });
  console.log(`${w} ${url}\n  ${JSON.stringify(r.result?.result?.value)}\n`);
}
ws.close(); chrome.kill(); await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
