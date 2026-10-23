'use strict';
(() => {
  const {t,request,bytes,escape:e} = window.PortalPage;
  const $ = id => document.getElementById(id);
  let data = null;
  function render() {
    if (!data) return;
    document.title = t('files');
    const selected = $('workspace').value;
    $('workspace').innerHTML = data.workspaces.map(row => '<option value="' + e(row.pane) + '">' + e(row.workspace + ' · ' + row.agent) + '</option>').join('');
    if (data.workspaces.some(row => row.pane === selected)) $('workspace').value = selected;
    $('limit').textContent = t('limit') + ': ' + data.max_mb + ' MiB';
    const workspace = data.workspaces.find(row => row.pane === $('workspace').value);
    $('list').innerHTML = ['inbox','outbox'].map(kind => '<h2>' + e(t(kind)) + '</h2>' + ((workspace?.files || []).filter(row => row.kind === kind).map(row => '<div class="file"><span>' + e(row.name) + ' <small>' + (row.size/1024).toFixed(1) + ' KiB</small></span><button data-name="' + e(row.name) + '" data-kind="' + kind + '">' + e(t('download')) + '</button></div>').join('') || '<p class="muted">' + e(t('empty')) + '</p>')).join('');
    $('upload').hidden = !workspace;
  }
  async function update() {
    try { data = await (await request('/api/files')).json(); render(); }
    catch (error) { $('status').textContent = error.message; }
  }
  $('workspace').onchange = render;
  $('list').onclick = async event => {
    if (!event.target.dataset.name) return;
    const params = new URLSearchParams({pane:$('workspace').value,kind:event.target.dataset.kind,name:event.target.dataset.name});
    try {
      const blob = await (await request('/api/files/download?' + params)).blob();
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = event.target.dataset.name;
      link.click(); setTimeout(() => URL.revokeObjectURL(link.href),1000);
    } catch (error) { $('status').textContent = error.message; }
  };
  $('upload').onsubmit = async event => {
    event.preventDefault();
    const file = $('file').files[0];
    if (!file || !data) return;
    if (file.size > data.max_mb * 1024 ** 2) { $('status').textContent = t('limit') + ': ' + data.max_mb + ' MiB'; return; }
    try {
      await request('/api/files/upload?' + new URLSearchParams({pane:$('workspace').value,nome:file.name}),{method:'POST',body:file});
      $('status').textContent = t('success'); $('file').value = ''; await update();
    } catch (error) { $('status').textContent = error.message; }
  };
  addEventListener('portal-render',render);
  update();
})();
