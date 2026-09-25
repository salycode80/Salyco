// Measure horizontal overflow at a phone width using Chrome DevTools Protocol.
// Node 24 has a global WebSocket, so no dependencies are needed.
const PORT = 9333;

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("no devtools target");
}

const EXPR = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    // RTL: the document's left edge is the one that overflows off-screen.
    if (r.left < -0.5 || r.right > vw + 0.5) {
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute('class') || '').slice(0, 120),
        text: (el.textContent || '').trim().slice(0, 30),
        w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right),
      });
    }
  }
  return JSON.stringify({
    vw,
    docScrollW: document.documentElement.scrollWidth,
    bodyScrollW: document.body.scrollWidth,
    count: out.length,
    worst: out.sort((a, b) => Math.min(a.left, vw - a.right) - Math.min(b.left, vw - b.right)).slice(0, 14),
  }, null, 1);
})()`;

const url = process.argv[2] || "http://localhost:5174/";
const width = Number(process.argv[3] || 390);

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
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height: 1400,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.enable");
await send("Page.navigate", { url });
await new Promise((r) => setTimeout(r, 5000));
const res = await send("Runtime.evaluate", { expression: EXPR, returnByValue: true });
console.log(res.result?.result?.value ?? JSON.stringify(res));
ws.close();
process.exit(0);
