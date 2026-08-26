# Task — Rewrite Salyco Product Content

**Scope:** every text field on both live products, read from
`GET /api/mattresses/<slug>/` on 2026-08-26.
**Companion:** evidence in [`salyco-site-audit.md`](./salyco-site-audit.md) §5, §5b.

Ordered by severity. **Task 1 is not a copy improvement — it is a factual
correction. Do it first, this week.**

---

## Task 1 — Delete the memory-foam content from Emperial 🔴 Critical

Emperial is a **spring** mattress: `نوع تشک: طبی فنری`, micro-bonnell coil core,
2.2 mm wire. Its FAQs and pros/cons were pasted from a **memory-foam** product and
assert things the mattress does not have.

### Delete outright

| Field | Why |
|---|---|
| FAQ 1 — `آیا تشک مموری فوم برای کمردرد...` | About memory foam. Product has none. |
| FAQ 2 — `...در تابستان داغ می‌شود؟` | Claims **Cool Gel** and **Open Cell**. Neither is in the build. |
| FAQ 3 — `آیا این تشک بوی شیمیایی دارد؟` | Claims **OEKO-TEX** certification. Not in the spec sheet — do not publish unless the certificate exists. |
| PRO 1 — `ایزوله‌ی کامل حرکت` | **Contradicts its own construction.** Micro-bonnell coils are interconnected — the weakest spring type for motion isolation. |
| PRO 2 — `قابلیت مموری فوم در تطابق با انحنای بدن` | Credits memory foam. |
| PRO 3 — `رویه‌ی ضد حساسیت` | Not substantiated in specs. Keep only if the fabric is certified. |
| CON 1 — `لایه‌ی فوم ممکن است جذب کند` | References a foam layer. |
| CON 2 — `عمر مفید ۱۲ ساله` | 12 years contradicts the 120-month (10-year) warranty. |

**If OEKO-TEX and the anti-allergy fabric are real,** keep those two — but move them
into `specifications` where they can be verified, and cite the certificate number.

### Replace with — FAQs grounded in the actual build

```
Q: تفاوت تشک طبی فنری با تشک مموری فوم چیست؟
A: تشک امپریال از نوع طبی فنری با اسکلت میکرو بونل است، نه مموری فوم.
   در تشک فنری، وزن بدن روی شبکه‌ای از فنرهای فولادی توزیع می‌شود؛ این ساختار
   تهویه‌ی هوای بهتری دارد و در تابستان خنک‌تر می‌ماند. مموری فوم با حرارت بدن
   فرم می‌گیرد اما گرما را بیشتر نگه می‌دارد. امپریال با پد اسفنج فشرده روی
   اسکلت فنری، بخشی از مزیت هر دو را ترکیب می‌کند.

Q: حداکثر وزن قابل تحمل این تشک چقدر است؟
A: ۱۸۰ کیلوگرم. اسکلت میکرو بونل با مفتول ۲.۲ میلی‌متر و Frame تقویت‌شده با
   مفتول ۴ میلی‌متر که با ۱۰ عدد جک M تثبیت شده، این ظرفیت را تأمین می‌کند.

Q: درجه سفتی ۵ برای چه کسانی مناسب است؟
A: سفتی ۵ سفت‌ترین گزینه‌ی سالیکو است و برای وزن بالای ۹۰ کیلوگرم، خواب به پشت،
   یا کسانی که با توصیه‌ی پزشک به تشک سفت نیاز دارند مناسب است. اگر وزن شما زیر
   ۷۰ کیلوگرم است یا به پهلو می‌خوابید، مدل پرستیژ با سفتی ۳ گزینه‌ی بهتری است.

Q: آیا این تشک در تابستان گرم می‌شود؟
A: ساختار فنری امپریال فضای خالی بین فنرها دارد که جریان هوا را ممکن می‌کند،
   و رویه از پارچه‌ی نخی گردبافت با خاصیت ضدتعریق تولید شده است. تشک‌های فنری
   عموماً از تشک‌های تمام‌فوم خنک‌تر هستند.

Q: گارانتی ۱۰ ساله دقیقاً چه چیزی را پوشش می‌دهد؟
A: ۱۲۰ ماه گارانتی تعویض بی‌قید و شرط. برای فعال‌سازی، شماره سریال تشک را در
   بخش ثبت گارانتی سایت وارد کنید.
```

Five FAQs, every claim traceable to the spec sheet or the warranty. This is also
the `FAQPage` schema source for plan §2.4.

### Replace with — honest pros/cons

