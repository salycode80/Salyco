const fs=require('fs');const f='Frontend/salyco-front/src/components/FeaturedProducts.jsx';
let s=fs.readFileSync(f,'utf8').replaceAll('\r\n','\n');
s=s.replace(/  \/\/ Auto-advance[\s\S]*?  \}, \[mattresses\]\);/,'  // Product browsing stays still until the customer scrolls the track.');
s=s.replaceAll('w-[calc((100%-1.5rem)/2)]','w-full md:w-[calc((100%-1.5rem)/2)]').replaceAll('sm:w-[calc((100%-4.5rem)/4)]','lg:w-[calc((100%-3rem)/3)]');
fs.writeFileSync(f,s);
