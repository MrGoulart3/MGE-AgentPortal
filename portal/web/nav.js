'use strict';
(() => {
  function showError(text) {
    try {
      let banner = document.getElementById('page-script-error');
      if (!banner) {
        banner = document.createElement('div'); banner.id = 'page-script-error';
        banner.setAttribute('role', 'alert'); banner.dataset.count = '0';
        banner.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;background:#b00020;color:#fff;padding:10px 12px;border-radius:10px;font:13px system-ui';
        (document.body || document.documentElement).appendChild(banner);
      }
      banner.dataset.count = String(Number(banner.dataset.count) + 1);
      banner.textContent = 'Page script error: ' + text + ' (×' + banner.dataset.count + ')';
    } catch (_) {}
  }
  window.addEventListener('error', event => {
    if (event.error?.name === 'AbortError') return;
    showError((event.message || 'Unknown error') + ' · ' + String(event.filename || '').split('/').pop() + ':' + (event.lineno || '?'));
  });
  window.addEventListener('unhandledrejection', event => {
    if (event.reason?.name === 'AbortError') return;
    showError(String(event.reason?.message || event.reason));
  });
})();
(() => {
  const read = key => { try { return sessionStorage.getItem(key) || localStorage.getItem(key) || ''; } catch (_) { return ''; } };
  function draw() {
    const pt = (read('portal_idioma') || navigator.language).startsWith('pt');
    let nav = document.getElementById('portal-navigation');
    if (!nav) { nav = document.createElement('nav'); nav.id = 'portal-navigation'; nav.className = 'nav'; document.body.prepend(nav); }
    nav.setAttribute('aria-label', pt ? 'Páginas' : 'Pages');
    nav.innerHTML = [['Portal','/spaces'],[pt?'Recursos':'Resources','/resources'],[pt?'Servidores':'Servers','/servers'],[pt?'Arquivos':'Files','/files']].map(([label,url]) => `<a href="${url}"${location.pathname === url || (url === '/resources' && location.pathname === '/painel') ? ' aria-current="page"' : ''}>${label}</a>`).join('');
    nav.onclick = async event => {
      const link = event.target.closest('a');
      if (!link || link.pathname === '/spaces' || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const target = window.open('', '_blank');
      if (!target) return;
      try {
        const key = read('portal_chave') || window.portalNavigationKey || '';
        const device = read('portal_aparelho') || window.portalNavigationDevice || '';
        const response = await fetch(link.pathname, {headers:{'X-Token':key,'X-Device':device}, signal:AbortSignal.timeout(10000)});
        if (!response.ok) throw Error();
        target.portalPanelKey = key; target.portalPanelDevice = device;
        target.document.open(); target.document.write(await response.text()); target.document.close();
        target.history.replaceState(null, '', link.pathname);
      } catch (_) { target.close(); window.alert(pt ? 'Entre novamente no Portal.' : 'Authenticate again in the Portal.'); }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', draw);
  else draw();
  addEventListener('portal-language', draw);
  document.addEventListener('click', event => { if (event.target.closest('[data-lang], [data-idioma]')) setTimeout(draw, 0); });
})();
