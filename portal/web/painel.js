'use strict';
const $ = id => document.getElementById(id);
const T = {
  en: {title:'PC resources', subtitle:'Read only · live resource samples', portal:'Agent Portal', capacity:'Capacity', memory:'Memory', temperature:'CPU temperature', disk:'Storage and I/O', network:'Network', spaces:'Resources per workspace', processes:'Processes', rss:'CPU: 100% = one core. RAM sums RSS; shared pages may be counted twice.', privacy:'Only executable basenames; no accounts, command arguments or working directory paths.', all:'All workspaces', unknown:'Unavailable', ok:'OK', tight:'TIGHT', full:'FULL', jobs:'Managed jobs', paused:'Paused', active:'Running', stale:'Stale record', login:'Open the Agent Portal and authenticate again.', disconnected:'Disconnected · retrying', updated:'Updated', load:'Load 1/5/15 min', available:'Available', swap:'Swap', clamp:'Power clamp active', uptime:'Uptime', read:'Read', write:'Write', count:'processes', pid:'PID', space:'Workspace', name:'Name', cpu:'CPU', ram:'RAM', seconds:'Elapsed', command:'Executable', now:'now', history:'History'},
  pt: {title:'Recursos do PC', subtitle:'Somente leitura · amostras ao vivo', portal:'Portal dos agentes', capacity:'Capacidade', memory:'Memória', temperature:'Temperatura da CPU', disk:'Disco e I/O', network:'Rede', spaces:'Recursos por workspace', processes:'Processos', rss:'CPU: 100% = um núcleo. RAM soma RSS; páginas compartilhadas podem contar duas vezes.', privacy:'Só nomes de executáveis; sem contas, argumentos de comandos ou caminhos de trabalho.', all:'Todos os workspaces', unknown:'Indisponível', ok:'OK', tight:'APERTADO', full:'LOTADO', jobs:'Jobs gerenciados', paused:'Pausado', active:'Rodando', stale:'Registro obsoleto', login:'Abra o portal dos agentes e autentique novamente.', disconnected:'Sem conexão · tentando novamente', updated:'Atualizado', load:'Carga 1/5/15 min', available:'Disponível', swap:'Swap', clamp:'Power-clamp ativo', uptime:'Ligado há', read:'Leitura', write:'Escrita', count:'processos', pid:'PID', space:'Workspace', name:'Nome', cpu:'CPU', ram:'RAM', seconds:'Tempo', command:'Executável', now:'agora', history:'Histórico'}
};
function stored(key) { try { return sessionStorage.getItem(key) || localStorage.getItem(key) || ''; } catch (_) { return ''; } }
let language = stored('portal_idioma') || ((navigator.language || '').startsWith('pt') ? 'pt' : 'en');
if (!T[language]) language = 'en';
const transientKey = window.portalPanelKey || '';
const transientDevice = window.portalPanelDevice || '';
window.portalNavigationKey = transientKey; window.portalNavigationDevice = transientDevice;
delete window.portalPanelKey; delete window.portalPanelDevice;
let state = null;
let sort = 'cpu';
let descending = true;
const t = key => T[language][key] || key;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const pct = value => Number(value || 0).toFixed(1) + '%';
function bytes(value) {
  if (value == null) return t('unknown');
  const units = ['B','KiB','MiB','GiB']; let index = 0;
  while (value >= 1024 && index < 3) { value /= 1024; index++; }
  return value.toFixed(index ? 1 : 0) + ' ' + units[index];
}
function duration(value) { return Math.floor(value / 86400) + 'd ' + Math.floor(value % 86400 / 3600) + 'h ' + Math.floor(value % 3600 / 60) + 'm'; }
function bar(value, maximum) { return '<div class="bar"><div class="fill" style="width:' + Math.max(0, Math.min(100, value / Math.max(1, maximum) * 100)) + '%"></div></div>'; }
function chart(id, keys, maximum, floor = 0) {
  const canvas = $(id), width = canvas.getBoundingClientRect().width, ratio = devicePixelRatio || 1;
  canvas.width = width * ratio; canvas.height = 130 * ratio;
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
  const points = state.history || [], range = Math.max(1, (maximum || Math.max(1, ...points.flatMap(point => keys.map(key => point[key] || 0)))) - floor);
  keys.forEach((key, index) => {
    ctx.strokeStyle = ['#4387ee', '#25b69d'][index]; ctx.lineWidth = 2; ctx.beginPath();
    points.forEach((point, position) => {
      const x = width * position / Math.max(1, points.length - 1), y = 110 - 90 * Math.max(0, (point[key] || floor) - floor) / range;
      if (position) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }); ctx.stroke();
  });
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted'); ctx.font = '11px system-ui';
  ctx.fillText(t('history'), 0, 127); ctx.fillText(t('now'), Math.max(0, width - 40), 127);
}
function applyLanguage() {
  document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
  document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll('[data-lang]').forEach(element => { element.setAttribute('aria-pressed', String(element.dataset.lang === language)); });
  window.dispatchEvent?.(new Event('portal-language'));
  if (state) render();
}
const columns = ['pid','space','name','cpu','ram','seconds','command'];
function renderProcesses() {
  const rows = state.processes.filter(row => !$('filter').value || row.space === $('filter').value)
    .sort((a,b) => b[$('top').value] - a[$('top').value]).slice(0,25);
  rows.sort((a,b) => { const x = a[sort], y = b[sort], value = typeof x === 'number' ? x-y : String(x).localeCompare(String(y)); return descending ? -value : value; });
  $('columns').innerHTML = columns.map(key => '<th><button data-sort="' + key + '">' + esc(t(key)) + ' ↕</button></th>').join('');
  $('processes').innerHTML = rows.map(row => '<tr>' + columns.map(key => '<td>' + esc(key === 'cpu' ? pct(row[key]) : key === 'ram' ? bytes(row[key]) : key === 'seconds' ? duration(row[key]) : row[key]) + '</td>').join('') + '</tr>').join('');
}
function renderSpaces() {
  const metric = $('metric').value, entries = Object.entries(state.spaces).sort((a,b) => b[1][metric] - a[1][metric]), total = entries.reduce((sum,row) => sum + row[1][metric],0);
  $('spaces').innerHTML = entries.map(([name,row]) => '<div class="space"><div class="spacehead"><strong>' + esc(name) + '</strong><span>' + pct(row.cpu) + ' CPU · ' + bytes(row.ram) + ' · ' + row.count + ' ' + esc(t('count')) + '</span></div>' + bar(row[metric],total) + '</div>').join('');
}
function render() {
  const s = state, memory = s.memory, thermal = s.thermal;
  const temp = thermal.package ?? s.temperature;
  const thresholds = {temp_warn:75,temp_full:85,cpu_warn:80,cpu_full:95,ram_warn:80,ram_full:95,...s.thresholds};
  const color = (value,key) => value >= thresholds[key+'_full'] ? '#d13b3b' : value >= thresholds[key+'_warn'] ? '#c98a00' : '#1f8a46';
  const ramPercent = memory.used / Math.max(1,memory.total) * 100;
  if (window.PortalRings) $('quick').innerHTML =
    window.PortalRings.card(t('temperature'),temp ?? 0,temp == null ? t('unknown') : thresholds.temp_warn + ' / ' + thresholds.temp_full + ' °C', {text:temp == null ? '—' : temp.toFixed(0),unit:'°C',color:color(temp,'temp')}) +
    window.PortalRings.card('CPU',s.cpu.cpu,pct(s.cpu.cpu),{color:color(s.cpu.cpu,'cpu')}) +
    window.PortalRings.card(t('memory'),ramPercent,bytes(memory.available)+' '+t('available'),{color:color(ramPercent,'ram')}) +
    window.PortalRings.card(t('capacity'),s.capacity === 'full' ? 100 : s.capacity === 'tight' ? 70 : 25,t('jobs')+': '+s.jobs.length,{text:t(s.capacity),unit:'',color:s.capacity === 'full' ? '#d13b3b' : s.capacity === 'tight' ? '#c98a00' : '#1f8a46'});
  $('thermal-details').textContent = Object.entries(thermal.cores || {}).map(([name,value]) => name + ': ' + value.toFixed(1) + ' °C').join(' · ') + ' · ' + (thermal.high ?? thresholds.temp_warn) + ' / ' + (thermal.crit ?? thresholds.temp_full) + ' °C';
  $('cpu').textContent = pct(s.cpu.cpu);
  $('load').textContent = t('load') + ': ' + s.load.map(value => value.toFixed(2)).join(' / ');
  $('cores').innerHTML = Object.entries(s.cpu).filter(([key]) => key !== 'cpu').map(([key,value]) => '<div>' + esc(key) + ' ' + pct(value) + bar(value,100) + '</div>').join('');
  $('memory').textContent = bytes(memory.used) + ' / ' + bytes(memory.total);
  $('memdetail').textContent = t('available') + ' ' + bytes(memory.available) + ' · ' + t('swap') + ' ' + bytes(memory.swap);
  $('temperature').textContent = temp == null ? t('unknown') : temp.toFixed(1) + ' °C';
  $('clamp').textContent = thermal.clamped ? t('clamp') + ': ' + thermal.powerclamp + '%' : '';
  $('disks').innerHTML = s.disks.map(row => esc(row.mount) + ' · ' + bytes(row.used) + ' / ' + bytes(row.total) + bar(row.used,row.total)).join('');
  $('io').textContent = t('read') + ' ' + bytes(s.rates.disk_read) + '/s · ' + t('write') + ' ' + bytes(s.rates.disk_write) + '/s';
  $('network').textContent = '↓ ' + bytes(s.rates.net_in) + '/s · ↑ ' + bytes(s.rates.net_out) + '/s';
  $('uptime').textContent = t('uptime') + ' ' + duration(s.uptime);
  $('verdict').textContent = t(s.capacity); $('verdict').className = 'badge' + (s.capacity === 'ok' ? '' : ' bad');
  $('jobs').innerHTML = '<p>' + esc(t('jobs')) + ': ' + s.jobs.length + '</p>' + s.jobs.map(row => 'PID ' + esc(row.pid) + ' · ' + esc(row.space) + ' · ' + esc(row.threads) + ' threads · ' + esc(t(row.paused ? 'paused' : row.active ? 'active' : 'stale'))).join('<br>');
  const selected = $('filter').value;
  $('filter').innerHTML = '<option value="">' + esc(t('all')) + '</option>' + Object.keys(s.spaces).sort().map(key => '<option value="' + esc(key) + '">' + esc(key) + '</option>').join('');
  $('filter').value = selected;
  renderSpaces(); renderProcesses();
  chart('cpuChart',['cpu'],100); chart('memoryChart',['memory'],memory.total);
  chart('tempChart',['temp'],thermal.crit || 105,30); chart('diskChart',['disk_read','disk_write']); chart('netChart',['net_in','net_out']);
}
async function update() {
  try {
    const key = stored('portal_chave') || transientKey;
    if (!key) { $('status').textContent = t('login'); return; }
    const response = await fetch('/api/estado', {headers:{'X-Token':key,'X-Device':stored('portal_aparelho') || transientDevice},signal:AbortSignal.timeout(5000)});
    if ([401,403,429].includes(response.status)) { $('status').textContent = t('login'); return; }
    if (!response.ok) throw Error();
    state = await response.json(); render();
    $('status').textContent = t('updated') + ' ' + new Date(state.timestamp * 1000).toLocaleTimeString(language === 'pt' ? 'pt-BR' : 'en-US');
  } catch (_) { $('status').textContent = t('disconnected'); }
  setTimeout(update, (state?.interval || 3) * 1000);
}
$('columns').onclick = event => { const key = event.target.dataset.sort; if (key) { descending = key === sort ? !descending : true; sort = key; renderProcesses(); } };
$('metric').onchange = () => state && renderSpaces(); $('filter').onchange = () => state && renderProcesses();
$('top').onchange = () => { sort = $('top').value; descending = true; if (state) renderProcesses(); };
document.querySelectorAll('[data-lang]').forEach(element => { element.onclick = () => { language = element.dataset.lang; try { localStorage.setItem('portal_idioma',language); } catch (_) {} applyLanguage(); }; });
window.onresize = () => state && render();
applyLanguage(); update();
