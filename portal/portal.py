"""MGE-AgentPortal: portal web para conversar com agentes de IA (Claude Code, Codex) que rodam no herdr.

Só biblioteca padrão do Python. Duas portas:
- privada (ex.: IP do Tailscale): exige a chave;
- pública (ex.: Tailscale Funnel -> 127.0.0.1:<porta_publica>): exige a chave + um aparelho aprovado pelo dono
  (2 etapas: o aparelho novo mostra um código de 6 dígitos; o dono DIGITA esse código num aparelho já confiável).

Configuração: <DIR>/config.json (DIR = $MGE_PORTAL_DIR ou ~/.config/mge-agentportal). Veja CONFIG_PADRAO e
config.example.json.
"""
from __future__ import annotations

from collections import OrderedDict, deque
import fcntl
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import threading
import time
from urllib.parse import parse_qs, urlsplit

DIR = Path(os.environ.get('MGE_PORTAL_DIR') or Path.home() / '.config/mge-agentportal')
CONFIG_PADRAO = dict(
    herdr=shutil.which('herdr') or str(Path.home() / '.local/bin/herdr'),
    dono='dono',                                    # aparece no prefixo dos recados: [Recado do <dono> pelo portal]
    porta_publica=8788,
    hosts_permitidos=[],                            # vazio = não confere o Host
    ocultos_na_internet=[],                         # workspaces (id, rótulo ou /pasta) que a porta pública não mostra
    aviso_cmd=[],                                   # comando de aviso (ex.: ntfy): recebe título, mensagem, prioridade
    copia_da_chave='',                              # arquivo extra opcional para a chave nova
    dias_aparelho=30,
    janela_contexto=1_000_000,
    cache_uso=str(Path.home() / '.claude/plugins/oh-my-claudecode/.usage-cache-anthropic.json'),
    painel=dict(enabled=False),                      # optional Linux PC collector
    upload_mb=25,
    upload_pasta='_recebidos_portal',
)
UPLOAD_EXT = {'.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt', '.md', '.csv', '.tsv', '.json',
              '.xyz', '.log', '.out', '.inp', '.gjf', '.com', '.mol', '.mol2', '.sdf', '.pdb', '.cif',
              '.docx', '.xlsx', '.pptx', '.zip'}


def carregar_config() -> dict:
    cfg = dict(CONFIG_PADRAO)
    try:
        cfg.update(json.loads((DIR / 'config.json').read_text()))
    except (OSError, ValueError):
        pass
    return cfg


CFG = carregar_config()
DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
TOKEN_FILE = DIR / 'token'
ACESSOS = DIR / 'acessos.json'
AUDITORIA = DIR / 'auditoria.log'
RECADOS = DIR / 'recados.log'
PANE_RE = re.compile(r'w[0-9A-Za-z]+:p[0-9]+')
TECLAS = {'esc', 'enter', 'up', 'down', *map(str, range(1, 10))}
LOCK = threading.RLock()            # acessos, recados e auditoria
BOOT = secrets.token_hex(3)
SEGREDO_RE = re.compile(r'(?i)\b(token|senha|password|passwd|secret|api[_-]?key|authorization)(\s*[=:]\s*|\s+)'
                        r'(bearer\s+)?[^\s\'"]{6,}')
CONTROLE_RE = re.compile('[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]')


def read(path: Path) -> str:
    try:
        return Path(path).read_text(errors='replace')
    except OSError:
        return ''


def mascarar(texto: str) -> str:
    return SEGREDO_RE.sub(lambda m: m.group(1) + m.group(2) + '***', texto)


def herdr(*args: str, timeout: float = 6) -> subprocess.CompletedProcess:
    """Chama o herdr sem shell (argumentos em lista)."""
    return subprocess.run([CFG['herdr'], *args], capture_output=True, text=True, timeout=timeout)


def avisar(titulo: str, msg: str, prio: str = '') -> None:
    if not CFG.get('aviso_cmd'):
        return
    try:
        subprocess.Popen([*CFG['aviso_cmd'], titulo, msg, prio], stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, start_new_session=True)
    except OSError:
        pass


_AVISOS = {}


def avisar_uma_vez(tipo: str, titulo: str, msg: str, prio: str = '', intervalo: float = 3600) -> None:
    """No máximo um aviso por tipo a cada `intervalo` segundos."""
    agora = time.time()
    if agora - _AVISOS.get(tipo, 0) >= intervalo:
        _AVISOS[tipo] = agora
        avisar(titulo, msg, prio)


def gravar_privado(path: Path, texto: str) -> None:
    tmp = path.with_name(f'.{path.name}.{secrets.token_hex(4)}.tmp')
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(texto)
    tmp.replace(path)


def anexar_privado(path: Path, linha: str, max_bytes: int = 2_000_000) -> None:
    """Acrescenta uma linha (arquivo 600) e gira quando passa de max_bytes."""
    with LOCK:
        try:
            if path.stat().st_size > max_bytes:
                path.replace(path.with_suffix(path.suffix + '.1'))
        except OSError:
            pass
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(fd, 'a') as f:
            f.write(linha + '\n')


