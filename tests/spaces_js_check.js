'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {value:'', dataset:{}, style:{}, hidden:true, textContent:'', innerHTML:'', classList:{toggle(){}}, setAttribute(){}, addEventListener(){}, querySelector(){return null;}});
  return elements.get(id);
}
const storage = {getItem(){return null;}, setItem(){}, removeItem(){}};
let limit = 40;
const context = vm.createContext({
  document:{getElementById:element, querySelector:element, querySelectorAll(){return [];}, addEventListener(){}, documentElement:{}},
  navigator:{language:'en'}, sessionStorage:storage, localStorage:storage, window:{},
  matchMedia(){return {matches:false};}, addEventListener(){}, clearTimeout(){}, setTimeout(){},
  Blob, AbortSignal, console,
  async fetch(url) {return {ok:true, status:200, async json(){return url === '/api/spaces' ? {spaces:[], upload_mb:limit} : {pendentes:[], aparelhos:[]};}};}
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../portal/web/spaces.js'), 'utf8'), context);
(async () => {
  await vm.runInContext('carregarLista(true)', context);
  vm.runInContext("anexar([{name:'sample.pdf',size:30*1048576}])", context);
  assert.equal(vm.runInContext('anexos.length', context), 1);
  limit = 2;
  await vm.runInContext('carregarLista(true)', context);
  vm.runInContext("anexos=[]; anexar([{name:'sample.pdf',size:3*1048576}])", context);
  assert.equal(vm.runInContext('anexos.length', context), 0);
  assert.ok(element('msg').textContent.includes('2 MB'));
  for (const [language, caption] of [['en','100,000 of 200,000 tokens'], ['pt','100.000 de 200.000 tokens']]) {
    vm.runInContext(`idioma='${language}'; desenharStatus({ctx:100000,ctx_pct:50,janela_contexto:200000},null)`, context);
    assert.ok(element('omc').innerHTML.includes(caption));
  }
  console.log('Configured uploads and bilingual context rendering: OK');
})().catch(error => {console.error(error); process.exitCode=1;});
