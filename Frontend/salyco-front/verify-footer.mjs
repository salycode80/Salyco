// Temporary verification harness for the Enamad seal fix. Safe to delete.
import * as esbuild from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

const out = "./.verify-AboutFooter.mjs";
await esbuild.build({
  entryPoints: ["src/components/AboutFooter.jsx"],
  bundle: true,
  format: "esm",
  outfile: out,
  jsx: "automatic",
  logLevel: "silent",
  external: ["react", "react-dom", "react/jsx-runtime", "react-router-dom", "lucide-react"],
});

const AboutFooter = (await import(out)).default;

let html;
try {
  html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(AboutFooter)));
} catch (e) {
  console.log("FAIL: component throws ->", e.message.split("\n")[0]);
  process.exit(1);
}

const seal = html.slice(html.indexOf("trustseal.enamad.ir") - 400, html.indexOf("trustseal.enamad.ir") + 500);
const checks = [
  ["renders without throwing", true],
  ["seal image present", /trustseal\.enamad\.ir\/logo\.aspx/.test(html)],
  ["uses NEW enamad id (7423184)", html.includes("id=7423184")],
  ["uses NEW enamad code", html.includes("Code=H0l91jYQCDPJ1VyeHuuoxNVNW7vIEOw4")],
  ["no stale OLD id (7415585)", !html.includes("7415585")],
  ["white card restored (bg-white)", /bg-white/.test(seal)],
  ["seal size constrained (h-24)", /h-24/.test(seal)],
  ["rel=noopener present", /rel="noopener"/.test(seal)],
  ["rel does NOT include noreferrer", !/noreferrer/.test(seal)],
  ["referrerPolicy reaches DOM", /referrerpolicy="origin"/i.test(seal)],
  ["code attribute reaches DOM", /code="H0l91jYQCDPJ1VyeHuuoxNVNW7vIEOw4"/.test(seal)],
  ["no loading=lazy on seal", !/loading="lazy"/.test(seal)],
  ["alt text restored", /alt="نماد اعتماد الکترونیکی"/.test(seal)],
];

let ok = true;
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
  if (!pass) ok = false;
}
console.log("\n--- rendered seal markup ---\n" + seal.slice(seal.indexOf("<div class=\"flex justify-center\"")));
console.log(ok ? "\nAll checks passed." : "\nSome checks FAILED.");
process.exit(ok ? 0 : 1);
