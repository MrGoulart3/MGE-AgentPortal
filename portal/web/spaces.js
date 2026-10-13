'use strict';
// Portal dos Spaces: conversa com os agentes do herdr (modo chat), terminal ao vivo, decisões, arquivos e acessos.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const ST = {working: 'trabalhando', done: 'terminou', idle: 'parado', blocked: 'esperando decisão', unknown: '?'};

// ---------- armazenamento (sempre protegido: pode falhar em janela anônima)
const mem = {};
function lerS(k) { try { return sessionStorage.getItem(k) ?? localStorage.getItem(k) ?? mem[k] ?? null } catch (e) { return mem[k] ?? null } }
function gravarS(k, v, lembrar = true) { mem[k] = v; try { (lembrar ? localStorage : sessionStorage).setItem(k, v) } catch (e) {} }
function apagarS(k) { delete mem[k]; try { localStorage.removeItem(k); sessionStorage.removeItem(k) } catch (e) {} }

let chave = lerS('portal_chave') || '';
let aparelhoAntigo = lerS('portal_aparelho') || '';   // aparelhos aprovados antes do cookie HttpOnly
let atual = lerS('portal_space') || '';
let modo = lerS('portal_modo') || 'conversa';
let tipo = lerS('portal_tipo') || 'claude';
let ocultos = new Set((lerS('portal_cartoes_ocultos') || '').split(',').filter(Boolean));
let ultSt = null, ultLim = null;
let fonte = +lerS('portal_fonte') || 12.5, alt = +lerS('portal_alt') || 52;
let auto = lerS('portal_auto') !== '0', quebra = lerS('portal_quebra') === '1';
if (lerS('portal_auto') === null && matchMedia('(max-width:760px)').matches) { auto = false; quebra = true }
let lista = [], grudado = true, timer = null, aptimer = null, ger = 0, ultLista = 0, ultRecados = 0, abertoAc = false;
let conv = [], convN = 0, convEpoca = '', convPane = '', anexos = [], dlgId = '', pendVistos = '', lembrar = lerS('portal_lembrar') !== '0';
const EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt', '.md', '.csv', '.tsv', '.json', '.xyz', '.log', '.out', '.inp', '.gjf', '.com', '.mol', '.mol2', '.sdf', '.pdb', '.cif', '.docx', '.xlsx', '.pptx', '.zip']);
const MAX_MB = 25;

// ---------- API
async function api(path, body, opts = {}) {
  const h = {'X-Token': chave};
  if (aparelhoAntigo) h['X-Device'] = aparelhoAntigo;
  let corpo;
  if (body instanceof Blob) { corpo = body; h['Content-Type'] = 'application/octet-stream' }
  else if (body !== undefined) { corpo = JSON.stringify(body); h['Content-Type'] = 'application/json' }
  const r = await fetch(path, {method: body !== undefined ? 'POST' : 'GET', headers: h, body: corpo,
    credentials: 'same-origin', signal: AbortSignal.timeout(opts.timeout || 20000)});
  const d = await r.json().catch(() => ({erro: 'resposta inválida'}));
  if (r.headers?.get?.('X-Migrado') && aparelhoAntigo) { aparelhoAntigo = ''; apagarS('portal_aparelho') }
  if (r.status === 401) { sair(false); throw Error('chave inválida') }
  if (r.status === 403 && d.precisa_aprovacao) { pedirAprovacao(); throw Error('aparelho não aprovado') }
  if (!r.ok) throw Error(d.erro || ('erro ' + r.status));
  return d;
}
function msg(t, ok) { $('msg').textContent = t; $('msg').className = ok ? 'okmsg' : (ok === false ? 'err' : 'muted') }

