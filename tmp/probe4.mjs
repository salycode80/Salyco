import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9488, BASE = "http://localhost:5173";
const profile = mkdtempSync(join(tmpdir(), "cdp-p4-"));
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
  let max = { w: 0, h: 0, cls: "" };
  for (const svg of document.querySelectorAll("svg")) {
    const r = svg.getBoundingClientRect();
    if (r.width > max.w) max = { w: Math.round(r.width), h: Math.round(r.height),
      cls: String(svg.parentElement.className||"").slice(0,30) };
  }
  const de = document.documentElement;
  const wide = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width > innerWidth + 1) wide.push(String(el.className||el.tagName).slice(0,30) + "=" + Math.round(r.width));
  }
  return { vw: innerWidth, sw: de.scrollWidth, docH: de.scrollHeight,
    maxSvg: max, wide: wide.slice(0,5),
    cssLoaded: [...document.styleSheets].map(s => (s.href||"inline").split("/").pop()).join(","),
    heroH: (() => { const h=document.querySelector(".index__hero"); return h?Math.round(h.getBoundingClientRect().height):null; })(),
    gridCols: (() => { const g=document.querySelector(".article-grid"); return g?getComputedStyle(g).gridTemplateColumns:null; })(),
    cards: document.querySelectorAll(".article-card").length,
    chips: document.querySelectorAll(".index__categories a, .index__categories span").length,
  };
})()`;

for (const w of [320, 360, 390, 414, 480, 600, 768, 900, 1024, 1200, 1440, 1920]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 });
  await send("Page.navigate", { url: BASE + "/articles/" });
  await sleep(1800);
  const res = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  const v = res.result?.result?.value;
  console.log(`${String(v.vw).padStart(4)} | sw=${String(v.sw).padStart(4)} docH=${String(v.docH).padStart(5)} | maxSvg ${String(v.maxSvg.w).padStart(4)}x${String(v.maxSvg.h).padEnd(4)} ${v.maxSvg.cls.padEnd(22)} | cards=${v.cards} chips=${v.chips}`);
  if (v.wide.length) console.log(`       WIDE: ${v.wide.join(" | ")}`);
}
ws.close(); chrome.kill(); await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
