// Drives the surfaces changed in this pass through CDP and reports measurements
// rather than only screenshots, so each claim is a number and not an impression.
//
// Usage: node verify-probe.mjs <access> <refresh>
const PORT = 9333;
import { writeFileSync } from "node:fs";

const [ACCESS, REFRESH] = process.argv.slice(2);
const BASE = "http://localhost:5173";

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

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.result?.exceptionDetails) {
    throw new Error(JSON.stringify(r.result.exceptionDetails));
  }
  return r.result?.result?.value;
}

async function goto(path, width, height, settle = 2200) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 1024,
  });
  await send("Page.enable");
  await send("Page.navigate", { url: `${BASE}${path}` });
  await new Promise((r) => setTimeout(r, settle));
}

async function shot(out, full = false) {
  const s = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: full,
  });
  writeFileSync(out, Buffer.from(s.result.data, "base64"));
  console.log(`  wrote ${out}`);
}

const AUTH = (extra = {}) => `headers: Object.assign({
    Authorization: 'Bearer ' + localStorage.getItem('access'),
    'Content-Type': 'application/json' }, ${JSON.stringify(extra)})`;

// ── install the session ─────────────────────────────────────────────────────
await goto("/", 1440, 900, 3000);
await evaluate(
  `localStorage.setItem("access", ${JSON.stringify(ACCESS)});
   localStorage.setItem("refresh", ${JSON.stringify(REFRESH)});
   localStorage.setItem("salyco_last_activity", String(Date.now()));
   localStorage.setItem("salyco_last_keepalive", String(Date.now()));
   "ok"`
);

// ── seed: a gallery image (so the section has something to render) and a cart
// line (so the badge has a count) ────────────────────────────────────────────
const seeded = await evaluate(`(async () => {
  const out = {};
  const csrfless = (path, init) => fetch(path, init);

  // gallery: build a small PNG by hand and POST it as multipart
  const c = document.createElement('canvas'); c.width = 400; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = '#052E5F'; g.fillRect(0,0,400,300);
  g.fillStyle = '#F7F5F0'; g.font = '40px sans-serif'; g.fillText('SALYCO', 90, 160);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const fd = new FormData();
  fd.append('title', 'نمای کارگاه سالیکو');
  fd.append('image', new File([blob], 'probe.png', { type: 'image/png' }));
  fd.append('order', '1');
  fd.append('is_active', 'true');
  const gr = await csrfless('/api/admin/gallery/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + localStorage.getItem('access') },
    body: fd });
  out.gallery = { status: gr.status, body: await gr.json().catch(() => null) };

  // cart: one line, so the header badge renders a count
  const m = await (await fetch('/api/mattress/')).json();
  const list = Array.isArray(m) ? m : m.results || [];
  const item = list[0];
  if (item) {
    const body = { mattress_id: item.id, quantity: 1 };
    const sizes = item.sizes || [];
    if (sizes[0]) body.size_id = sizes[0].id;
    const cr = await csrfless('/api/cart/items/', { method: 'POST', ${AUTH()},
      body: JSON.stringify(body) });
    out.cart = { status: cr.status, mattress: item.name, size: sizes[0]?.label ?? null };
  }
  const cart = await (await fetch('/api/cart/', { ${AUTH()} })).json();
  out.cartCount = (cart.items || []).length;
  return out;
})()`);
console.log("SEED", JSON.stringify(seeded, null, 2));

// ── 1. desktop header: account control + cart badge ─────────────────────────
await goto("/", 1440, 900, 3500);
const header = await evaluate(`(() => {
  const cart = document.querySelector('header a[aria-label="سبد خرید"]');
  const badge = cart?.querySelector('span');
  const acct = document.querySelector('header button[aria-label="منوی حساب کاربری"]');
  const spans = acct ? [...acct.querySelectorAll('span')] : [];
  const circle = spans[spans.length - 1];
  const num = acct?.querySelector('span[dir="ltr"]');
  const cs = (el) => el ? getComputedStyle(el) : null;
  const navBg = cs(document.querySelector('header > div')).backgroundColor;
  return {
    badgeText: badge?.textContent?.trim() ?? null,
    badgeBg: badge ? cs(badge).backgroundColor : null,
    badgeFg: badge ? cs(badge).color : null,
    navbarBg: navBg,
    badgeIsNavy: badge ? cs(badge).backgroundColor === 'rgb(5, 46, 95)' : null,
    badgeTextIsWhite: badge ? cs(badge).color === 'rgb(255, 255, 255)' : null,
    acctNumber: num?.textContent?.trim() ?? null,
    numberRightOfCircle: num && circle
      ? num.getBoundingClientRect().left > circle.getBoundingClientRect().left
      : null,
    circleHasSvg: circle ? !!circle.querySelector('svg') : null,
    circleText: circle?.textContent?.trim() || '',
  };
})()`);
console.log("HEADER", JSON.stringify(header, null, 2));
await evaluate(
  `document.querySelector('header a[aria-label="سبد خرید"]').scrollIntoView({block:'center'}); 1`
);
await shot("tmp/shot-header-desktop.png");

await evaluate(
  `document.querySelector('header button[aria-label="منوی حساب کاربری"]').click(); 1`
);
await new Promise((r) => setTimeout(r, 700));
await shot("tmp/shot-header-dropdown.png");
const dropdown = await evaluate(`(() => {
  const avatar = document.querySelector('header .w-10.h-10');
  return { hasSvg: !!avatar?.querySelector('svg'),
           text: avatar?.textContent?.trim() ?? null };
})()`);
console.log("DROPDOWN", JSON.stringify(dropdown));

