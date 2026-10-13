#!/usr/bin/env python3
"""herdr falso para testes e demonstração: responde aos comandos que o portal usa, a partir de um estado em JSON.

Estado: $HERDR_FALSO (arquivo JSON) com {"workspaces": [...], "agents": [...], "telas": {pane: texto}}.
Recados e teclas recebidos vão para <estado>.log (uma linha JSON por ação).
"""
import json
import os
import sys
from pathlib import Path

ESTADO = Path(os.environ.get('HERDR_FALSO', 'herdr_estado.json'))


def main(argv: list) -> int:
    estado = json.loads(ESTADO.read_text())
    log = ESTADO.with_suffix('.log')
    cmd = argv[:2]
    if cmd == ['workspace', 'list']:
        print(json.dumps({'result': {'workspaces': estado['workspaces']}}))
        return 0
    if cmd == ['agent', 'list']:
        print(json.dumps({'result': {'agents': estado['agents']}}))
        return 0
    pane = argv[2] if len(argv) > 2 else ''
    agente = next((a for a in estado['agents'] if a['pane_id'] == pane), None)
    if cmd == ['agent', 'read']:
        if '--lines' in argv and agente and agente.get('agent_status') == 'working':
            print(json.dumps({'error': {'code': 'agent_not_idle'}}))
            return 1
        print(estado['telas'].get(pane, ''))
        return 0
    if cmd == ['agent', 'prompt']:
        if agente and agente.get('agent_status') == 'blocked':
            print(json.dumps({'error': {'code': 'agent_blocked'}}))
            return 1
        with log.open('a') as f:
            f.write(json.dumps({'acao': 'prompt', 'pane': pane, 'texto': argv[3]}, ensure_ascii=False) + '\n')
        print(json.dumps({'result': {'type': 'agent_prompted'}}))
        return 0
    if cmd == ['pane', 'send-keys']:
        with log.open('a') as f:
            f.write(json.dumps({'acao': 'tecla', 'pane': pane, 'tecla': argv[3]}) + '\n')
        return 0
    print(json.dumps({'error': {'code': 'unknown_command', 'argv': argv}}))
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
