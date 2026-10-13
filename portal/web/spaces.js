'use strict';
// Portal dos Spaces: conversa com os agentes do herdr (modo chat), terminal ao vivo, decisões, arquivos e acessos.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const T = {
  "pt": {
    "subtitle": "Conversa com os agentes de IA do herdr",
    "accessKey": "Chave de acesso",
    "loginHelp": "Digite a chave do portal. Pela internet, cada aparelho novo também precisa da aprovação do dono.",
    "key": "chave",
    "show": "Ver",
    "hide": "Ocultar",
    "login": "Entrar",
    "remember": "lembrar a chave neste navegador (desmarque em computador de outra pessoa)",
    "approvalNeeded": "Este aparelho precisa da sua aprovação.",
    "deviceName": "nome deste aparelho (ex.: PC do serviço)",
    "requestApproval": "Pedir aprovação",
    "all": "Todos",
    "chooseSpace": "Escolha um space",
    "chooseOption": "— escolha um space —",
    "accesses": "Acessos",
    "logout": "Sair",
    "view": "Tela:",
    "chat": "💬 Conversa",
    "live": "● Terminal ao vivo",
    "history": "Histórico",
    "size": "Tamanho:",
    "fit": "↔ Ajustar",
    "wrap": "Quebrar linhas",
    "fullscreen": "⛶ Tela cheia",
    "exitFullscreen": "✕ Sair da tela cheia",
    "decision": "⚠ O space está pedindo uma decisão",
    "cancel": "Cancelar (Esc)",
    "freeText": "Para responder com texto livre: cancele e mande um recado.",
    "keys": "Teclas:",
    "interrupt": "Esc (interromper)",
    "messagePlaceholder": "Recado para este space… (Enter envia · Shift+Enter pula linha · arraste ou cole arquivos)",
    "send": "Enviar",
    "attach": "📎 Anexar",
    "working": "trabalhando",
    "done": "terminou",
    "idle": "parado",
    "blocked": "esperando decisão",
    "unknown": "?",
    "invalidResponse": "resposta inválida",
    "invalidKey": "chave inválida",
    "unapproved": "aparelho não aprovado",
    "error": "erro {status}",
    "networkError": "falha de conexão",
    "timeout": "tempo de espera esgotado",
    "requesting": "pedindo…",
    "requestCode": "Código deste pedido: ",
    "approvalBefore": "Num aparelho já autorizado, abra o portal → ",
    "approvalAfter": " → digite este código e aprove. O pedido vale 15 min; esta página entra sozinha.",
    "requestDenied": "O pedido foi recusado.",
    "requestExpired": "O pedido expirou. Peça de novo.",
    "noAgents": "nenhum {type} aberto",
    "loading": "carregando…",
    "chatWorking": "⏳ trabalhando…",
    "noMessages": "(sem mensagens)",
    "hideCard": "ocultar este cartão",
    "hideShort": "ocultar",
    "used": "% usados",
    "resets": " · renova ",
    "at": "às ",
    "model": "Modelo",
    "claudeWindow": "Claude · janela de 5 h",
    "codexWindow": "Codex · janela de 5 h",
    "codexWeek": "Codex · semana",
    "context": "Contexto da conversa",
    "contextTokens": " mil de 1 milhão de tokens",
    "session": "Sessão",
    "actions": " ações",
    "mode": "Modo",
    "automatic": "automático",
    "restoreHelp": "mostrar de novo os cartões ocultos",
    "restoreCards": "↺ restaurar cartões",
    "emptyScreen": "(tela vazia)",
    "yourMessages": "Seus recados para este space:",
    "keyPress": "tecla ",
    "remove": "tirar",
    "noExtension": "sem extensão",
    "exceeds": "{name} passa de {size} MB",
    "sendingFile": "enviando {name}…",
    "sending": "enviando…",
    "sent": "enviado ✓",
    "requests": "Pedidos de acesso",
    "origin": "origem ",
    "code": "código",
    "approve": "Aprovar",
    "deny": "Recusar",
    "none": "nenhum",
    "approvedDevices": "Aparelhos aprovados (internet)",
    "thisDevice": "(este)",
    "seen": "visto ",
    "expires": " · vale até ",
    "revoke": "Revogar",
    "forget": "Esquecer este aparelho",
    "rotate": "Trocar a chave",
    "events": "Últimos eventos",
    "deviceApproved": "aparelho aprovado ✓",
    "confirmRotate": "Confirmar troca",
    "currentKey": "chave atual",
    "rotateHelp": "digite a chave atual e toque em Confirmar; todos os aparelhos vão pedir a nova",
    "newKey": "Chave nova (anote; os outros aparelhos vão pedir):",
    "keySent": "tecla {key} ✓",
    "typeError": "tipo não permitido: {ext} ({name})",
    "fileIntro": "Enviei arquivo(s) para você olhar.",
    "filePaths": "Arquivo(s) salvo(s) no PC:",
    "connectionStatus": "Sem conexão: {error}",
    "updatedStatus": "Atualizado {time}"
  },
  "en": {
    "subtitle": "Chat with herdr AI agents",
    "accessKey": "Access key",
    "loginHelp": "Enter the portal key. Over the internet, each new device also needs approval from the owner.",
    "key": "key",
    "show": "Show",
    "hide": "Hide",
    "login": "Sign in",
    "remember": "remember the key in this browser (uncheck on someone else’s computer)",
    "approvalNeeded": "This device needs your approval.",
    "deviceName": "device name (e.g. work PC)",
    "requestApproval": "Request approval",
    "all": "All",
    "chooseSpace": "Choose a space",
    "chooseOption": "— choose a space —",
    "accesses": "Access",
    "logout": "Sign out",
    "view": "View:",
    "chat": "💬 Chat",
    "live": "● Live terminal",
    "history": "History",
    "size": "Size:",
    "fit": "↔ Fit",
    "wrap": "Wrap lines",
    "fullscreen": "⛶ Full screen",
    "exitFullscreen": "✕ Exit full screen",
    "decision": "⚠ The space needs a decision",
    "cancel": "Cancel (Esc)",
    "freeText": "To reply with free text: cancel and send a message.",
    "keys": "Keys:",
    "interrupt": "Esc (interrupt)",
    "messagePlaceholder": "Message for this space… (Enter sends · Shift+Enter adds a line · drag or paste files)",
    "send": "Send",
    "attach": "📎 Attach",
    "working": "working",
    "done": "finished",
    "idle": "idle",
    "blocked": "awaiting a decision",
    "unknown": "?",
    "invalidResponse": "invalid response",
    "invalidKey": "invalid key",
    "unapproved": "device not approved",
    "error": "error {status}",
    "networkError": "connection failed",
    "timeout": "request timed out",
    "requesting": "requesting…",
    "requestCode": "Code for this request: ",
    "approvalBefore": "On an authorized device, open the portal → ",
    "approvalAfter": " → enter this code and approve. The request is valid for 15 min; this page signs in automatically.",
    "requestDenied": "The request was denied.",
    "requestExpired": "The request expired. Request approval again.",
    "noAgents": "no {type} agents open",
    "loading": "loading…",
    "chatWorking": "⏳ working…",
    "noMessages": "(no messages)",
    "hideCard": "hide this card",
    "hideShort": "hide",
    "used": "% used",
    "resets": " · resets ",
    "at": "at ",
    "model": "Model",
    "claudeWindow": "Claude · 5 h window",
    "codexWindow": "Codex · 5 h window",
    "codexWeek": "Codex · week",
    "context": "Conversation context",
    "contextTokens": " thousand of 1 million tokens",
    "session": "Session",
    "actions": " actions",
    "mode": "Mode",
    "automatic": "automatic",
    "restoreHelp": "show hidden cards again",
    "restoreCards": "↺ restore cards",
    "emptyScreen": "(empty screen)",
    "yourMessages": "Your messages for this space:",
    "keyPress": "key ",
    "remove": "remove",
    "noExtension": "no extension",
    "exceeds": "{name} exceeds {size} MB",
    "sendingFile": "sending {name}…",
    "sending": "sending…",
    "sent": "sent ✓",
    "requests": "Access requests",
    "origin": "origin ",
    "code": "code",
    "approve": "Approve",
    "deny": "Deny",
    "none": "none",
    "approvedDevices": "Approved devices (internet)",
    "thisDevice": "(this one)",
    "seen": "seen ",
    "expires": " · valid until ",
    "revoke": "Revoke",
    "forget": "Forget this device",
    "rotate": "Change key",
    "events": "Recent events",
    "deviceApproved": "device approved ✓",
    "confirmRotate": "Confirm change",
    "currentKey": "current key",
    "rotateHelp": "enter the current key and tap Confirm; all devices will need the new key",
    "newKey": "New key (save it; other devices will need it):",
    "keySent": "key {key} ✓",
    "typeError": "file type not allowed: {ext} ({name})",
    "fileIntro": "I sent file(s) for you to review.",
    "filePaths": "File(s) saved on the PC:",
    "connectionStatus": "Disconnected: {error}",
    "updatedStatus": "Updated {time}"
  }
};
const ST = {working: 'working', done: 'done', idle: 'idle', blocked: 'blocked', unknown: 'unknown'};

