import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9533, BASE = "http://localhost:5173";
const profile = mkdtempSync(join(tmpdir(), "cdp-p8-"));
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
  const h = document.querySelector(".site-header--mobile").getBoundingClientRect();
  const d = document.querySelector(".site-header--desktop").getBoundingClientRect();
  const over = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.right > innerWidth + 1 || r.left < -1) over.push(String(el.className||el.tagName).slice(0,24));
  }
  return { vw: innerWidth, sw: document.documentElement.scrollWidth,
    mobileH: Math.round(h.height), desktopH: Math.round(d.height),
    accountText: document.querySelector(".site-header--desktop .site-header__account")?.textContent.trim(),
    customerShown: document.body.innerText.includes("۰۹۹۳۳۹۲۱۰۹۶"),
    overflow: over.slice(0,5) };
})()`;
for (const [w, url] of [[1440,"/articles/rahnama-kamel/"],[390,"/articles/rahnama-kamel/"],[1440,"/"]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 });
  await send("Page.navigate", { url: BASE + url });
  await sleep(2600);
  const r = await send("Runtime.evaluate", { expression: P, returnByValue: true });
  console.log(`${String(w).padStart(4)} ${url.padEnd(24)} ${JSON.stringify(r.result?.result?.value)}`);
}
ws.close(); chrome.kill(); await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
