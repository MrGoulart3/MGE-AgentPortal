#!/usr/bin/env python3
"""Gera as imagens de exemplo do README (docs/img/) com o cenário fictício de tests/demo.py.

Sobe o servidor com o herdr falso, busca as respostas reais da API e fotografa a página com o Firefox headless
(a página roda com essas respostas gravadas, porque o Firefox headless não guarda a chave no navegador).
Uso: python3 scripts/gerar_imagens.py            (português, docs/img/)
     IDIOMA=en python3 scripts/gerar_imagens.py  (inglês, docs/img/en/; precisa do firefox no PATH)
"""
import http.client
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / 'tests'))
import demo  # noqa: E402

IDIOMA = os.environ.get('IDIOMA', 'pt')   # pt ou en
SAIDA = RAIZ / ('docs/img' if IDIOMA == 'pt' else f'docs/img/{IDIOMA}')


def main() -> None:
    base = Path(tempfile.mkdtemp(prefix='_tmp_img_', dir=RAIZ / 'tests'))
    d = demo.montar(base)
    proc = subprocess.Popen([sys.executable, str(RAIZ / 'portal/server.py')], env=d['env'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                socket.create_connection(('127.0.0.1', d['priv']), timeout=0.2).close()
                break
            except OSError:
                time.sleep(0.1)
        K = {'X-Token': d['token'], 'Host': f"127.0.0.1:{d['priv']}"}

        def api(caminho, corpo=None, h=None, publica=False):
            porta = d['pub'] if publica else d['priv']
            c = http.client.HTTPConnection('127.0.0.1', porta, timeout=20)
            hs = {**K, 'Host': f'127.0.0.1:{porta}', **(h or {})}
            if corpo is not None:
                hs['Content-Type'] = 'application/json'
            c.request('POST' if corpo is not None else 'GET', caminho, body=json.dumps(corpo).encode() if corpo is not None else None, headers=hs)
            r = c.getresponse()
            return json.loads(r.read()), r

        # um pedido pendente e um aparelho aprovado, para a tela de Acessos
        ped, r = api('/api/acesso/pedir', {'nome': 'PC do laboratório'}, {'X-Forwarded-For': '203.0.113.7'}, publica=True)
        ped2, r2 = api('/api/acesso/pedir', {'nome': 'Celular'}, {'X-Forwarded-For': '198.51.100.20'}, publica=True)
        lst, _ = api('/api/acesso/lista')
        pid = next(p['id'] for p in lst['pendentes'] if p['nome'] == 'Celular')
        api('/api/acesso/decidir', {'id': pid, 'aprovar': True, 'codigo': ped2['codigo']})
        dados = dict(
            spaces=api('/api/spaces')[0], conversa=api('/api/conversa?pane=w1:p1&desde=0')[0],
            tela=api('/api/tela?pane=w2:p1')[0], acessos=api('/api/acesso/lista')[0],
            recados={'historico': [{'t': '2026-10-13 13:05:40', 'tipo': 'recado', 'texto': 'Sim, corrija as duas e proponha a legenda da 3.4.', 'aparelho': 'Celular'}]})
        dados['conversa']['estado'] = 'working'
        cenas = [
            ('conversa.png', 1400, 950, dict(space='w1:p1', modo='conversa')),
            ('decisao.png', 1400, 950, dict(space='w2:p1', modo='vivo')),
            ('acessos.png', 1400, 950, dict(space='w3:p1', modo='vivo', acessos=True)),
            ('aprovacao.png', 1000, 620, dict(login=True, codigo=ped['codigo'])),
            ('celular.png', 420, 900, dict(space='w1:p1', modo='conversa', celular=True)),
        ]
        html = (RAIZ / 'portal/web/spaces.html').read_text()
        trabalho = base / 'web'
        trabalho.mkdir()
        shutil.copy(RAIZ / 'portal/web/spaces.js', trabalho / 'spaces.js')
        SAIDA.mkdir(parents=True, exist_ok=True)
        for nome, w, h, cena in cenas:
            js = ["localStorage.clear()", f"localStorage.setItem('portal_idioma','{IDIOMA}')"]
            if cena.get('login'):
                js.append("localStorage.setItem('portal_chave','x')")
                resp = "u.includes('/api/acesso/estado')?{estado:'pendente'}:u.includes('/api/acesso/pedir')?{codigo:%s}:null" % json.dumps(cena['codigo'])
                extra = ("addEventListener('load',()=>setTimeout(()=>{document.getElementById('apnome').value='PC do laboratório';"
                         "document.getElementById('appedir').click()},300));")
                falha403 = "if(u.includes('/api/spaces'))return {ok:false,status:403,headers:new Headers(),json:async()=>({erro:'aparelho não aprovado',precisa_aprovacao:true})};"
            else:
                js += ["localStorage.setItem('portal_chave','x')", f"localStorage.setItem('portal_space','{cena['space']}')",
                       f"localStorage.setItem('portal_modo','{cena['modo']}')", "localStorage.setItem('portal_auto','0')"]
                resp = "null"
                extra = "addEventListener('load',()=>setTimeout(()=>document.getElementById('vacessos').click(),400));" if cena.get('acessos') else ''
                falha403 = ''
            mock = ("<script>%s;const D=%s;window.fetch=async(u)=>{%sconst x=%s;const b=x||(u.includes('/api/spaces')?D.spaces:"
                    "u.includes('/api/conversa')?D.conversa:u.includes('/api/tela')?D.tela:u.includes('/api/acesso/lista')?D.acessos:"
                    "u.includes('/api/recados')?D.recados:{});return {ok:true,status:200,headers:new Headers(),json:async()=>b}};%s</script>"
                    % (';'.join(js), json.dumps(dados, ensure_ascii=False), falha403, resp, extra))
            pagina = html.replace('<script src="/spaces.js"></script>', mock + '<script src="spaces.js"></script>')
            (trabalho / 'p.html').write_text(pagina)
            perfil = base / f'perfil_{nome}'
            perfil.mkdir()
            subprocess.run(['firefox', '--headless', '--profile', str(perfil), f'--window-size={w},{h}',
                            '--screenshot', str(SAIDA / nome), (trabalho / 'p.html').as_uri()],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
            print('ok', nome)
    finally:
        proc.terminate()
        shutil.rmtree(base, ignore_errors=True)


if __name__ == '__main__':
    main()
