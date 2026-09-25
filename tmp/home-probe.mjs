// Measure the mobile home stack at a given width: header fit, card geometry,
// line counts, and any element escaping the viewport.
// Usage: node home-probe.mjs <width>
const PORT = 9333;
const width = Number(process.argv[2] || 390);

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
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

await send("Emulation.setDeviceMetricsOverride", {
  width,
  height: 900,
  deviceScaleFactor: 1,
  mobile: width < 1024,
});
await send("Page.enable");
await send("Page.navigate", { url: "http://localhost:5173/" });
await new Promise((r) => setTimeout(r, 5000));

const expr = `(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const lines = (el) => { const cs = getComputedStyle(el); const lh = parseFloat(cs.lineHeight); return lh ? Math.round(el.getBoundingClientRect().height / lh) : null; };
  // The desktop Navbar is also a <header>; the mobile one is the lg:hidden one.
  const header = [...document.querySelectorAll('header')].find((h) => String(h.className).includes('lg:hidden'));
  const headerRow = header.firstElementChild;
  const brand = headerRow.querySelector('a');
  const brandImg = brand.querySelector('img');
  const brandText = brand.querySelector('span');
  const rightGroup = headerRow.lastElementChild;
  const acctBtn = rightGroup.querySelector('button');
  const acctText = acctBtn.querySelector('span');
  const divider = rightGroup.children[1];
  const grid = document.querySelector('#root section:nth-of-type(3) > div, main div');
  const cards = [...document.querySelectorAll('a[href="/catalog.pdf"], a[href="/articles"], a[href="/products"]')]
    .filter((el) => el.className.includes('rounded-[24px]') && el.className.includes('min-h-[142px]'));
  const texts = cards.map((c) => {
    const spans = [...c.querySelectorAll(':scope > span')];
    return {
      box: r(c),
      tile: r(spans[0]),
      title: { text: spans[1].textContent, h: Math.round(spans[1].getBoundingClientRect().height), lines: lines(spans[1]) },
      sub: { text: spans[2].textContent, h: Math.round(spans[2].getBoundingClientRect().height), lines: lines(spans[2]) },
      arrow: { ...r(spans[3]), align: getComputedStyle(spans[3]).alignSelf, pos: r(spans[3]).x - r(c).x },
    };
  });
  const slogan = document.querySelector('h1');
  const nav = document.querySelector('nav[aria-label="ناوبری موبایل"]');
  const hero = document.querySelector('#root section img[alt^="تشک امپریال"]');
  const overflow = [];
  document.querySelectorAll('body *').forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.width && (b.left < -1 || b.right > ${width} + 1)) overflow.push(el.tagName + '.' + String(el.className).slice(0, 70) + ' [' + Math.round(b.left) + ',' + Math.round(b.right) + ']');
  });
  return JSON.stringify({
    docScrollW: document.documentElement.scrollWidth,
    header: { box: r(header), row: r(headerRow), brand: r(brand), brandImg: r(brandImg), brandTextW: r(brandText).w, rightGroup: r(rightGroup), acctBtn: r(acctBtn), acctTextW: r(acctText).w, divider: divider ? r(divider) : null, gapBrandToAcct: Math.round(r(acctBtn).x - (r(brand).x + r(brand).w)) },
    slogan: { text: slogan.textContent, box: r(slogan), font: getComputedStyle(slogan).fontSize, lines: lines(slogan) },
    hero: hero ? { box: r(hero), objPos: getComputedStyle(hero).objectPosition } : null,
    cards: texts,
    nav: nav ? { box: r(nav), bottom: getComputedStyle(nav).bottom, h: getComputedStyle(nav).height } : null,
    overflow: overflow.slice(0, 12),
  }, null, 1);
})()`;

const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
console.log(res.result?.result?.value ?? JSON.stringify(res, null, 1));
ws.close();
process.exit(0);
