"""Authenticated lifecycle routes and reversible file download marks."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

import demo
import transport


class NewRoutesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.fixture = transport.fixture_without_sockets(demo, Path(self.temp.name))
        self.server = transport.MemoryServer(self.fixture)
        self.addCleanup(self.server.close)
        import portal
        self.portal = portal
        self.key = {'X-Token': self.fixture['token']}

    def request(self, method, path, body=None, authenticated=True, public=False):
        return self.server.request(public, method, path, body, self.key if authenticated else {})

    def test_new_routes_require_authorization(self):
        for method, path in [('GET', '/api/adormecidos'), ('POST', '/api/acordar'),
                             ('POST', '/api/acao'), ('POST', '/api/entregas/ocultar')]:
            self.assertIn(self.request(method, path, {}, False)[0], (401, 403))
            self.assertEqual(self.request(method, path, {}, public=True)[0], 403)

    def test_download_marks_and_newest_first(self):
        space = self.portal.space('w1:p1', False)
        folder = Path(space['cwd']) / '_portal_outbox'
        (folder / 'new.txt').write_text('new')
        body = dict(pane='w1:p1', kind='outbox', name='new.txt', marcar='baixado')
        self.assertEqual(self.request('POST', '/api/entregas/ocultar', body)[0], 200)
        rows = self.request('GET', '/api/files')[1]['workspaces'][0]['files']
        rows = [r for r in rows if r['kind'] == 'outbox']
        self.assertEqual(rows[0]['name'], 'new.txt')
        self.assertTrue(rows[0]['baixado'])
        body['marcar'] = 'nao_baixado'
        self.assertEqual(self.request('POST', '/api/entregas/ocultar', body)[0], 200)
        self.assertFalse(self.portal.file_store.marked(self.portal.DIR, folder / 'new.txt'))
        body['name'] = '../secret'
        self.assertEqual(self.request('POST', '/api/entregas/ocultar', body)[0], 400)

    def test_wake_filters_visibility_capacity_and_duplicates(self):
        dormant = dict(ws='wZ', workspace='sample', desde='', cwd='/srv/projects/sample')
        with mock.patch.object(self.portal, 'adormecidos', return_value=[dormant]), mock.patch.object(self.portal.subprocess, 'run') as run, mock.patch.object(self.portal.subprocess, 'Popen') as spawn:
            self.assertEqual(self.request('GET', '/api/adormecidos')[1]['spaces'][0]['ws'], 'wZ')
            run.return_value.stdout = 'FULL'
            self.assertEqual(self.request('POST', '/api/acordar', {'ws':'wZ'})[0], 503)
            spawn.assert_not_called()
            run.return_value.stdout = 'Capacity: OK'
            spawn.return_value.poll.return_value = None
            self.assertEqual(self.request('POST', '/api/acordar', {'ws':'wZ'})[0], 200)
            self.assertEqual(self.request('POST', '/api/acordar', {'ws':'wZ'})[0], 409)
            self.assertEqual(self.request('POST', '/api/acordar', {'ws':'wX'})[0], 400)
            spawn.assert_called_once()

    def test_close_coordinator_and_duplicate_action(self):
        body = dict(pane='w1:p1', acao='fechar')
        with mock.patch.dict(self.portal.CFG, coordinator_pane='w1:p1'):
            self.assertEqual(self.request('POST', '/api/acao', body)[0], 400)
        with mock.patch.object(self.portal.subprocess, 'Popen') as spawn:
            spawn.return_value.poll.return_value = None
            self.assertEqual(self.request('POST', '/api/acao', body)[0], 200)
            self.assertEqual(self.request('POST', '/api/acao', body)[0], 409)
            self.assertTrue(spawn.call_args.args[0][0].endswith('fechar_space'))

    def test_dormant_workspaces_hide_private_paths(self):
        results = [dict(result=dict(workspaces=[dict(workspace_id='wZ',label='private')])),
                   dict(result=dict(panes=[dict(workspace_id='wZ',cwd='/srv/private')]))]
        with mock.patch.object(self.portal, 'herdr', side_effect=[subprocess.CompletedProcess([],0,json.dumps(r)) for r in results]), mock.patch.dict(self.portal.CFG, ocultos_na_internet=['/srv/private']):
            self.assertEqual(self.portal.adormecidos(True), [])
