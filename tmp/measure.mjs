// Throwaway: measure the article surfaces against the rest of the site, so the
// review argues from computed values rather than from how a PNG looks.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 9453;
const BASE = "http://localhost:5173";

const profile = mkdtempSync(join(tmpdir(), "cdp-measure-"));
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
    pending.get(msg.id)(msg);
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

const PROBE = `(() => {
  const de = document.documentElement;
  const vw = window.innerWidth;
  const overflow = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      overflow.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || "",
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
      });
    }
  }
  const cs = (sel, props) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const out = { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] };
    for (const p of props) out[p] = c[p];
    return out;
  };
  return {
    url: location.pathname,
    vw,
    scrollW: de.scrollWidth,
    bodyScrollW: document.body.scrollWidth,
    overflow: overflow.slice(0, 14),
    fontBody: getComputedStyle(document.body).fontFamily,
    vazirLoaded: Array.from(document.fonts).filter(f => f.family.includes("Vazirmatn")).map(f => f.family + " " + f.status),
    fontFaces: Array.from(document.fonts).map(f => f.family + "/" + f.status).slice(0, 12),
    h1: cs("h1", ["fontFamily","fontSize","fontWeight","lineHeight","color","letterSpacing"]),
    header: cs("header", ["backgroundColor","minHeight","position","borderBottomColor"]),
    shell: cs(".article-shell", ["maxWidth","width","paddingInlineStart","boxSizing"]),
    crumb: cs(".article-breadcrumb", ["width"]),
    postTitle: cs(".article__title", ["fontSize","lineHeight","fontWeight"]),
    grid: cs(".article-grid", ["gridTemplateColumns","width","gap"]),
    card: cs(".article-card__link", ["width","borderRadius","padding","backgroundColor","borderColor"]),
    nav: cs("nav a", ["fontSize","fontWeight","color","paddingInlineStart"]),
    main: cs("main", ["paddingTop","backgroundColor"]),
    body: cs("body", ["backgroundColor","color","fontSize","lineHeight","margin"]),
    cardCount: document.querySelectorAll(".article-card").length,
    footerBtns: document.querySelectorAll("footer a").length,
  };
})()`;

for (const [w, url] of [
  [1440, "/articles/"],
  [1440, "/articles/rahnama-kamel/"],
  [1440, "/"],
  [390, "/articles/"],
  [390, "/articles/rahnama-kamel/"],
]) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768,
  });
  await send("Page.navigate", { url: BASE + url });
  await sleep(2800);
  const res = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  console.log(`\n=== ${w}px ${url} ===`);
  console.log(JSON.stringify(res.result?.result?.value, null, 1));
}

ws.close();
chrome.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
