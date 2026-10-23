'use strict';
// MGE-AgentPortal: conversa com os agentes do herdr, terminal ao vivo, decisões, arquivos e acessos.
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
    "dragCard": "arraste para mudar de lugar",
    "hideShort": "ocultar",
    "used": "% usados",
    "resets": " · renova ",
    "at": "às ",
    "model": "Modelo",
    "claudeWindow": "Claude · janela de 5 h",
    "codexWindow": "Codex · janela de 5 h",
    "codexWeek": "Codex · semana",
    "context": "Contexto da conversa",
    "contextTokens": "{used} de {total} tokens",
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
    "holdDone": "⏳ Quando terminar",
    "holdDoneTitle": "guarda o recado e entrega quando o agente terminar a tarefa atual",
    "interruptSend": "⛔ Interromper e enviar",
    "interruptSendTitle": "interrompe o que o agente está fazendo (Esc) e envia o recado",
    "confirmInterrupt": "Interromper o que o agente está fazendo agora (Esc) e enviar o recado?",
    "interrupted": "interrompido ✓",
    "heldTitle": "Recados em espera (só chegam ao agente no momento indicado):",
    "heldIn": "⏱ entra em {s} s (ou quando o agente parar)",
    "heldAfter": "⏳ quando o agente terminar",
    "sendNow": "➤ enviar já",
    "cancelHeld": "✕ cancelar",
    "heldWait": "em espera por 2 min (o agente está trabalhando): dá para cancelar ou enviar já ✓",
    "heldAfterOk": "guardado: chega quando o agente terminar ✓",
    "threads": "📨 Recados",
    "threadsTitle": "cada recado seu com a resposta final do agente",
    "queued": "📨 Seu recado está na fila do agente: ele lê quando o comando atual terminar. Não precisa reenviar.",
    "quick": "Rápido:",
    "goAhead": "▶ pode seguir",
    "goAheadText": "pode seguir",
    "approve": "✔ pode publicar",
    "approveText": "pode publicar",
    "quickSent": "\"{text}\" enviado ✓",
    "noReplyText": "sem resposta em texto",
    "workingSteps": "⏳ trabalhando… ({n} ações)",
    "steps": "{n} ações",
    "noThreads": "(sem recados nesta sessão)",
    "sharedConfirm": "Recebido pelo Compartilhar: {n} arquivo(s){txt}. Anexar à caixa de recado?",
    "sharedText": " e um texto",
    "sharedReady": "Compartilhado: escolha o space e toque em Enviar.",
    "sharedLost": "Abra o portal uma vez pelo app e compartilhe de novo (os arquivos não chegaram).",
    "moreSize": "⋯ Tamanho",
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
    "updatedStatus": "Atualizado {time}",
    "pcPanel": "Recursos do PC",
    "panelOpenError": "Não foi possível abrir o painel. Entre novamente no portal."
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
    "dragCard": "drag to move",
    "hideShort": "hide",
    "used": "% used",
    "resets": " · resets ",
    "at": "at ",
    "model": "Model",
    "claudeWindow": "Claude · 5 h window",
    "codexWindow": "Codex · 5 h window",
    "codexWeek": "Codex · week",
    "context": "Conversation context",
    "contextTokens": "{used} of {total} tokens",
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
    "holdDone": "⏳ When done",
    "holdDoneTitle": "keeps the message and delivers it when the agent finishes the current task",
    "interruptSend": "⛔ Interrupt and send",
    "interruptSendTitle": "interrupts what the agent is doing (Esc) and sends the message",
    "confirmInterrupt": "Interrupt what the agent is doing now (Esc) and send the message?",
    "interrupted": "interrupted ✓",
    "heldTitle": "Held messages (reach the agent only at the time shown):",
    "heldIn": "⏱ goes in {s} s (or when the agent stops)",
    "heldAfter": "⏳ when the agent finishes",
    "sendNow": "➤ send now",
    "cancelHeld": "✕ cancel",
    "heldWait": "held for 2 min (the agent is working): you can cancel or send now ✓",
    "heldAfterOk": "saved: delivered when the agent finishes ✓",
    "threads": "📨 Messages",
    "threadsTitle": "each of your messages with the agent's final reply",
    "queued": "📨 Your message is in the agent's queue: it is read when the current command finishes. No need to resend.",
    "quick": "Quick:",
    "goAhead": "▶ go ahead",
    "goAheadText": "go ahead",
    "approve": "✔ approved",
    "approveText": "approved, go ahead",
    "quickSent": "\"{text}\" sent ✓",
    "noReplyText": "no text reply",
    "workingSteps": "⏳ working… ({n} steps)",
    "steps": "{n} steps",
    "noThreads": "(no messages in this session)",
    "sharedConfirm": "Received via Share: {n} file(s){txt}. Attach to the message box?",
    "sharedText": " and a text",
    "sharedReady": "Shared: choose a space and tap Send.",
    "sharedLost": "Open the portal once as an app and share again (the files did not arrive).",
    "moreSize": "⋯ Size",
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
    "updatedStatus": "Updated {time}",
    "pcPanel": "PC resources",
    "panelOpenError": "Unable to open the panel. Please sign in to the portal again."
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
let modo = lerS('portal_modo') || 'recados';
const ehConv = () => modo === 'conversa' || modo === 'recados';
let tipo = lerS('portal_tipo') || 'claude';
let ocultos = new Set((lerS('portal_cartoes_ocultos') || '').split(',').filter(Boolean));
let ultSt = null, ultLim = null, ultEstado = '', ultHistorico = [];
let fonte = +lerS('portal_fonte') || 12.5, alt = +lerS('portal_alt') || 52;
let auto = lerS('portal_auto') !== '0', quebra = lerS('portal_quebra') === '1';
if (lerS('portal_auto') === null && matchMedia('(max-width:760px)').matches) { auto = false; quebra = true }
let lista = [], grudado = true, timer = null, aptimer = null, ger = 0, ultLista = 0, ultRecados = 0, abertoAc = false;
let conv = [], convN = 0, convEpoca = '', convPane = '', anexos = [], dlgId = '', pendVistos = '', lembrar = lerS('portal_lembrar') !== '0';
const EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt', '.md', '.csv', '.tsv', '.json', '.xyz', '.log', '.out', '.inp', '.gjf', '.com', '.mol', '.mol2', '.sdf', '.pdb', '.cif', '.docx', '.xlsx', '.pptx', '.zip']);
let maxUploadMB = 25;

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
  const resposta = await api('/api/spaces');
  maxUploadMB = num(resposta.upload_mb, 25);
  lista = resposta.spaces; $('abrirPainel').hidden = !resposta.painel; ultLista = Date.now();
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
  atual = p; gravarS('portal_space', p); ger++; grudado = true; ultRecados = 0; $('guardados').hidden = true; $('guardados').innerHTML = '';
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
  const ehChat = ehConv(), t = $('tela');
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
function tabelas(h) {   // markdown tables (| a | b |) become <table> with horizontal scroll / tabelas markdown viram <table>
  const L = h.split('\n'), out = [];
  const cel = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  for (let i = 0; i < L.length; i++) {
    if (/^\s*\|.*\|\s*$/.test(L[i]) && i + 1 < L.length && /^\s*\|?\s*:?-{2,}/.test(L[i + 1])) {
      let t = '<div class="tbl"><table><tr>' + cel(L[i]).map(c => '<th>' + c + '</th>').join('') + '</tr>'; i += 2;
      while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) { t += '<tr>' + cel(L[i]).map(c => '<td>' + c + '</td>').join('') + '</tr>'; i++ }
      out.push(t + '</table></div>'); i--;
    } else out.push(L[i]);
  }
  return out.join('\n');
}
function md(x) {
  let h = esc(x); const blocos = [];
  h = h.replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, (m, c) => { blocos.push(c); return '\u0000' + (blocos.length - 1) + '\u0000' });
  h = tabelas(h);
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/^#{1,4} (.*)$/gm, '<strong>$1</strong>');
  h = h.replace(/(^|[\s(>])(https?:\/\/[^\s<)"']+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  return h.replace(/\u0000(\d+)\u0000/g, (m, i) => '<pre>' + (blocos[+i] ?? '') + '</pre>');
}
function desenharChat(estado) {
  ultEstado = estado;
  if (modo === 'recados') return desenharFio(estado);
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
  html += dlgHtml();
  html = html || '<div class="work">' + esc(t('noMessages')) + '</div>';
  if (c.dataset.h !== html) { c.innerHTML = html; c.dataset.h = html; if (grudado) c.scrollTop = c.scrollHeight }
}
$('omc').onclick = $('omc2').onclick = e => {
  const k = e.target.dataset.fechar;
  if (k) ocultos.add(k); else if (e.target.dataset.restaurar) ocultos.clear(); else return;
  gravarS('portal_cartoes_ocultos', [...ocultos].join(',')); desenharStatus(ultSt, ultLim);
};
const ORDEM_PADRAO = {topo: ['claude5h', 'codex5h', 'codexsem', 'contexto'], baixo: ['modelo', 'sessao', 'modo']};
let ordemCartoes = (() => { try { const o = JSON.parse(lerS('portal_cartoes_ordem') || 'null'); if (o && Array.isArray(o.topo) && Array.isArray(o.baixo)) return o } catch (e) {} return ORDEM_PADRAO })();
let arrasto = null;
function salvarOrdem() {
  const zona = id => [...$(id).querySelectorAll('.st')].map(c => c.dataset.card), noDom = new Set([...zona('omc'), ...zona('omc2')]);
  const fora = z => ordemCartoes[z].filter(k => !noDom.has(k));
  ordemCartoes = {topo: [...zona('omc'), ...fora('topo')], baixo: [...zona('omc2'), ...fora('baixo')]};
  gravarS('portal_cartoes_ordem', JSON.stringify(ordemCartoes));
}
document.addEventListener('pointerdown', e => {
  const a = e.target.closest('.cartoes .alca'); if (!a) return;
  e.preventDefault(); arrasto = {c: a.closest('.st'), id: e.pointerId};
  arrasto.c.classList.add('arrastando'); document.body.classList.add('arrastando-cartao');
  try { a.setPointerCapture(e.pointerId) } catch (_) {}
});
document.addEventListener('pointermove', e => {
  if (!arrasto || e.pointerId !== arrasto.id) return;
  const el = document.elementFromPoint(e.clientX, e.clientY), z = el && el.closest('.cartoes'); if (!z) return;
  const alvo = el.closest('.st');
  if (alvo && alvo !== arrasto.c) { const r = alvo.getBoundingClientRect(); z.insertBefore(arrasto.c, e.clientX - r.left < r.width / 2 ? alvo : alvo.nextSibling) }
  else if (!alvo && arrasto.c.parentNode !== z) z.insertBefore(arrasto.c, z.querySelector('.restaurar'));
});
function soltarCartao(e) {
  if (!arrasto || e.pointerId !== arrasto.id) return;
  arrasto.c.classList.remove('arrastando'); document.body.classList.remove('arrastando-cartao'); arrasto = null;
  salvarOrdem(); $('omc').dataset.h = $('omc2').dataset.h = ''; desenharStatus(ultSt, ultLim);
}
document.addEventListener('pointerup', soltarCartao); document.addEventListener('pointercancel', soltarCartao);
function barra(p) { p = num(p); const c = p >= 90 ? 'h' : p >= 70 ? 'w' : ''; return '<div class="mt"><i class="' + c + '" style="width:' + Math.max(0, Math.min(100, p)) + '%"></i></div>' }
function desenharStatus(st, lim) {
  ultSt = st; ultLim = lim;
  if (arrasto) return;
  const o = $('omc'), o2 = $('omc2'); if (!st && !lim) { o.hidden = o2.hidden = true; return }
  const C = {};
  const nomeModelo = m => { const x = String(m || '').match(/claude-([a-z]+)-(\d+)-(\d+)/); return x ? x[1][0].toUpperCase() + x[1].slice(1) + ' ' + x[2] + '.' + x[3] : (m || '?') };
  const dur = s => { if (!num(s)) return '?'; const m = Math.floor((Date.now() / 1000 - s) / 60); return m >= 1440 ? Math.floor(m / 1440) + ' d ' + Math.floor(m % 1440 / 60) + ' h' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min' };
  const quando = valor => { if (!valor) return '?'; const d = new Date(typeof valor === 'number' ? valor * 1000 : valor); if (isNaN(d)) return '?';
    const hoje = new Date().toDateString() === d.toDateString(); return hoje ? t('at') + d.toLocaleTimeString(locale(), {hour: '2-digit', minute: '2-digit'}) : d.toLocaleDateString(locale(), {weekday: 'short', day: '2-digit', month: '2-digit'}) + ' ' + d.toLocaleTimeString(locale(), {hour: '2-digit', minute: '2-digit'}) };
  const card = (k, html) => ocultos.has(k) ? '' : C[k] = '<div class="st" data-card="' + esc(k) + '"><button type="button" class="fechar" data-fechar="' + esc(k) + '" aria-label="' + esc(t('hideCard')) + '" title="' + esc(t('hideShort')) + '">✕</button><span class="alca" title="' + esc(t('dragCard')) + '" aria-hidden="true">⠿</span>' + html + '</div>';
  const lc = (k, nome, pct, reset) => pct == null ? '' : card(k, '<small>' + esc(nome) + '</small><b>' + num(pct) + esc(t('used')) + '</b>' + esc(t('resets')) + esc(quando(reset)) + barra(pct));
  let h = '';
  if (st && ehConv()) h += card('modelo', '<small>' + esc(t('model')) + '</small><b>' + esc(nomeModelo(st.modelo)) + '</b>');
  if (lim) h += lc('claude5h', t('claudeWindow'), lim.claude_5h, lim.claude_5h_reset) + lc('codex5h', t('codexWindow'), lim.codex_5h, lim.codex_5h_reset) + lc('codexsem', t('codexWeek'), lim.codex_sem, lim.codex_sem_reset);
  if (st && ehConv()) {
    h += card('contexto', '<small>' + esc(t('context')) + '</small><b>' + num(st.ctx_pct) + '%</b> · ' + esc(t('contextTokens', {used: num(st.ctx).toLocaleString(locale()), total: num(st.janela_contexto, 1000000).toLocaleString(locale())})) + barra(st.ctx_pct));
    if (st.ferramentas != null) h += card('sessao', '<small>' + esc(t('session')) + '</small><b>' + esc(dur(st.inicio)) + '</b> · ' + num(st.ferramentas) + esc(t('actions')));
    h += card('modo', '<small>' + esc(t('mode')) + '</small><b>' + esc(st.modo === 'auto' ? t('automatic') : st.modo || '?') + '</b>' + (st.branch ? ' · git ' + esc(st.branch) : ''));
  }
  const zonaDe = k => ordemCartoes.topo.includes(k) ? 'topo' : ordemCartoes.baixo.includes(k) ? 'baixo' : ORDEM_PADRAO.topo.includes(k) ? 'topo' : 'baixo';
  const monta = z => [...ordemCartoes[z], ...Object.keys(C).filter(k => !ordemCartoes.topo.includes(k) && !ordemCartoes.baixo.includes(k) && zonaDe(k) === z)].filter(k => C[k]).map(k => C[k]).join('');
  const h1 = monta('topo');
  let h2 = monta('baixo');
  if (ocultos.size) h2 += '<button type="button" class="b restaurar" data-restaurar="1" title="' + esc(t('restoreHelp')) + '">' + esc(t('restoreCards')) + ' (' + ocultos.size + ')</button>';
  if (o.dataset.h !== h1) { o.innerHTML = h1; o.dataset.h = h1 }
  if (o2.dataset.h !== h2) { o2.innerHTML = h2; o2.dataset.h = h2 }
  o.hidden = !h1; o2.hidden = !h2;
}
// Messages mode: each user message with the FINAL reply of that turn (tool steps only counted)
function desenharFio(estado) {
  const c = $('chat'), pares = []; let par = null;
  for (const e of conv) {
    if (e.r === 'user') { par = {u: e, r: null, passos: 0}; pares.push(par); continue }
    if (!par) continue;
    if (e.r === 'tool') par.passos++; else par.r = e;
  }
  const hora = x => x ? new Date(x + 'Z').toLocaleTimeString(locale(), {hour: '2-digit', minute: '2-digit'}) : '';
  let html = pares.slice(-40).map((p, i, a) => {
    const ult = i === a.length - 1, txt = p.u.x.replace(/^\[[^\]]*portal\]\s*/i, '');
    return '<div class="par"><div class="m u">' + md(txt) + '<div class="hr">' + esc(hora(p.u.t)) + '</div></div>' +
      (p.r ? '<div class="m c">' + md(p.r.x) + '<div class="hr">' + esc(hora(p.r.t)) + (p.passos ? ' · ' + esc(t('steps', {n: p.passos})) : '') + '</div></div>' :
        '<div class="passos">' + esc(ult && estado === 'working' ? t('workingSteps', {n: p.passos}) : t('noReplyText')) + '</div>') + '</div>';
  }).join('');
  html = (html || '<div class="work">' + esc(t('noThreads')) + '</div>') + dlgHtml();
  if (c.dataset.h !== html) { c.innerHTML = html; c.dataset.h = html; if (grudado) c.scrollTop = c.scrollHeight }
}
async function carregarConversa(g) {
  if (convPane !== atual) { conv = []; convN = 0; convEpoca = ''; convPane = atual; grudado = true }
  const d = await api('/api/conversa?pane=' + encodeURIComponent(atual) + '&desde=' + convN + '&epoca=' + encodeURIComponent(convEpoca));
  if (g !== ger) return;
  if (d.epoca !== convEpoca || d.n < convN) { conv = d.itens; convEpoca = d.epoca }
  else conv = conv.concat(d.itens).slice(-400);
  convN = d.n; desenharChat(d.estado); desenharStatus(d.status, d.limites); desenharDialogo(d.dialogo); $('fila').hidden = !d.fila;
}

// ---------- decisões (permissões, perguntas, confiar na pasta)
let dlgAtual = null;
function dlgHtml() {   // the decision also appears INSIDE the chat, at the end / a decisão aparece também dentro da conversa
  const dg = dlgAtual; if (!dg) return '';
  return '<div class="dlgchat"><strong>' + esc(t('decision')) + '</strong><pre>' + esc(dg.pergunta || '') + '</pre><div class="ops">' +
    dg.opcoes.map(o => '<button class="b' + (o.marcada ? ' on' : '') + '" type="button" data-op="' + esc(o.n) + '">' + esc(o.n) + '. ' + esc(o.texto) + '</button>').join('') +
    '<button class="b" type="button" data-op="esc">' + esc(t('cancel')) + '</button></div><small class="muted">' + esc(t('freeText')) + '</small></div>';
}
function desenharDialogo(dg) {
  dlgId = dg && dg.id ? dg.id : '';
  const antes = dlgAtual?.id; dlgAtual = dg && dg.opcoes?.length ? dg : null;
  if (ehConv() && dlgAtual?.id !== antes) { $('chat').dataset.h = ''; grudado = true; desenharChat(ultEstado) }
  if (!dg || !dg.opcoes || !dg.opcoes.length) { $('dlg').hidden = true; return }
  if (ehConv()) { $('dlg').hidden = true; return }
  $('dlgq').textContent = dg.pergunta || '';
  $('dlgops').innerHTML = dg.opcoes.map(o => '<button class="b' + (o.marcada ? ' on' : '') + '" type="button" data-op="' + esc(o.n) + '">' + esc(o.n) + '. ' + esc(o.texto) + '</button>').join('');
  $('dlg').hidden = false;
}
$('chat').addEventListener('click', e => { const n = e.target.closest('.dlgchat [data-op]')?.dataset.op; if (n) tecla(n) });
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
      if (ehConv() && s.agent === 'claude') {
        try { await carregarConversa(g) } catch (err) { if (/indisponível/.test(err.message)) { modo = 'vivo'; aplicarTela() } else throw err }
        if (g !== ger) return;
        if (Date.now() - ultRecados > 6000) { const r = await api('/api/recados?pane=' + encodeURIComponent(atual)); if (g !== ger) return; desenharRecados(r.historico); ultRecados = Date.now(); carregarGuardados() }
      } else {
        if (ehConv()) { modo = 'vivo'; aplicarTela() }
        const d = await api('/api/tela?pane=' + encodeURIComponent(atual) + '&modo=' + (modo === 'historico' ? 'historico' : 'vivo'));
        if (g !== ger) return;
        const t = $('tela'); delete t.dataset.i18n; if (d.tela) t.textContent = d.tela; else textoI18n('tela', 'emptyScreen'); caber(); if (grudado) t.scrollTop = t.scrollHeight;
        desenharDialogo(d.dialogo); desenharRecados(d.historico); desenharStatus(null, d.limites); $('fila').hidden = !d.fila;
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
$('acoes').onclick = async e => {   // quick replies go straight to the agent; the draft and attachments stay put
  const b = e.target.closest('[data-rapido]'); if (!b || !atual) return;
  const texto = t(b.dataset.rapido);
  try { await api('/api/enviar', {pane: atual, texto, agora: true}); msg(t('quickSent', {text: texto}), true); ultRecados = 0; setTimeout(atualizar, 1000) } catch (err) { msg(err.message, false) }
};
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
    if (f.size > maxUploadMB * 1048576) { msgI18n('exceeds', false, {name: f.name, size: maxUploadMB}); continue }
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
let modoEnvio = '', urgenteEnvio = false, destinoEnvio = '';   // '' normal · 'depois' until done · urgente = after Esc
$('ef').onsubmit = async e => {
  e.preventDefault(); if (enviando || !atual) return;
  const modoAgora = modoEnvio, urgenteAgora = urgenteEnvio, destino = destinoEnvio || atual; modoEnvio = ''; urgenteEnvio = false; destinoEnvio = '';
  let texto = $('texto').value.trim(); if (!texto && !anexos.length) return;
  enviando = true; $('enviar').disabled = true;
  try {
    while (anexos.length) {
      const f = anexos[0];
      msgI18n('sendingFile', undefined, {name: f.name});
      const d = await api('/api/arquivo?pane=' + encodeURIComponent(destino) + '&nome=' + encodeURIComponent(f.name), f, {timeout: 900000});
      enviados.push(d.caminho); anexos.shift(); desenharAnexos();
    }
    const caminhos = enviados;
    if (caminhos.length) texto = (texto ? texto + '\n\n' : t('fileIntro') + '\n\n') + t('filePaths') + '\n' + caminhos.map(c => '- ' + c).join('\n');
    msgI18n('sending');
    const r = await api('/api/enviar', {pane: destino, texto, depois: modoAgora === 'depois', agora: urgenteAgora});
    if (r.guardado) { $('texto').value = ''; anexos = []; enviados = []; desenharAnexos(); carregarGuardados(); msg(t(r.tipo === 'espera' ? 'heldWait' : 'heldAfterOk'), true); return }
    $('texto').value = ''; anexos = []; enviados = []; desenharAnexos(); msgI18n('sent', true); grudado = true; ultRecados = 0; setTimeout(atualizar, 1000);
  } catch (err) { msgErro(err) }
  finally { enviando = false; $('enviar').disabled = false }
};
$('depois').onclick = () => { if (enviando) return; modoEnvio = 'depois'; $('ef').requestSubmit() };
$('urgente').onclick = async () => {
  if (!atual || enviando) return; const alvo = atual;   // interrupts and sends to the SAME agent
  if (!confirm(t('confirmInterrupt'))) return;
  try { await api('/api/tecla', {pane: alvo, tecla: 'esc', dlg: dlgId}) } catch (err) { msgErro(err); return }
  await new Promise(r => setTimeout(r, 1500));
  if ($('texto').value.trim() || anexos.length) { urgenteEnvio = true; destinoEnvio = alvo; $('ef').requestSubmit() } else { msg(t('interrupted'), true); setTimeout(atualizar, 700) }
};
async function carregarGuardados() {
  if (!atual) return; const pane = atual;
  try {
    const d = await api('/api/depois?pane=' + encodeURIComponent(pane)), g = $('guardados');
    if (pane !== atual) return;   // switched agent meanwhile: never show (or cancel) the previous queue
    const quando = i => i.tipo === 'espera' ? t('heldIn', {s: Math.max(0, Math.round(i.ate - Date.now() / 1000))}) : t('heldAfter');
    g.hidden = !d.itens.length;
    g.innerHTML = '<small class="muted">' + esc(t('heldTitle')) + '</small>' + d.itens.map(i => '<div><small class="muted">' + esc(quando(i)) + '</small><br>' + esc(i.texto.slice(0, 300)) +
      ' <button type="button" data-agora="' + esc(i.id) + '" style="color:var(--accent)">' + esc(t('sendNow')) + '</button> <button type="button" data-cancelar="' + esc(i.id) + '">' + esc(t('cancelHeld')) + '</button></div>').join('');
    clearTimeout(carregarGuardados.t); if (d.itens.length) carregarGuardados.t = setTimeout(carregarGuardados, 5000);
  } catch (e) {}
}
$('guardados').onclick = async e => {
  const {cancelar, agora} = e.target.dataset; if (!cancelar && !agora) return;
  await api(cancelar ? '/api/depois/cancelar' : '/api/depois/agora', {id: cancelar || agora}).catch(() => {}); carregarGuardados();
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
// Shared from the phone (sw.js): asks before attaching the files and text to the message box
async function receberCompartilhado() {
  const q = new URLSearchParams(location.search).get('shared'); if (q === null) return;
  history.replaceState(null, '', '/spaces');
  if (q === '0' || !('caches' in window)) { msg(t('sharedLost'), false); return }
  const c = await caches.open('shared'), fs = []; let textoC = '';
  for (const k of await c.keys()) {
    const r = await c.match(k);
    if (k.url.endsWith('/text')) textoC = (await r.text()).slice(0, 4000);
    else fs.push(new File([await r.blob()], decodeURIComponent(r.headers.get('X-Name') || 'file'), {type: r.headers.get('Content-Type') || ''}));
  }
  await caches.delete('shared');
  if (!fs.length && !textoC) return;
  if (!confirm(t('sharedConfirm', {n: fs.length, txt: textoC ? t('sharedText') : ''}))) return;
  if (textoC) $('texto').value = textoC;
  if (fs.length) anexar(fs);
  msg(t('sharedReady'), true);
}
receberCompartilhado().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
$('lembrar').checked = lembrar;
function iniciar() { $('login').hidden = true; $('app').hidden = false; aplicarTela(); atualizar() }
if (chave) api('/api/spaces').then(iniciar).catch(e => { if (e.code === 'invalidKey') sair(true); else if (e.code !== 'unapproved') { $('login').hidden = false; mostrarErro('lerr', e) } });
else sair(false);

// The HTML route is authenticated through the same headers as the APIs.
$('abrirPainel').onclick = async () => {
  const painel = window.open('', '_blank');
  if (!painel) return;
  try {
    const response = await fetch('/painel', {headers: {'X-Token': chave, 'X-Device': aparelhoAntigo}, signal: AbortSignal.timeout(5000)});
    if (!response.ok) throw Error();
    const html = await response.text();
    painel.portalPanelKey = chave; painel.portalPanelDevice = aparelhoAntigo;
    painel.document.open(); painel.document.write(html); painel.document.close();
    painel.history.replaceState(null, '', '/painel');
  } catch (_) { painel.close(); $('status').textContent = t('panelOpenError'); }
};
