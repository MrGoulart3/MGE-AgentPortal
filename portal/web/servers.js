'use strict';
(() => {
  const {t,request,bytes,dateTime,escape:e} = window.PortalPage;
  const $ = id => document.getElementById(id);
  let snapshot = null, filter = 'all', selected = null;
  const number = value => Number(value || 0).toFixed(1).replace(/\.0$/, '');
  const table = (headers, rows) => '<thead><tr>' + headers.map(key => '<th>' + e(t(key === 'cores' ? 'coresHeader' : key)) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(cell => '<td>' + e(cell) + '</td>').join('') + '</tr>').join('') + '</tbody>';
  function spark(server) {
    const history = (snapshot.history || []).filter(point => point.servers?.[server.name]);
    if (history.length < 2) return '<small>' + e(t('history')) + ' · ' + e(t('offline')) + '</small>';
    const start = snapshot.timestamp - 48 * 3600;
    const line = (metric, max, color) => '<polyline fill="none" stroke="' + color + '" stroke-width="2" points="' + history.map(point => {
      const x = Math.max(0,Math.min(300,(point.timestamp - start) / (48 * 3600) * 300));
      const y = 50 - Math.max(0,Math.min(1,point.servers[server.name][metric] / Math.max(1,max))) * 46;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ') + '"/>';
    return '<small>' + e(t('history')) + '</small><svg class="spark" viewBox="0 0 300 56" role="img" aria-label="' + e(t('history')) + '">' + line('used',server.cores,'#3579e8') + line('memory',100,'#25b69d') + '</svg>';
  }
  function render() {
    if (!snapshot) return;
    document.title = t('servers');
    const servers = snapshot.servers || [];
    $('summary').innerHTML = servers.map((server,index) => '<div role="button" tabindex="0" aria-haspopup="dialog" data-server="' + index + '">' + window.PortalRings.card(server.name,
      server.online ? server.used / server.cores * 100 : 0,
      server.online ? t('ours') + ': ' + number(server.ours) + ' ' + t('cores') : t('offline'),
      {text:server.online ? number(server.used) + '/' + number(server.cores) : '—',unit:t('cores'),ours:server.ours / server.cores * 100}) + '</div>').join('');
    $('cards').innerHTML = servers.map((server,index) => {
      const attrs = ' role="button" tabindex="0" aria-haspopup="dialog" data-server="' + index + '"';
      if (!server.online) return '<section class="card"' + attrs + '><h2>' + e(server.name) + '</h2><p>' + e(t('offline')) + '</p></section>';
      const ours = Math.min(server.used, server.ours), other = Math.max(0,server.used - ours), free = Math.max(0,server.cores - server.used);
      return '<section class="card"' + attrs + '><h2>' + e(server.name) + '</h2><div class="stack"><i class="ours" style="width:' + ours / server.cores * 100 + '%"></i><i class="others" style="width:' + other / server.cores * 100 + '%"></i></div><small>' + e(t('ours')) + ' ' + number(ours) + ' · ' + e(t('others')) + ' ' + number(other) + ' · ' + e(t('free')) + ' ' + number(free) + '</small><p>' + e(t('memory')) + ': ' + bytes(server.memory.used) + ' / ' + bytes(server.memory.total) + '</p><strong>' + e(t('disks')) + '</strong>' + server.disks.map(disk => '<p class="' + (disk.percent >= 90 ? 'alert' : '') + '">' + e(disk.mount) + ' · ' + e(disk.percent) + '% · ' + bytes(disk.available) + ' ' + e(t('free')) + '</p>').join('') + spark(server) + '</section>';
    }).join('');
    const workspace = {}, jobs = [];
    servers.forEach(server => {
      const running = ['R','RUNNING','COMPLETING'];
      const rows = server.jobs.length ? server.jobs.filter(row => running.includes(row.state)) : server.processes;
      rows.filter(row => row.ours).forEach(row => {
        const key = row.workspace || t('ours');
        const item = workspace[key] ||= {cores:0,count:0,servers:new Set()};
        item.cores += row.cores ?? row.cpu / 100; item.count++; item.servers.add(server.name);
      });
      server.jobs.forEach(row => jobs.push({...row,server:server.name,running:running.includes(row.state)}));
      if (!server.jobs.length) server.processes.filter(row => row.cpu >= 1).forEach(row => jobs.push({...row,id:row.person,name:row.program,cores:row.cpu/100,state:'RUNNING',running:true,server:server.name}));
    });
    $('workspace-table').innerHTML = table(['workspace','cores','jobs','server'],Object.entries(workspace).map(([name,row]) => [name,number(row.cores),row.count,[...row.servers].join(', ')]));
    $('chips').innerHTML = ['all','ours','running','queued',...servers.map(row => row.name)].map(key => '<button data-filter="' + e(key) + '" aria-pressed="' + (key === filter) + '">' + e(t(key)) + '</button>').join('');
    const filtered = jobs.filter(row => filter === 'all' || (filter === 'ours' ? row.ours : filter === 'running' ? row.running : filter === 'queued' ? ['Q','PD','PENDING','H'].includes(row.state) : row.server === filter));
    $('job-table').innerHTML = table(['server','workspace','name','owner','cores','state','elapsed'], filtered.map(row => [row.server,row.workspace || '—',row.program || row.person,row.person,number(row.cores),row.state,row.elapsed]));
    const age = Date.now()/1000 - snapshot.timestamp;
    $('status').textContent = (age > 900 ? t('stale') : t('updated')) + ' · ' + dateTime(snapshot.timestamp*1000);
  }
  function detail(index, open = true) {
    const server = snapshot?.servers[index];
    if (!server) return;
    selected = index;
    $('detail-title').textContent = server.name + ' · ' + t('usage');
    const scheduler = server.scheduler && server.scheduler !== 'none' || server.jobs.length > 0;
    const groups = new Map();
    (scheduler ? server.jobs : server.heavy_processes || []).forEach(row => {
      const key = JSON.stringify([row.person,row.responsible,scheduler ? row.state : row.program]);
      const item = groups.get(key) || {...row,cores:0,ram:0,count:0,elapsed:0};
      item.cores += scheduler ? row.cores : row.cpu / 100;
      item.ram += row.ram || 0;
      item.count += scheduler ? 1 : row.count;
      const parts = String(row.elapsed || 0).split('-');
      const seconds = typeof row.elapsed === 'number' ? row.elapsed : parts.pop().split(':').reduce((n,x)=>n*60+Number(x),0) + Number(parts[0] || 0)*86400;
      item.elapsed = Math.max(item.elapsed,seconds);
      groups.set(key,item);
    });
    const rows = [...groups.values()].sort((a,b)=>b.cores-a.cores), users = new Map();
    rows.filter(row => !scheduler || ['R','RUNNING','COMPLETING'].includes(row.state)).forEach(row => users.set(row.person,(users.get(row.person) || 0)+row.cores));
    const duration = seconds => Math.floor(seconds/3600) + ':' + String(Math.floor(seconds/60)%60).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0');
    const headers = scheduler ? ['who','jobCount','cores','state','longest'] : ['who','program','cores','memory','runningFor'];
    const cells = rows.map(row => {
      const who = '<strong>' + e(row.person || '—') + '</strong><br><small>' + e(row.responsible || '') + '</small>';
      const values = scheduler ? [row.count,number(row.cores),t(['R','RUNNING','COMPLETING'].includes(row.state) ? 'running' : ['Q','PD','PENDING','H'].includes(row.state) ? 'queued' : row.state),duration(row.elapsed)] : [row.program + ' (' + row.count + ' proc.)',number(row.cores),bytes(row.ram),duration(row.elapsed)];
      return '<tr><td>' + who + '</td>' + values.map(value=>'<td>' + e(value) + '</td>').join('') + '</tr>';
    }).join('');
    $('detail-body').innerHTML = '<h3>' + e(t('perUser')) + '</h3><p>' + [...users].sort((a,b)=>b[1]-a[1]).map(([person,cores])=>e(person) + ': ' + number(cores)).join(' · ') + '</p>' +
      (scheduler ? '' : '<p>' + e(t('heavyHint')) + ' ' + e(snapshot.process_cpu_min ?? 5) + '% · ≤ 200</p>') +
      (rows.length ? '<div class="scroll"><table><thead><tr>' + headers.map(key=>'<th>' + e(t(key === 'cores' ? 'coresHeader' : key)) + '</th>').join('') + '</tr></thead><tbody>' + cells + '</tbody></table></div>' : '<p>' + e(t('noProcesses')) + '</p>');
    if (open && !$('detail').open) $('detail').showModal();
  }
  for (const id of ['summary','cards']) {
    const activate = event => {
      const target = event.target.closest('[data-server]');
      if (!target || (event.type === 'keydown' && !['Enter',' '].includes(event.key))) return;
      event.preventDefault(); detail(Number(target.dataset.server));
    };
    $(id).onclick = activate; $(id).onkeydown = activate;
  }
  $('detail-close').onclick = () => $('detail').close();
  $('detail').onclick = event => { if (event.target === $('detail')) $('detail').close(); };
  addEventListener('portal-render', () => { if ($('detail').open) detail(selected, false); });
  $('chips').onclick = event => { if (event.target.dataset.filter) {filter = event.target.dataset.filter; render();} };
  addEventListener('portal-render',render);
  async function update() {
    try { snapshot = await (await request('/api/servers')).json(); render(); }
    catch (error) { $('status').textContent = error.message + ' · ' + t('error'); }
    setTimeout(update,60000);
  }
  update();
})();
