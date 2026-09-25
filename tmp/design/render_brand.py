import sys, os
import pypdfium2 as pdfium

src = r"E:\salyco-fullstack\Salyco-Brand-Guide.pdf"
out = r"E:\salyco-fullstack\tmp\design\brand"
os.makedirs(out, exist_ok=True)

doc = pdfium.PdfDocument(src)
print("pages:", len(doc))
for i in range(len(doc)):
    page = doc[i]
    # ~150 DPI: scale = 150/72
    bmp = page.render(scale=150 / 72)
    img = bmp.to_pil()
    p = os.path.join(out, f"page{i+1:02d}.png")
    img.save(p)
    print(p, img.size)
