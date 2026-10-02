import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createBrowser} from '../bin/mdapi-browser.mjs';
const api=JSON.parse(fs.readFileSync(new URL('../docs/api.json',import.meta.url)));
test('Lua and SGDK indexes are separate and complete',()=>{
 const lua=createBrowser(api,{pageSize:1000});lua.input('1');lua.input('1');
 assert.match(lua.render(),/spr/);assert.doesNotMatch(lua.render(),/SPR_addSprite/);
 const sgdk=createBrowser(api,{pageSize:1000});sgdk.input('2');sgdk.input('1');
 assert.match(sgdk.render(),/SPR_addSprite/);assert.doesNotMatch(sgdk.render(),/\d spr\n/);
 assert.doesNotMatch(lua.render(),/layer_show/);
});
test('Lua browser begins with a curated start-here path',()=>{
 const b=createBrowser(api);b.input('1');assert.match(b.render(),/Start here/);
 b.input('1');assert.match(b.render(),/spr/);assert.match(b.render(),/_init/);
});
test('number selection and back preserve the previous page',()=>{
 const b=createBrowser(api);b.input('1');b.input('1');b.input('n');const previous=b.render();
 b.input('2');assert.match(b.render(),/Quick view/);b.input('m');assert.match(b.render(),/Details/);
 b.input('b');assert.equal(b.render(),previous);
});
test('all entries are reachable by pagination without retyping names',()=>{
 const b=createBrowser(api);b.input(':all');let visited=0;
 const count=api.entries.filter(e=>e.status!=='unsupported').length;
 for(let page=0;page<Math.ceil(count/8);page++){
  for(let i=1;i<=Math.min(8,count-page*8);i++){b.input(String(i));assert.match(b.render(),/Quick\s+view/);visited++;b.input('b');}
  b.input('n');
 }
 assert.equal(visited,count);
});
test('search retains results, supports case-insensitive exact lookup and scope',()=>{
 const b=createBrowser(api);b.input('/sprite');const results=b.render();
 b.input('1');b.input('b');assert.equal(b.render(),results);
 b.input('/SPR');assert.match(b.render(),/spr - Quick view/);
 b.input('?');b.input('1');b.input('/SPR_addSprite');assert.match(b.render(),/No matches/);
});
test('invalid selections, missing search and boundary pages are safe',()=>{
 const b=createBrowser(api);b.input('999');assert.match(b.render(),/Choose a number/);
 b.input('p');b.input('b');assert.match(b.render(),/Genesis Lua API/);
 b.input('/doesnotexist');assert.match(b.render(),/No matches/);
 b.input('n');assert.match(b.render(),/1\/1/);b.input('q');assert.equal(b.finished,true);
});
test('quick view is paginated and detailed content remains accessible',()=>{
 const b=createBrowser(api,{width:32,detailLines:12});b.find('SPR_addSprite');
 assert.match(b.render(),/Quick view/);assert.doesNotMatch(b.render(),/Source:/);
 for(let i=0;i<20;i++){assert.ok(b.render().split('\n').every(l=>l.length<=32));b.input('n');}
 b.input('m');assert.match(b.render(),/Details/);
});
test('foreground CLI consumes a piped navigation session and exits at EOF',()=>{
 const cli=fileURLToPath(new URL('../bin/mdapi-browser.mjs',import.meta.url));
 const r=spawnSync(process.execPath,[cli],{input:'1\n1\n2\nm\nb\n/\nspr\nq\n',encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/Lua game API/);assert.match(r.stdout,/spr - Quick view/);assert.match(r.stdout,/Type fg/);
 assert.equal(spawnSync(process.execPath,[cli],{input:'',encoding:'utf8'}).status,0);
 assert.equal(spawnSync(process.execPath,[cli,'--bad'],{encoding:'utf8'}).status,2);
});
