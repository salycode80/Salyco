// Header crowding check at both QA phone widths: the gap between the brand
// lockup and the account/menu group, and whether anything overflows.
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
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.result?.value;
await send("Page.enable");

const MEASURE = `(() => {
  const btn = document.querySelector('header button[aria-haspopup="dialog"]');
  const hdr = btn ? btn.closest('header') : null;
  if (!hdr) return JSON.stringify({ error: 'no mobile header' });
  const row = hdr.firstElementChild;
  const lockup = row.firstElementChild;
  const group = row.lastElementChild;
  const lb = lockup.getBoundingClientRect();
  const gb = group.getBoundingClientRect();
  const rb = row.getBoundingClientRect();
  const disc = group.querySelector('span > span, span span');
  const discEl = [...group.querySelectorAll('span')].find(s => getComputedStyle(s).borderRadius === '50%' && s.getBoundingClientRect().width > 20);
  const ham = group.querySelector('button[aria-label="منو"]');
  const acct = group.querySelector('button[aria-haspopup="dialog"]');
  const img = lockup.querySelector('img');
  const overflow = [...document.querySelectorAll('body *')].filter(el => {
    const b = el.getBoundingClientRect();
    return b.width > 0 && (b.right > window.innerWidth + 0.5 || b.left < -0.5);
  }).map(el => (el.tagName + '.' + String(el.className).slice(0, 40)));
  return JSON.stringify({
    vw: window.innerWidth, headerH: Math.round(hdr.getBoundingClientRect().height),
    rowPadL: getComputedStyle(row).paddingLeft,
    lockupW: Math.round(lb.width), groupW: Math.round(gb.width),
    // rtl: lockup is on the right, group on the left, so the gap is lockup.left - group.right
    gap: Math.round(lb.left - gb.right),
    logoW: img ? Math.round(img.getBoundingClientRect().width) : null,
    logoH: img ? Math.round(img.getBoundingClientRect().height) : null,
    wordmarkPx: (() => { const s = lockup.querySelector('span'); return s ? getComputedStyle(s).fontSize + ' / ' + getComputedStyle(s).fontWeight : null; })(),
    acctPx: (() => { const s = acct && acct.querySelector('span'); return s ? getComputedStyle(s).fontSize + ' / ' + getComputedStyle(s).fontWeight : null; })(),
    discPx: discEl ? Math.round(discEl.getBoundingClientRect().width) : null,
    hamPx: ham ? Math.round(ham.getBoundingClientRect().width) : null,
    acctTouch: acct ? Math.round(acct.getBoundingClientRect().height) : null,
    rightEdge: Math.round(rb.right), leftEdge: Math.round(rb.left),
    lockupFlushRight: Math.round(lb.right) === Math.round(rb.right),
    overflowX: overflow.slice(0, 5), docW: document.documentElement.scrollWidth,
  });
})()`;

for (const w of [390, 360]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: "http://localhost:5173/" });
  await new Promise((r) => setTimeout(r, 4000));
  const raw = await ev(MEASURE);
  console.log(`--- ${w}px ---`);
  try { console.log(JSON.stringify(JSON.parse(raw), null, 1)); } catch { console.log(raw); }
}
ws.close();
process.exit(0);