def cauda(path: Path, n_bytes: int = 400_000) -> list:
    try:
        with path.open('rb') as f:
            inicio = max(0, path.stat().st_size - n_bytes)
            f.seek(inicio)
            linhas = f.read().decode(errors='replace').splitlines()
    except OSError:
        return []
    return linhas[1:] if inicio > 0 and len(linhas) > 1 else linhas


# ---------------------------------------------------------------- chave e auditoria
def token_atual() -> str:
    return read(TOKEN_FILE).strip()


def token_ok(valor: str) -> bool:
    token = token_atual()
    return bool(token) and hmac.compare_digest(valor.encode(), token.encode())


def trocar_token() -> str:
    novo = secrets.token_urlsafe(24)
    gravar_privado(TOKEN_FILE, novo + '\n')
    if CFG.get('copia_da_chave'):
        try:
            gravar_privado(Path(CFG['copia_da_chave']), f'Chave do MGE-AgentPortal: {novo}\n')
        except OSError:
            pass
    return novo


def auditar(evento: str, cliente: str = '', aparelho: str = '', detalhe: str = '') -> None:
    anexar_privado(AUDITORIA, json.dumps(dict(t=time.strftime('%Y-%m-%d %H:%M:%S'), evento=evento, cliente=cliente,
                                              aparelho=aparelho, detalhe=detalhe[:200]), ensure_ascii=False))


def auditoria_recente(n: int = 40) -> list:
    out = []
    for linha in cauda(AUDITORIA, 200_000)[-n:]:
        try:
            out.append(json.loads(linha))
        except ValueError:
            pass
    return out[::-1]


# ---------------------------------------------------------------- limite de tentativas (por cliente)
_FALHAS: dict = {}


def falhas_demais(cliente: str, janela: float = 900, limite: int = 15) -> bool:
    agora = time.time()
    with LOCK:
        q = _FALHAS.get(cliente)
        return bool(q) and sum(1 for t in q if agora - t < janela) >= limite


def contar_falha(cliente: str) -> None:
    with LOCK:
        _FALHAS.setdefault(cliente, deque(maxlen=50)).append(time.time())
        if len(_FALHAS) > 5000:
            _FALHAS.clear()


# ---------------------------------------------------------------- aparelhos (2 etapas)
def _itens(v) -> list:
    return [r for r in v if isinstance(r, dict) and isinstance(r.get('hash'), str)] if isinstance(v, list) else []


class Acessos:
    """Transação sobre acessos.json com lock entre threads e entre processos. NUNCA aninhar
    (nem chamar aparelho_de dentro dela): o flock de outro descritor travaria a própria thread."""

    def __enter__(self) -> dict:
        LOCK.acquire()
        self.fd = None
        try:
            self.fd = os.open(DIR / '.acessos.lock', os.O_RDWR | os.O_CREAT, 0o600)
            fcntl.flock(self.fd, fcntl.LOCK_EX)
            try:
                dados = json.loads(ACESSOS.read_text())
            except (OSError, ValueError):
                dados = {}
            if not isinstance(dados, dict):
                dados = {}
            agora = time.time()
            num = lambda v: v if isinstance(v, (int, float)) else 0
            dados['pending'] = [r for r in _itens(dados.get('pending')) if agora - num(r.get('criado')) < 900]
            dados['devices'] = [r for r in _itens(dados.get('devices')) if num(r.get('expira')) > agora]
            rec = dados.get('recusados') if isinstance(dados.get('recusados'), dict) else {}
            dados['recusados'] = {h: t for h, t in rec.items() if agora - num(t) < 3600}
            self.dados, self.original = dados, json.dumps(dados, sort_keys=True)
            return dados
        except BaseException:
            if self.fd is not None:
                os.close(self.fd)
            LOCK.release()
            raise

    def __exit__(self, *exc) -> None:
        try:
            if exc[0] is None and json.dumps(self.dados, sort_keys=True) != self.original:
                gravar_privado(ACESSOS, json.dumps(self.dados, ensure_ascii=False, indent=1))
        finally:
            fcntl.flock(self.fd, fcntl.LOCK_UN)
            os.close(self.fd)
            LOCK.release()


def digest(segredo: str) -> str:
    return hashlib.sha256(segredo.encode()).hexdigest()


def aparelho_de(segredo: str) -> dict | None:
    if not segredo:
        return None
    h = digest(segredo)
    with Acessos() as dados:
        for row in dados['devices']:
            if hmac.compare_digest(row['hash'], h):
                if time.time() - row.get('ultimo', 0) > 300:
                    row['ultimo'] = time.time()
                return dict(row)
    return None


# ---------------------------------------------------------------- spaces (herdr), com cache curto
_SPACES = [0.0, []]
_SPACES_LOCK = threading.Lock()


def spaces_list() -> list:
    """Agentes Claude/Codex abertos (cache de 2 s; uma atualização por vez, os outros esperam e reaproveitam)."""
    with _SPACES_LOCK:
        if time.monotonic() - _SPACES[0] < 2:
            return _SPACES[1]
        return _atualizar_spaces()