// ---------- armazenamento (sempre protegido: pode falhar em janela anônima)
const mem = {};
function lerS(k) { try { return sessionStorage.getItem(k) ?? localStorage.getItem(k) ?? mem[k] ?? null } catch (e) { return mem[k] ?? null } }
function gravarS(k, v, lembrar = true) { mem[k] = v; try { (lembrar ? localStorage : sessionStorage).setItem(k, v) } catch (e) {} }
function apagarS(k) { delete mem[k]; try { localStorage.removeItem(k); sessionStorage.removeItem(k) } catch (e) {} }


let idioma = lerS('portal_idioma');
if (idioma !== 'pt' && idioma !== 'en') idioma = (navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
const locale = () => idioma === 'pt' ? 'pt-BR' : 'en-US';
function t(k, valores = {}) { return (T[idioma][k] ?? k).replace(/\{(\w+)\}/g, (m, nome) => String(valores[nome] ?? m)) }
function textoI18n(id, k, valores = {}) { const el = $(id); el.dataset.i18n = k; el.i18nValores = valores; el.textContent = t(k, valores) }
function aplicarIdioma() {
  document.documentElement.lang = locale();
  if ($('status').erroCliente) { const e = $('status').erroCliente; $('status').i18nValores = {error: t(e.code, e.valores)} }
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n, el.i18nValores) });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh) });
  document.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)) });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle) });
  document.querySelectorAll('[data-idioma]').forEach(el => { el.classList.toggle('on', el.dataset.idioma === idioma); el.setAttribute('aria-pressed', String(el.dataset.idioma === idioma)) });
}
$('idiomas').onclick = e => {
  const novo = e.target.dataset.idioma; if (novo !== 'pt' && novo !== 'en') return;
  idioma = novo; gravarS('portal_idioma', idioma); aplicarIdioma();
  desenharLista(); desenharAnexos(); desenharStatus(ultSt, ultLim);
  if (convPane === atual) desenharChat(ultEstado);
  desenharRecados(ultHistorico);
  const agente = lista.find(s => s.pane === atual);
  if (agente) $('estado').textContent = ST[agente.status] ? t(ST[agente.status]) : agente.status;
  if (!$('app').hidden) atualizar();
  caber();
};