// ── 2. About page: hero copy, story image, no stats, gallery rendered ───────
await goto("/about", 1440, 1000, 3000);
const about = await evaluate(`(() => {
  const main = document.querySelector('main');
  const txt = main.textContent;
  const storyImg = document.querySelector('main img[src*="prestige"]');
  const galHeading = [...main.querySelectorAll('h2')]
    .find(h => h.textContent.includes('گالری'));
  const galImgs = galHeading
    ? [...galHeading.closest('section').querySelectorAll('img')]
    : [];
  return {
    h1: main.querySelector('h1')?.textContent?.trim() ?? null,
    persianSloganGone: !/بال قو/.test(txt),
    englishSloganGone: !/Swan Wing/i.test(txt),
    statsBlocks: [...main.querySelectorAll('section')]
      .filter(s => /Y\\+/.test(s.textContent)).length,
    storyImage: storyImg?.getAttribute('src') ?? null,
    galleryHeadingPresent: !!galHeading,
    galleryImages: galImgs.map(i => ({ src: i.getAttribute('src'),
                                       alt: i.getAttribute('alt'),
                                       w: Math.round(i.getBoundingClientRect().width) })),
  };
})()`);
console.log("ABOUT", JSON.stringify(about, null, 2));
await shot("tmp/shot-about-desktop.png", true);

// ── 3. checkout: notice block gone, one merged card ────────────────────────
// Navigated client-side from /cart: a full page load of /checkout races the
// cart fetch and bounces to /cart before the items arrive.
await goto("/cart", 1440, 1000, 2500);
const clicked = await evaluate(`(() => {
  const link = [...document.querySelectorAll('a')]
    .find(a => a.getAttribute('href') === '/checkout');
  if (!link) return 'no checkout link';
  link.click();
  return 'clicked';
})()`);
await new Promise((r) => setTimeout(r, 2500));
const checkout = await evaluate(`(() => {
  const main = document.querySelector('section');
  if (!main) return { url: location.pathname, why: 'no section' };
  const txt = main.textContent;
  const h = [...main.querySelectorAll('h2')].map(x => x.textContent.trim());
  const form = main.querySelector('form');
  const summaryH = [...main.querySelectorAll('h2')]
    .find(x => x.textContent.includes('خلاصه سفارش'));
  let node = summaryH, shared = null;
  while (node && node !== main) {
    if (node.contains(form)) { shared = node; break; }
    node = node.parentElement;
  }
  const sc = shared ? getComputedStyle(shared) : null;
  const aside = summaryH ? summaryH.closest('aside') : null;
  return {
    url: location.pathname,
    noticeGone: !txt.includes('پیش از ثبت سفارش این موارد را بخوانید'),
    removedHeadings: h.filter(x => x.includes('پیش از ثبت سفارش')),
    hints: [...main.querySelectorAll('form p')]
      .map(p => p.textContent.trim())
      .filter(t => t.length > 12),
    sharedAncestor: shared?.className ?? null,
    sharedRadius: sc?.borderRadius ?? null,
    sharedBorderWidth: sc?.borderTopWidth ?? null,
    asideBg: aside ? getComputedStyle(aside).backgroundColor : null,
    asideDivide: aside ? getComputedStyle(aside).borderInlineStartWidth : null,
    headings: h,
  };
})()`);
console.log("CHECKOUT", JSON.stringify(checkout, null, 2), "| clicked:", clicked);
await shot("tmp/shot-checkout-desktop.png", true);

await goto("/cart", 390, 900, 2000);
await evaluate(`[...document.querySelectorAll('a')]
  .find(a => a.getAttribute('href') === '/checkout')?.click(); 1`);
await new Promise((r) => setTimeout(r, 2500));
await shot("tmp/shot-checkout-390.png", true);

// ── 4. jalali: a displayed date, and the admin pickers ─────────────────────
await goto("/user-info", 1440, 1000, 3000);
const jalaliDates = await evaluate(`(() => {
  const txt = document.body.textContent;
  const latin = txt.match(/\\b(19|20)\\d\\d-\\d\\d-\\d\\d\\b/g);
  const joined = txt.match(/[۰-۹]{4}\\/[۰-۹]{1,2}\\/[۰-۹]{1,2}/g);
  const labeled = [...document.querySelectorAll('p')]
    .filter(p => p.previousElementSibling || true)
    .map(p => p.textContent.trim());
  const idx = labeled.findIndex(t => t.includes('تاریخ عضویت'));
  return {
    latinIsoDates: latin ?? [],
    joinedJalaliMatches: joined ?? [],
    membershipDate: idx >= 0 ? labeled[idx] : null,
    // The Field label and value are siblings; grab the value after the label.
    memberValue: (() => {
      const fields = [...document.querySelectorAll('div')]
        .filter(d => d.textContent.trim().startsWith('تاریخ عضویت'));
      const f = fields[fields.length - 1];
      return f ? f.textContent.replace('تاریخ عضویت','').trim() : null;
    })(),
  };
})()`);
console.log("USERINFO", JSON.stringify(jalaliDates, null, 2));

ws.close();
process.exit(0);
