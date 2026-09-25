import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9499, BASE = "http://localhost:5173";
const profile = mkdtempSync(join(tmpdir(), "cdp-p5-"));
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

const RECT = `(s) => { const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }`;

const PROBE = `(() => {
  const rect = ${RECT};
  const vis = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).display : null; };
  // duplicate ids anywhere on the page
  const ids = {}, dupes = [];
  for (const e of document.querySelectorAll("[id]")) {
    if (ids[e.id]) dupes.push(e.id); else ids[e.id] = 1;
  }
  // every label must point at an input that exists, and be visible-ish
  const orphan = [...document.querySelectorAll("label[for]")]
    .filter(l => !document.getElementById(l.getAttribute("for"))).map(l => l.getAttribute("for"));
  const de = document.documentElement;
  const over = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.right > innerWidth + 1 || r.left < -1)
      over.push(String(el.className||el.tagName).slice(0,26) + "[" + Math.round(r.left) + "," + Math.round(r.right) + "]");
  }
  const panel = document.querySelector(".site-menu__panel");
  const summary = document.querySelector(".site-menu__toggle");
  return {
    vw: innerWidth, sw: de.scrollWidth,
    desktopHeader: vis(".site-header--desktop"), mobileHeader: vis(".site-header--mobile"),
    headerH: rect(".site-header--mobile")?.[3] ?? null,
    lastH1Top: (() => { const hs = document.querySelectorAll("h1"); if (!hs.length) return null;
      const h = hs[hs.length-1]; return Math.round(h.getBoundingClientRect().top); })(),
    wordmark: vis(".site-header__wordmark"),
    brandLabel: document.querySelector(".site-header__brand[aria-label]")?.getAttribute("aria-label") ?? null,
    summaryBox: rect(".site-menu__toggle"),
    openIcon: vis(".site-menu__icon--open"), closeIcon: vis(".site-menu__icon--close"),
    panelDisplay: panel ? getComputedStyle(panel).display : null,
    panelPos: panel ? getComputedStyle(panel).position : null,
    dupes, orphanLabels: orphan,
    inputIds: [...document.querySelectorAll(".site-search input")].map(i => i.id),
    overflow: over.slice(0, 6),
  };
})()`;

for (const [w, url, open] of [[360,"/articles/rahnama-kamel/",false],[390,"/articles/rahnama-kamel/",false],
                              [390,"/articles/rahnama-kamel/",true],[1024,"/articles/rahnama-kamel/",false],
                              [1440,"/articles/rahnama-kamel/",false],[390,"/articles/",false]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 });
  await send("Page.navigate", { url: BASE + url });
  await sleep(2400);
  if (open) {
    await send("Runtime.evaluate", { expression: `document.querySelector(".site-menu").setAttribute("open","")` });
    await sleep(400);
  }
  const res = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  const v = res.result?.result?.value;
  console.log(`\n=== ${w}px ${url} ${open ? "[menu OPEN]" : ""} ===`);
  console.log(` desktop=${v.desktopHeader} mobile=${v.mobileHeader} headerH=${v.headerH} h1Top=${v.lastH1Top} sw=${v.sw} wordmark=${v.wordmark}`);
  console.log(` summary=${JSON.stringify(v.summaryBox)} openIcon=${v.openIcon} closeIcon=${v.closeIcon}`);
  console.log(` panel: display=${v.panelDisplay} position=${v.panelPos}`);
  console.log(` ids=${JSON.stringify(v.inputIds)} dupes=${JSON.stringify(v.dupes)} orphanLabels=${JSON.stringify(v.orphanLabels)}`);
  if (v.overflow.length) console.log(` OVERFLOW: ${v.overflow.join(" | ")}`);
  if (open || w === 390 || w === 1440) {
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !open });
    writeFileSync(`tmp/p5-${url === "/articles/" ? "idx" : "art"}-${w}${open ? "-open" : ""}.png`,
      Buffer.from(shot.result.data, "base64"));
  }
}
ws.close(); chrome.kill(); await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