let chave = lerS('portal_chave') || '';
let aparelhoAntigo = lerS('portal_aparelho') || '';   // aparelhos aprovados antes do cookie HttpOnly
let atual = lerS('portal_space') || '';
let modo = lerS('portal_modo') || 'conversa';
let tipo = lerS('portal_tipo') || 'claude';
let ocultos = new Set((lerS('portal_cartoes_ocultos') || '').split(',').filter(Boolean));
let ultSt = null, ultLim = null, ultEstado = '', ultHistorico = [];
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
  let r;
  try { r = await fetch(path, {method: body !== undefined ? 'POST' : 'GET', headers: h, body: corpo,
    credentials: 'same-origin', signal: AbortSignal.timeout(opts.timeout || 20000)}); }
  catch (e) { throw erroCliente(e.name === 'TimeoutError' || e.name === 'AbortError' ? 'timeout' : 'networkError') }
  let invalida = false;
  const d = await r.json().catch(() => { invalida = true; return {} });
  if (r.headers?.get?.('X-Migrado') && aparelhoAntigo) { aparelhoAntigo = ''; apagarS('portal_aparelho') }
  if (r.status === 401) { sair(false); throw erroCliente('invalidKey') }
  if (r.status === 403 && d.precisa_aprovacao) { pedirAprovacao(); throw erroCliente('unapproved') }
  if (invalida) { if (!r.ok) throw erroCliente('invalidResponse'); d.erro = t('invalidResponse') }
  if (!r.ok) throw d.erro ? Error(d.erro) : erroCliente('error', {status: r.status});
  return d;
}
function erroCliente(k, valores) { const e = Error(t(k, valores)); e.code = k; e.valores = valores; return e }
function mostrarErro(id, e) { if (e.code) textoI18n(id, e.code, e.valores); else { delete $(id).dataset.i18n; $(id).textContent = e.message } }
function msgI18n(k, ok, valores) { msg(t(k, valores), ok); textoI18n('msg', k, valores) }
function msgErro(e) { msg(e.message, false); mostrarErro('msg', e) }
function msg(t, ok) { delete $('msg').dataset.i18n; $('msg').textContent = t; $('msg').className = ok ? 'okmsg' : (ok === false ? 'err' : 'muted') }