def _atualizar_spaces() -> list:
    labels = {}
    try:
        for w in json.loads(herdr('workspace', 'list').stdout)['result']['workspaces']:
            labels[w['workspace_id']] = w['label']
    except (ValueError, KeyError, OSError, subprocess.TimeoutExpired):
        pass
    agents = json.loads(herdr('agent', 'list').stdout)['result']['agents']
    rows = []
    for a in agents:
        if a.get('agent') not in ('claude', 'codex'):
            continue
        ws = a.get('workspace_id', '')
        rows.append(dict(pane=a['pane_id'], workspace=labels.get(ws, ws), ws=ws, agent=a['agent'],
                         status=a.get('agent_status', 'unknown'), title=a.get('terminal_title_stripped', '')[:80],
                         cwd=a.get('cwd', ''), sessao=(a.get('agent_session') or {}).get('value', '')))
    rows.sort(key=lambda r: (r['agent'] != 'claude', r['pane']))
    _SPACES[:] = [time.monotonic(), rows]
    return rows


def visiveis(publico: bool) -> list:
    rows = spaces_list()
    if publico:
        rows = [r for r in rows if not oculto(r)]
    return rows


def oculto(r: dict) -> bool:
    """Oculto pela internet: casa com o id do workspace, o rótulo ou o começo da pasta (configuração)."""
    for o in CFG['ocultos_na_internet']:
        if o in (r.get('ws'), r.get('workspace')) or (o.startswith('/') and str(r.get('cwd', '')).startswith(o)):
            return True
    return False


def space(pane: str, publico: bool) -> dict | None:
    if not PANE_RE.fullmatch(pane or ''):
        return None
    return next((r for r in visiveis(publico) if r['pane'] == pane), None)


# ---------------------------------------------------------------- recados
def registrar(pane: str, tipo: str, texto: str, aparelho: str = '') -> None:
    anexar_privado(RECADOS, json.dumps(dict(t=time.strftime('%Y-%m-%d %H:%M:%S'), pane=pane, tipo=tipo,
                                            texto=texto[:4000], aparelho=aparelho), ensure_ascii=False))


def historico(pane: str, n: int = 30) -> list:
    rows = []
    for linha in cauda(RECADOS.with_suffix('.log.1'), 100_000) + cauda(RECADOS):
        try:
            row = json.loads(linha)
        except ValueError:
            continue
        if row.get('pane') == pane:
            rows.append(row)
    return rows[-n:]


# ---------------------------------------------------------------- tela e diálogos (aprovações/perguntas)
OPCAO_RE = re.compile(r'^\s*(?:[│┃|]\s*)?(❯|>)?\s*(\d)\.\s+(.+?)\s*(?:[│┃|]\s*)?$')


def ler_tela(pane: str) -> str:
    r = herdr('agent', 'read', pane, '--source', 'visible')
    if r.returncode != 0:
        raise RuntimeError('não consegui ler a tela')
    return r.stdout[-30000:]


def dialogo(tela: str) -> dict | None:
    """Acha uma escolha numerada no fim da tela (permissão do Claude Code, AskUserQuestion, confiar na pasta)."""
    linhas = tela.rstrip().split('\n')[-40:]
    opcoes, fim = [], None
    for i in range(len(linhas) - 1, -1, -1):
        m = OPCAO_RE.match(linhas[i])
        if m:
            opcoes.insert(0, dict(n=m.group(2), texto=m.group(3)[:160], marcada=bool(m.group(1))))
            fim = i
        elif opcoes and linhas[i].strip() and not linhas[i].startswith('    '):
            break
    if len(opcoes) < 2 or [o['n'] for o in opcoes] != [str(k) for k in range(1, len(opcoes) + 1)]:
        return None
    pergunta = []
    for linha in reversed(linhas[max(0, fim - 12):fim]):
        t = linha.strip(' │┃|╭╮╰╯─')
        if t and re.fullmatch(r'[─━\-═╌╭╮╰╯ ]+', t) and pergunta:
            break
        if t:
            pergunta.insert(0, t)
    d = dict(pergunta='\n'.join(pergunta)[-1200:], opcoes=opcoes)
    d['id'] = hashlib.sha256(json.dumps(d, sort_keys=True).encode()).hexdigest()[:16]
    return d


# ---------------------------------------------------------------- conversa (transcrição do Claude Code)
_CONV: OrderedDict = OrderedDict()
_CONV_LOCKS: dict = {}
_SESSAO_PATH: dict = {}
CONV_MAX = 400


def sessao_path(sid: str) -> Path | None:
    if not re.fullmatch(r'[0-9a-f-]{36}', sid or ''):
        return None
    p = _SESSAO_PATH.get(sid)
    if p and p.exists():
        return p
    hits = list((Path.home() / '.claude/projects').glob(f'*/{sid}.jsonl'))
    _SESSAO_PATH[sid] = hits[0] if hits else None
    return _SESSAO_PATH[sid]


def _tool(item: dict) -> str:
    e = item.get('input') or {}
    d = e.get('description') or e.get('file_path') or e.get('pattern') or e.get('query') or e.get('prompt') \
        or e.get('command') or ''
    return mascarar(f"{item.get('name', 'ferramenta')}: {' '.join(str(d).split())[:140]}")


def _limpo(texto: str) -> str:
    return re.sub(r'<system-reminder>.*?</system-reminder>', '', texto, flags=re.S).strip()


