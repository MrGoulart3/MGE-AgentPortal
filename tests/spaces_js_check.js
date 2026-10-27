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
const saved = new Map();
const storage = {getItem(k){return saved.get(k) ?? null;}, setItem(k,v){saved.set(k,v);}, removeItem(k){saved.delete(k);}};
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
  const keys = id => [...element(id).innerHTML.matchAll(/data-card="([^"]+)"/g)].map(m => m[1]);
  vm.runInContext(`idioma='en'; desenharStatus({ctx:100000,ctx_pct:50,ferramentas:3}, {claude_5h:10,codex_5h:20,codex_sem:30})`, context);
  assert.deepEqual(keys('omc'), ['claude5h', 'codex5h', 'codexsem', 'contexto']);
  assert.deepEqual(keys('omc2'), ['modelo', 'sessao', 'modo']);
  assert.ok(element('omc').innerHTML.includes('title="drag to move"'));
  vm.runInContext("idioma='pt'; desenharStatus(ultSt,ultLim)", context);
  assert.ok(element('omc2').innerHTML.includes('title="arraste para mudar de lugar"'));
  const html = fs.readFileSync(path.join(__dirname, '../portal/web/spaces.html'), 'utf8');
  assert.match(html, /id="chat"[^>]*><\/div>\s*<div id="omc" class="cartoes" data-zona="topo"/);
  assert.match(html, /id="omc2" class="cartoes" data-zona="baixo"/);
  vm.runInContext("ordemCartoes={topo:['modelo','contexto'],baixo:['codexsem','claude5h','codex5h','sessao','modo']}; ocultos.add('codexsem'); desenharStatus(ultSt,ultLim)", context);
  assert.deepEqual(keys('omc'), ['modelo', 'contexto']);
  assert.deepEqual(keys('omc2'), ['claude5h', 'codex5h', 'sessao', 'modo']);
  assert.ok(element('omc2').innerHTML.includes('data-restaurar="1"'));
  assert.ok(!element('omc').innerHTML.includes('data-restaurar="1"'));
  for (const id of ['omc', 'omc2']) element(id).querySelectorAll = () => keys(id).map(card => ({dataset:{card}}));
  vm.runInContext('salvarOrdem()', context);
  const order = JSON.parse(saved.get('portal_cartoes_ordem'));
  assert.deepEqual(order.topo, ['modelo', 'contexto']);
  assert.deepEqual(order.baixo, ['claude5h', 'codex5h', 'sessao', 'modo', 'codexsem']);
  const before = element('omc').innerHTML;
  vm.runInContext('arrasto={}; desenharStatus({ctx:1},null)', context);
  assert.equal(element('omc').innerHTML, before);
  vm.runInContext("arrasto=null; ocultos.clear(); desenharStatus({ctx:100000}, {codex_sem:30})", context);
  assert.ok(keys('omc2').includes('codexsem'));
  vm.runInContext('desenharStatus(null,null)', context);
  assert.ok(element('omc').hidden && element('omc2').hidden);
  assert.equal(vm.runInContext('navDlg({})', context), '');
  const tabs = vm.runInContext('navDlg({abas:true})', context);
  assert.ok(tabs.includes('data-op="left"') && tabs.includes('data-op="right"'));
  assert.ok(!tabs.includes('data-op="enter"'));
  const multiple = vm.runInContext('navDlg({multipla:true})', context);
  assert.ok(multiple.includes('Confirm checked (Enter)'));
  vm.runInContext('dlgAtual={abas:true,multipla:true,pergunta:"Choose",opcoes:[]}', context);
  assert.ok(vm.runInContext('dlgHtml()', context).includes('Next / Submit'));
  for (const key of ['left','right','tab','space']) assert.ok(html.includes('data-k="' + key + '"'));
  console.log('Configured uploads and bilingual context rendering: OK');
})().catch(error => {console.error(error); process.exitCode=1;});