// ---------- login e aprovação do aparelho
function sair(esquecerChave = true) {
  clearTimeout(timer); clearTimeout(aptimer);
  if (esquecerChave) { chave = ''; apagarS('portal_chave') }
  $('chave').value = ''; $('app').hidden = true; $('login').hidden = false; $('aprov').hidden = true;
}
$('vchave').onclick = () => { const c = $('chave'); c.type = c.type === 'password' ? 'text' : 'password'; textoI18n('vchave', c.type === 'password' ? 'show' : 'hide') };
$('sair').onclick = () => sair(true);
$('lf').onsubmit = async e => {
  e.preventDefault(); chave = $('chave').value.trim(); delete $('lerr').dataset.i18n; $('lerr').textContent = '';
  lembrar = $('lembrar').checked; apagarS('portal_chave'); gravarS('portal_lembrar', lembrar ? '1' : '0');
  try { await carregarLista(true); gravarS('portal_chave', chave, lembrar); iniciar() }
  catch (err) { if (err.code !== 'unapproved') { mostrarErro('lerr', err); chave = '' } else gravarS('portal_chave', chave, lembrar) }
};
function pedirAprovacao() {
  clearTimeout(timer); $('app').hidden = true; $('login').hidden = false; $('aprov').hidden = false;
  esperar();
}
$('appedir').onclick = async () => {
  delete $('apinfo').dataset.pedido; textoI18n('apinfo', 'requesting');
  try {
    const d = await api('/api/acesso/pedir', {nome: $('apnome').value});
    aparelhoAntigo = ''; apagarS('portal_aparelho');
    delete $('apinfo').dataset.i18n; $('apinfo').dataset.pedido = '1';
    $('apinfo').innerHTML = '<span data-i18n="requestCode">' + esc(t('requestCode')) + '</span><strong style="font-size:22px;letter-spacing:2px">' + esc(d.codigo) + '</strong><br>' +
      '<span data-i18n="approvalBefore">' + esc(t('approvalBefore')) + '</span><em data-i18n="accesses">' + esc(t('accesses')) + '</em><span data-i18n="approvalAfter">' + esc(t('approvalAfter')) + '</span>';
    esperar();
  } catch (err) { mostrarErro('apinfo', err) }
};
async function esperar() {
  clearTimeout(aptimer);
  try {
    const d = await api('/api/acesso/estado');
    if (d.estado === 'aprovado') { $('aprov').hidden = true; iniciar(); return }
    if (d.estado === 'recusado') { delete $('apinfo').dataset.pedido; textoI18n('apinfo', 'requestDenied'); return }
    if (d.estado === 'nenhum' && $('apinfo').dataset.pedido === '1') { delete $('apinfo').dataset.pedido; textoI18n('apinfo', 'requestExpired'); return }
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
  $('spaces').innerHTML = (vis.length ? '' : '<div class="muted" style="padding:8px 4px">' + esc(t('noAgents', {type: tipo === 'todos' ? t('all') : tipo})) + '</div>') + vis.map(s => '<button type="button" class="space' + (s.pane === atual ? ' sel' : '') + '" data-p="' + esc(s.pane) + '"><span><strong>' + rot(s) + '</strong><small>' + esc(s.title) + '</small></span><span class="dot s-' + esc(s.status) + '">' + esc(ST[s.status] ? t(ST[s.status]) : s.status) + '</span></button>').join('');
  $('sel').innerHTML = '<option value="">' + esc(t('chooseOption')) + '</option>' + vis.map(s => '<option value="' + esc(s.pane) + '"' + (s.pane === atual ? ' selected' : '') + '>' + rot(s) + ' · ' + esc(ST[s.status] ? t(ST[s.status]) : s.status) + '</option>').join('');
}
$('tipos').onclick = e => { const t = e.target.dataset.tipo; if (!t) return; tipo = t; gravarS('portal_tipo', t); desenharLista() };
$('spaces').onclick = e => { const b = e.target.closest('[data-p]'); if (b) escolher(b.dataset.p) };
$('sel').onchange = () => $('sel').value && escolher($('sel').value);
function escolher(p) {
  atual = p; gravarS('portal_space', p); ger++; grudado = true; ultRecados = 0;
  document.querySelectorAll('.space').forEach(b => b.classList.toggle('sel', b.dataset.p === p)); $('sel').value = p;
  textoI18n('tela', 'loading'); $('chat').innerHTML = ''; $('chat').dataset.h = ''; $('dlg').hidden = true;
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
$('cheia').onclick = () => { const s = $('sec'); s.classList.toggle('full'); textoI18n('cheia', s.classList.contains('full') ? 'exitFullscreen' : 'fullscreen'); grudado = true; caber() };
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
  ultEstado = estado;
  const c = $('chat'); let html = '', tools = [];
  const flush = () => { if (tools.length) { html += '<div class="tl">🔧 ' + tools.map(esc).join('\n🔧 ') + '</div>'; tools = [] } };
  for (const e of conv) {
    if (e.r === 'tool') { tools.push(e.x); if (tools.length > 6) tools.shift(); continue }
    flush();
    const hora = e.t ? new Date(e.t + 'Z').toLocaleTimeString(locale(), {hour: '2-digit', minute: '2-digit'}) : '';
    html += '<div class="m ' + (e.r === 'user' ? 'u' : 'c') + '">' + md(e.x) + '<div class="hr">' + esc(hora) + '</div></div>';
  }
  flush();
  if (estado === 'working') html += '<div class="work">' + esc(t('chatWorking')) + '</div>';
  html = html || '<div class="work">' + esc(t('noMessages')) + '</div>';
  if (c.dataset.h !== html) { c.innerHTML = html; c.dataset.h = html; if (grudado) c.scrollTop = c.scrollHeight }
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
  const dur = s => { if (!num(s)) return '?'; const m = Math.floor((Date.now() / 1000 - s) / 60); return m >= 1440 ? Math.floor(m / 1440) + ' d ' + Math.floor(m % 1440 / 60) + ' h' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min' };
  const quando = valor => { if (!valor) return '?'; const d = new Date(typeof valor === 'number' ? valor * 1000 : valor); if (isNaN(d)) return '?';
    const hoje = new Date().toDateString() === d.toDateString(); return hoje ? t('at') + d.toLocaleTimeString(locale(), {hour: '2-digit', minute: '2-digit'}) : d.toLocaleDateString(locale(), {weekday: 'short', day: '2-digit', month: '2-digit'}) + ' ' + d.toLocaleTimeString(locale(), {hour: '2-digit', minute: '2-digit'}) };
  const card = (k, html) => ocultos.has(k) ? '' : '<div class="st" data-card="' + esc(k) + '"><button type="button" class="fechar" data-fechar="' + esc(k) + '" aria-label="' + esc(t('hideCard')) + '" title="' + esc(t('hideShort')) + '">✕</button>' + html + '</div>';
  const lc = (k, nome, pct, reset) => pct == null ? '' : card(k, '<small>' + esc(nome) + '</small><b>' + num(pct) + esc(t('used')) + '</b>' + esc(t('resets')) + esc(quando(reset)) + barra(pct));
  let h = '';
  if (st && modo === 'conversa') h += card('modelo', '<small>' + esc(t('model')) + '</small><b>' + esc(nomeModelo(st.modelo)) + '</b>');
  if (lim) h += lc('claude5h', t('claudeWindow'), lim.claude_5h, lim.claude_5h_reset) + lc('codex5h', t('codexWindow'), lim.codex_5h, lim.codex_5h_reset) + lc('codexsem', t('codexWeek'), lim.codex_sem, lim.codex_sem_reset);
  if (st && modo === 'conversa') {
    h += card('contexto', '<small>' + esc(t('context')) + '</small><b>' + num(st.ctx_pct) + '%</b> · ' + Math.round(num(st.ctx) / 1000) + esc(t('contextTokens')) + barra(st.ctx_pct));
    if (st.ferramentas != null) h += card('sessao', '<small>' + esc(t('session')) + '</small><b>' + esc(dur(st.inicio)) + '</b> · ' + num(st.ferramentas) + esc(t('actions')));
    h += card('modo', '<small>' + esc(t('mode')) + '</small><b>' + esc(st.modo === 'auto' ? t('automatic') : st.modo || '?') + '</b>' + (st.branch ? ' · git ' + esc(st.branch) : ''));
  }
  if (ocultos.size) h += '<button type="button" class="b restaurar" data-restaurar="1" title="' + esc(t('restoreHelp')) + '">' + esc(t('restoreCards')) + ' (' + ocultos.size + ')</button>';
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
      delete $('nome').dataset.i18n; $('nome').textContent = s.workspace + (s.agent !== 'claude' ? ' (' + s.agent + ')' : ''); $('estado').textContent = ST[s.status] ? t(ST[s.status]) : s.status;
      if (modo === 'conversa' && s.agent === 'claude') {
        try { await carregarConversa(g) } catch (err) { if (/indisponível/.test(err.message)) { modo = 'vivo'; aplicarTela() } else throw err }
        if (g !== ger) return;
        if (Date.now() - ultRecados > 6000) { const r = await api('/api/recados?pane=' + encodeURIComponent(atual)); if (g !== ger) return; desenharRecados(r.historico); ultRecados = Date.now() }
      } else {
        if (modo === 'conversa') { modo = 'vivo'; aplicarTela() }
        const d = await api('/api/tela?pane=' + encodeURIComponent(atual) + '&modo=' + (modo === 'historico' ? 'historico' : 'vivo'));
        if (g !== ger) return;
        const t = $('tela'); delete t.dataset.i18n; if (d.tela) t.textContent = d.tela; else textoI18n('tela', 'emptyScreen'); caber(); if (grudado) t.scrollTop = t.scrollHeight;
        desenharDialogo(d.dialogo); desenharRecados(d.historico); desenharStatus(null, d.limites);
      }
    } else { textoI18n('nome', 'chooseSpace'); delete $('tela').dataset.i18n; $('tela').textContent = ''; $('chat').innerHTML = ''; $('hist').innerHTML = ''; ultHistorico = []; $('dlg').hidden = true }
    $('status').erroCliente = null; textoI18n('status', 'updatedStatus', {time: new Date().toLocaleTimeString(locale())}); $('status').className = 'muted';
  } catch (e) { if (g === ger) { textoI18n('status', 'connectionStatus', {error: e.message}); $('status').erroCliente = e.code ? e : null; $('status').className = 'err' } }
  if (g === ger && chave && !$('app').hidden) timer = setTimeout(atualizar, document.hidden ? 15000 : (modo === 'historico' ? 4000 : 1500));
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && chave && !$('app').hidden) atualizar() });
function desenharRecados(h) {
  ultHistorico = h || [];
  const tipo = x => x.tipo === 'tecla' ? '<em>' + esc(t('keyPress')) + esc(x.texto) + '</em>' : x.tipo === 'arquivo' ? '📎 ' + esc(x.texto) : esc(x.texto);
  $('hist').innerHTML = h && h.length ? '<small class="muted" data-i18n="yourMessages">' + esc(t('yourMessages')) + '</small>' + h.slice().reverse().map(x => '<div><small class="muted">' + esc(String(x.t).slice(5, 16)) + (x.aparelho ? ' · ' + esc(x.aparelho) : '') + '</small> ' + tipo(x) + '</div>').join('') : '';
}

