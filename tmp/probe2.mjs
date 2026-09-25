import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9461, BASE = "http://localhost:5173";
const profile = mkdtempSync(join(tmpdir(), "cdp-p2-"));
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
  const de = document.documentElement, vw = innerWidth, over = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.right > vw + 1 || r.left < -1)
      over.push(el.tagName.toLowerCase() + "." + String(el.className||"").split(" ")[0] + " [" + Math.round(r.left) + "," + Math.round(r.right) + "]");
  }
  const rect = (s) => { const e = document.querySelector(s); if (!e) return null;
    const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
  const img = document.querySelector(".site-footer img[src*='enamad'], footer img[src*='enamad']");
  const meta = document.querySelector(".article__meta");
  const search = document.querySelector(".site-header input");
  return {
    vw, scrollW: de.scrollWidth,
    overflow: over.slice(0, 10),
    header: rect(".site-header"),
    headerTop: rect(".site-header__top"),
    headerNav: rect(".site-header__nav"),
    navWraps: (() => { const n = document.querySelector(".site-header__nav"); return n ? Math.round(n.getBoundingClientRect().height / 40) : 0; })(),
    firstArticlePx: (() => { const h = document.querySelector("h1"); return h ? Math.round(h.getBoundingClientRect().top) : null; })(),
    enamad: img ? { src: img.getAttribute("src").slice(0, 70), complete: img.complete,
      nw: img.naturalWidth, nh: img.naturalHeight, w: Math.round(img.getBoundingClientRect().width),
      h: Math.round(img.getBoundingClientRect().height) } : "no img",
    metaText: meta ? meta.innerText.replace(/\s+/g, " ").trim() : null,
    metaKids: meta ? meta.children.length : 0,
    searchDir: search ? getComputedStyle(search).direction : null,
    searchPH: search ? search.placeholder : null,
  };
})()`;

for (const [w, url] of [[390,"/articles/rahnama-kamel/"],[360,"/articles/rahnama-kamel/"],
                        [768,"/articles/rahnama-kamel/"],[1024,"/articles/rahnama-kamel/"],
                        [1280,"/articles/"]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 });
  await send("Page.navigate", { url: BASE + url });
  await sleep(2500);
  const res = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  console.log(`\n=== ${w}px ${url} ===`);
  console.log(JSON.stringify(res.result?.result?.value, null, 1));
}
ws.close(); chrome.kill(); await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