// ---------- login e aprovação do aparelho
function sair(esquecerChave = true) {
  clearTimeout(timer); clearTimeout(aptimer);
  if (esquecerChave) { chave = ''; apagarS('portal_chave') }
  $('chave').value = ''; $('app').hidden = true; $('login').hidden = false; $('aprov').hidden = true;
}
$('vchave').onclick = () => { const c = $('chave'); c.type = c.type === 'password' ? 'text' : 'password'; $('vchave').textContent = c.type === 'password' ? 'Ver' : 'Ocultar' };
$('sair').onclick = () => sair(true);
$('lf').onsubmit = async e => {
  e.preventDefault(); chave = $('chave').value.trim(); $('lerr').textContent = '';
  lembrar = $('lembrar').checked; apagarS('portal_chave'); gravarS('portal_lembrar', lembrar ? '1' : '0');
  try { await carregarLista(true); gravarS('portal_chave', chave, lembrar); iniciar() }
  catch (err) { if (err.message !== 'aparelho não aprovado') { $('lerr').textContent = err.message; chave = '' } else gravarS('portal_chave', chave, lembrar) }
};
function pedirAprovacao() {
  clearTimeout(timer); $('app').hidden = true; $('login').hidden = false; $('aprov').hidden = false;
  esperar();
}
$('appedir').onclick = async () => {
  $('apinfo').textContent = 'pedindo…';
  try {
    const d = await api('/api/acesso/pedir', {nome: $('apnome').value});
    aparelhoAntigo = ''; apagarS('portal_aparelho');
    $('apinfo').innerHTML = 'Código deste pedido: <strong style="font-size:22px;letter-spacing:2px">' + esc(d.codigo) + '</strong><br>' +
      'Num aparelho já autorizado, abra o portal → <em>Acessos</em> → digite este código e aprove. O pedido vale 15 min; esta página entra sozinha.';
    esperar();
  } catch (err) { $('apinfo').textContent = err.message }
};
async function esperar() {
  clearTimeout(aptimer);
  try {
    const d = await api('/api/acesso/estado');
    if (d.estado === 'aprovado') { $('aprov').hidden = true; iniciar(); return }
    if (d.estado === 'recusado') { $('apinfo').textContent = 'O pedido foi recusado.'; return }
    if (d.estado === 'nenhum' && $('apinfo').textContent.includes('Código')) { $('apinfo').textContent = 'O pedido expirou. Peça de novo.'; return }
    if (d.estado === 'nenhum') return;
  } catch (e) {}
  aptimer = setTimeout(esperar, 3000);
}

// ---------- lista de spaces
async function carregarLista(forcar) {
  if (!forcar && Date.now() - ultLista < 6000 && lista.length) return;
  lista = (await api('/api/spaces')).spaces; ultLista = Date.now();
  carregarAcessos();
  desenharLista();
}
function desenharLista() {
  document.querySelectorAll('[data-tipo]').forEach(b => b.classList.toggle('on', b.dataset.tipo === tipo));
  const vis = lista.filter(s => tipo === 'todos' || s.agent === tipo);
  const rot = s => esc(s.workspace) + (tipo === 'todos' && s.agent !== 'claude' ? ' (' + esc(s.agent) + ')' : '');
  $('spaces').innerHTML = (vis.length ? '' : '<div class="muted" style="padding:8px 4px">nenhum ' + esc(tipo) + ' aberto</div>') + vis.map(s => '<button type="button" class="space' + (s.pane === atual ? ' sel' : '') + '" data-p="' + esc(s.pane) + '"><span><strong>' + rot(s) + '</strong><small>' + esc(s.title) + '</small></span><span class="dot s-' + esc(s.status) + '">' + esc(ST[s.status] || s.status) + '</span></button>').join('');
  $('sel').innerHTML = '<option value="">— escolha um space —</option>' + vis.map(s => '<option value="' + esc(s.pane) + '"' + (s.pane === atual ? ' selected' : '') + '>' + rot(s) + ' · ' + esc(ST[s.status] || s.status) + '</option>').join('');
}
$('tipos').onclick = e => { const t = e.target.dataset.tipo; if (!t) return; tipo = t; gravarS('portal_tipo', t); desenharLista() };
$('spaces').onclick = e => { const b = e.target.closest('[data-p]'); if (b) escolher(b.dataset.p) };
$('sel').onchange = () => $('sel').value && escolher($('sel').value);
function escolher(p) {
  atual = p; gravarS('portal_space', p); ger++; grudado = true; ultRecados = 0;
  document.querySelectorAll('.space').forEach(b => b.classList.toggle('sel', b.dataset.p === p)); $('sel').value = p;
  $('tela').textContent = 'carregando…'; $('chat').innerHTML = ''; $('chat').dataset.h = ''; $('dlg').hidden = true;
  atualizar();
}

