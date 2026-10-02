#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const sdk=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const digestText=data=>createHash('sha256').update(data.toString('utf8').replace(/\r\n/g,'\n')).digest('hex');
const HELP=`mdapi: offline Genesis Lua API lookup

  mdapi spr          exact lookup
  mdapi sprite       search
  mdapi SPR          ignore case
  mdapi --list       public names
  mdapi --index      category index
  mdapi --category graphics
  mdapi --category input button
  mdapi --help

Categories: graphics, input, audio,
map, system, math, data, string,
storage, lifecycle.

Pipe to a pager if desired:
  mdapi spr | less

In mdedit: F6 suspends Nano.
Run mdapi or mdlookup, then fg.
No Internet or ROM build is used.

SGDK entries describe compiler bindings,
not a promise of runtime compatibility.
Exit: 0 found, 1 no match, 2 usage/data.
`;
export function wrap(text,width=40){
 return String(text).split('\n').map(line=>{
  const words=line.trim().split(/\s+/);let out=[],current='';
  for(let word of words){
   if(current.length+word.length+1>width&&current){out.push(current);current='';}
   while(word.length>width){if(current){out.push(current);current='';}out.push(word.slice(0,width));word=word.slice(width);}
   if(word)current+=(current?' ':'')+word;
  }
  if(current||!out.length)out.push(current);return out.join('\n');
 }).join('\n');
}
export function search(entries,query,category){
 const q=query.toLowerCase(),tokens=q.split(/\s+/).filter(Boolean);
 return entries.filter(e=>!category||e.category===category).map(e=>{
  const name=e.name.toLowerCase(),aliases=e.aliases.map(a=>a.toLowerCase());
  const text=[e.name,...e.aliases,e.description,e.category,...e.keywords].join(' ').toLowerCase();
  let score=name===q?1000:aliases.includes(q)?950:name.startsWith(q)?800:name.includes(q)?600:tokens.every(t=>text.includes(t))?200:0;
  if(score&&e.status==='available'&&!e.keywords.includes('sgdk'))score+=10;
  return {entry:e,score};
 }).filter(x=>x.score).sort((a,b)=>b.score-a.score||a.entry.name.localeCompare(b.entry.name,'en'));
}
export function formatEntry(e,width=40){
 const out=[e.signature,`[${e.category}; ${e.status}]`,e.description];
 if(e.aliases.length)out.push('Aliases: '+e.aliases.join(', '));
 if(e.overloads.length)out.push('Forms:\n'+e.overloads.join('\n'));
 if(e.params.length)out.push('Parameters:\n'+e.params.map(p=>`${p.name}${p.optional?' (optional)':''}: ${p.description}${p.cType?' C: '+p.cType+'.':''}`).join('\n'));
 out.push('Returns:\n'+e.returns);
 if(e.cReturns)out.push('SGDK return notes:\n'+e.cReturns);
 if(e.notes.length)out.push('Notes:\n'+e.notes.join('\n'));
 out.push(e.example?'Example (snippet):\n'+e.example:e.exampleNote);
 out.push('Source:\n'+e.source,'Reference:\n'+e.reference);
 return out.map(section=>wrap(section,width)).join('\n\n')+'\n';
}
export function run(args,api,width=40){
 if(args.length===1&&args[0]==='--index'){
  const available=api.entries.filter(e=>e.status!=='unsupported');
  const categories=[...new Set(available.map(e=>e.category))].sort();
  return {code:0,text:wrap('API index\n\n'+categories.map(c=>':'+c+' ('+available.filter(e=>e.category===c).length+')').join('\n')+'\n:all ('+available.length+')\n\nIn mdlookup, enter :graphics etc.\nThen enter a listed function name.\n? shows this index again.\n\nFrom the shell:\nmdapi --category graphics\nmdapi --list',width)+'\n'};
 }
 if(args.some(a=>!a.trim()))return {code:2,text:'Search cannot be empty. Use mdapi --help.\n'};
 let list=false,category=null,query=[];
 for(let i=0;i<args.length;i++){
  const a=args[i];
  if(a==='--help'||a==='-h'){if(args.length!==1)return {code:2,text:'Use mdapi --help by itself.\n'};return {code:0,text:wrap(HELP,width)+'\n'};}
  if(a==='--list'){if(list)return {code:2,text:'Duplicate --list.\n'};list=true;}
  else if(a==='--category'){
   if(category||!args[i+1]||args[i+1].startsWith('-'))return {code:2,text:'--category needs one category.\n'};
   category=args[++i].toLowerCase();
  }else if(a.startsWith('-'))return {code:2,text:'Unknown option: '+a+'\nUse mdapi --help.\n'};
  else query.push(a);
 }
 if(!args.length)return {code:0,text:wrap(HELP,width)+'\n'};
 if(category&&!api.entries.some(e=>e.category===category))return {code:2,text:'Unknown category: '+category+'\nUse mdapi --help.\n'};
 if(list&&query.length)return {code:2,text:'Use --list without a search query.\n'};
 const q=query.join(' ').trim();
 if(list||!q){const entries=api.entries.filter(e=>e.status!=='unsupported'&&(!category||e.category===category));return {code:0,text:wrap(`${entries.length} entries${category?' in '+category:''}.\n`+entries.map(e=>e.name+(e.status!=='available'?' ['+e.status+']':'')).join('\n'),width)+'\n'};}
 const matches=search(api.entries,q,category);
 if(!matches.length)return {code:1,text:wrap(`No API match for "${q}".\nTry a shorter term, --list, or --category graphics.`,width)+'\n'};
 const exact=matches.find(x=>x.entry.name.toLowerCase()===q.toLowerCase());
 if(exact||matches.length===1)return {code:0,text:formatEntry((exact||matches[0]).entry,width)};
 const shown=matches.slice(0,30);
 return {code:0,text:wrap(`${matches.length} matches${matches.length>shown.length?'; first '+shown.length+' shown':''}:\n`+shown.map(({entry:e})=>e.name+' ['+e.category+(e.status==='unsupported'?'; unsupported':'')+']').join('\n')+'\n\nLookup: mdapi NAME\nNarrow with a longer term or --category.',width)+'\n'};
}
const invokedFile=process.argv[1]&&fs.realpathSync(process.argv[1]);
if(invokedFile&&invokedFile===fs.realpathSync(fileURLToPath(import.meta.url))){
 process.stdout.on('error',e=>{if(e.code==='EPIPE')process.exit(0);throw e;});
 try{
  const width=Math.max(24,Math.min(80,Number(process.env.COLUMNS)||process.stdout.columns||40));
  const args=process.argv.slice(2);
  if(!args.length||args.length===1&&['--help','-h'].includes(args[0])){process.stdout.write(wrap(HELP,width)+'\n');}
  else {
   const api=JSON.parse(fs.readFileSync(path.join(sdk,'docs/api.json'),'utf8'));
   if(api.schema!==1||!Array.isArray(api.entries))throw new Error('Invalid API metadata');
   for(const file of ['compiler/builtins.js','compiler/builtins-sgdk.js']){
    const hash=digestText(fs.readFileSync(path.join(sdk,file)));
    if(hash!==api.sources[file])throw new Error('API table changed. Regenerate with: node tools/generate-api.mjs (from SDK directory)');
   }
   const result=run(args,api,width);process.stdout.write(result.text);process.exitCode=result.code;
  }
 }catch(e){console.error('mdapi: '+e.message);process.exitCode=2;}
}
