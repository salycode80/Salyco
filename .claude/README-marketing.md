# Salyco — Marketing & Site Analysis

Session output, 2026-08-26. Analysis of production **https://salyco.ir**.

## Files

| File | What it is | Read it when |
|---|---|---|
| [`salyco-site-audit.md`](./salyco-site-audit.md) | **Measured evidence.** Every byte count, HTTP status and API field, probed live. Includes re-runnable verification commands. | You need proof, or want to re-check a number |
| [`salyco-improvement-plan.md`](./salyco-improvement-plan.md) | **The plan.** 4 dependency-ordered phases covering site structure, images, copy and articles. | You're deciding what to do next |
| [`salyco-product-copy-rewrite.md`](./salyco-product-copy-rewrite.md) | **Product content task list.** 10 ordered tasks with the replacement Persian copy written out. Tasks 1–4 are factual corrections, not polish. | You're editing product descriptions, specs, FAQs or ratings |
| [`product-marketing-context.md`](./product-marketing-context.md) | **Positioning.** Canonical path every `marketing-skills:*` skill reads. ~60% complete; gaps flagged. | Before writing any copy or running a marketing skill |

## Method

- Live HTTP probes (`curl`) against production — headers, byte counts, status codes.
- Live API reads for all catalogue and article facts.
- Static analysis of `Frontend/salyco-front/src`, `nginx.conf`, `index.html`.
- **Local `Backend/db.sqlite3` was not used** — it is stale dev data.

Every figure in the audit was measured, not estimated. Nothing was inferred from
the local database.

## The short version

Salyco has the hard parts built: a real manufacturer with 20+ years of history, a
120-month warranty with working registration and admin approval, Enamad
certification, a coherent brand voice, and a physical Neyshabur address. What it
lacks is **any ability to be found, and any ability to load quickly.**

The five findings that matter most:

1. **Emperial's FAQs and pros/cons describe a memory-foam mattress** — but Emperial
   is a spring mattress. They assert Cool Gel, Open Cell and OEKO-TEX
   certification the product does not have, plus "complete motion isolation" that
   its own micro-bonnell coil construction contradicts. Same template contaminated
   the back-pain article. **This is a factual correction, not a copy edit.**
2. **A 5.2 MB PNG is the homepage's largest paint** (`/layerdimage.png`).
3. **No compression anywhere** — 610 KB of JS served raw; `nginx.conf` has no
   `gzip` or `brotli` directive.
4. **Zero SEO infrastructure** — 0 canonical tags, 0 OG tags, 0 JSON-LD blocks, one
   global `<title>` shared by all ~11 public routes, no `robots.txt`, no
   `sitemap.xml`.
5. **The flagship's 2.00 rating is the developer's own test review** — `rating: 2`
   with the body text `عالی` ("excellent"), from the name credited in the site
   footer. It is the sole input to the public rating.

Also live: the hero's "download catalogue" CTA is broken (`/catalog.pdf` returns
the SPA shell), and both products display the single-bed price on a Queen-sized
configuration — understating by 26% and 37%.

**Start here:** enable gzip and replace `layerdimage.png`. Two changes, under a
day, and they fix the largest measured performance defect. In parallel, delete the
memory-foam claims — that one is a correctness issue, not an optimization.

## Sequencing

Content written before the site is crawlable earns nothing. The plan is
dependency-ordered for that reason:

```
Phase 1  Stop the bleeding      days      compression, images, broken CTA, ratings
Phase 2  Make it indexable      1-2 wks   prerender, per-route meta, sitemap, schema
Phase 3  Content                ongoing   rewrite 4 articles, topic clusters, specs
Phase 4  Trust & conversion     ongoing   reviews, local SEO, warranty as centrepiece
```

## Before Phase 1 ships

**No analytics implementation exists in the frontend.** Nothing is currently being
measured, so none of these improvements will be provable. Install GA4 or an
Iran-accessible equivalent first — the baseline table in the plan's *What to
measure* section is the set of numbers to capture.

## Known gaps

The marketing context is **~60% complete**. Five sections are placeholders because
they need information only the business owner has:

- Named competitors (§5)
- Real sales objections (§7)
- Customer verbatims (§9) — sample from warranty registrants; they are verified
  buyers with contact details
- Proof metrics and testimonials (§12)
- Confirmed primary business goal (§14)

A single 30-minute owner conversation closes gaps 2–4.

**Note on the validator:** `marketing-context`'s `context_validator.py` scores this
file 71/100, but it is a keyword-marker counter, not a quality check — it scores the
empty Competitive Landscape section 10/10 purely because the words "direct",
"competitor" and "secondary" appear. Trust the ~60% figure and the gap list above,
not the 71. (The script also crashes on Windows unless run with `PYTHONUTF8=1`; it
calls `read_text()` with no encoding and dies on the Persian text.)
