import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {BUILTINS,CALLBACKS} from '../compiler/builtins.js';
import {compile} from '../compiler/index.js';
import {variantEmitter} from '../compiler/sprite-variants.mjs';
import {buildApi,validateApi} from '../tools/generate-api.mjs';
import {run,formatEntry,sourceHelp} from '../bin/mdapi.mjs';
const sdk=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const api=JSON.parse(fs.readFileSync(path.join(sdk,'docs/api.json'),'utf8'));
const names=new Set([...Object.keys(BUILTINS),...CALLBACKS,'all','hexdata']);
test('metadata covers exact compiler API inventory without duplicates',()=>assert.equal(validateApi(api,names),names.size));
test('metadata regeneration matches current descriptors, headers and notes',async()=>assert.deepEqual(await buildApi(sdk),api));
test('validation rejects missing, extra, duplicate and malformed entries',()=>{
 for(const mutate of [a=>a.entries.pop(),a=>a.entries.push({...a.entries[0],name:'invented_api'}),a=>a.entries.push(a.entries[0]),a=>a.entries[0].category='wrong',a=>a.entries[0].signature='bad()']){
  const copy=structuredClone(api);mutate(copy);assert.throws(()=>validateApi(copy,names));
 }
});
test('help, list and all requested categories',()=>{
 assert.match(run(['--help'],api).text,/offline/);
 const list=run(['--list'],api);assert.equal(list.code,0);assert.match(list.text,/SPR_addSprite/);assert.doesNotMatch(list.text,/layer_show/);
 for(const c of ['graphics','input','audio','map','system']){const r=run(['--category',c],api);assert.equal(r.code,0);assert.match(r.text,/entries in/);}
});
test('exact and case-insensitive lookup use full real entries',()=>{
 for(const n of ['spr','music','btn','map','print','SPR_addSprite','hexdata','all','_draw']){
  const r=run([n],api);assert.equal(r.code,0);assert.ok(!r.text.includes('matches:'));assert.match(r.text,/Source:/);
  assert.equal(run([n.toUpperCase()],api).text,r.text);
 }
});
test('search supports names, prefixes, substrings and descriptive keywords',()=>{
 for(const q of ['sprite','draw','button','VDP_set','ingpong']){const r=run([q],api);assert.equal(r.code,0,q);}
 assert.match(run(['sprite'],api).text,/Lookup: mdapi NAME/);
 assert.match(run(['ingpong'],api).text,/anim_pingpong\(/);
 assert.equal(run(['definitely_not_an_api'],api).code,1);
});
test('malformed arguments fail clearly',()=>{
 for(const args of [['--unknown'],['--category'],['--category','bogus'],['--list','spr'],['--list','--list'],['--help','spr'],['']])assert.equal(run(args,api).code,2,JSON.stringify(args));
});
test('small-terminal output stays within selected width',()=>{
 for(const e of api.entries)for(const line of formatEntry(e,40).split('\n'))assert.ok(line.length<=40,e.name+': '+line);
});
test('unsupported calls and known documentation discrepancies are explicit',()=>{
 assert.match(run(['layer_show'],api).text,/unsupported/);
 assert.match(run(['pcm_play'],api).text,/supplies -1/);
 assert.match(run(['print'],api).text,/runtime C functions\s+return void/);
});
test('documented snippets pass the actual Lua frontend',()=>{
 let count=0;const failures=[];
 for(const e of api.entries.filter(e=>e.example&&e.status!=='unsupported')){
  let source=e.example;
  if(!/function\s/.test(source)&&!/^local \w+=(?:array8?|pool|split|hexdata)\(/.test(source))source='function _draw()\n'+source+'\nend';
  if(!/function _draw\(/.test(source))source+='\nfunction _draw() end';
  if(!/function _update(?:60)?\(/.test(source))source+='\nfunction _update60() end';
  const opts=e.name==='ssprv'?{builtins:{...BUILTINS,ssprv:{...BUILTINS.ssprv,emit:variantEmitter([{id:0}])}}}:{};
  const result=compile(source,'api-example-'+e.name+'.lua',opts);
  if(!result.ok)failures.push(e.name+': '+JSON.stringify(result.diagnostics));count++;
 }
 console.log('Frontend-validated documentation snippets:',count);
 assert.deepEqual(failures,[]);
});
test('CLI runs from another working directory and rejects stale tables',()=>{
 const cli=path.join(sdk,'bin/mdapi.mjs');
 const r=spawnSync(process.execPath,[cli,'spr'],{cwd:path.dirname(sdk),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/spr\(/);
 // The generator equality test above detects stale metadata without altering sources.
});
test('source-aware lookup selects calls by line and nearest column',()=>{
 const source='function _draw()\n  cls(1) spr(0,32,48)\nend\n';
 const read=()=>source;
 const line=sourceHelp(['--at','main.lua:2'],api,40,read);assert.equal(line.code,0);assert.match(line.text,/cls\(/);assert.match(line.text,/spr\(/);
 const nearest=sourceHelp(['--at','main.lua:2:12'],api,40,read);assert.equal(nearest.code,0);assert.match(nearest.text,/spr\(id/);assert.doesNotMatch(nearest.text,/cls\(\[color/);
 assert.equal(sourceHelp(['--at','main.lua:99'],api,40,read).code,2);
 assert.equal(sourceHelp(['--at','bad'],api,40,read).code,2);
});
test('source inventory lists each used API once',()=>{
 const source='function _draw() cls(1) spr(0,1,2) spr(1,3,4) end';
 const result=sourceHelp(['--used','main.lua'],api,40,()=>source);assert.equal(result.code,0);assert.match(result.text,/3 APIs used/);assert.match(result.text,/_draw/);assert.match(result.text,/cls/);assert.match(result.text,/spr/);
 assert.equal(sourceHelp(['--used','empty.lua'],api,40,()=> 'local x=1').code,1);
});
