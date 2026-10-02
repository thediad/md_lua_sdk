#!/usr/bin/env node
// Foreground, line-oriented browser. No raw terminal mode or shell job control.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {formatEntry,search,wrap} from './mdapi.mjs';
const digestText=data=>createHash('sha256').update(data.toString('utf8').replace(/\r\n/g,'\n')).digest('hex');

export function createBrowser(api,{width=40,pageSize=8,detailLines=22}={}){
 width=Math.max(24,Math.min(80,width));
 const publicEntries=api.entries.filter(e=>e.status!=='unsupported');
 const startNames=['_init','_update','_draw','btn','btnp','cls','spr','map','print','sfx','music','array','pool'];
 const startEntries=startNames.map(name=>publicEntries.find(e=>e.name===name)).filter(Boolean);
 const stack=[{kind:'home',page:0}];let message='',finished=false;
 const top=()=>stack.at(-1);
 const scopeEntries=scope=>publicEntries.filter(e=>scope==='all'||(e.keywords.includes('sgdk')?(scope==='sgdk'):(scope==='lua')));
 const push=v=>stack.push({...v,page:0});
 function choices(s){
  if(s.kind==='home')return [
   {label:'Lua game API',description:'Everyday helpers and callbacks',scope:'lua'},
   {label:'Advanced SGDK API',description:'Direct hardware/library bindings',scope:'sgdk'},
   {label:'All entries',description:'Combined alphabetical index',scope:'all'}];
  if(s.kind==='categories'){
   const entries=scopeEntries(s.scope);
   const order=['lifecycle','graphics','input','audio','map','data','math','string','storage','system'];
   const found=[...new Set(entries.map(e=>e.category))].sort((a,b)=>order.indexOf(a)-order.indexOf(b));
   return [...(s.scope==='lua'?[{label:'Start here',description:'Core APIs for a first game',category:'__start'}]:[]),{label:'All '+s.scope+' entries',description:entries.length+' entries',category:null},...found.map(c=>({label:c,description:entries.filter(e=>e.category===c).length+' entries',category:c}))];
  }
  return s.entries||[];
 }
 function entryLines(s){
  if(s.full)return formatEntry(s.entry,width).trimEnd().split('\n');
  const e=s.entry;
  const brief=e.description.length>180?e.description.slice(0,177)+'...':e.description;
  return [e.signature,`[${e.category}; ${e.status}]`,brief,
   e.example?'Example (snippet):\n'+e.example:e.exampleNote,
   e.status==='syntax'?'Compiler syntax; see More for context.':e.status==='callback'?'Define this callback; do not call it.':'',
   e.notes.length?'Notes and restrictions: press m.':'',
   'Snippets need normal game callbacks.'].filter(Boolean).map(t=>wrap(t,width)).join('\n\n').split('\n');
 }
 function render(){
  const s=top();let out=[];
  if(message)out.push(wrap(message,width));
  if(s.kind==='entry'){
   const lines=entryLines(s),pages=Math.max(1,Math.ceil(lines.length/detailLines));
   s.page=Math.min(s.page,pages-1);
   out.push(wrap(`${s.entry.name} - ${s.full?'Details':'Quick view'} ${s.page+1}/${pages}`,width),'',...lines.slice(s.page*detailLines,(s.page+1)*detailLines),'','m: more/quick  n/p: page  b: back','/: search  q: finish');
  }else{
   const items=choices(s),pages=Math.max(1,Math.ceil(items.length/pageSize));s.page=Math.min(s.page,pages-1);
   const title=s.kind==='home'?'Genesis Lua API':s.kind==='categories'?`${s.scope} categories`:s.title;
   out.push(wrap(`${title} (${s.page+1}/${pages})`,width),'');
   if(!items.length)out.push('No matches. Try another search.');
   items.slice(s.page*pageSize,(s.page+1)*pageSize).forEach((e,i)=>{
    out.push(wrap(`${i+1} ${e.label||e.name}`,width));
    const d=e.description||'';
    out.push('  '+(d.length>width-2?d.slice(0,width-5)+'...':d));
   });
   out.push('','Number: open  n/p: page  b: back','/: search  ?: home  q: finish');
  }
  return out.map(l=>wrap(l,width)).join('\n')+'\n';
 }
 function find(query){
  const s=top();const scope=s.scope||'all';
  const matches=search(api.entries,query).map(x=>x.entry).filter(e=>scope==='all'||(e.keywords.includes('sgdk')?scope==='sgdk':scope==='lua'));
  const exact=matches.find(e=>e.name.toLowerCase()===query.toLowerCase());
  if(exact||matches.length===1)push({kind:'entry',entry:exact||matches[0],scope,full:false});
  else push({kind:'list',entries:matches,title:'Search: '+query,scope});
 }
 function input(raw){
  message='';const command=raw.trim(),s=top();
  if(command==='q'){finished=true;return;}
  if(command==='b'){if(stack.length>1)stack.pop();return;}
  if(command==='?'||command===':index'){stack.splice(1);return;}
  if(command==='n'||command==='p'){
   const count=s.kind==='entry'?Math.ceil(entryLines(s).length/detailLines):Math.ceil(choices(s).length/pageSize);
   s.page=Math.max(0,Math.min(Math.max(0,count-1),s.page+(command==='n'?1:-1)));return;
  }
  if(command==='m'&&s.kind==='entry'){s.full=!s.full;s.page=0;return;}
  if(command===':all'){push({kind:'list',entries:publicEntries,title:'All entries',scope:'all'});return;}
  if(command.startsWith(':')){
   const category=command.slice(1).toLowerCase(),entries=publicEntries.filter(e=>e.category===category);
   if(entries.length)push({kind:'list',entries,title:category,scope:'all'});else message='Unknown category. Use ? for the index.';return;
  }
  if(/^\d+$/.test(command)&&s.kind!=='entry'){
   const i=Number(command)-1,item=choices(s)[s.page*pageSize+i];
   if(i<0||i>=pageSize||!item){message='Choose a number shown on this page.';return;}
   if(s.kind==='home')push({kind:'categories',scope:item.scope});
   else if(s.kind==='categories')push({kind:'list',entries:item.category==='__start'?startEntries:scopeEntries(s.scope).filter(e=>!item.category||e.category===item.category),scope:s.scope,title:item.label});
   else push({kind:'entry',entry:item,scope:s.scope,full:false});return;
  }
  if(command==='/')return 'search';
  if(command.startsWith('/')){if(command.slice(1).trim())find(command.slice(1).trim());return;}
  if(command)find(command);else message='Use q to finish, or b to go back.';
 }
 return {render,input,find,get finished(){return finished;}};
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length>1||args[0]?.startsWith('-')&&!['--help','-h'].includes(args[0]))throw new Error('Usage: mdlookup [query]');
 if(['--help','-h'].includes(args[0])){console.log('mdlookup [query]\nNumber: open; n/p: page; b: back; m: details\n/: search; ?: home; q: finish; then fg to resume Nano.');return;}
 const sdk=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
 const api=JSON.parse(fs.readFileSync(path.join(sdk,'docs/api.json'),'utf8'));
 if(api.schema!==1||!Array.isArray(api.entries))throw new Error('Invalid API metadata');
 for(const f of ['compiler/builtins.js','compiler/builtins-sgdk.js'])if(digestText(fs.readFileSync(path.join(sdk,f)))!==api.sources[f])throw new Error('API table changed; regenerate with node tools/generate-api.mjs');
 const browser=createBrowser(api,{width:Number(process.env.COLUMNS)||process.stdout.columns||40});
 if(args[0])browser.find(args[0]);
 const rl=readline.createInterface({input:process.stdin,terminal:false});
 let searching=false;
 process.stdout.write(browser.render()+'Select: ');
 try{for await(const line of rl){
  if(searching){if(line.trim())browser.find(line.trim());searching=false;}
  else if(browser.input(line)==='search'){searching=true;process.stdout.write('Search: ');continue;}
  if(browser.finished)break;
  process.stdout.write('\n'+browser.render()+'Select: ');
 }}finally{rl.close();}
 console.log('\nBack at the shell. Type fg to resume Nano.');
}
const invokedFile=process.argv[1]&&fs.realpathSync(process.argv[1]);
if(invokedFile&&invokedFile===fs.realpathSync(fileURLToPath(import.meta.url))){
 process.stdout.on('error',e=>{if(e.code==='EPIPE')process.exit(0);throw e;});
 main().catch(e=>{console.error('mdlookup: '+e.message);process.exitCode=2;});
}
