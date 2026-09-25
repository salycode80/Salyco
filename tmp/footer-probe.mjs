// Re-check sheet focus return, and whether the tab bar covers the footer.
const PORT = 9333;
import { writeFileSync } from "node:fs";

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.find((x) => x.type === "page" && x.webSocketDebuggerUrl);
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
  width: 390, height: 900, deviceScaleFactor: 1, mobile: true,
});
await send("Page.enable");
await send("Page.navigate", { url: "http://localhost:5174/" });
await new Promise((r) => setTimeout(r, 5000));

// --- focus return ---
await send("Runtime.evaluate", {
  expression: `document.querySelector('nav[aria-label="ناوبری موبایل"] button').click()`,
});
await new Promise((r) => setTimeout(r, 700));
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await new Promise((r) => setTimeout(r, 600));
const focus = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const a = document.activeElement;
    return JSON.stringify({
      closed: !document.querySelector('[role="dialog"]'),
      activeTag: a.tagName,
      activeLabel: (a.textContent||'').trim().slice(0,16),
      isAccountTab: a === document.querySelector('nav[aria-label="ناوبری موبایل"] button'),
    });
  })()`,
});
console.log("focus:", focus.result.result.value);

// --- footer clearance ---
await send("Runtime.evaluate", {
  expression: `(() => { window.scrollTo(0, document.documentElement.scrollHeight); return 1; })()`,
  returnByValue: true,
});
await new Promise((r) => setTimeout(r, 1200));
const foot = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const bar = document.querySelector('nav[aria-label="ناوبری موبایل"]');
    const barTop = bar.getBoundingClientRect().top;
    const barH = Math.round(bar.getBoundingClientRect().height);
    // The last painted text node in the footer.
    const f = document.querySelector('footer');
    const last = f ? f.getBoundingClientRect().bottom : null;
    const atBottom = Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) < 2;
    // Is any footer content sitting under the bar's band?
    let covered = [];
    if (f) {
      for (const el of f.querySelectorAll('a,p,span,img,svg')) {
        const r = el.getBoundingClientRect();
        if (r.height && r.top < window.innerHeight && r.bottom > barTop && r.top < barTop) {
          covered.push(((el.textContent||'').trim().slice(0,20) || el.tagName));
        }
      }
    }
    return JSON.stringify({ barH, barTop: Math.round(barTop), footerBottom: last && Math.round(last), atBottom, covered: covered.slice(0,8) }, null, 1);
  })()`,
});
console.log("footer:", foot.result.result.value);

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("shots/footer-390.png", Buffer.from(shot.result.data, "base64"));
ws.close();
process.exit(0);
