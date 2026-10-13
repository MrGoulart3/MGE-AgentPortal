"""Monta um ambiente de demonstração isolado (HOME temporário, herdr falso, transcrição, chave e config).

Todo o conteúdo é fictício. Usado pelos testes (tests/test_portal.py) e para gerar as imagens do README.
"""
import json
import os
import secrets
import socket
import stat
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SID = '0f6c2a8e-1b2c-4d5e-8f90-123456789abc'

PERMISSAO = """● Vou limpar a pasta de build antes de recompilar.

 ╭──────────────────────────────────────────────╮
 │ Bash command                                 │
 │                                              │
 │   rm -rf build/                              │
 │   Apagar a pasta de build antiga             │
 │                                              │
 │ Do you want to proceed?                      │
 │ ❯ 1. Yes                                     │
 │   2. Yes, and don't ask again for rm commands│
 │   3. No, and tell Claude what to do (esc)    │
 ╰──────────────────────────────────────────────╯"""

TELA_TRABALHANDO = """● Li os três capítulos e marquei as figuras sem legenda.

● Bash(python3 scripts/conferir_refs.py capitulos/)
  ⎿  42 referências conferidas, 2 sem DOI

✻ Revisando o capítulo 3… (1m 12s · ↓ 4.1k tokens)

────────────────────────────────────────────────────────────────────────
❯
────────────────────────────────────────────────────────────────────────
  ⏵⏵ auto mode on (shift+tab to cycle)"""


def porta_livre() -> int:
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    porta = s.getsockname()[1]
    s.close()
    return porta


def linha(tipo, ts, **kw):
    return json.dumps(dict(type=tipo, timestamp=ts, **kw), ensure_ascii=False)


def transcricao() -> str:
    msg = lambda papel, *conteudo: {'role': papel, 'content': list(conteudo)}
    texto = lambda t: {'type': 'text', 'text': t}
    tool = lambda nome, desc: {'type': 'tool_use', 'name': nome, 'input': {'description': desc}}
    linhas = [
        linha('permission-mode', None, permissionMode='auto'),
        linha('user', '2026-10-13T13:02:10', message={'role': 'user', 'content': 'Revise o capítulo 3 da tese e confira as referências, por favor.'}),
        linha('assistant', '2026-10-13T13:02:20', message=msg('assistant', texto('Combinado. Vou ler o capítulo 3, conferir as referências e listar o que precisa de ajuste.'))),
        linha('assistant', '2026-10-13T13:02:31', message=msg('assistant', tool('Read', 'Ler capitulos/cap3.md'), tool('Bash', 'Conferir DOIs das referências'))),
        linha('assistant', '2026-10-13T13:04:02', message=dict(msg('assistant', texto(
            'Terminei a primeira passada no capítulo 3:\n\n- **42 referências** conferidas; **2 estão sem DOI** (Silva 2019 e Costa 2021).\n'
            '- A Figura 3.4 não tem legenda.\n- Na seção 3.2, o termo `energia livre` aparece com duas definições.\n\nQuer que eu corrija as duas referências e proponha a legenda?')),
            model='claude-opus-5-5', usage={'input_tokens': 4, 'cache_read_input_tokens': 182000, 'cache_creation_input_tokens': 3200})),
        linha('user', '2026-10-13T13:05:40', message={'role': 'user', 'content': '[Recado do Ana pelo portal] Sim, corrija as duas e proponha a legenda da 3.4.'}),
        linha('assistant', '2026-10-13T13:05:52', message=msg('assistant', tool('Edit', 'capitulos/cap3.md'), tool('Bash', 'export API_KEY=sk-demo-123456 && python3 scripts/doi.py'))),
        linha('assistant', '2026-10-13T13:07:15', message=dict(msg('assistant', texto(
            'Pronto: as duas referências agora têm DOI, e a legenda proposta para a Figura 3.4 é:\n\n'
            '> Perfil de energia livre da reação, com os estados de transição TS1 e TS2.\n\nRevisando agora a seção 3.2.')),
            model='claude-opus-5-5', usage={'input_tokens': 4, 'cache_read_input_tokens': 191000, 'cache_creation_input_tokens': 900})),
    ]
    return '\n'.join(linhas) + '\n'