def _entradas(linha: dict) -> list:
    tipo, ts = linha.get('type'), (linha.get('timestamp') or '')[:19]
    if linha.get('isSidechain') or linha.get('isMeta') or linha.get('isCompactSummary'):
        return []
    if tipo == 'attachment':
        att = linha.get('attachment') or {}
        if att.get('type') == 'queued_command' and isinstance(att.get('prompt'), str):
            return [dict(r='user', t=ts, x=mascarar(att['prompt'][:12000]))]
        return []
    content = (linha.get('message') or {}).get('content')
    if tipo == 'user':
        if isinstance(content, str):
            texto = content.strip()
            if texto.startswith('<local-command') or (texto.startswith('<command-') and '<command-name>' not in texto):
                return []
            if texto.startswith('<bash-input>'):
                texto = '! ' + re.sub(r'</?bash-input>', '', texto)
            elif '<command-name>' in texto:
                m = re.search(r'<command-name>(.*?)</command-name>', texto)
                texto = m.group(1) if m else texto
            texto = _limpo(texto)
            return [dict(r='user', t=ts, x=mascarar(texto[:12000]))] if texto else []
        if isinstance(content, list):
            textos = [_limpo(c.get('text', '')) for c in content if c.get('type') == 'text']
            textos = [x for x in textos if x]
            return [dict(r='user', t=ts, x=mascarar('\n'.join(textos)[:12000]))] if textos else []
        return []
    if tipo == 'assistant' and isinstance(content, list):
        out = []
        for c in content:
            if c.get('type') == 'text' and c.get('text', '').strip():
                out.append(dict(r='claude', t=ts, x=mascarar(c['text'][:20000])))
            elif c.get('type') == 'tool_use':
                out.append(dict(r='tool', t=ts, x=_tool(c)))
        return out
    return []


def _numero(v, padrao=None):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else padrao


def status_sessao(c: dict, sid: str, cwd: str) -> dict:
    """Linha de status do OMC reescrita a partir dos dados (não da tela)."""
    ctx = int(c.get('ctx', 0))
    out = dict(modelo=str(c.get('modelo', ''))[:60], modo=str(c.get('modo', ''))[:30], ctx=ctx,
               ctx_pct=round(100 * ctx / CFG['janela_contexto']), janela_contexto=CFG['janela_contexto'])
    try:
        uso = json.loads(read(Path(CFG['cache_uso'])))['data']
        out.update(cinco_h=_numero(uso.get('fiveHourPercent')), cinco_h_reset=str(uso.get('fiveHourResetsAt') or '')[:40])
    except (ValueError, KeyError, TypeError):
        pass
    try:
        st = json.loads(read(Path.home() / '.claude/.session-stats.json'))['sessions'].get(sid) or {}
        out.update(ferramentas=_numero(st.get('total_calls')), inicio=_numero(st.get('started_at')))
    except (ValueError, KeyError, TypeError, AttributeError):
        pass
    head = read(Path(cwd) / '.git/HEAD').strip() if cwd else ''
    if head:
        out['branch'] = (head.rsplit('/', 1)[-1] if head.startswith('ref:') else head[:8])[:40]
    return out


_LIMITES = [0.0, {}]


def limites() -> dict:
    """Limites de uso da conta: Claude 5 h (cache do OMC) e Codex 5 h + semanal (último registro do Codex). Cache 30 s."""
    if time.monotonic() - _LIMITES[0] < 30:
        return _LIMITES[1]
    out = {}
    try:
        uso = json.loads(read(Path(CFG['cache_uso'])))['data']
        out.update(claude_5h=_numero(uso.get('fiveHourPercent')), claude_5h_reset=str(uso.get('fiveHourResetsAt') or '')[:40])
    except (ValueError, KeyError, TypeError):
        pass
    base = Path.home() / '.codex/sessions'
    dias = sorted(base.glob('*/*/*'), reverse=True)[:3]
    arquivos = sorted((f for d in dias for f in d.glob('rollout-*.jsonl')), key=lambda f: f.stat().st_mtime, reverse=True)
    for f in arquivos[:4]:
        for linha in reversed(cauda(f, 300_000)):
            if '"rate_limits"' not in linha:
                continue
            try:
                rl = json.loads(linha)
                rl = rl.get('payload', rl)
                rl = rl.get('rate_limits') or (rl.get('info') or {}).get('rate_limits')
            except (ValueError, AttributeError):
                continue
            if not isinstance(rl, dict):
                continue
            for nome, k in (('primary', 'codex_5h'), ('secondary', 'codex_sem')):
                j = rl.get(nome) or {}
                if isinstance(j, dict) and _numero(j.get('used_percent')) is not None:
                    out[k] = _numero(j.get('used_percent'))
                    out[k + '_reset'] = _numero(j.get('resets_at'))
                    out[k + '_janela'] = _numero(j.get('window_minutes'))
            out['codex_em'] = f.stat().st_mtime
            break
        if 'codex_5h' in out:
            break
    _LIMITES[:] = [time.monotonic(), out]
    return out