// ---------- envio de recados, teclas e arquivos
async function tecla(k) {
  if (!atual) return;
  try { await api('/api/tecla', {pane: atual, tecla: k, dlg: dlgId}); msgI18n('keySent', true, {key: k}); dlgId = ''; $('dlg').hidden = true; setTimeout(atualizar, 700) }
  catch (err) { msgErro(err); setTimeout(atualizar, 300) }
}
document.querySelector('.teclas').onclick = e => { const k = e.target.dataset.k; if (k) tecla(k) };
function desenharAnexos() {
  $('anexos').innerHTML = anexos.map((f, i) => '<span class="anexo">📎 ' + esc(f.name) + ' <small>(' + Math.ceil(f.size / 1024) + ' KB)</small><button type="button" data-rm="' + i + '" aria-label="' + esc(t('remove')) + '">✕</button></span>').join('');
}
function anexar(files) {
  for (let f of files) {
    if (!f || !f.size) continue;
    if (!f.name || f.name === 'image.png') f = new File([f], 'print_' + Date.now() + '.png', {type: f.type || 'image/png'});
    const ext = (f.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (!EXT.has(ext)) { msgI18n('typeError', false, {ext: ext || t('noExtension'), name: f.name}); continue }
    if (f.size > MAX_MB * 1048576) { msgI18n('exceeds', false, {name: f.name, size: MAX_MB}); continue }
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
      msgI18n('sendingFile', undefined, {name: f.name});
      const d = await api('/api/arquivo?pane=' + encodeURIComponent(atual) + '&nome=' + encodeURIComponent(f.name), f, {timeout: 900000});
      enviados.push(d.caminho); anexos.shift(); desenharAnexos();
    }
    const caminhos = enviados;
    if (caminhos.length) texto = (texto ? texto + '\n\n' : t('fileIntro') + '\n\n') + t('filePaths') + '\n' + caminhos.map(c => '- ' + c).join('\n');
    msgI18n('sending');
    await api('/api/enviar', {pane: atual, texto});
    $('texto').value = ''; anexos = []; enviados = []; desenharAnexos(); msgI18n('sent', true); grudado = true; ultRecados = 0; setTimeout(atualizar, 1000);
  } catch (err) { msgErro(err) }
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
    const dt = t => new Date(num(t) * 1000).toLocaleString(locale(), {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
    let h = '<h2><span data-i18n="requests">' + esc(t('requests')) + '</span></h2>' + (d.pendentes.map(r => '<div class="ac"><strong>' + esc(r.nome) + '</strong><br><small>' + esc(r.navegador) + '<br><span data-i18n="origin">' + esc(t('origin')) + '</span>' + esc(r.cliente || '?') + ' · ' + dt(r.criado) + '</small>' +
      '<div class="row"><input inputmode="numeric" maxlength="6" data-i18n-ph="code" placeholder="' + esc(t('code')) + '" data-cod="' + esc(r.id) + '"><button class="b main" type="button" data-ap="' + esc(r.id) + '"><span data-i18n="approve">' + esc(t('approve')) + '</span></button><button class="b" type="button" data-rc="' + esc(r.id) + '"><span data-i18n="deny">' + esc(t('deny')) + '</span></button></div></div>').join('') || '<div class="muted"><span data-i18n="none">' + esc(t('none')) + '</span></div>');
    h += '<h2 style="margin-top:14px"><span data-i18n="approvedDevices">' + esc(t('approvedDevices')) + '</span></h2>' + (d.aparelhos.map(r => '<div class="ac">' + esc(r.nome) + (r.este ? ' <em><span data-i18n="thisDevice">' + esc(t('thisDevice')) + '</span></em>' : '') + '<br><small><span data-i18n="seen">' + esc(t('seen')) + '</span>' + dt(r.ultimo) + '<span data-i18n="expires">' + esc(t('expires')) + '</span>' + dt(r.expira) + '</small><div class="row"><button class="b" type="button" data-rv="' + esc(r.id) + '"><span data-i18n="revoke">' + esc(t('revoke')) + '</span></button></div></div>').join('') || '<div class="muted"><span data-i18n="none">' + esc(t('none')) + '</span></div>');
    h += '<div class="row"><button class="b" type="button" data-esq="1"><span data-i18n="forget">' + esc(t('forget')) + '</span></button><button class="b perigo" type="button" data-troca="1"><span data-i18n="rotate">' + esc(t('rotate')) + '</span></button></div><div id="chnova"></div>';
    h += '<h2 style="margin-top:14px"><span data-i18n="events">' + esc(t('events')) + '</span></h2><div class="aud">' + (d.auditoria || []).map(a => '<div>' + esc(String(a.t).slice(5, 16)) + ' · ' + esc(a.evento) + (a.aparelho ? ' · ' + esc(a.aparelho) : '') + (a.cliente ? ' · ' + esc(a.cliente) : '') + (a.detalhe ? ' · ' + esc(a.detalhe) : '') + '</div>').join('') + '</div>';
    if (document.activeElement?.dataset?.cod || document.activeElement?.id === 'chatual' || $('acessos').querySelector('[data-confirma="1"]')) return;
    const codigos = {}; document.querySelectorAll('[data-cod]').forEach(i => { if (i.value) codigos[i.dataset.cod] = i.value });
    const nova = $('chnova') ? $('chnova').innerHTML : '';
    $('acessos').innerHTML = h;
    for (const [id, v] of Object.entries(codigos)) { const i = document.querySelector('[data-cod="' + CSS.escape(id) + '"]'); if (i) i.value = v }
    if (nova && $('chnova')) $('chnova').innerHTML = nova;
  } catch (e) {}
}
$('acessos').onclick = async e => {
  const botao = e.target.closest('button'); if (!botao) return;
  const b = botao.dataset;
  try {
    if (b.ap) { const cod = document.querySelector('[data-cod="' + CSS.escape(b.ap) + '"]').value.trim(); await api('/api/acesso/decidir', {id: b.ap, aprovar: true, codigo: cod}); msgI18n('deviceApproved', true) }
    else if (b.rc) await api('/api/acesso/decidir', {id: b.rc, aprovar: false});
    else if (b.rv) await api('/api/acesso/revogar', {id: b.rv});
    else if (b.esq) { await api('/api/acesso/esquecer', {}); aparelhoAntigo = ''; apagarS('portal_aparelho'); sair(true); return }
    else if (b.troca) {
      if (botao.dataset.confirma !== '1') {
        botao.dataset.confirma = '1'; botao.dataset.i18n = 'confirmRotate'; botao.textContent = t('confirmRotate');
        $('chnova').innerHTML = '<div class="row"><input id="chatual" type="password" data-i18n-ph="currentKey" placeholder="' + esc(t('currentKey')) + '" autocapitalize="off" spellcheck="false"><small class="muted"><span data-i18n="rotateHelp">' + esc(t('rotateHelp')) + '</span></small></div>';
        return;
      }
      const d = await api('/api/acesso/trocar-chave', {revogar_todos: false, chave_atual: ($('chatual') || {}).value || ''});
      chave = d.chave; apagarS('portal_chave'); gravarS('portal_chave', chave, lembrar);
      botao.dataset.confirma = ''; botao.dataset.i18n = 'rotate'; botao.textContent = t('rotate');
      $('chnova').innerHTML = '<p><span data-i18n="newKey">' + esc(t('newKey')) + '</span></p><div class="novachave">' + esc(d.chave) + '</div>';
      return;
    } else return;
    carregarAcessos();
  } catch (err) { msgErro(err) }
};

aplicarIdioma();
$('lembrar').checked = lembrar;
function iniciar() { $('login').hidden = true; $('app').hidden = false; aplicarTela(); atualizar() }
if (chave) api('/api/spaces').then(iniciar).catch(e => { if (e.code === 'invalidKey') sair(true); else if (e.code !== 'unapproved') { $('login').hidden = false; mostrarErro('lerr', e) } });
else sair(false);
