const fs = require('fs');
const path = require('path');
const root = 'Frontend/salyco-front';
const colors = {'003087':'brand-navy','009CDE':'brand-navy','00246B':'action-hover','687173':'text-secondary','1A1A2E':'text-primary','CBD2D6':'brand-mist','E5E9EB':'brand-mist','F5F7FA':'brand-warm-white','D20000':'status-error','A80000':'status-error','FDE7E7':'status-error-bg','019C34':'status-success','017a29':'status-success','E6F4EA':'status-success-bg','FFF8E1':'status-warning-bg','F5BA2E':'status-warning','B8860B':'status-warning','E6F0FB':'status-info-bg','E7F3FB':'status-info-bg','F0F8FC':'status-info-bg'};
function walk(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]); }
for (const file of walk(root+'/src').filter(f=>/\.(jsx|js)$/.test(f))) {
 let s=fs.readFileSync(file,'utf8'), before=s;
 for(const [hex,token] of Object.entries(colors)) s=s.replace(new RegExp('\\[#'+hex+'\\]','gi'),token);
 s=s.replace(/rgba\(0,\s*48,\s*135,/g,'rgba(5,46,95,').replace(/rgba\(0,\s*156,\s*222,/g,'rgba(5,46,95,').replace(/rgba\(245,\s*186,\s*46,/g,'rgba(228,229,226,');
 s=s.replace(/max-w-7xl|max-w-\[1400px\]/g,'max-w-[1200px]');
 s=s.replace(/\b(?:hover:-translate-y-(?:0\.5|1|2)|group-hover:scale-\[1\.03\]|hover:scale-105)\b/g,'');
 s=s.replace(/fill-status-warning text-status-warning/g,'fill-brand-navy text-brand-navy');
 if(s!==before) fs.writeFileSync(file,s);
}
function edit(file,fn){const p=root+'/'+file; fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));}
edit('index.html',s=>s.replace('<html lang="fa">','<html lang="fa" dir="rtl">').replace('#003087','#052E5F'));
for(const f of ['ProductList','ProductsIndex','Mattress']) edit('src/pages/'+f+'.jsx',s=>s.replace('grid grid-cols-2 gap-3 sm:gap-8 md:grid-cols-3 lg:grid-cols-4','grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3').replace('grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4','grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3'));
for(const f of ['ProductCard','MattressCard']) edit('src/components/product/'+f+'.jsx',s=>s.replace('aspect-[4/3] overflow-hidden bg-brand-navy','aspect-[4/3] overflow-hidden bg-white').replace('object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]','object-contain p-4').replace(/\s*<div className="absolute inset-0 bg-gradient-to-t[^\n]+\/>/,'').replace('border-white/20 bg-white/10','border-brand-mist bg-white/95').replace('tracking-wide text-white @[280px]:text-xs','text-brand-navy @[280px]:text-xs').replace('bg-white/15 text-white/90','bg-brand-warm-white text-brand-navy').replace('bg-status-error px-2 py-1','bg-brand-navy px-2 py-1'));
edit('src/components/product/ProductGallery.jsx',s=>s.replace('aspect-square w-full','aspect-[4/3] w-full').replaceAll('object-cover','object-contain'));
edit('src/components/SearchBar.jsx',s=>s.replace('نتیجه‌ای برای «{q}» یافت نشد.','نتیجه‌ای برای «{q}» یافت نشد. نام مدل دیگری را امتحان کنید.'));