def conversa(path: Path, sid: str, cwd: str) -> dict:
    """Lê a transcrição de forma incremental (cache por arquivo, LRU de 8 sessões)."""
    chave = str(path)
    with LOCK:
        trava = _CONV_LOCKS.setdefault(chave, threading.Lock())
    with trava:
        st = path.stat()
        c = _CONV.get(chave)
        ident = (st.st_ino, st.st_dev)
        if c is None or st.st_size < c['offset'] or c['ident'] != ident:
            c = dict(offset=max(0, st.st_size - 8_000_000), itens=deque(maxlen=CONV_MAX), n=0, resto=b'',
                     ident=ident, epoca=f'{sid[:8]}:{BOOT}:{secrets.token_hex(3)}', primeira=True)
        with LOCK:
            _CONV[chave] = c
            _CONV.move_to_end(chave)
            while len(_CONV) > 8:
                velho, _ = _CONV.popitem(last=False)
                _CONV_LOCKS.pop(velho, None)
        if st.st_size > c['offset']:
            with path.open('rb') as f:
                f.seek(c['offset'])
                bloco = c['resto'] + f.read(min(st.st_size - c['offset'], 16_000_000))
            c['offset'] += len(bloco) - len(c['resto'])
            linhas = bloco.split(b'\n')
            c['resto'] = linhas.pop()[-2_000_000:]
            if c.pop('primeira', False) and c['offset'] > 8_000_000 and linhas:
                linhas = linhas[1:]
            for raw in linhas:
                try:
                    linha = json.loads(raw)
                except ValueError:
                    continue
                if not isinstance(linha, dict):
                    continue
                if linha.get('type') == 'permission-mode':
                    c['modo'] = linha.get('permissionMode', '')
                msg = linha.get('message') or {}
                if linha.get('type') == 'assistant' and not linha.get('isSidechain') and isinstance(msg, dict) \
                        and isinstance(msg.get('usage'), dict):
                    u = msg['usage']
                    c['modelo'] = msg.get('model', c.get('modelo', ''))
                    c['ctx'] = sum(int(u.get(k) or 0) for k in
                                   ('input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'))
                for e in _entradas(linha):
                    c['n'] += 1
                    e['i'] = c['n']
                    c['itens'].append(e)
        else:
            c.pop('primeira', None)
        return dict(epoca=c['epoca'], n=c['n'], itens=list(c['itens']), status=status_sessao(c, sid, cwd))


# ---------------------------------------------------------------- arquivos enviados
def nome_seguro(nome: str) -> str:
    base = re.sub(r'[^\w.\- ]+', '_', Path(nome).name, flags=re.UNICODE).strip(' .')
    tronco, ext = Path(base).stem[:90].strip(' .'), Path(base).suffix[:10]
    return (tronco or 'arquivo') + ext