// ---------- tela (terminal) e ajuste de tamanho
function caber() {
  const t = $('tela'); if (!auto || quebra || t.hidden) return;
  const n = Math.max(40, ...t.textContent.split('\n').map(l => l.length));
  const cs = getComputedStyle(t), w = t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const m = document.createElement('span'); m.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:100px ui-monospace,Menlo,Consolas,monospace';
  m.textContent = 'M'.repeat(10); document.body.appendChild(m); const cw = m.getBoundingClientRect().width / 1000; m.remove();
  const f = Math.max(6, Math.min(16, Math.floor(w / (n * cw) * 10) / 10)); if (Math.abs(f - fonte) >= 0.1) { fonte = f; t.style.fontSize = f + 'px' }
}
addEventListener('resize', () => caber());
function aplicarTela() {
  const ehChat = modo === 'conversa', t = $('tela');
  t.hidden = ehChat; $('chat').hidden = !ehChat;
  ['ajustar', 'quebrar'].forEach(i => $(i).hidden = ehChat);
  t.classList.toggle('wrap', quebra); $('ajustar').classList.toggle('on', auto && !quebra); $('quebrar').classList.toggle('on', quebra);
  t.style.fontSize = fonte + 'px'; t.style.height = alt + 'vh'; $('chat').style.height = alt + 'vh';
  document.querySelectorAll('[data-modo]').forEach(b => b.classList.toggle('on', b.dataset.modo === modo));
  gravarS('portal_auto', auto ? '1' : '0'); gravarS('portal_quebra', quebra ? '1' : '0'); gravarS('portal_fonte', fonte); gravarS('portal_alt', alt);
}
$('ctl').onclick = e => {
  const b = e.target.dataset;
  if (b.modo) { modo = b.modo; gravarS('portal_modo', modo); ger++; grudado = true; aplicarTela(); atualizar(); return }
  if (b.z) { auto = false; fonte = Math.min(22, Math.max(6, Math.round(fonte) + (+b.z))) }
  else if (b.h) alt = Math.min(90, Math.max(25, alt + 10 * (+b.h)));
  else return;
  aplicarTela();
};
$('ajustar').onclick = () => { auto = true; quebra = false; aplicarTela(); caber() };
$('quebrar').onclick = () => { quebra = !quebra; aplicarTela(); caber() };
$('cheia').onclick = () => { const s = $('sec'); s.classList.toggle('full'); $('cheia').textContent = s.classList.contains('full') ? '✕ Sair da tela cheia' : '⛶ Tela cheia'; grudado = true; caber() };
$('tela').ondblclick = () => $('cheia').click();
document.addEventListener('keydown', e => { if (e.key === 'Escape' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT' && $('sec').classList.contains('full')) $('cheia').click() });
$('tela').onscroll = () => { const t = $('tela'); grudado = t.scrollHeight - t.scrollTop - t.clientHeight < 40 };
$('chat').onscroll = () => { const t = $('chat'); grudado = t.scrollHeight - t.scrollTop - t.clientHeight < 60 };

// ---------- conversa (chat)
function md(x) {
  let h = esc(x); const blocos = [];
  h = h.replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, (m, c) => { blocos.push(c); return '\u0000' + (blocos.length - 1) + '\u0000' });
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/^#{1,4} (.*)$/gm, '<strong>$1</strong>');
  return h.replace(/\u0000(\d+)\u0000/g, (m, i) => '<pre>' + (blocos[+i] ?? '') + '</pre>');
}
function desenharChat(estado) {
  const c = $('chat'); let html = '', tools = [];
  const flush = () => { if (tools.length) { html += '<div class="tl">🔧 ' + tools.map(esc).join('\n🔧 ') + '</div>'; tools = [] } };
  for (const e of conv) {
    if (e.r === 'tool') { tools.push(e.x); if (tools.length > 6) tools.shift(); continue }
    flush();
    const hora = e.t ? new Date(e.t + 'Z').toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : '';
    html += '<div class="m ' + (e.r === 'user' ? 'u' : 'c') + '">' + md(e.x) + '<div class="hr">' + esc(hora) + '</div></div>';
  }
  flush();
  if (estado === 'working') html += '<div class="work">⏳ trabalhando…</div>';
  if (c.dataset.h !== html) { c.innerHTML = html || '<div class="work">(sem mensagens)</div>'; c.dataset.h = html; if (grudado) c.scrollTop = c.scrollHeight }
}
$('omc').onclick = e => {
  const k = e.target.dataset.fechar;
  if (k) ocultos.add(k); else if (e.target.dataset.restaurar) ocultos.clear(); else return;
  gravarS('portal_cartoes_ocultos', [...ocultos].join(',')); desenharStatus(ultSt, ultLim);
};
function barra(p) { p = num(p); const c = p >= 90 ? 'h' : p >= 70 ? 'w' : ''; return '<div class="mt"><i class="' + c + '" style="width:' + Math.max(0, Math.min(100, p)) + '%"></i></div>' }
function desenharStatus(st, lim) {
  ultSt = st; ultLim = lim;
  const o = $('omc'); if (!st && !lim) { o.hidden = true; return }
  const nomeModelo = m => { const x = String(m || '').match(/claude-([a-z]+)-(\d+)-(\d+)/); return x ? x[1][0].toUpperCase() + x[1].slice(1) + ' ' + x[2] + '.' + x[3] : (m || '?') };
  const hm = t => { const d = new Date(t); return isNaN(d) ? '?' : d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) };
  const dur = s => { if (!num(s)) return '?'; const m = Math.floor((Date.now() / 1000 - s) / 60); return m >= 1440 ? Math.floor(m / 1440) + ' d ' + Math.floor(m % 1440 / 60) + ' h' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min' };
  const quando = t => { if (!t) return '?'; const d = new Date(typeof t === 'number' ? t * 1000 : t); if (isNaN(d)) return '?';
    const hoje = new Date().toDateString() === d.toDateString(); return hoje ? 'às ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : d.toLocaleDateString('pt-BR', {weekday: 'short', day: '2-digit', month: '2-digit'}) + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) };
  const card = (k, html) => ocultos.has(k) ? '' : '<div class="st" data-card="' + k + '"><button type="button" class="fechar" data-fechar="' + k + '" aria-label="ocultar este cartão" title="ocultar">✕</button>' + html + '</div>';
  const lc = (k, nome, pct, reset) => pct == null ? '' : card(k, '<small>' + nome + '</small><b>' + num(pct) + '% usados</b> · renova ' + esc(quando(reset)) + barra(pct));
  let h = '';
  if (st && modo === 'conversa') h += card('modelo', '<small>Modelo</small><b>' + esc(nomeModelo(st.modelo)) + '</b>');
  if (lim) h += lc('claude5h', 'Claude · janela de 5 h', lim.claude_5h, lim.claude_5h_reset) + lc('codex5h', 'Codex · janela de 5 h', lim.codex_5h, lim.codex_5h_reset) + lc('codexsem', 'Codex · semana', lim.codex_sem, lim.codex_sem_reset);
  if (st && modo === 'conversa') {
    h += card('contexto', '<small>Contexto da conversa</small><b>' + num(st.ctx_pct) + '%</b> · ' + Math.round(num(st.ctx) / 1000) + ' mil de 1 milhão de tokens' + barra(st.ctx_pct));
    if (st.ferramentas != null) h += card('sessao', '<small>Sessão</small><b>' + esc(dur(st.inicio)) + '</b> · ' + num(st.ferramentas) + ' ações');
    h += card('modo', '<small>Modo</small><b>' + esc(st.modo === 'auto' ? 'automático' : st.modo || '?') + '</b>' + (st.branch ? ' · git ' + esc(st.branch) : ''));
  }
  if (ocultos.size) h += '<button type="button" class="b restaurar" data-restaurar="1" title="mostrar de novo os cartões ocultos">↺ restaurar cartões (' + ocultos.size + ')</button>';
  if (o.dataset.h !== h) { o.innerHTML = h; o.dataset.h = h }
  o.hidden = !h;
}
async function carregarConversa(g) {
  if (convPane !== atual) { conv = []; convN = 0; convEpoca = ''; convPane = atual; grudado = true }
  const d = await api('/api/conversa?pane=' + encodeURIComponent(atual) + '&desde=' + convN + '&epoca=' + encodeURIComponent(convEpoca));
  if (g !== ger) return;
  if (d.epoca !== convEpoca || d.n < convN) { conv = d.itens; convEpoca = d.epoca }
  else conv = conv.concat(d.itens).slice(-400);
  convN = d.n; desenharChat(d.estado); desenharStatus(d.status, d.limites); desenharDialogo(d.dialogo);
}

// ---------- decisões (permissões, perguntas, confiar na pasta)
function desenharDialogo(dg) {
  dlgId = dg && dg.id ? dg.id : '';
  if (!dg || !dg.opcoes || !dg.opcoes.length) { $('dlg').hidden = true; return }
  $('dlgq').textContent = dg.pergunta || '';
  $('dlgops').innerHTML = dg.opcoes.map(o => '<button class="b' + (o.marcada ? ' on' : '') + '" type="button" data-op="' + esc(o.n) + '">' + esc(o.n) + '. ' + esc(o.texto) + '</button>').join('');
  $('dlg').hidden = false;
}
$('dlgops').onclick = e => { const n = e.target.closest('[data-op]')?.dataset.op; if (n) tecla(n) };
$('dlgesc').onclick = () => tecla('esc');

// ---------- ciclo de atualização (um por vez; respostas antigas descartadas)
async function atualizar() {
  clearTimeout(timer); const g = ++ger;
  try {
    await carregarLista(false);
    if (g !== ger) return;
    const s = lista.find(x => x.pane === atual);
    if (s) {
      $('nome').textContent = s.workspace + (s.agent !== 'claude' ? ' (' + s.agent + ')' : ''); $('estado').textContent = ST[s.status] || s.status;
      if (modo === 'conversa' && s.agent === 'claude') {
        try { await carregarConversa(g) } catch (err) { if (/indisponível/.test(err.message)) { modo = 'vivo'; aplicarTela() } else throw err }
        if (g !== ger) return;
        if (Date.now() - ultRecados > 6000) { const r = await api('/api/recados?pane=' + encodeURIComponent(atual)); if (g !== ger) return; desenharRecados(r.historico); ultRecados = Date.now() }
      } else {
        if (modo === 'conversa') { modo = 'vivo'; aplicarTela() }
        const d = await api('/api/tela?pane=' + encodeURIComponent(atual) + '&modo=' + (modo === 'historico' ? 'historico' : 'vivo'));
        if (g !== ger) return;
        const t = $('tela'); t.textContent = d.tela || '(tela vazia)'; caber(); if (grudado) t.scrollTop = t.scrollHeight;
        desenharDialogo(d.dialogo); desenharRecados(d.historico); desenharStatus(null, d.limites);
      }
    } else { $('nome').textContent = 'Escolha um space'; $('tela').textContent = ''; $('chat').innerHTML = ''; $('hist').innerHTML = ''; $('dlg').hidden = true }
    $('status').textContent = 'Atualizado ' + new Date().toLocaleTimeString('pt-BR'); $('status').className = 'muted';
  } catch (e) { if (g === ger) { $('status').textContent = 'Sem conexão: ' + e.message; $('status').className = 'err' } }
  if (g === ger && chave && !$('app').hidden) timer = setTimeout(atualizar, document.hidden ? 15000 : (modo === 'historico' ? 4000 : 1500));
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && chave && !$('app').hidden) atualizar() });
function desenharRecados(h) {
  const tipo = x => x.tipo === 'tecla' ? '<em>tecla ' + esc(x.texto) + '</em>' : x.tipo === 'arquivo' ? '📎 ' + esc(x.texto) : esc(x.texto);
  $('hist').innerHTML = h && h.length ? '<small class="muted">Seus recados para este space:</small>' + h.slice().reverse().map(x => '<div><small class="muted">' + esc(String(x.t).slice(5, 16)) + (x.aparelho ? ' · ' + esc(x.aparelho) : '') + '</small> ' + tipo(x) + '</div>').join('') : '';
}

// ---------- envio de recados, teclas e arquivos
async function tecla(k) {
  if (!atual) return;
  try { await api('/api/tecla', {pane: atual, tecla: k, dlg: dlgId}); msg('tecla ' + k + ' ✓', true); dlgId = ''; $('dlg').hidden = true; setTimeout(atualizar, 700) }
  catch (err) { msg(err.message, false); setTimeout(atualizar, 300) }
}
document.querySelector('.teclas').onclick = e => { const k = e.target.dataset.k; if (k) tecla(k) };
function desenharAnexos() {
  $('anexos').innerHTML = anexos.map((f, i) => '<span class="anexo">📎 ' + esc(f.name) + ' <small>(' + Math.ceil(f.size / 1024) + ' KB)</small><button type="button" data-rm="' + i + '" aria-label="tirar">✕</button></span>').join('');
}
function anexar(files) {
  for (let f of files) {
    if (!f || !f.size) continue;
    if (!f.name || f.name === 'image.png') f = new File([f], 'print_' + Date.now() + '.png', {type: f.type || 'image/png'});
    const ext = (f.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (!EXT.has(ext)) { msg('tipo não permitido: ' + (ext || 'sem extensão') + ' (' + f.name + ')', false); continue }
    if (f.size > MAX_MB * 1048576) { msg(f.name + ' passa de ' + MAX_MB + ' MB', false); continue }
    anexos.push(f);
  }
  desenharAnexos();
}
$('anexos').onclick = e => { const i = e.target.dataset.rm; if (i !== undefined) { anexos.splice(+i, 1); desenharAnexos() } };
$('clip').onclick = () => $('arq').click();
$('arq').onchange = () => { anexar($('arq').files); $('arq').value = '' };
$('texto').addEventListener('paste', e => { const fs = [...(e.clipboardData?.files || [])]; if (!fs.length) return; anexar(fs); if (!(e.clipboardData.types || []).includes('text/plain')) e.preventDefault() });
['dragover', 'drop'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
['dragenter', 'dragover'].forEach(t => $('entrada').addEventListener(t, e => { e.preventDefault(); $('entrada').classList.add('arrastando') }));
['dragleave', 'drop'].forEach(t => $('entrada').addEventListener(t, e => { e.preventDefault(); $('entrada').classList.remove('arrastando') }));
$('entrada').addEventListener('drop', e => anexar(e.dataTransfer?.files || []));
let enviando = false, enviados = [];   // caminhos já salvos sobrevivem a uma falha no meio
$('ef').onsubmit = async e => {
  e.preventDefault(); if (enviando || !atual) return;
  let texto = $('texto').value.trim(); if (!texto && !anexos.length) return;
  enviando = true; $('enviar').disabled = true;
  try {
    while (anexos.length) {
      const f = anexos[0];
      msg('enviando ' + f.name + '…');
      const d = await api('/api/arquivo?pane=' + encodeURIComponent(atual) + '&nome=' + encodeURIComponent(f.name), f, {timeout: 900000});
      enviados.push(d.caminho); anexos.shift(); desenharAnexos();
    }
    const caminhos = enviados;
    if (caminhos.length) texto = (texto ? texto + '\n\n' : 'Enviei arquivo(s) para você olhar.\n\n') + 'Arquivo(s) salvo(s) no PC:\n' + caminhos.map(c => '- ' + c).join('\n');
    msg('enviando…');
    await api('/api/enviar', {pane: atual, texto});
    $('texto').value = ''; anexos = []; enviados = []; desenharAnexos(); msg('enviado ✓', true); grudado = true; ultRecados = 0; setTimeout(atualizar, 1000);
  } catch (err) { msg(err.message, false) }
  finally { enviando = false; $('enviar').disabled = false }
};
$('texto').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('ef').requestSubmit() } };

// ---------- acessos (aparelhos, auditoria, chave)
$('vacessos').onclick = () => { abertoAc = !abertoAc; $('acessos').hidden = !abertoAc; carregarAcessos() };
async function carregarAcessos() {
  try {
    const d = await api('/api/acesso/lista');
    $('npend').innerHTML = d.pendentes.length ? '<span class="pend">' + d.pendentes.length + '</span>' : '';
    const ids = d.pendentes.map(r => r.id).join(',');
    if (ids && ids !== pendVistos && !abertoAc) { abertoAc = true; $('acessos').hidden = false }
    pendVistos = ids;
    if (!abertoAc) return;
    const dt = t => new Date(num(t) * 1000).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
    let h = '<h2>Pedidos de acesso</h2>' + (d.pendentes.map(r => '<div class="ac"><strong>' + esc(r.nome) + '</strong><br><small>' + esc(r.navegador) + '<br>origem ' + esc(r.cliente || '?') + ' · ' + dt(r.criado) + '</small>' +
      '<div class="row"><input inputmode="numeric" maxlength="6" placeholder="código" data-cod="' + esc(r.id) + '"><button class="b main" type="button" data-ap="' + esc(r.id) + '">Aprovar</button><button class="b" type="button" data-rc="' + esc(r.id) + '">Recusar</button></div></div>').join('') || '<div class="muted">nenhum</div>');
    h += '<h2 style="margin-top:14px">Aparelhos aprovados (internet)</h2>' + (d.aparelhos.map(r => '<div class="ac">' + esc(r.nome) + (r.este ? ' <em>(este)</em>' : '') + '<br><small>visto ' + dt(r.ultimo) + ' · vale até ' + dt(r.expira) + '</small><div class="row"><button class="b" type="button" data-rv="' + esc(r.id) + '">Revogar</button></div></div>').join('') || '<div class="muted">nenhum</div>');
    h += '<div class="row"><button class="b" type="button" data-esq="1">Esquecer este aparelho</button><button class="b perigo" type="button" data-troca="1">Trocar a chave</button></div><div id="chnova"></div>';
    h += '<h2 style="margin-top:14px">Últimos eventos</h2><div class="aud">' + (d.auditoria || []).map(a => '<div>' + esc(String(a.t).slice(5, 16)) + ' · ' + esc(a.evento) + (a.aparelho ? ' · ' + esc(a.aparelho) : '') + (a.cliente ? ' · ' + esc(a.cliente) : '') + (a.detalhe ? ' · ' + esc(a.detalhe) : '') + '</div>').join('') + '</div>';
    if (document.activeElement?.dataset?.cod || document.activeElement?.id === 'chatual' || $('acessos').querySelector('[data-confirma="1"]')) return;
    const codigos = {}; document.querySelectorAll('[data-cod]').forEach(i => { if (i.value) codigos[i.dataset.cod] = i.value });
    const nova = $('chnova') ? $('chnova').innerHTML : '';
    $('acessos').innerHTML = h;
    for (const [id, v] of Object.entries(codigos)) { const i = document.querySelector('[data-cod="' + CSS.escape(id) + '"]'); if (i) i.value = v }
    if (nova && $('chnova')) $('chnova').innerHTML = nova;
  } catch (e) {}
}
$('acessos').onclick = async e => {
  const b = e.target.dataset;
  try {
    if (b.ap) { const cod = document.querySelector('[data-cod="' + CSS.escape(b.ap) + '"]').value.trim(); await api('/api/acesso/decidir', {id: b.ap, aprovar: true, codigo: cod}); msg('aparelho aprovado ✓', true) }
    else if (b.rc) await api('/api/acesso/decidir', {id: b.rc, aprovar: false});
    else if (b.rv) await api('/api/acesso/revogar', {id: b.rv});
    else if (b.esq) { await api('/api/acesso/esquecer', {}); aparelhoAntigo = ''; apagarS('portal_aparelho'); sair(true); return }
    else if (b.troca) {
      if (e.target.dataset.confirma !== '1') {
        e.target.dataset.confirma = '1'; e.target.textContent = 'Confirmar troca';
        $('chnova').innerHTML = '<div class="row"><input id="chatual" type="password" placeholder="chave atual" autocapitalize="off" spellcheck="false"><small class="muted">digite a chave atual e toque em Confirmar; todos os aparelhos vão pedir a nova</small></div>';
        return;
      }
      const d = await api('/api/acesso/trocar-chave', {revogar_todos: false, chave_atual: ($('chatual') || {}).value || ''});
      chave = d.chave; apagarS('portal_chave'); gravarS('portal_chave', chave, lembrar);
      e.target.dataset.confirma = ''; e.target.textContent = 'Trocar a chave';
      $('chnova').innerHTML = '<p>Chave nova (anote; os outros aparelhos vão pedir):</p><div class="novachave">' + esc(d.chave) + '</div>';
      return;
    } else return;
    carregarAcessos();
  } catch (err) { msg(err.message, false) }
};

$('lembrar').checked = lembrar;
function iniciar() { $('login').hidden = true; $('app').hidden = false; aplicarTela(); atualizar() }
if (chave) api('/api/spaces').then(iniciar).catch(e => { if (e.message === 'chave inválida') sair(true); else if (e.message !== 'aparelho não aprovado') { $('login').hidden = false; $('lerr').textContent = e.message } });
else sair(false);
