const fs = require("fs");
const path = require("path");
const SRC = "Frontend/salyco-front/src";
const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
  );
const files = walk(SRC).filter((f) => /\.jsx?$/.test(f));
const rel = (f) => f.replace(/\\/g, "/");
const show = (re, label, max = 22) => {
  console.log("\n### " + label);
  let n = 0;
  for (const f of files) {
    fs.readFileSync(f, "utf8").split("\n").forEach((l, i) => {
      if (re.test(l) && n < max) {
        console.log("  " + rel(f).replace("Frontend/salyco-front/src/", "") + ":" + (i + 1));
        console.log("      " + l.trim().slice(0, 140));
        n++;
      }
    });
  }
  if (!n) console.log("  (none)");
};

show(/#E5E9EB|#000C3E|#B8860B|#017A29|#10B981|#A80000|#E7F3FB|#E6F0FB|#F5F7FF|#F0F8FC/i, "one-off colours not in either palette", 30);
show(/text-\[10px\]|text-\[11px\]|text-\[13px\]/, "sub-12px / off-scale font sizes", 20);
show(/font-sans/, "font-sans usage (no --font-sans token exists)", 20);
show(/border-[lr]-4|border-[lr]-\[/, "border-l-4 / border-r-4 status accents", 14);
show(/space-x-|divide-x-/, "space-x / divide-x (RTL-sensitive)", 14);
show(/\[var\(--navbar-height\)\]/, "navbar-offset pattern (PageShell candidate)", 20);