# ---------------------------------------------------------------- HTTP
class PortalMixin:
    """Rotas do portal. A classe concreta fornece reply()/json_reply()/public/headers/rfile."""

    # ------------- identidade e autenticação
    def cliente(self) -> str:
        if self.public:
            # o tailscaled acrescenta o IP real no FIM; valores anteriores podem ser forjados pelo cliente
            xff = self.headers.get('X-Forwarded-For', '').split(',')[-1].strip()
            return xff[:64] or 'funnel'
        return self.client_address[0]

    def segredo_aparelho(self) -> str:
        cookie = self.headers.get('Cookie', '')
        m = re.search(r'(?:^|;\s*)pdev=([A-Za-z0-9_\-]{20,100})', cookie)
        return m.group(1) if m else self.headers.get('X-Device', '')[:100]

    def key_ok(self) -> bool:
        valor = self.headers.get('X-Token', '')
        if token_ok(valor):
            return True
        if not valor:                      # aba sem chave: não conta como tentativa
            self.json_reply(401, dict(erro='chave inválida'))
            return False
        cli = self.cliente()
        if falhas_demais(cli):
            self.json_reply(429, dict(erro='muitas tentativas erradas; tente mais tarde'))
            return False
        contar_falha(cli)
        if self.public and falhas_demais(cli):
            auditar('bloqueio', cli)
            avisar_uma_vez('bloqueio', 'Portal: chaves erradas', 'Muitas chaves erradas pela internet; esse cliente ficou bloqueado 15 min.', 'low')
        self.json_reply(401, dict(erro='chave inválida'))
        return False

    def authorized(self) -> bool:
        if not self.key_ok():
            return False
        if not self.public:
            self.aparelho = dict(nome='rede privada')
            return True
        ap = aparelho_de(self.segredo_aparelho())
        if ap:
            self.aparelho = ap
            if 'pdev=' not in self.headers.get('Cookie', ''):
                self.migrar = self.segredo_aparelho()   # aparelho antigo (X-Device): passa a usar o cookie HttpOnly
            return True
        self.json_reply(403, dict(erro='aparelho não aprovado', precisa_aprovacao=True))
        return False

    def nome_aparelho(self) -> str:
        return (getattr(self, 'aparelho', None) or {}).get('nome', '')

    # ------------- corpo da requisição (em fluxo, prazo total real, sem aceitar corpo cortado)
    def tamanho(self, limite: int) -> int | None:
        try:
            n = int(self.headers.get('Content-Length', ''))
        except ValueError:
            self.json_reply(411, dict(erro='tamanho ausente'))
            return None
        if n < 0 or n > limite:
            self.json_reply(413, dict(erro='conteúdo grande demais'))
            return None
        return n

    def ler_corpo(self, n: int, escrever) -> bool:
        """Lê n bytes chamando escrever(pedaço). False = já respondeu (408) ou o cliente caiu."""
        prazo, lidos = time.monotonic() + max(30, min(900, n / 40_000)), 0
        try:
            while lidos < n:
                resto = prazo - time.monotonic()
                if resto <= 0:
                    raise TimeoutError
                self.connection.settimeout(min(15, max(0.5, resto)))
                pedaco = self.rfile.read1(min(65536, n - lidos))
                if not pedaco:
                    return False                      # cliente caiu no meio: nada é aceito
                escrever(pedaco)
                lidos += len(pedaco)
            return True
        except TimeoutError:
            self.json_reply(408, dict(erro='envio lento demais'))
            return False
        except OSError:
            return False

    def corpo(self, limite: int) -> bytes | None:
        n = self.tamanho(limite)
        if n is None:
            return None
        dados = bytearray()
        return bytes(dados) if self.ler_corpo(n, dados.extend) else None

    def corpo_json(self, limite: int = 20000) -> dict | None:
        raw = self.corpo(limite)
        if raw is None:
            return None
        try:
            data = json.loads(raw or b'{}')
        except ValueError:
            data = None
        if not isinstance(data, dict):
            self.json_reply(400, dict(erro='pedido inválido'))
            return None
        return data

    # ------------- rotas
    def portal_route(self, metodo: str) -> bool:
        """Trata a rota se for do portal; devolve False se não for."""
        url = urlsplit(self.path)
        q = parse_qs(url.query)
        rotas = {
            ('GET', '/api/spaces'): self.r_spaces, ('GET', '/api/tela'): self.r_tela,
            ('GET', '/api/conversa'): self.r_conversa, ('GET', '/api/recados'): self.r_recados,
            ('POST', '/api/enviar'): self.r_enviar, ('POST', '/api/tecla'): self.r_tecla,
            ('POST', '/api/arquivo'): self.r_arquivo,
            ('POST', '/api/acesso/pedir'): self.r_pedir, ('GET', '/api/acesso/estado'): self.r_estado,
            ('GET', '/api/acesso/lista'): self.r_lista, ('POST', '/api/acesso/decidir'): self.r_decidir,
            ('POST', '/api/acesso/revogar'): self.r_revogar, ('POST', '/api/acesso/esquecer'): self.r_esquecer,
            ('POST', '/api/acesso/trocar-chave'): self.r_trocar,
        }
        fn = rotas.get((metodo, url.path))
        if not fn:
            return False
        try:
            fn(q)
        except (OSError, RuntimeError, subprocess.TimeoutExpired, ValueError, KeyError) as erro:
            print(f'portal: erro em {url.path}: {erro!r}', flush=True)
            self.json_reply(502, dict(erro='o PC não respondeu agora; tente de novo'))
        return True

    def pane_q(self, q: dict) -> dict | None:
        sp = space(q.get('pane', [''])[0], self.public)
        if not sp:
            self.json_reply(400, dict(erro='space desconhecido'))
        return sp

    def r_spaces(self, q):
        if self.authorized():
            campos = ('pane', 'workspace', 'agent', 'status', 'title')
            self.json_reply(200, dict(spaces=[{k: r[k] for k in campos} for r in visiveis(self.public)],
                                      painel=bool(CFG.get('painel', {}).get('enabled')), upload_mb=CFG['upload_mb']))

    def r_recados(self, q):
        if self.authorized() and (sp := self.pane_q(q)):
            self.json_reply(200, dict(historico=historico(sp['pane'])))

    def r_tela(self, q):
        if not (self.authorized() and (sp := self.pane_q(q))):
            return
        pane = sp['pane']
        if q.get('modo', [''])[0] == 'historico':
            r = herdr('agent', 'read', pane, '--source', 'recent', '--lines', '400')
            tela = r.stdout[-60000:] if r.returncode == 0 and not r.stdout.startswith('{"error"') else \
                '(o histórico só fica disponível quando o space para de trabalhar; mostrando a tela atual)\n\n' + ler_tela(pane)
        else:
            tela = ler_tela(pane)
        dlg = dialogo(tela) if sp['status'] == 'blocked' else None
        self.json_reply(200, dict(tela=tela, dialogo=dlg, historico=historico(pane), limites=limites()))

    def r_conversa(self, q):
        if not (self.authorized() and (sp := self.pane_q(q))):
            return
        path = sessao_path(sp['sessao']) if sp['agent'] == 'claude' else None
        if not path:
            return self.json_reply(404, dict(erro='conversa indisponível para este space'))
        dados = conversa(path, sp['sessao'], sp['cwd'])
        desde = q.get('desde', ['0'])[0]
        epoca = q.get('epoca', [''])[0]
        if not desde.isdigit():
            return self.json_reply(400, dict(erro='parâmetro inválido'))
        if epoca == dados['epoca'] and 0 < int(desde) <= dados['n']:
            dados['itens'] = [e for e in dados['itens'] if e['i'] > int(desde)]
        dados['estado'] = sp['status']
        dados['limites'] = limites()
        if sp['status'] == 'blocked':
            try:
                dados['dialogo'] = dialogo(ler_tela(sp['pane']))
            except RuntimeError:
                pass
        self.json_reply(200, dados)

    def r_enviar(self, q):
        if not self.authorized():
            return
        data = self.corpo_json()
        if data is None:
            return
        sp = space(str(data.get('pane', '')), self.public)
        if not sp:
            return self.json_reply(400, dict(erro='space desconhecido'))
        texto = CONTROLE_RE.sub(' ', str(data.get('texto', ''))).strip()
        if not texto:
            return self.json_reply(400, dict(erro='recado vazio'))
        if len(texto) > 8000:
            return self.json_reply(413, dict(erro='recado grande demais (máx. 8000 caracteres)'))
        try:
            r = herdr('agent', 'prompt', sp['pane'], f"[Recado do {CFG['dono']} pelo portal] {texto}", timeout=10)
        except subprocess.TimeoutExpired:
            return self.json_reply(504, dict(erro='o envio demorou; confira a conversa antes de reenviar'))
        if r.returncode != 0:
            if 'agent_blocked' in r.stdout + r.stderr:
                return self.json_reply(409, dict(erro='o space está esperando uma escolha: responda no cartão acima'))
            print(f'portal: prompt falhou rc={r.returncode}', flush=True)
            return self.json_reply(502, dict(erro='o space não aceitou o recado agora'))
        registrar(sp['pane'], 'recado', texto, self.nome_aparelho())
        self.json_reply(200, dict(ok=True))

    def r_tecla(self, q):
        if not self.authorized():
            return
        data = self.corpo_json()
        if data is None:
            return
        sp = space(str(data.get('pane', '')), self.public)
        tecla = str(data.get('tecla', ''))
        if not sp or tecla not in TECLAS:
            return self.json_reply(400, dict(erro='space ou tecla inválidos'))
        if tecla.isdigit() or tecla == 'enter':
            # uma tecla que escolhe só vale para a MESMA decisão que a pessoa viu (impressão digital)
            atual = dialogo(ler_tela(sp['pane']))
            if tecla.isdigit() and not atual:
                return self.json_reply(409, dict(erro='não há decisão aberta neste space agora'))
            if atual and not hmac.compare_digest(str(data.get('dlg', '')), atual['id']):
                return self.json_reply(409, dict(erro='a decisão na tela mudou; confira antes de responder', dialogo=atual))
        r = herdr('pane', 'send-keys', sp['pane'], tecla)
        if r.returncode != 0:
            return self.json_reply(502, dict(erro='não consegui enviar a tecla'))
        registrar(sp['pane'], 'tecla', tecla, self.nome_aparelho())
        self.json_reply(200, dict(ok=True))

    def r_arquivo(self, q):
        """Recebe um arquivo (corpo cru) e salva em <pasta do space>/_recebidos_portal/."""
        if not (self.authorized() and (sp := self.pane_q(q))):
            return
        nome = nome_seguro(q.get('nome', [''])[0])
        ext = Path(nome).suffix.lower()
        if ext not in UPLOAD_EXT:
            return self.json_reply(415, dict(erro=f'tipo de arquivo não permitido ({ext or "sem extensão"})'))
        n = self.tamanho(int(CFG['upload_mb']) * 1024 * 1024)
        if n is None:
            return
        if n == 0:
            return self.json_reply(400, dict(erro='arquivo vazio'))
        cwd = Path(sp['cwd'])
        if not cwd.is_dir():
            return self.json_reply(409, dict(erro='pasta do space indisponível'))
        pasta = cwd / CFG['upload_pasta']
        if not pasta.exists():
            pasta.mkdir(mode=0o700)
            (pasta / '.gitignore').write_text('*\n')      # uploads nunca entram no git do projeto
        destino = pasta / f"{time.strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(2)}_{nome}"
        parcial = destino.with_name('.' + destino.name + '.part')
        fd = os.open(parcial, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, 'wb') as f:
                completo = self.ler_corpo(n, f.write)
            if not completo:
                parcial.unlink(missing_ok=True)
                return
            parcial.replace(destino)
        except BaseException:
            parcial.unlink(missing_ok=True)
            raise
        registrar(sp['pane'], 'arquivo', destino.name, self.nome_aparelho())
        auditar('arquivo', self.cliente(), self.nome_aparelho(), f"{sp['workspace']}: {destino.name} ({n} B)")
        self.json_reply(200, dict(ok=True, caminho=str(destino), nome=destino.name))

    # ------------- acessos
    def r_pedir(self, q):
        if not self.key_ok():
            return
        if not self.public:
            return self.json_reply(400, dict(erro='na rede privada não precisa de aprovação'))
        cli = self.cliente()
        if falhas_demais('pedido:' + cli, janela=3600, limite=3):
            return self.json_reply(429, dict(erro='muitos pedidos deste lugar; tente mais tarde'))
        data = self.corpo_json(2000)
        if data is None:
            return
        contar_falha('pedido:' + cli)
        segredo, codigo = secrets.token_urlsafe(32), f'{secrets.randbelow(10 ** 6):06d}'
        nome = CONTROLE_RE.sub(' ', ' '.join(str(data.get('nome', '')).split()))[:40] or 'sem nome'
        with Acessos() as dados:
            if len(dados['pending']) >= 5:
                return self.json_reply(429, dict(erro='muitos pedidos pendentes; aprove ou recuse os anteriores'))
            dados['pending'].append(dict(id=secrets.token_hex(6), hash=digest(segredo), codigo=codigo, nome=nome,
                                         navegador=self.headers.get('User-Agent', '')[:120], cliente=cli,
                                         criado=time.time()))
        auditar('pedido', cli, nome)
        avisar('Portal: pedido de acesso', 'Um aparelho pediu acesso ao portal. Aprove em Acessos digitando o codigo da tela dele. Se nao foi voce, troque a chave.', 'alta')
        self.json_reply(200, dict(codigo=codigo), cookie=segredo)

    def r_estado(self, q):
        if not self.key_ok():
            return
        if not self.public:
            return self.json_reply(200, dict(estado='aprovado'))
        segredo = self.segredo_aparelho()
        if aparelho_de(segredo):
            return self.json_reply(200, dict(estado='aprovado'))
        h = digest(segredo) if segredo else ''
        with Acessos() as dados:
            if h and any(r['hash'] == h for r in dados['pending']):
                return self.json_reply(200, dict(estado='pendente'))
            if h and h in dados['recusados']:
                return self.json_reply(200, dict(estado='recusado'))
        self.json_reply(200, dict(estado='nenhum'))

    def r_lista(self, q):
        if not self.authorized():
            return
        ocultar = ('hash', 'codigo', 'erros')
        meu = digest(self.segredo_aparelho()) if self.public and self.segredo_aparelho() else ''
        with Acessos() as dados:
            pend = [{k: v for k, v in r.items() if k not in ocultar} for r in dados['pending']]
            aps = [dict({k: v for k, v in r.items() if k not in ocultar}, este=bool(meu) and r['hash'] == meu)
                   for r in dados['devices']]
        self.json_reply(200, dict(pendentes=pend, aparelhos=aps, auditoria=auditoria_recente()))

    def r_decidir(self, q):
        if not self.authorized():
            return
        data = self.corpo_json(2000)
        if data is None:
            return
        rid, aprovar = str(data.get('id', '')), data.get('aprovar') is True
        with Acessos() as dados:
            hit = next((r for r in dados['pending'] if r['id'] == rid), None)
            if not hit:
                return self.json_reply(404, dict(erro='pedido não encontrado ou expirado'))
            if aprovar:
                codigo = str(data.get('codigo', '')).strip()
                if not (codigo.isascii() and codigo.isdigit() and len(codigo) == 6) or not hmac.compare_digest(codigo, hit['codigo']):
                    hit['erros'] = hit.get('erros', 0) + 1
                    if hit['erros'] >= 3:
                        dados['pending'].remove(hit)
                        dados['recusados'][hit['hash']] = time.time()
                    return self.json_reply(403, dict(erro='código não confere'))
                agora = time.time()
                hit.update(aprovado=agora, ultimo=agora, expira=agora + CFG['dias_aparelho'] * 86400)
                for k in ('codigo', 'erros'):
                    hit.pop(k, None)
                dados['devices'].append(hit)
            else:
                dados['recusados'][hit['hash']] = time.time()
            dados['pending'].remove(hit)
        auditar('aprovado' if aprovar else 'recusado', self.cliente(), hit['nome'], f'por {self.nome_aparelho()}')
        self.json_reply(200, dict(ok=True))

    def r_revogar(self, q):
        if not self.authorized():
            return
        data = self.corpo_json(2000)
        if data is None:
            return
        rid, todos = str(data.get('id', '')), data.get('todos') is True
        with Acessos() as dados:
            antes = len(dados['devices'])
            dados['devices'] = [] if todos else [r for r in dados['devices'] if r['id'] != rid]
            n = antes - len(dados['devices'])
        auditar('revogado', self.cliente(), 'todos' if todos else rid, f'{n} aparelho(s) por {self.nome_aparelho()}')
        self.json_reply(200, dict(ok=True, revogados=n))

    def r_esquecer(self, q):
        """Sai deste aparelho: revoga-o no servidor e apaga o cookie (exige a chave)."""
        if not self.key_ok():
            return
        segredo = self.segredo_aparelho()
        if segredo:
            h = digest(segredo)
            with Acessos() as dados:
                antes = len(dados['devices']) + len(dados['pending'])
                dados['devices'] = [r for r in dados['devices'] if r['hash'] != h]
                dados['pending'] = [r for r in dados['pending'] if r['hash'] != h]
                n = antes - len(dados['devices']) - len(dados['pending'])
            if n:
                auditar('esquecido', self.cliente())
        self.json_reply(200, dict(ok=True), cookie='')

    def r_trocar(self, q):
        if not self.authorized():
            return
        data = self.corpo_json(2000)
        if data is None:
            return
        if not token_ok(str(data.get('chave_atual', ''))):
            return self.json_reply(403, dict(erro='digite a chave atual para trocar'))
        novo = trocar_token()
        if data.get('revogar_todos') is True:
            with Acessos() as dados:
                dados['devices'], dados['pending'] = [], []
        auditar('chave trocada', self.cliente(), self.nome_aparelho(), 'aparelhos revogados' if data.get('revogar_todos') else '')
        avisar('Portal: chave trocada', f"A chave do portal foi trocada as {time.strftime('%H:%M')} pelo aparelho '{self.nome_aparelho()}'. Se nao foi voce, verifique o PC.", 'alta')
        self.json_reply(200, dict(ok=True, chave=novo))
