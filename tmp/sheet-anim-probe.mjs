// Verify the AccountSheet entry animation actually plays when the mobile
// hamburger is tapped: sample the panel's computed transform frame by frame,
// then freeze the CSS animations at two points to photograph them.
// Usage: node sheet-anim-probe.mjs [url]
const PORT = 9333;
import { writeFileSync } from "node:fs";

const url = process.argv[2] ?? "http://localhost:5173/";

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (
        await fetch(`http://127.0.0.1:${PORT}/json/list`)
      ).json();
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

const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.result?.exceptionDetails) {
    throw new Error(JSON.stringify(r.result.exceptionDetails));
  }
  return r.result?.result?.value;
};

const shoot = async (out) => {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(shot.result.data, "base64"));
};

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url });
await new Promise((r) => setTimeout(r, 4000));

// ---- 1. what the animations actually are -------------------------------
const declared = await evaluate(`(async () => {
  const menu = document.querySelector('header.lg\\\\:hidden button[aria-label="منو"]')
    || [...document.querySelectorAll('header button')].find(b => b.getAttribute('aria-label') === 'منو');
  if (!menu) return { error: 'no hamburger' };
  menu.click();
  await new Promise(r => requestAnimationFrame(r));
  const panel = document.querySelector('[role="dialog"][aria-modal="true"]');
  const backdrop = document.querySelector('.sheet-backdrop-enter');
  const info = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const anims = el.getAnimations().map(a => ({
      name: a.animationName,
      duration: a.effect.getTiming().duration,
      easing: a.effect.getTiming().easing,
      currentTime: Math.round(a.currentTime ?? -1),
    }));
    return { transform: cs.transform, opacity: cs.opacity, anims };
  };
  return { panel: info(panel), backdrop: info(backdrop) };
})()`);
console.log("declared:", JSON.stringify(declared, null, 2));

// Let it settle, then close so run 2 starts clean.
await new Promise((r) => setTimeout(r, 700));
await shoot("shot-sheet-open.png");
const openRect = await evaluate(`(() => {
  const p = document.querySelector('[role="dialog"][aria-modal="true"]');
  if (!p) return null;
  const r = p.getBoundingClientRect();
  return { top: Math.round(r.top), height: Math.round(r.height), bottom: Math.round(r.bottom), vh: window.innerHeight };
})()`);
console.log("settled panel:", JSON.stringify(openRect));

// ---- 2. frame-by-frame transform of a fresh open -----------------------
const frames = await evaluate(`(async () => {
  const bd = document.querySelector('.sheet-backdrop-enter');
  bd.click();                                  // close
  await new Promise(r => setTimeout(r, 400));
  const menu = [...document.querySelectorAll('header button')].find(b => b.getAttribute('aria-label') === 'منو');
  const t0 = performance.now();
  menu.click();
  const out = [];
  // Sample every frame for 420ms. The panel is looked up each time: React
  // mounts it one render after the click.
  await new Promise(resolve => {
    const tick = () => {
      const el = document.querySelector('[role="dialog"][aria-modal="true"]');
      const el2 = document.querySelector('.sheet-backdrop-enter');
      const t = Math.round(performance.now() - t0);
      if (el) {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        out.push({ t, y: Math.round(m.f), o: +(el2 ? getComputedStyle(el2).opacity : 1).slice(0, 4) });
      } else {
        out.push({ t, y: null });
      }
      if (performance.now() - t0 > 420) resolve(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return out;
})()`);
console.log("frames (t ms, panel translateY px, backdrop opacity):");
console.log(frames.map((f) => `${f.t}\t${f.y}\t${f.o}`).join("\n"));

// ---- 3. freeze mid-flight and photograph -------------------------------
await evaluate(`(() => {
  const p = document.querySelector('[role="dialog"][aria-modal="true"]');
  if (p) p.closest('.fixed').querySelector('.sheet-backdrop-enter').click();
})()`);
await new Promise((r) => setTimeout(r, 400));
await evaluate(`(() => {
  const menu = [...document.querySelectorAll('header button')].find(b => b.getAttribute('aria-label') === 'منو');
  menu.click();
})()`);
await new Promise((r) => setTimeout(r, 40));
const frozen = await evaluate(`(() => {
  const a = document.getAnimations();
  a.forEach(x => { x.pause(); x.currentTime = 110; });
  const p = document.querySelector('[role="dialog"][aria-modal="true"]');
  const bd = document.querySelector('.sheet-backdrop-enter');
  return {
    count: a.length,
    panelY: p ? Math.round(new DOMMatrixReadOnly(getComputedStyle(p).transform).f) : null,
    backdropOpacity: bd ? getComputedStyle(bd).opacity : null,
  };
})()`);
console.log("frozen @110ms:", JSON.stringify(frozen));
await shoot("shot-sheet-mid.png");
await evaluate(`document.getAnimations().forEach(a => a.finish())`);

// ---- 4. reduced motion --------------------------------------------------
await send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});
await evaluate(`(() => {
  const bd = document.querySelector('.sheet-backdrop-enter');
  if (bd) bd.click();
})()`);
await new Promise((r) => setTimeout(r, 400));
const reduced = await evaluate(`(async () => {
  const menu = [...document.querySelectorAll('header button')].find(b => b.getAttribute('aria-label') === 'منو');
  menu.click();
  await new Promise(r => setTimeout(r, 60));
  const p = document.querySelector('[role="dialog"][aria-modal="true"]');
  if (!p) return { error: 'panel not mounted' };
  return {
    transform: getComputedStyle(p).transform,
    animations: p.getAnimations().length,
  };
})()`);
console.log("reduced-motion @60ms:", JSON.stringify(reduced));
await send("Emulation.setEmulatedMedia", { features: [] });

ws.close();
process.exit(0);