```
PRO  تحمل وزن تا ۱۸۰ کیلوگرم — اسکلت میکرو بونل با مفتول ۲.۲ میلی‌متر و
     Frame تقویت‌شده‌ی ۴ میلی‌متری
PRO  تهویه‌ی بهتر نسبت به تشک‌های تمام‌فوم — فضای بین فنرها جریان هوا را
     ممکن می‌کند و رویه‌ی گردبافت ضدتعریق است
PRO  پد اسفنج فشرده روی اسکلت فنری، گودی کمر را پر می‌کند و انحنای طبیعی
     ستون فقرات را حفظ می‌کند
PRO  ۱۲۰ ماه گارانتی تعویض بی‌قید و شرط
CON  سفتی ۵ برای خواب به پهلو یا وزن زیر ۷۰ کیلوگرم سفت‌تر از حد لازم است —
     در این شرایط مدل پرستیژ (سفتی ۳) مناسب‌تر است
CON  تشک فنری لرزش را بیشتر از مموری فوم منتقل می‌کند؛ اگر حرکت هم‌خواب
     شما را بیدار می‌کند، این را در نظر بگیرید
CON  وزن تشک بالاست و جابه‌جایی آن به دو نفر نیاز دارد
```

The two CONs are real and specific. **A CON that names the sibling product is a
conversion tool, not a liability** — it moves a mismatched buyer to the product
that fits instead of losing the sale or earning a return.

---

## Task 2 — Fix the description that names the wrong product 🔴 Critical

Inside **Emperial's** `long_description`:

> پد داخلی **پرستیژ** از الیاف فشرده پلی‌استر با وزن ۱۴۰۰ گرم تولید شده است

Change `پرستیژ` → `امپریال`. One word, on the flagship product page.

Then read both `long_description` fields end to end — they were clearly built from
one another and this is unlikely to be the only leak.

---

## Task 3 — Fix the headline price 🔴 Critical

`price` is the **cheapest size**, while `width`/`length` describe a Queen:

| | Declared size | Headline price | True price at that size | Understated |
|---|---|---:|---:|---:|
| Emperial | 160×200 | 27,000,000 | 34,000,000 | 26% |
| Prestige | 160×200 | 19,000,000 | 26,000,000 | 37% |

Pick one:

- **A (recommended)** — label it: `از ۲۴,۳۰۰,۰۰۰ تومان` and default the size
  selector to تکنفره so headline and selection agree.
- **B** — key the headline to the declared `width×length` (Queen), showing
  30,600,000.

Either is defensible. The current state — a Queen-sized product shown at the
single-bed price with no "from" — sets an expectation checkout then breaks.

---

## Task 4 — Delete the test review 🔴 Critical

The flagship's entire public rating comes from one row:

```json
{"customer_name": "امیررضا سلامت", "rating": 2,
 "title": "عالی", "body": "عالی", "pros": "", "cons": ""}
```

A 2-star score whose text reads *"excellent"*, from the name credited in the footer
as the site's developer. **This is a smoke test, and it is the only thing setting
Emperial to 2.00 stars.**

1. Delete the row.
2. Suppress the rating widget while `review_count < 3` — show
   `هنوز امتیازی ثبت نشده` instead.
3. **Never render a rating when `review_count == 0`** (Prestige currently shows
   5.00 from zero).
4. Do not emit `AggregateRating` schema until `review_count >= 3`.

---

## Task 5 — Bring Prestige up to parity 🟠 High

Prestige has **0 features, 0 FAQs, 0 pros/cons, 1 image, 4 specs** — for a product
only 30% cheaper than Emperial. Its page cannot convert or rank.

Write, mirroring Task 1's structure but true to **firmness 3, height 24 cm**:

- **3–4 features** — same shape as Emperial's, honest to a softer build.
- **5 FAQs** — lead with the one buyers actually have:
  `تفاوت پرستیژ و امپریال چیست؟ کدام را انتخاب کنم؟` Answer it as a decision rule:
  *firmness 3 vs 5, 24 cm vs 31 cm, by body weight and sleep position.* This single
  FAQ resolves the site's most common purchase decision.
- **4 PRO / 2–3 CON** — the honest CON is that firmness 3 is under-supportive
  above ~90 kg, which routes that buyer to Emperial.
- **2–3 more gallery images**, including a layer cross-section (Emperial has
  `empralayers.png`; Prestige has no equivalent).

---

## Task 6 — Normalize the spec tables 🟠 High

The same spring is described three different ways, so the two products cannot be
compared:

| | Emperial | Prestige |
|---|---|---|
| Spring | `نوع فنرها = High Micro` | `نوع اسکلت = میکرو بونل` + `قطر مفتول فنر = 2.2 mm` |

Adopt one key set across both, in one order:

```
نوع تشک              طبی فنری
نوع اسکلت            میکرو بونل
قطر مفتول فنر        ۲.۲ میلی‌متر
قطر مفتول Frame      ۴ میلی‌متر
لایه محافظ           نمد ترموفلت ۱۱۰۰ گرم (دو طرف)
پد داخلی             الیاف فشرده پلی‌استر ۱۴۰۰ گرم
جنس رویه             پارچه نخی گردبافت، ضدتعریق
ضخامت تشک            ۳۱ سانتی‌متر        ← Emperial (Prestige: ۲۴)
درجه سفتی            ۵ از ۵              ← Emperial (Prestige: ۳ از ۵)
حداکثر تحمل وزن      ۱۸۰ کیلوگرم
گارانتی              ۱۲۰ ماه تعویض بی‌قید و شرط
```

Fixes in passing:

- `ضخامت تشک = "31"` → `۳۱ سانتی‌متر` (unit missing).
- `پد رویی فنر = "گرم1400 الیاف فشرده پلی استر"` → `الیاف فشرده پلی‌استر ۱۴۰۰ گرم`
  (digits reversed onto the unit; `پلی استر` missing its ZWNJ).
- Set real `display_order` values — currently `0` on every Prestige spec and every
  Emperial pros/cons row, so render order is undefined.

---

## Task 7 — Add firmness in words 🟠 High

`firmness` ships as a bare integer (`5`, `3`). Nobody buys a `3`. Add a label and a
weight guide to every product page:

| Firmness | Label | Suits |
|---|---|---|
| 1–2 | نرم | زیر ۶۰ کیلوگرم، خواب به پهلو |
| 3 | متعادل | ۶۰–۹۰ کیلوگرم، خواب به پهلو یا مختلط — **پرستیژ** |
| 4 | نسبتاً سفت | ۸۰–۱۰۰ کیلوگرم، خواب به پشت |
| 5 | سفت | بالای ۹۰ کیلوگرم، خواب به پشت، توصیه‌ی پزشکی — **امپریال** |

This table is also the answer to `تشک سفت یا نرم` — the existing article that
currently answers it in 230 untagged words (plan §3.1).

---

## Task 8 — Fill gallery alt text 🟡 Medium

All four gallery images have `alt_text: ""`, and **none is marked `is_primary`**.

```
main.png          تشک طبی فنری سالیکو مدل امپریال، نمای کامل  [is_primary ✓]
empra5.png        نمای نزدیک رویه گردبافت تشک امپریال سالیکو
empralayers.png   برش مقطعی لایه‌های داخلی تشک امپریال: اسکلت میکرو بونل،
                  نمد ترموفلت و پد پلی‌استر
prestige1.png     تشک طبی فنری سالیکو مدل پرستیژ، نمای کامل  [is_primary ✓]
```

Then make `alt_text` required in the admin form so the next upload can't ship blank.

---

## Task 9 — Rewrite the subtitles 🟡 Medium

Both subtitles are the same sentence with the model name swapped, and both waste
the slot on the warranty — which already has its own badge, spec row, and feature.

| | Now | Proposed |
|---|---|---|
| Emperial | `تشک سالیکو مدل امپریال به همراه 10 سال گارانتی` | `سفت‌ترین تشک سالیکو — تحمل وزن تا ۱۸۰ کیلوگرم، ضخامت ۳۱ سانتی‌متر` |
| Prestige | `تشک سالیکو مدل پرستیژ به همراه 10 سال گارانتی` | `سفتی متعادل برای خواب به پهلو — ضخامت ۲۴ سانتی‌متر` |

Each now says who the product is for and how it differs from its sibling. Also fix
`10 سال` → `۱۰ سال` (Persian numerals in prose, per the style guide).

---

## Task 10 — Retire or populate `material` 🟡 Medium

`material` is `""` on both products while `specifications` carries the real
material data. Either populate it as a one-line summary
(`فنر فولادی، الیاف پلی‌استر، اسفنج فشرده، رویه نخی گردبافت`) for use in listing
cards and schema, or drop it from the serializer. Right now it is a field that
looks missing but isn't.

Same call on `is_washable` (`false`, never surfaced) and `trial_nights` (`0` — see
plan §4 on whether to offer a trial at all).

---

## Order of work

| Priority | Tasks | Why |
|---|---|---|
| **This week** | 1, 2, 3, 4 | False product claims, a wrong product name on the flagship, a 26–37% price understatement, and a developer's test review setting the public rating |
| **Next** | 5, 6, 7 | Prestige can't convert as-is; specs aren't comparable; firmness is unreadable |
| **Then** | 8, 9, 10 | Real gains, no correctness risk |

## Keep as-is

Do not rewrite these — they are the best product content on the site:

- **Both `long_description` fields.** The micro-bonnell / 2.2 mm wire / 4 mm frame /
  10 M-jacks / 1,100 g thermofelt / 1,400 g polyester breakdown is exactly the
  specificity this category needs and most Iranian competitors don't publish. Fix
  the `پرستیژ` slip (Task 2) and leave the rest alone.
- **The six-size price ladder** on both products — complete, coherent, in stock.
- **Emperial's three features** — `تهویه هوای عالی`, `مقاوم در برابر گود شدن`,
  `پشتیبانی از انحنای ستون فقرات`. All three are true to the build. Mirror this
  shape for Prestige.
- `گارانتی و خدمات = 10 سال گارانتی تعویض بی‌قید و شرط` — the strongest single line
  in the catalogue. Promote it, don't touch it.

## Verify after

```bash
curl -sS -L https://salyco.ir/api/mattresses/tsh-slo-mdl-shmrh-1/ \
  | PYTHONUTF8=1 python -c "import sys,json;d=json.load(sys.stdin);\
print('faqs',len(d['faqs']),'pros_cons',len(d['pros_cons']),\
'reviews',len(d['reviews']),'rating',d['rating'])"
```

Expect: no `مموری فوم` anywhere in Emperial's payload, no `OEKO-TEX` unless
certified, `reviews: 0`, and no rating rendered.
