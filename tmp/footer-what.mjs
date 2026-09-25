// Identify what is painting at the centre of the footer area.
const PORT = 9333;
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.find((x) => x.type === "page" && x.webSocketDebuggerUrl);
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (m, p = {}) =>
  new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m); };
await new Promise((r) => (ws.onopen = r));

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
await send("Page.enable");
await send("Page.navigate", { url: "http://localhost:5174/" });
await new Promise((r) => setTimeout(r, 5000));
await send("Runtime.evaluate", { expression: `window.scrollTo(0, document.documentElement.scrollHeight)` });
await new Promise((r) => setTimeout(r, 1200));

const r = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const hits = [];
    // Walk a grid over the viewport and report what is painted, skipping the
    // fixed tab bar's own band.
    const probes = [[195,700],[195,760],[195,790],[195,810],[100,790],[300,790],[195,650],[195,830]];
    for (const [x,y] of probes) {
      const el = document.elementFromPoint(x,y);
      const stack = document.elementsFromPoint(x,y).map(e => e.tagName.toLowerCase() + '.' + (e.getAttribute('class')||'').split(' ').slice(0,3).join('.'));
      hits.push({ x, y, top: el && (el.tagName.toLowerCase() + ' ' + (el.textContent||'').trim().slice(0,18)), stack: stack.slice(0,4) });
    }
    return JSON.stringify({ vw, vh, scrollY: Math.round(window.scrollY), hits }, null, 1);
  })()`,
});
console.log(r.result.result.value);
ws.close();
process.exit(0);
