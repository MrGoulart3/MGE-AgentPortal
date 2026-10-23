'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname,'../portal/web');
async function check(page) {
  const elements = new Map(), listeners = {};
  const element = id => {
    if (!elements.has(id)) elements.set(id,{value:'',innerHTML:'',textContent:'',dataset:{},setAttribute(){},files:[],open:false,showModal(){this.open=true;},close(){this.open=false;}});
    return elements.get(id);
  };
  const labels = [...fs.readFileSync(path.join(root,page+'.html'),'utf8').matchAll(/data-i18n="([^"]+)"/g)].map(match => ({dataset:{i18n:match[1]},textContent:''}));
  const languages = ['en','pt'].map(lang => ({dataset:{lang},setAttribute(){}}));
  const malicious = '<img src=x onerror=alert(1)>';
  const data = page === 'servers' ? {timestamp:Date.now()/1000,history:[],servers:[{name:malicious,online:true,used:4,ours:2,cores:8,memory:{used:1,total:2},disks:[{mount:malicious,percent:92,available:1}],jobs:[{person:malicious,responsible:malicious,name:malicious,owner:malicious,workspace:malicious,ours:true,cores:2,state:'R'}],heavy_processes:[{person:malicious,responsible:malicious,program:malicious,owner:malicious,cpu:250,ram:1024,elapsed:90,cwd:malicious,command:malicious,count:2}],processes:[]}]} : {max_mb:25,workspaces:[{pane:'w1:p1',workspace:malicious,agent:'codex',files:[{name:malicious,kind:'outbox',size:100}]}]};
  const context = vm.createContext({console,Event,AbortSignal,URLSearchParams,navigator:{language:'en'},localStorage:{getItem(){return '';},setItem(){}},sessionStorage:{getItem(){return '';}},setTimeout(){},document:{documentElement:{},querySelectorAll(selector){return selector === '[data-i18n]' ? labels : languages;},getElementById:element},fetch:async()=>({ok:true,json:async()=>data}),addEventListener:(name,callback)=>{listeners[name]=callback;}});
  context.window = context;
  context.dispatchEvent = event => listeners[event.type]?.();
  for (const file of ['rings.js','pages.js',page+'.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
  await new Promise(resolve => setImmediate(resolve));
  if (page === 'files') {element('workspace').value='w1:p1';element('workspace').onchange();}
  for (const id of page === 'servers' ? ['summary','cards','workspace-table','job-table'] : ['workspace','list']) {
    assert.ok(!element(id).innerHTML.includes('<img'),id+' escaping');
    assert.ok(element(id).innerHTML.includes('&lt;img'),id+' renders supplied data');
  }
  if (page === 'servers') {
    const target = {closest:()=>({dataset:{server:'0'}})};
    for (const id of ['summary','cards']) {
      for (const key of ['Enter',' ']) {
        let prevented = false;
        element(id).onkeydown({target,type:'keydown',key,preventDefault(){prevented=true;}});
        assert.ok(prevented); assert.ok(element('detail').open);
        assert.ok(element('detail-body').innerHTML.includes('Running for (longest)'));
        assert.ok(!element('detail-body').innerHTML.includes('Working directory'));
        assert.ok(!element('detail-body').innerHTML.includes('Command'));
        assert.ok(element('detail-body').innerHTML.includes('&lt;img'));
        assert.ok(!element('detail-body').innerHTML.includes('<img'));
        element('detail-close').onclick(); assert.ok(!element('detail').open);
      }
      element(id).onclick({target,type:'click',preventDefault(){}});
      assert.ok(element('detail').open);
      element('detail').onclick({target:element('detail')});
      assert.ok(!element('detail').open);
    }
  }
  if (page === 'servers') {
    data.servers[0].jobs=[];
    element('summary').onclick({target:{closest:()=>({dataset:{server:'0'}})},type:'click',preventDefault(){}});
    assert.ok(element('detail-body').innerHTML.includes('2.5'));
    assert.ok(element('detail-body').innerHTML.includes('(2 proc.)'));
    assert.ok(!element('detail-body').innerHTML.includes('Working directory'));
  }
  for (const language of languages) {
    language.onclick();
    for (const label of labels) assert.notEqual(label.textContent,label.dataset.i18n,'missing translation: '+label.dataset.i18n);
    if (page === 'servers') assert.equal(element('status').textContent.split(' · ')[1],new Date(data.timestamp*1000).toLocaleString(language.dataset.lang === 'pt' ? 'pt-BR' : 'en-US'));
    assert.equal(context.document.documentElement.lang,language.dataset.lang === 'pt' ? 'pt-BR' : 'en');
  }
  // Every literal t() call must resolve in both languages.
  for (const file of [page+'.js','pages.js']) {
    const source = fs.readFileSync(path.join(root,file),'utf8');
    for (const match of source.matchAll(/\bt\('([^']+)'\)/g)) {
      for (const language of languages) {language.onclick();assert.ok(context.PortalPage.hasTranslation(match[1]),match[1]);}
    }
  }
}
(async()=>{await check('servers');await check('files');console.log('Pages translation and escaping: OK');})().catch(error=>{console.error(error);process.exitCode=1;});
