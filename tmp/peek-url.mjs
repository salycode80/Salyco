const PORT = 9333;
async function target() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  return list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
}
const t = await target();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m); };
await new Promise((r) => (ws.onopen = r));
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.result?.value;
console.log(await ev(`JSON.stringify({ url: location.href, title: document.title, hasSheet: !!document.querySelector('[role="dialog"][aria-modal="true"]') })`));
ws.close(); process.exit(0);
