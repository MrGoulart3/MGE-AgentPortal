"""Real HTTP handler over byte streams for sandboxes that disallow local sockets.

This fallback exercises parsing, routing and bodies, but cannot test TCP behavior,
listener binding, connection concurrency or socket-level timeouts.
"""
import http.client
import importlib
import io
import json
import os
from pathlib import Path
import sys
from unittest import mock


class StreamSocket:
    """Supplies the stream operations used by BaseHTTPRequestHandler."""

    def __init__(self, request=b''):
        self.request = request
        self.response = bytearray()

    def makefile(self, mode, *_args):
        return io.BytesIO(self.request)

    def sendall(self, data):
        self.response.extend(data)

    def settimeout(self, _timeout):
        pass

    def shutdown(self, _how):
        pass


class MemoryServer:
    """Handles actual serialized HTTP requests without a listening socket."""

    def __init__(self, fixture):
        self.fixture = fixture
        self.environment = mock.patch.dict(os.environ, fixture['env'])
        self.environment.start()
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'portal'))
        for name in ('portal', 'server'):
            if name in sys.modules:
                importlib.reload(sys.modules[name])
            else:
                importlib.import_module(name)
        self.server = sys.modules['server']
        if self.server.COLLECTOR is not None:
            self.server.COLLECTOR.payload = json.dumps(self.server.COLLECTOR.sample()).encode()
        self.raw_patch = mock.patch('socket.create_connection', self.raw_connection)
        self.raw_patch.start()

    def dispatch(self, raw, port):
        stream = StreamSocket(raw)
        server = mock.Mock(server_address=('127.0.0.1', port))
        self.server.Handler(stream, ('127.0.0.1', 54321), server)
        return bytes(stream.response)

    def request(self, public, method, path, body=None, headers=None):
        port = self.fixture['pub'] if public else self.fixture['priv']
        fields = {'Host': f'127.0.0.1:{port}', **(headers or {})}
        if isinstance(body, dict):
            body = json.dumps(body).encode()
            fields.setdefault('Content-Type', 'application/json')
        if isinstance(body, str):
            body = body.encode()
        body = body or b''
        fields.setdefault('Content-Length', str(len(body)))
        request = (f'{method} {path} HTTP/1.0\r\n' + ''.join(f'{key}: {value}\r\n' for key, value in fields.items()) + '\r\n').encode() + body
        reply = self.dispatch(request, port)
        response = http.client.HTTPResponse(StreamSocket(reply))
        response.begin()
        data = response.read()
        try:
            parsed = json.loads(data)
        except ValueError:
            parsed = {}
        return response.status, parsed, response

    def raw_connection(self, address, *_args, **_kwargs):
        owner = self

        class Upload:
            def __init__(self):
                self.data = bytearray()

            def sendall(self, data):
                self.data.extend(data)

            def close(self):
                if self.data:
                    owner.dispatch(bytes(self.data), address[1])

        return Upload()

    def close(self):
        self.raw_patch.stop()
        self.environment.stop()


def available() -> bool:
    """Reports whether the environment permits TCP sockets."""
    import socket
    try:
        sock = socket.socket()
        sock.close()
        return True
    except PermissionError:
        return False


def fixture_without_sockets(factory, root):
    """Builds the same fictional fixture with deterministic test-only port numbers."""
    with mock.patch.object(factory, 'porta_livre', side_effect=[18787, 18788]):
        return factory.montar(root)