def montar(base: Path) -> dict:
    """Cria o ambiente em `base` e devolve {env, cfg, token, portas, estado}."""
    home = base / 'home'
    projetos = home / 'projetos'
    for nome in ('paper-review', 'data-pipeline', 'site-docs', 'privado'):
        (projetos / nome).mkdir(parents=True, exist_ok=True)
    (home / '.claude/projects/proj-paper-review').mkdir(parents=True, exist_ok=True)
    (home / f'.claude/projects/proj-paper-review/{SID}.jsonl').write_text(transcricao())
    (home / '.claude/plugins/oh-my-claudecode').mkdir(parents=True, exist_ok=True)
    (home / '.claude/plugins/oh-my-claudecode/.usage-cache-anthropic.json').write_text(json.dumps(
        {'data': {'fiveHourPercent': 38, 'fiveHourResetsAt': '2026-10-14T00:50:00Z'}}))
    cdx = home / '.codex/sessions/2026/10/13'
    cdx.mkdir(parents=True, exist_ok=True)
    (cdx / 'rollout-demo.jsonl').write_text(json.dumps({'type': 'event_msg', 'payload': {'type': 'token_count', 'rate_limits': {
        'primary': {'used_percent': 12.0, 'window_minutes': 300, 'resets_at': 1791939698},
        'secondary': {'used_percent': 27.0, 'window_minutes': 10080, 'resets_at': 1792496550}}}}) + '\n')
    agente = lambda pane, ws, tipo, status, pasta, titulo, sid='': dict(
        pane_id=pane, workspace_id=ws, agent=tipo, agent_status=status, cwd=str(projetos / pasta),
        terminal_title_stripped=titulo, agent_session={'value': sid})
    estado = dict(
        workspaces=[dict(workspace_id='w1', label='paper-review'), dict(workspace_id='w2', label='data-pipeline'),
                    dict(workspace_id='w3', label='site-docs'), dict(workspace_id='w4', label='privado')],
        agents=[agente('w1:p1', 'w1', 'claude', 'working', 'paper-review', 'Revisão do capítulo 3', SID),
                agente('w2:p1', 'w2', 'claude', 'blocked', 'data-pipeline', 'Recompilar o pipeline'),
                agente('w3:p1', 'w3', 'claude', 'done', 'site-docs', 'Atualizar a documentação'),
                agente('w2:p2', 'w2', 'codex', 'idle', 'data-pipeline', 'codex: testes do pipeline'),
                agente('w4:p1', 'w4', 'claude', 'idle', 'privado', 'Projeto de outra pessoa')],
        telas={'w1:p1': TELA_TRABALHANDO, 'w2:p1': PERMISSAO, 'w3:p1': '● Documentação atualizada.\n❯ ', 'w2:p2': '› pronto\n'})
    est = base / 'herdr_estado.json'
    est.write_text(json.dumps(estado, ensure_ascii=False))
    herdr = base / 'herdr'
    herdr.write_text(f'#!/bin/sh\nexec {sys.executable} {AQUI / "herdr_falso.py"} "$@"\n')
    herdr.chmod(herdr.stat().st_mode | stat.S_IEXEC)
    cfgdir = base / 'cfg'
    cfgdir.mkdir(mode=0o700, exist_ok=True)
    priv, pub = porta_livre(), porta_livre()
    token = secrets.token_urlsafe(32)
    (cfgdir / 'token').write_text(token + '\n')
    (cfgdir / 'config.json').write_text(json.dumps(dict(
        dono='Ana', herdr=str(herdr), enderecos_privados=[['127.0.0.1', priv]], porta_publica=pub,
        hosts_permitidos=[f'127.0.0.1:{priv}', f'127.0.0.1:{pub}'], ocultos_na_internet=['privado'],
        aviso_cmd=[], cache_uso=str(home / '.claude/plugins/oh-my-claudecode/.usage-cache-anthropic.json'))))
    env = dict(os.environ, HOME=str(home), MGE_PORTAL_DIR=str(cfgdir), HERDR_FALSO=str(est))
    return dict(env=env, token=token, priv=priv, pub=pub, estado=est, home=home, cfgdir=cfgdir)
