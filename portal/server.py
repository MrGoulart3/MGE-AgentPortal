"""MGE-AgentPortal: servidor HTTP (biblioteca padrão) com cabeçalhos de segurança, conferência de Host,
vagas por porta e prazo total de cabeçalhos. As rotas e a autenticação ficam em portal.py.

Uso: python3 server.py        (lê <DIR>/config.json; veja config.example.json)
"""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import signal
import socket
import subprocess
import threading
import time

import portal
import resources

BASE = Path(__file__).resolve().parent / 'web'
COLLECTOR = resources.Collector(portal.CFG.get('painel') or {}) if portal.CFG.get('painel', {}).get('enabled') else None
PRIVADOS = [tuple(x) for x in portal.CFG.get('enderecos_privados', [['127.0.0.1', 8787]])]
PUBLICO = ('127.0.0.1', int(portal.CFG['porta_publica']))
VAGAS = {'privada': int(portal.CFG.get('max_conexoes_privada', 24)), 'publica': int(portal.CFG.get('max_conexoes_publica', 16))}
PRAZO_CABECALHOS = 20  # segundos para a linha de pedido + cabeçalhos chegarem inteiros
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
       "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'")
ESTATICOS = {'/spaces': ('spaces.html', 'text/html'), '/spaces.html': ('spaces.html', 'text/html'),
             '/spaces.js': ('spaces.js', 'text/javascript'), '/sw.js': ('sw.js', 'text/javascript'),
             '/manifest.webmanifest': ('manifest.webmanifest', 'application/manifest+json'),
             '/icon192.png': ('icon192.png', 'image/png'), '/icon512.png': ('icon512.png', 'image/png')}


class Handler(portal.PortalMixin, BaseHTTPRequestHandler):
    """Portal: chave; pela internet (porta pública), chave + aparelho aprovado."""
    server_version = 'agentportal'
    sys_version = ''

    @property
    def public(self) -> bool:
        return self.server.server_address[1] == PUBLICO[1]

    def cabecalhos(self, cookie: str | None = None) -> None:
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', CSP)
        if self.public:
            self.send_header('Strict-Transport-Security', 'max-age=31536000')
            if cookie is None and getattr(self, 'migrar', None):
                cookie = self.migrar
                self.send_header('X-Migrado', '1')
            if cookie is not None:
                idade = int(portal.CFG['dias_aparelho']) * 86400 if cookie else 0
                self.send_header('Set-Cookie', f'pdev={cookie}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age={idade}')

    def reply(self, code: int, body: bytes, content_type: str = 'application/json; charset=utf-8',
              cookie: str | None = None) -> None:
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.cabecalhos(cookie)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def json_reply(self, code: int, data: object, cookie: str | None = None) -> None:
        self.reply(code, json.dumps(data, ensure_ascii=False).encode(), cookie=cookie)

    def send_error(self, code: int, message: str | None = None, explain: str | None = None) -> None:
        try:
            self.json_reply(code, dict(erro=message or ('não encontrado' if code == 404 else 'erro')))
        except OSError:
            pass

    def host_ok(self) -> bool:
        hosts = portal.CFG.get('hosts_permitidos') or []
        if not hosts or self.headers.get('Host', '') in hosts:
            return True
        self.json_reply(421, dict(erro='host não permitido'))
        return False

    def do_GET(self) -> None:
        if not self.host_ok() or self.portal_route('GET'):
            return
        caminho = self.path.split('?', 1)[0]
        pages = {'/servers': 'servers.html', '/servidores': 'servers.html',
                 '/files': 'files.html', '/arquivos': 'files.html'}
        if caminho in pages:
            if self.authorized():
                self.reply(200, (BASE / pages[caminho]).read_bytes(), 'text/html; charset=utf-8')
            return
        if caminho in ('/api/servers', '/api/servidores'):
            if not self.authorized():
                return
            options = portal.CFG.get('servers', {})
            try:
                snapshot = json.loads(Path(options.get('snapshot', '~/.local/state/mge-agentportal/servers.json')).expanduser().read_text())
                try:
                    history = json.loads(Path(options.get('history', '~/.local/state/mge-agentportal/servers-history.json')).expanduser().read_text())
                except (OSError, ValueError):
                    history = []
                snapshot['history'] = [point for point in history if point.get('timestamp', 0) >= time.time() - 48 * 3600]
                for row in snapshot.get('servers', []):
                    for key in ('processes', 'heavy_processes', 'jobs'):
                        row[key] = [{k: v for k, v in item.items()
                                     if k not in ('cwd', 'command', 'name')}
                                    for item in row.get(key, [])]
                snapshot['process_cpu_min'] = options.get('process_cpu_min', 5)
                if self.public:
                    allowed = {row['workspace'] for row in portal.visiveis(True)}
                    for row in snapshot.get('servers', []):
                        for key in ('processes', 'heavy_processes', 'jobs'):
                            row[key] = [{k: v for k, v in item.items() if k not in ('cwd', 'command', 'owner')} for item in row.get(key, [])
                                        if item.get('workspace') in allowed]
                self.json_reply(200, snapshot)
            except (OSError, ValueError):
                self.json_reply(503, dict(erro='Run collector / Execute o coletor'))
            return
        if caminho == '/resources':
            caminho = '/painel'
        if caminho in ('/painel', '/api/estado', '/painel.js'):
            if COLLECTOR is None:
                self.send_error(404)
                return
            if caminho == '/painel.js':
                self.reply(200, (BASE / 'painel.js').read_bytes(), 'text/javascript; charset=utf-8')
                return
            if not self.authorized():
                return
            if caminho == '/painel':
                self.reply(200, (BASE / 'painel.html').read_bytes(), 'text/html; charset=utf-8')
                return
            payload = COLLECTOR.payload
            if payload == b'{}':
                self.json_reply(503, dict(erro='Waiting for sample / Aguardando coleta'))
                return
            if self.public:
                try:
                    rows = portal.spaces_list()
                    visible = [row for row in rows if not portal.oculto(row)]
                    hidden = [*portal.CFG['ocultos_na_internet'],
                              *(row['cwd'] for row in rows if portal.oculto(row))]
                    payload = resources.public_snapshot(payload, COLLECTOR.root, visible, hidden)
                except (OSError, ValueError, KeyError, subprocess.SubprocessError):
                    self.json_reply(503, dict(erro='Workspace map unavailable / Mapa indisponível'))
                    return
            self.reply(200, payload)
            return
        if caminho == '/':
            self.send_response(302)
            self.send_header('Location', '/spaces')
            self.send_header('Content-Length', '0')
            self.cabecalhos()
            self.end_headers()
            return
        if caminho in ('/nav.js', '/rings.js', '/pages.js', '/servers.js', '/files.js', '/common.css', '/nav.css'):
            tipo = 'text/css' if caminho.endswith('.css') else 'text/javascript'
            self.reply(200, (BASE / caminho[1:]).read_bytes(), tipo + '; charset=utf-8')
            return
        if caminho in ESTATICOS:
            nome, tipo = ESTATICOS[caminho]
            return self.reply(200, (BASE / nome).read_bytes(), tipo if tipo.startswith('image/') else f'{tipo}; charset=utf-8')
        self.send_error(404)

    def do_HEAD(self) -> None:
        self.do_GET()

    def do_POST(self) -> None:
        if self.host_ok() and self.path.split('?', 1)[0] == '/share':
            # share that arrived before the service worker was active: back to the portal without the files
            self.send_response(303)
            self.send_header('Location', '/spaces?shared=0')
            self.send_header('Content-Length', '0')
            self.cabecalhos()
            self.end_headers()
            return
        if self.host_ok() and not self.portal_route('POST'):
            self.send_error(404)

    def setup(self) -> None:
        super().setup()
        # prazo TOTAL para os cabeçalhos (o timeout do socket vale por leitura e não para quem manda 1 byte por vez)
        self.vigia = threading.Timer(PRAZO_CABECALHOS, self.derrubar)
        self.vigia.daemon = True
        self.vigia.start()

    def derrubar(self) -> None:
        try:
            self.connection.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass

    def parse_request(self) -> bool:
        ok = super().parse_request()
        self.vigia.cancel()            # cabeçalhos completos: o corpo tem prazo próprio (portal.ler_corpo)
        return ok

    def finish(self) -> None:
        self.vigia.cancel()
        super().finish()

    def log_message(self, format: str, *args: object) -> None:
        """Sem log de acesso em disco (a auditoria de segurança fica em portal.auditar)."""


