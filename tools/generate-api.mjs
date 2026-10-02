// Offline inventory: compiler descriptors own membership and argument kinds.
// Header documentation and api-notes.json enrich entries, never add bindings.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const defaultSdk=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const digest=b=>createHash('sha256').update(Buffer.isBuffer(b)?b.toString('utf8').replace(/\r\n/g,'\n'):String(b).replace(/\r\n/g,'\n')).digest('hex');
const categories=new Set(['graphics','input','audio','map','system','math','data','string','storage','lifecycle']);
const returns={void:'No return value.',int:'Integer.',fixed:'16.16 fixed-point number.',bool:'Boolean.',same:'Numeric result; integer/fixed representation follows the arguments.',array:'Fixed-capacity array.',pool:'Fixed-capacity entity pool.',str:'Compile-time string.'};
const kinds={int:'Integer; fractional numeric arguments are floored.',coord:'Pixel coordinate; fractional numeric arguments are floored.',color:'PICO-style palette index 0-15.',num:'16.16 number.',flip:'Boolean or numeric flag.',optr:'Opaque pointer handle from a compatible API; not an arbitrary number.',fn:'Bare name of a top-level Lua callback function.',str:'String literal/static string.',array8:'Top-level array8 variable.',value:'See function-specific notes.'};
const common={x:'Horizontal pixel position.',y:'Vertical pixel position.',x0:'First horizontal pixel coordinate.',y0:'First vertical pixel coordinate.',x1:'Second horizontal pixel coordinate.',y1:'Second vertical pixel coordinate.',sx:'Source horizontal position.',sy:'Source vertical position.',dx:'Destination horizontal position.',dy:'Destination vertical position.',sw:'Source width in pixels.',sh:'Source height in pixels.',dw:'Destination width in pixels.',dh:'Destination height in pixels.',cx:'Source map column.',cy:'Source map row.',cw:'Map width in cells.',ch:'Map height in cells.',radius:'Radius in pixels.',color:'Palette index; omitted drawing color uses current color unless noted.',slot:'Animation or SRAM slot; see function description.',sample:'Zero-based WAV-bank index.',song:'Zero-based music-bank index; -1 stops playback.',loop:'Repeat playback flag; check documented defaults.',capacity:'Constant storage capacity.',count:'Requested byte count.',data:'Top-level array8 variable.',turns:'Angle in turns; 1 is a full circle.',first:'First frame or string index; see description.',last:'Last frame or string index; see description.',fps:'Animation frames per second.',container:'Top-level array or entity pool as appropriate.',hex:'Even-length hexadecimal string literal.',text:'Static string.',index:'1-based constant string position.',byte:'Constant byte value, 0-255.',bits:'Shift count.'};
function clean(s){return s.replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/[\\@](?:ref|a|b|c|p)\s+/g,'').replace(/\s+/g,' ').trim();}
function doxygen(source,line){
 const before=source.split('\n').slice(0,line-1).join('\n');
 const end=before.lastIndexOf('*/'),start=before.lastIndexOf('/**',end);
 if(start<0||end<start||before.slice(end+2).trim())return {params:{}};
 const text=before.slice(start+3,end).split('\n').map(l=>l.replace(/^\s*\*\s?/,'' )).join('\n');
 const sections=[...text.matchAll(/[\\@](brief|param|return|returns|note|see|warning)\b([^]*?)(?=[\\@](?:brief|param|return|returns|note|see|warning)\b|$)/g)];
 const result={params:{},notes:[]};
 for(const [,tag,body] of sections){
  if(tag==='param'){const m=body.trim().match(/^(?:\[[^\]]+\]\s*)?(\w+)\s*([^]*)/);if(m)result.params[m[1]]=clean(m[2]);}
  else if(tag==='brief')result.description=clean(body);
  else if(tag.startsWith('return'))result.returns=clean(body);
  else result.notes.push(clean(body));
 }
 return result;
}
function category(name,header=''){
 if(/^(JOY_|KEY_|MOUSE_)/.test(name)||/joy/.test(header))return 'input';
 if(/^(SND_|XGM|PSG_|Z80_|YM2612_)/.test(name)||header.startsWith('snd/'))return 'audio';
 if(/^(MAP_|VDP_.*(?:Map|Scroll))/.test(name)||/^map/.test(header))return 'map';
 if(/^(VDP_|SPR_|BMP_|PAL_|DMA_|VRAM_)/.test(name)||/vdp|sprite|bmp|palette/.test(header))return 'graphics';
 if(/^SRAM_/.test(name)||/sram/.test(header))return 'storage';
 if(/math|trigo/.test(header))return 'math';
 if(/string/.test(header))return 'string';
 return 'system';
}
export function validateApi(api,expectedNames){
 if(api.schema!==1||!Array.isArray(api.entries))throw new Error('Invalid API schema');
 const names=new Set();
 for(const e of api.entries){
  if(names.has(e.name))throw new Error('Duplicate API name: '+e.name);names.add(e.name);
  if(!/^[A-Za-z_]\w*$/.test(e.name)||!categories.has(e.category))throw new Error('Malformed name/category: '+e.name);
  if(e.signature!==makeSignature(e.name,e.params)||!e.description||!e.source)throw new Error('Malformed signature/description/source: '+e.name);
  if(!['available','unsupported','syntax','callback'].includes(e.status))throw new Error('Invalid status: '+e.name);
  for(const p of e.params)if(!/^(?:[A-Za-z_]\w*|\.\.\.)$/.test(p.name)||typeof p.optional!=='boolean'||!p.description)throw new Error('Malformed parameter: '+e.name);
 }
 for(const n of expectedNames)if(!names.has(n))throw new Error('Implemented API missing metadata: '+n);
 for(const n of names)if(!expectedNames.has(n))throw new Error('Documented API missing implementation: '+n);
 return names.size;
}
function makeSignature(name,params){return name+'('+params.map(p=>p.optional?'['+p.name+']':p.name).join(', ')+')';}
export async function buildApi(sdk=defaultSdk,notesPath=path.join(sdk,'docs/api-notes.json')){
 const {BUILTINS,CALLBACKS}=await import(pathToFileURL(path.join(sdk,'compiler/builtins.js')));
 const {buildInventory,SGDK_INCLUDE}=await import(pathToFileURL(path.join(sdk,'tools/sgdk-coverage.mjs')));
 const notes=JSON.parse(fs.readFileSync(notesPath,'utf8'));
 const checker=path.resolve(sdk,'../../luacretro/compiler/check.js');
 const parser=path.resolve(sdk,'../../luacretro/compiler/parser.js');
 // Resolve the actual dependency when the SDK is distributed independently.
 let checkPath=checker,parsePath=parser;
 if(fs.existsSync(path.join(sdk,'node_modules/luacretro/compiler/check.js'))){checkPath=path.join(sdk,'node_modules/luacretro/compiler/check.js');parsePath=path.join(sdk,'node_modules/luacretro/compiler/parser.js');}
 const checkSource=fs.readFileSync(checkPath,'utf8'),parseSource=fs.readFileSync(parsePath,'utf8');
 if(!/callee\.name === "hexdata"/.test(checkSource)||!parseSource.includes('only \'for e in all(pool)\' iteration is supported'))throw new Error('Compiler syntax changed; review hexdata/all metadata');
 const expected=new Set([...Object.keys(BUILTINS),...CALLBACKS,'hexdata','all']);
 for(const n of Object.keys(notes))if(!expected.has(n))throw new Error('Notes describe missing API: '+n);
 const inventory=buildInventory(),headers=new Map();
 const sourceHashes={};
 function record(file){const rel=path.relative(sdk,file).split(path.sep).join('/');sourceHashes[rel]=digest(fs.readFileSync(file));}
 for(const file of ['compiler/builtins.js','compiler/builtins-sgdk.js','compiler/sprite-variants.mjs','md-sdk/md_api.h','md-sdk/md_api.c','md-sdk/md_math.h','docs/api-notes.json']){
  const full=file==='docs/api-notes.json'?notesPath:path.join(sdk,file);record(full);
 }
 record(checkPath);record(parsePath);
 const emitPath=path.join(path.dirname(checkPath),'emit.js');record(emitPath);
 for(const [header,data] of Object.entries(inventory.headers)){
  const file=path.join(SGDK_INCLUDE,header),source=fs.readFileSync(file,'utf8');record(file);
  for(const fn of data.functions)if(!headers.has(fn.name))headers.set(fn.name,{...fn,header,doc:doxygen(source,fn.line)});
 }
 const entries=[];
 for(const name of [...expected].sort((a,b)=>a.localeCompare(b,'en'))){
  const b=BUILTINS[name],note=notes[name]||{},fn=b?.sgdk?headers.get(name):null;
  if(b?.sgdk&&!fn)throw new Error('No bundled header prototype for '+name);
  const rawParams=b?.params||[];
  const paramDefs=note.specialOptional?note.specialOptional.map(optional=>['value',optional]):rawParams;
  const headerParams=fn?.params||[];
  if(fn&&headerParams.length!==rawParams.length)throw new Error('Header/descriptor arity mismatch: '+name);
  if(note.names&&note.names.length!==paramDefs.length)throw new Error('Documentation/descriptor arity mismatch: '+name);
  const params=paramDefs.map(([kind,optional],i)=>{
   const c=headerParams[i],paramName=note.names?.[i]||c?.match(/([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?$/)?.[1]||'arg'+(i+1);
   return {name:paramName,kind,optional,cType:c||null,description:note.parameterDocs?.[paramName]||fn?.doc.params[paramName]||common[paramName]||kinds[kind]||'See source reference.'};
  });
  const status=note.status||note.kind||'available';
  const inferredBlocked=b?.emit&&/not implemented on Genesis/.test(b.emit.toString());
  if(inferredBlocked&&status!=='unsupported')throw new Error('Rejected descriptor must be marked unsupported: '+name);
  const aliases=b?.c&&!b.sgdk?Object.entries(BUILTINS).filter(([n,other])=>n!==name&&!other.sgdk&&other.c===b.c&&JSON.stringify(other.params)===JSON.stringify(b.params)).map(([n])=>n):[];
  const source=b?(b.sgdk?'compiler/builtins-sgdk.js':'compiler/builtins.js'):note.reference;
  const sourceText=b?fs.readFileSync(path.join(sdk,source),'utf8'):'';
  const sourceLine=b?sourceText.slice(0,sourceText.search(new RegExp('^  '+name+':','m'))).split('\n').length:null;
  const extraNotes=[note.notes,...(fn?.doc.notes||[])].filter(Boolean);
  if(b?.sgdk)extraNotes.push('Direct SGDK binding. Pointer values are opaque handles; callbacks are bare Lua function names. SGDK fix16/fix32 use raw integer representations, not automatic Lua 16.16 conversion. C documentation may mention macros or types not exposed as Lua functions. Compiler exposure is not a runtime compatibility guarantee.');
  entries.push({name,aliases,category:note.category||category(name,fn?.header),status,signature:makeSignature(name,params),params,descriptorReturn:b?.ret||null,returns:note.returns||(b?.retptr?'Opaque pointer handle.':returns[b?.ret])||(status==='callback'?'No return; called by runtime.':'Compiler syntax, not a runtime return.'),cReturns:fn?.doc.returns||null,description:note.description||fn?.doc.description||'Direct SGDK function; see bundled header for details.',notes:extraNotes,overloads:note.overloads||[],example:note.example||null,exampleNote:note.example?'':'No verified standalone Lua example yet; pointer/state prerequisites are not inferred.',source:source+(sourceLine?':'+sourceLine:''),reference:fn?inventory.include+'/'+fn.header+':'+fn.line:note.reference||'md-sdk/md_api.h',keywords:[name.replace(/_/g,' '),note.category||category(name,fn?.header),b?.sgdk?'sgdk':'lua',...(note.keywords||[])]});
 }
 const api={schema:1,provenance:'Generated from compiler descriptors, shared-compiler syntax, bundled SGDK headers and documentation notes.',counts:{descriptors:Object.keys(BUILTINS).length,sgdk:Object.values(BUILTINS).filter(b=>b.sgdk).length,entries:entries.length},sources:sourceHashes,entries};
 validateApi(api,expected);return api;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 try{
  const args=process.argv.slice(2);let sdk=defaultSdk,out,notes,check=false;
  while(args.length){const a=args.shift();if(a==='--check')check=true;else if(['--sdk','--out','--notes'].includes(a)&&args.length){const v=path.resolve(args.shift());if(a==='--sdk')sdk=v;else if(a==='--out')out=v;else notes=v;}else throw new Error('Usage: generate-api.mjs [--check] [--sdk DIR] [--out FILE] [--notes FILE]');}
  out??=path.join(sdk,'docs/api.json');const api=await buildApi(sdk,notes);const text=JSON.stringify(api,null,2)+'\n';
  if(check){if(fs.readFileSync(out,'utf8')!==text)throw new Error('API metadata is stale; regenerate with tools/generate-api.mjs');}
  else {fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,text);}
  console.log(`${check?'Verified':'Generated'} ${api.entries.length} API entries (${api.counts.sgdk} SGDK); ${Buffer.byteLength(text)} bytes.`);
 }catch(e){console.error(e.message);process.exitCode=2;}
}
