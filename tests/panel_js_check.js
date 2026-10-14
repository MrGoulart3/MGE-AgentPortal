'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {value: '', dataset: {}, textContent: '', innerHTML: '', className: '', setAttribute() {}, getBoundingClientRect() { return {width:640}; }, getContext() { return {scale() {}, beginPath() {}, lineTo() {}, moveTo() {}, stroke() {}, fillText() {}}; }});
  return elements.get(id);
}
element('metric').value = 'cpu'; element('top').value = 'cpu';
const labels = ['title','subtitle','capacity','memory','temperature','disk','network','spaces','processes','rss','privacy'].map(key => { const result=element('label-'+key); result.dataset.i18n=key; return result; });
const langs = ['en','pt'].map(lang => ({dataset:{lang},setAttribute(){}}));
const context = vm.createContext({document:{getElementById:element, documentElement:{lang:''}, querySelectorAll(selector){ return selector === '[data-i18n]' ? labels : langs; }}, navigator:{language:'en'}, sessionStorage:{getItem(){return '';}}, localStorage:{getItem(){return '';},setItem(){}}, window:{}, devicePixelRatio:1, getComputedStyle(){return {getPropertyValue(){return '#777';}};}, setTimeout(){}, AbortSignal, console});
const source = fs.readFileSync(path.join(__dirname,'../portal/web/painel.js'),'utf8');
vm.runInContext(source,context);
const malicious = '<img src=x onerror=alert(1)>';
const sample = {timestamp:1,interval:3,cpu:{cpu:10,cpu0:10},memory:{total:1000,used:600,available:400,swap:0},load:[1,1,1],thermal:{package:70,clamped:false},rates:{net_in:0,net_out:0,disk_read:0,disk_write:0},disks:[],uptime:120,spaces:{[malicious]:{cpu:10,ram:600,count:1}},jobs:[{pid:1,space:malicious,threads:1,active:true}],processes:[{pid:1,space:malicious,name:malicious,cpu:10,ram:600,seconds:120,command:malicious}],history:[{cpu:10,memory:600,temp:70}],capacity:'ok'};
vm.runInContext('state = '+JSON.stringify(sample)+'; render();',context);
for (const id of ['spaces','processes','jobs']) {
  assert.ok(!element(id).innerHTML.includes('<img'),id+' must escape process/project names');
  assert.ok(element(id).innerHTML.includes('&lt;img'),id+' escaped sample is rendered');
}
assert.equal(element('label-title').textContent,'PC resources');
langs[1].onclick();
assert.equal(element('label-title').textContent,'Recursos do PC');
assert.ok(element('jobs').innerHTML.includes('Rodando'));
langs[0].onclick();
assert.ok(element('jobs').innerHTML.includes('Running'));
console.log('Panel rendering, language switching and escaping: OK');