class Server(ThreadingHTTPServer):
    """Threads descartáveis, vagas próprias por porta, timeout por operação."""
    daemon_threads = True
    request_queue_size = 32

    def __init__(self, endereco, handler, vagas: int) -> None:
        self.vagas = threading.BoundedSemaphore(vagas)
        super().__init__(endereco, handler)

    def get_request(self) -> tuple:
        connection, address = super().get_request()
        connection.settimeout(10)
        return connection, address

    def process_request(self, request, client_address) -> None:
        if not self.vagas.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.vagas.release()
            raise

    def process_request_thread(self, request, client_address) -> None:
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.vagas.release()


def main() -> None:
    parar = threading.Event()
    servers = []
    for address, port in [*PRIVADOS, PUBLICO]:
        try:
            servers.append(Server((address, port), Handler, VAGAS['publica' if port == PUBLICO[1] else 'privada']))
            print(f'Escutando em {address}:{port}' + (' (pública: chave + aparelho)' if port == PUBLICO[1] else ' (privada: chave)'), flush=True)
        except OSError as error:
            print(f'Não foi possível escutar em {address}:{port}: {error}', flush=True)
    if not servers:
        raise SystemExit(1)
    if not portal.token_atual():
        print(f'ATENÇÃO: sem chave em {portal.TOKEN_FILE}. Gere uma: scripts/portal-ctl chave', flush=True)
    signal.signal(signal.SIGTERM, lambda *_: parar.set())
    signal.signal(signal.SIGINT, lambda *_: parar.set())
    if COLLECTOR is not None:
        threading.Thread(target=COLLECTOR.run, daemon=True).start()
    for server in servers:
        threading.Thread(target=server.serve_forever, daemon=True).start()
    parar.wait()
    if COLLECTOR is not None:
        COLLECTOR.stopped.set()
    for server in servers:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
