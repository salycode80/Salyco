const PORT = 9333;
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.find((x) => x.type === "page" && x.webSocketDebuggerUrl);
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m); };
await new Promise((r) => (ws.onopen = r));
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.result?.value;
await send("Page.enable");

const M = `(() => {
  const hdr = [...document.querySelectorAll('header')].find(h => String(h.className).includes('lg:hidden'));
  const row = hdr.firstElementChild;
  const lockup = row.firstElementChild;
  const group = row.lastElementChild;
  const img = lockup.querySelector('img');
  const span = lockup.querySelector('span');
  const box = (el) => { const b = el.getBoundingClientRect();
    return { w: +b.width.toFixed(1), l: +b.left.toFixed(1), r: +b.right.toFixed(1) }; };
  const sp = getComputedStyle(span);
  // The text's own intrinsic width, measured off-layout so squeeze cannot hide it.
  const probe = document.createElement('span');
  probe.textContent = span.textContent;
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + sp.font;
  document.body.appendChild(probe);
  const intrinsic = +probe.getBoundingClientRect().width.toFixed(1);
  probe.remove();
  const acctLabel = group.querySelector('button span');
  const ham = group.querySelector('button[aria-label="منو"]');
  const disc = [...group.querySelectorAll('span')].find(s => Math.round(s.getBoundingClientRect().width) === 34);
  return JSON.stringify({
    vw: window.innerWidth,
    lockup: box(lockup), img: box(img), span: box(span),
    spanIntrinsic: intrinsic, spanScrollW: span.scrollWidth, spanClientW: span.clientWidth,
    squeezedPx: +(intrinsic - box(span).w).toFixed(1),
    acctLabel: box(acctLabel), acctLabelText: acctLabel.textContent,
    disc: disc ? box(disc) : null,
    ham: ham ? box(ham) : null,
    group: box(group),
    gapLockupToGroup: +(box(lockup).l - box(group).r).toFixed(1),
    // Would the wordmark paint over the account label?
    wordmarkRightEdgeVsGroupLeft: +(box(lockup).l - box(group).r).toFixed(1),
  }, null, 1);
})()`;

for (const w of [390, 360, 344, 320]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: "http://localhost:5173/" });
  await new Promise((r) => setTimeout(r, 3200));
  console.log(`===== ${w}px =====`);
  console.log(await ev(M));
}
ws.close(); process.exit(0);
