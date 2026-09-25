from pathlib import Path
import pdfplumber

# Copy the approved vector outlines, including the wordmark, without redrawing.
page = pdfplumber.open('Salyco-Brand-Guide.pdf').pages[1]
curves = [c for c in page.curves if c['x0'] > 40 and c['x1'] < 185 and c['top'] > 130 and c['bottom'] < 270]
assert len(curves) == 11
for variant, ink in [('navy', '#052E5F'), ('white', '#FFFFFF')]:
    paths = []
    for curve in curves:
        color = curve['non_stroking_color']
        # White counter-shapes become transparent cutouts through evenodd paths.
        if isinstance(color, (tuple, list)) and min(color) > .95:
            continue
        d = ' '.join(('Z' if op[0] == 'h' else op[0].upper()) + ' ' + ' '.join(f'{v:.4f}' for point in op[1:] for v in point) for op in curve['path'])
        paths.append(d)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 130 148 144"><title>سالیکو</title><path fill="{ink}" fill-rule="evenodd" d="' + ' '.join(paths) + '"/></svg>\n'
    Path(f'Frontend/salyco-front/public/salyco-logo-{variant}.svg').write_text(svg, encoding='utf-8')
