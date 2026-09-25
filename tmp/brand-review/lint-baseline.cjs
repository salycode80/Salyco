const {execFileSync}=require('child_process');
const path=require('path');
const {ESLint}=require('../../Frontend/salyco-front/node_modules/eslint');
(async()=>{
 const cwd=path.resolve('Frontend/salyco-front'); const eslint=new ESLint({cwd});
 const files=execFileSync('git',['-c','safe.directory=E:/salyco-fullstack','diff','--name-only'],{encoding:'utf8'}).trim().split('\n').filter(f=>f.startsWith('Frontend/salyco-front/src/')&&/\.(jsx|js)$/.test(f));
 let added=[];
 for(const f of files){
  const original=execFileSync('git',['-c','safe.directory=E:/salyco-fullstack','show','HEAD:'+f],{encoding:'utf8'});
  const [before]=await eslint.lintText(original,{filePath:path.resolve(f)});
  const [after]=await eslint.lintFiles(path.resolve(f));
  const key=m=>m.ruleId+':'+m.message;
  const counts=new Map();for(const m of before.messages)counts.set(key(m),(counts.get(key(m))||0)+1);
  for(const m of after.messages){const k=key(m);if(counts.get(k))counts.set(k,counts.get(k)-1);else added.push({file:f,rule:m.ruleId,line:m.line,message:m.message.slice(0,120)});}
 }
 console.log(JSON.stringify({checked:files.length,newDiagnostics:added},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
