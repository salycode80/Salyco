/** Quick look at what the browser is actually showing. */
const CDP = 9333;
const list = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
const target = list.find((x) => x.type === "page" && x.webSocketDebuggerUrl);
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m);
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (r.result?.exceptionDetails)
    return "EXC: " + r.result.exceptionDetails.exception?.description?.split("\n")[0];
  return r.result?.result?.value;
};
await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:5174/admin/coupons" });
await wait(5000);
console.log("URL      ", await evaluate("location.href"));
console.log("TITLE    ", await evaluate("document.title"));
console.log("HAS h1   ", await evaluate("document.querySelector('h1')?.textContent || 'none'"));
console.log("BODY HEAD", await evaluate("document.body.innerText.slice(0, 300).replace(/\\n+/g,' | ')"));
console.log("CONSOLE  ", await evaluate("window.__probeErrors || 'n/a'"));
ws.close();
process.exit(0);
