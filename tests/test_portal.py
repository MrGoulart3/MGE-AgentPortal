"""Testes ponta a ponta do MGE-AgentPortal com herdr falso (não precisa de herdr, Claude Code nem Tailscale).

Rodar:  python3 -m unittest discover -s tests -v
"""
import http.client
import json
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import demo  # noqa: E402
import transport  # noqa: E402

RAIZ = AQUI.parent


class PortalTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = Path(tempfile.mkdtemp(prefix='_tmp_portal_', dir=AQUI))
        cls.memory = None
        if not transport.available():
            cls.d = transport.fixture_without_sockets(demo, cls.base)
            cls.memory = transport.MemoryServer(cls.d)
            cls.K = {'X-Token': cls.d['token']}
            print('HTTP tests: in-memory transport (TCP unavailable)', flush=True)
            return
        cls.d = demo.montar(cls.base)
        cls.proc = subprocess.Popen([sys.executable, '-u', str(RAIZ / 'portal/server.py')], env=cls.d['env'],
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        for _ in range(100):
            try:
                socket.create_connection(('127.0.0.1', cls.d['pub']), timeout=0.2).close()
                socket.create_connection(('127.0.0.1', cls.d['priv']), timeout=0.2).close()
                break
            except OSError:
                time.sleep(0.1)
        cls.K = {'X-Token': cls.d['token']}

    @classmethod
    def tearDownClass(cls):
        if cls.memory:
            cls.memory.close()
        else:
            cls.proc.terminate()
            cls.proc.communicate(timeout=5)
        shutil.rmtree(cls.base, ignore_errors=True)

    def req(self, publica, metodo, caminho, corpo=None, h=None):
        if self.memory:
            return self.memory.request(publica, metodo, caminho, corpo, h)
        porta = self.d['pub'] if publica else self.d['priv']
        c = http.client.HTTPConnection('127.0.0.1', porta, timeout=20)
        hs = {'Host': f'127.0.0.1:{porta}', **(h or {})}
        if isinstance(corpo, dict):
            corpo = json.dumps(corpo).encode()
            hs.setdefault('Content-Type', 'application/json')
        c.request(metodo, caminho, body=corpo, headers=hs)
        r = c.getresponse()
        b = r.read()
        try:
            d = json.loads(b)
        except ValueError:
            d = {}
        return r.status, d, r

    def aprovar(self, nome, cliente):
        """Pede acesso pela porta pública e aprova pela privada digitando o código. Devolve o cookie."""
        s, d, r = self.req(True, 'POST', '/api/acesso/pedir', {'nome': nome}, {**self.K, 'X-Forwarded-For': cliente})
        self.assertEqual(s, 200, d)
        pdev = re.search(r'pdev=([^;]+)', r.getheader('Set-Cookie')).group(1)
        s, lst, _ = self.req(False, 'GET', '/api/acesso/lista', h=self.K)
        pid = next(p['id'] for p in lst['pendentes'] if p['nome'] == nome)
        s, _, _ = self.req(False, 'POST', '/api/acesso/decidir', {'id': pid, 'aprovar': True, 'codigo': d['codigo']}, self.K)
        self.assertEqual(s, 200)
        return pdev

    # ---- cabeçalhos e rotas
    def test_cabecalhos_de_seguranca(self):
        s, _, r = self.req(False, 'GET', '/spaces')
        self.assertEqual(s, 200)
        self.assertIn("script-src 'self'", r.getheader('Content-Security-Policy'))
        self.assertIn("frame-ancestors 'none'", r.getheader('Content-Security-Policy'))
        self.assertEqual(r.getheader('X-Frame-Options'), 'DENY')
        self.assertEqual(r.getheader('Referrer-Policy'), 'no-referrer')
        s, _, r = self.req(True, 'GET', '/spaces')
        self.assertIn('max-age', r.getheader('Strict-Transport-Security') or '')

    def test_host_estranho_e_rota_parecida(self):
        self.assertEqual(self.req(False, 'GET', '/spaces', h={'Host': 'evil.example'})[0], 421)
        self.assertEqual(self.req(False, 'GET', '/api/spacesX', h=self.K)[0], 404)

    # ---- chave
    def test_sem_chave_e_chave_errada(self):
        self.assertEqual(self.req(False, 'GET', '/api/spaces')[0], 401)
        self.assertEqual(self.req(False, 'GET', '/api/spaces', h={'X-Token': 'errada'})[0], 401)

    def test_limite_por_cliente_nunca_bloqueia_a_chave_certa(self):
        h = {'X-Token': 'x', 'X-Forwarded-For': '203.0.113.50'}
        for _ in range(16):
            self.req(True, 'GET', '/api/spaces', h=h)
        self.assertEqual(self.req(True, 'GET', '/api/spaces', h=h)[0], 429)
        forjado = {'X-Token': 'x', 'X-Forwarded-For': '192.0.2.1, 203.0.113.50'}   # o IP real vem por último
        self.assertEqual(self.req(True, 'GET', '/api/spaces', h=forjado)[0], 429)
        self.assertEqual(self.req(True, 'GET', '/api/spaces', h={**self.K, 'X-Forwarded-For': '203.0.113.50'})[0], 403)

    # ---- duas etapas
    def test_pela_internet_precisa_de_aparelho(self):
        s, d, _ = self.req(True, 'GET', '/api/spaces', h=self.K)
        self.assertEqual(s, 403)
        self.assertTrue(d.get('precisa_aprovacao'))

    def test_aprovacao_exige_codigo_digitado(self):
        s, d, r = self.req(True, 'POST', '/api/acesso/pedir', {'nome': 'teste código'}, {**self.K, 'X-Forwarded-For': '198.51.100.1'})
        ck = r.getheader('Set-Cookie')
        self.assertIn('HttpOnly', ck)
        self.assertIn('Secure', ck)
        self.assertIn('SameSite=Strict', ck)
        s, lst, _ = self.req(False, 'GET', '/api/acesso/lista', h=self.K)
        p = next(p for p in lst['pendentes'] if p['nome'] == 'teste código')
        self.assertNotIn('codigo', p)
        errado = '000000' if d['codigo'] != '000000' else '111111'
        self.assertEqual(self.req(False, 'POST', '/api/acesso/decidir', {'id': p['id'], 'aprovar': True, 'codigo': errado}, self.K)[0], 403)
        self.assertEqual(self.req(False, 'POST', '/api/acesso/decidir', {'id': p['id'], 'aprovar': True, 'codigo': d['codigo'] + 'é'}, self.K)[0], 403)
        self.assertEqual(self.req(False, 'POST', '/api/acesso/decidir', {'id': p['id'], 'aprovar': True, 'codigo': d['codigo']}, self.K)[0], 200)

    def test_aparelho_aprovado_entra_e_esquecer_tira(self):
        pdev = self.aprovar('celular', '198.51.100.2')
        C = {**self.K, 'Cookie': f'pdev={pdev}'}
        s, d, _ = self.req(True, 'GET', '/api/spaces', h=C)
        self.assertEqual(s, 200)
        self.assertNotIn('privado', [x['workspace'] for x in d['spaces']], 'workspace oculto não aparece pela internet')
        self.assertEqual(self.req(True, 'GET', '/api/spaces', h={'X-Token': 'errada', 'Cookie': f'pdev={pdev}'})[0], 401)
        self.assertEqual(self.req(True, 'POST', '/api/acesso/esquecer', {}, {'Cookie': f'pdev={pdev}'})[0], 401)
        s, _, r = self.req(True, 'POST', '/api/acesso/esquecer', {}, C)
        self.assertIn('Max-Age=0', r.getheader('Set-Cookie'))
        self.assertEqual(self.req(True, 'GET', '/api/spaces', h=C)[0], 403)

    def test_recusa(self):
        s, d, r = self.req(True, 'POST', '/api/acesso/pedir', {'nome': 'recusar'}, {**self.K, 'X-Forwarded-For': '198.51.100.3'})
        pdev = re.search(r'pdev=([^;]+)', r.getheader('Set-Cookie')).group(1)
        s, lst, _ = self.req(False, 'GET', '/api/acesso/lista', h=self.K)
        pid = next(p['id'] for p in lst['pendentes'] if p['nome'] == 'recusar')
        self.req(False, 'POST', '/api/acesso/decidir', {'id': pid, 'aprovar': False}, self.K)
        s, d, _ = self.req(True, 'GET', '/api/acesso/estado', h={**self.K, 'Cookie': f'pdev={pdev}'})
        self.assertEqual(d['estado'], 'recusado')

    # ---- conversa, decisões, recados, arquivos
    def test_conversa_status_limites_e_mascara(self):
        s, d, _ = self.req(False, 'GET', '/api/conversa?pane=w1:p1&desde=0', h=self.K)
        self.assertEqual(s, 200)
        self.assertTrue(d['epoca'])
        textos = ' '.join(e['x'] for e in d['itens'])
        self.assertIn('guia de instalação', textos)
        self.assertNotIn('sk-demo-123456', textos, 'segredo mascarado')
        self.assertEqual(d['status']['ctx_pct'], 19)
        self.assertEqual(d['status']['janela_contexto'], 1000000)
        self.assertEqual(d['limites']['codex_sem'], 27.0)
        s, d2, _ = self.req(False, 'GET', f"/api/conversa?pane=w1:p1&desde={d['n']}&epoca={d['epoca']}", h=self.K)
        self.assertEqual(d2['itens'], [])
        self.assertEqual(self.req(False, 'GET', '/api/conversa?pane=w1:p1&desde=abc', h=self.K)[0], 400)

    def test_decisao_com_impressao_digital(self):
        s, d, _ = self.req(False, 'GET', '/api/tela?pane=w2:p1', h=self.K)
        dlg = d['dialogo']
        self.assertEqual([o['texto'] for o in dlg['opcoes']][0], 'Yes')
        self.assertIn('rm -rf build/', dlg['pergunta'])
        self.assertEqual(self.req(False, 'POST', '/api/tecla', {'pane': 'w2:p1', 'tecla': '1', 'dlg': 'velho'}, self.K)[0], 409)
        self.assertEqual(self.req(False, 'POST', '/api/tecla', {'pane': 'w2:p1', 'tecla': '1', 'dlg': dlg['id']}, self.K)[0], 200)
        self.assertEqual(self.req(False, 'POST', '/api/tecla', {'pane': 'w3:p1', 'tecla': '2'}, self.K)[0], 409)
        self.assertEqual(self.req(False, 'POST', '/api/tecla', {'pane': 'w2:p1', 'tecla': 'shift+tab'}, self.K)[0], 400)
        self.assertEqual(self.req(False, 'POST', '/api/enviar', {'pane': 'w2:p1', 'texto': 'oi'}, self.K)[0], 409)

    def test_app_instalavel_e_compartilhar(self):
        for caminho, tipo in (('/manifest.webmanifest', 'application/manifest+json'), ('/sw.js', 'text/javascript'), ('/icon192.png', 'image/png')):
            s, _, r = self.req(False, 'GET', caminho)
            self.assertEqual(s, 200, caminho)
            self.assertTrue(r.getheader('Content-Type').startswith(tipo), caminho)
        # share before the service worker is active: back to the portal, nothing stored / sem o SW: volta ao portal
        s, _, r = self.req(True, 'POST', '/share', b'x', {'Content-Type': 'multipart/form-data; boundary=x'})
        self.assertEqual(s, 303)
        self.assertEqual(r.getheader('Location'), '/spaces?shared=0')
        if not self.memory:
            self.assertEqual(self.req(False, 'HEAD', '/spaces')[0], 200)

    def test_recado_em_espera_enquanto_trabalha(self):
        # agent working → held 2 min, listed, can be sent now or cancelled / agente trabalhando → recado em espera
        s, d, _ = self.req(False, 'POST', '/api/enviar', {'pane': 'w1:p1', 'texto': 'segura'}, self.K)
        self.assertEqual((s, d.get('guardado'), d.get('tipo')), (200, True, 'espera'), d)
        s, d, _ = self.req(False, 'POST', '/api/enviar', {'pane': 'w1:p1', 'texto': 'quando terminar', 'depois': True}, self.K)
        self.assertEqual(d.get('tipo'), 'depois')
        s, lst, _ = self.req(False, 'GET', '/api/depois?pane=w1:p1', h=self.K)
        self.assertEqual([i['texto'] for i in lst['itens']], ['segura', 'quando terminar'])
        for i in lst['itens']:
            self.assertEqual(self.req(False, 'POST', '/api/depois/cancelar', {'id': i['id']}, self.K)[1]['removido'], 1)
        self.assertEqual(self.req(False, 'GET', '/api/depois?pane=w1:p1', h=self.K)[1]['itens'], [])

    def test_recado_multilinha(self):
        s, _, _ = self.req(False, 'POST', '/api/enviar', {'pane': 'w3:p1', 'texto': 'linha 1\nlinha 2\x1b[2J'}, self.K)
        self.assertEqual(s, 200)
        ult = json.loads(self.d['estado'].with_suffix('.log').read_text().splitlines()[-1])
        self.assertEqual(ult['texto'], '[Recado do Ana pelo portal] linha 1\nlinha 2 [2J')

    def test_corpos_invalidos(self):
        self.assertEqual(self.req(False, 'POST', '/api/enviar', b'[]', {**self.K, 'Content-Type': 'application/json'})[0], 400)
        self.assertIn(self.req(False, 'POST', '/api/enviar', b'{}', {**self.K, 'Content-Length': '-1'})[0], (400, 411, 413))

    def test_upload(self):
        self.assertEqual(self.req(False, 'POST', '/api/arquivo?pane=w3:p1&nome=x.exe', b'MZ', self.K)[0], 415)
        s, d, _ = self.req(False, 'POST', '/api/arquivo?pane=w3:p1&nome=../../relatorio.pdf', b'%PDF-1.4 demo', self.K)
        self.assertEqual(s, 200, d)
        p = Path(d['caminho'])
        self.assertTrue(p.name.endswith('_relatorio.pdf'))
        self.assertEqual(p.parent.name, '_recebidos_portal')
        self.assertEqual(oct(p.parent.stat().st_mode)[-3:], '700')
        self.assertTrue((p.parent / '.gitignore').exists())
        c = socket.create_connection(('127.0.0.1', self.d['priv']))
        c.sendall(f"POST /api/arquivo?pane=w3:p1&nome=cortado.txt HTTP/1.0\r\nHost: 127.0.0.1:{self.d['priv']}\r\n"
                  f"X-Token: {self.d['token']}\r\nContent-Length: 1000\r\n\r\n".encode() + b'x' * 100)
        c.close()
        time.sleep(0.5)
        self.assertFalse(any('cortado' in f.name for f in p.parent.iterdir()), 'envio cortado não é salvo')

    def test_trocar_chave_exige_a_atual(self):
        self.assertEqual(self.req(False, 'POST', '/api/acesso/trocar-chave', {}, self.K)[0], 403)

    def test_lista_informa_limite_de_upload(self):
        status, data, _ = self.req(False, 'GET', '/api/spaces', h=self.K)
        self.assertEqual(status, 200)
        self.assertEqual(data['upload_mb'], 25)


class UnidadeTest(unittest.TestCase):
    def setUp(self):
        import os
        os.environ.setdefault('MGE_PORTAL_DIR', tempfile.mkdtemp(prefix='_tmp_unid_', dir=AQUI))
        sys.path.insert(0, str(RAIZ / 'portal'))
        import portal
        self.p = portal

    def test_dialogo_sem_opcoes(self):
        self.assertIsNone(self.p.dialogo('texto normal\nsem opções\n'))
        self.assertIsNone(self.p.dialogo('só uma opção:\n❯ 1. Yes\n'))

    def test_dialogo_confianca(self):
        d = self.p.dialogo(' Do you trust the files in this folder?\n\n /home/ana/projects/example\n\n ❯ 1. Yes, proceed\n   2. No, exit\n')
        self.assertEqual(len(d['opcoes']), 2)
        self.assertIn('trust', d['pergunta'])

    def test_fila_e_pergunta_fora_do_blocked(self):
        fila = 'trabalhando…\n❯ [Recado] olha isso\n  ctrl+enter to send now\n❯ Press up to edit queued messages\n'
        with mock.patch.object(self.p, 'tela_recente', return_value=fila):
            self.assertTrue(self.p.situacao(dict(pane='w1:p1', status='working'))['fila'])
            self.assertFalse(self.p.situacao(dict(pane='w1:p1', status='idle'))['fila'])
        pergunta = ' Qual formato?\n ❯ 1. PDF\n   2. Word\n\n Enter to select · ↑/↓ to navigate · Esc to cancel\n'
        with mock.patch.object(self.p, 'tela_recente', return_value=pergunta):
            d = self.p.situacao(dict(pane='w1:p1', status='idle'))['dialogo']
            self.assertEqual([o['texto'] for o in d['opcoes']], ['PDF', 'Word'])
        lista = 'Resposta final:\n 1. primeiro\n 2. segundo\n'   # numbered answer text is not a decision
        with mock.patch.object(self.p, 'tela_recente', return_value=lista):
            self.assertIsNone(self.p.situacao(dict(pane='w1:p1', status='idle'))['dialogo'])
        with mock.patch.object(self.p, 'tela_recente', side_effect=subprocess.TimeoutExpired('herdr', 6)):
            self.assertEqual(self.p.situacao(dict(pane='w1:p1', status='working')), {})

    def test_mascara_e_nome_seguro(self):
        self.assertEqual(self.p.mascarar('senha: hunter22222 token=abcdefghij'), 'senha: *** token=***')
        self.assertEqual(self.p.nome_seguro('../../' + 'a' * 200 + '.pdf')[-4:], '.pdf')

    def test_janela_contexto_configuravel(self):
        with mock.patch.dict(self.p.CFG, janela_contexto=200000), mock.patch.object(self.p, 'read', return_value=''):
            status = self.p.status_sessao({'ctx': 100000}, '', '')
        self.assertEqual(status['ctx_pct'], 50)
        self.assertEqual(status['janela_contexto'], 200000)


if __name__ == '__main__':
    unittest.main()
