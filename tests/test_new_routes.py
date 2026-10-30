"""Authenticated lifecycle routes and reversible file download marks."""
import json
import io
from concurrent.futures import ThreadPoolExecutor
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
                             ('POST', '/api/acao'), ('POST', '/api/entregas/ocultar'),
                             ('GET', '/api/priority'), ('POST', '/api/priority')]:
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
            run.return_value.returncode = 0
            self.assertEqual(self.request('POST', '/api/acordar', {'ws':'wZ'})[0], 503)
            spawn.assert_not_called()
            run.return_value.stdout = 'Capacity: OK'
            spawn.return_value.poll.return_value = None
            self.assertEqual(self.request('POST', '/api/acordar', {'ws':'wZ'})[0], 200)
            self.assertEqual(self.request('POST', '/api/acordar', {'ws':'wZ'})[0], 409)
            self.assertEqual(self.request('POST', '/api/acordar', {'ws':'wX'})[0], 400)
            spawn.assert_called_once()

    def test_unknown_capacity_never_wakes(self):
        dormant = dict(ws='wZ', workspace='sample', desde='')
        for output, code in [('', 0), ('unreadable', 0), ('VEREDITO: UNKNOWN', 0),
                             ('Capacity: OK', 1), ('Capacity: OK\nFULL', 0)]:
            with self.subTest(output=output, code=code), mock.patch.object(
                    self.portal, 'adormecidos', return_value=[dormant]), mock.patch.object(
                    self.portal.subprocess, 'run', return_value=subprocess.CompletedProcess([], code, output)), mock.patch.object(
                    self.portal.subprocess, 'Popen') as spawn:
                self.assertEqual(self.request('POST', '/api/acordar', {'ws': 'wZ'})[0], 503)
                spawn.assert_not_called()
        with mock.patch.object(self.portal, 'adormecidos', return_value=[dormant]), mock.patch.object(
                self.portal.subprocess, 'run', side_effect=subprocess.TimeoutExpired('capacity', 30)), mock.patch.object(
                self.portal.subprocess, 'Popen') as spawn:
            self.assertEqual(self.request('POST', '/api/acordar', {'ws': 'wZ'})[0], 503)
            spawn.assert_not_called()

    def test_agent_list_failure_keeps_previous_spaces(self):
        previous = [dict(pane='w1:p1')]
        self.portal._SPACES[:] = [0, previous]
        for stdout, code in [('not json', 0), ('{}', 0), ('{"result":{"agents":null}}', 0),
                             ('{"result":{"agents":[]}}', 1)]:
            with mock.patch.object(self.portal, 'herdr', return_value=subprocess.CompletedProcess([], code, stdout)):
                self.assertIs(self.portal.spaces_list(), previous)

    def configure_priority(self):
        options = dict(enabled=True, projects={'sample-project': 5, 'example-project': 5, 'paused-project': 0},
                       panes={}, **{name: str(Path(self.temp.name) / ('priority-' + name))
                                   for name in ('scores', 'order', 'paused', 'log', 'lock')})
        self.portal.CFG['priority'] = options
        return options

    def test_priority_validation_and_stable_order(self):
        options = self.configure_priority()
        Path(options['order']).write_text('example-project sample-project\n')
        self.assertEqual(self.request('GET', '/api/priority')[0], 200)
        for scores in (None, {}, [], {'unknown': 5}, {'sample-project': True},
                       {'sample-project': 1.5}, {'sample-project': 5.0},
                       {'sample-project': ''}, {'sample-project': None},
                       {'sample-project': -1}, {'sample-project': 11}):
            self.assertEqual(self.request('POST', '/api/priority', {'scores': scores})[0], 400)
        self.assertFalse(Path(options['scores']).exists())
        code, data, _ = self.request('POST', '/api/priority', {'scores': {'sample-project': 5}})
        self.assertEqual(code, 200)
        self.assertEqual(data['order'], ['example-project', 'sample-project'])
        self.assertEqual(data['paused'], ['paused-project'])
        data = self.request('POST', '/api/priority', {'scores': {'sample-project': 10, 'example-project': 0}})[1]
        self.assertEqual(data['order'], ['sample-project'])
        self.assertEqual(Path(options['order']).read_text().strip(), 'sample-project')
        self.assertIn('example-project', Path(options['paused']).read_text().split())
        self.assertEqual(json.loads(Path(options['scores']).read_text())['scores'], data['scores'])
        self.assertEqual(json.loads(Path(options['log']).read_text().splitlines()[-1])['changes']['sample-project'], [5, 10])
        self.assertEqual(Path(options['scores']).stat().st_mode & 0o777, 0o600)

    def test_priority_public_visibility_and_change_notifications(self):
        options = self.configure_priority()
        options['panes'] = {'sample-project': 'w1:p1'}
        with mock.patch.object(self.portal, 'queue_after') as queue:
            self.request('POST', '/api/priority', {'scores': {'sample-project': 5}})
            queue.assert_not_called()
            self.request('POST', '/api/priority', {'scores': {'sample-project': 0}})
            queue.assert_called_once()
            self.assertEqual(queue.call_args.args[0], 'w1:p1')
        with mock.patch.object(self.portal.PortalMixin, 'authorized', return_value=True), mock.patch.object(
                self.portal, 'visiveis', return_value=[dict(workspace='sample-project', pane='w1:p1')]):
            self.assertEqual(set(self.request('GET', '/api/priority', public=True)[1]['scores']), {'sample-project'})
            self.assertEqual(self.request('POST', '/api/priority', {'scores': {'example-project': 4}}, public=True)[0], 400)

    def test_priority_concurrent_partial_updates_are_preserved(self):
        options = self.configure_priority()
        allowed = set(options['projects'])
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(self.portal.priority_save, {project: score}, allowed, 'test')
                       for project, score in [('sample-project', 9), ('example-project', 8)]]
            for future in futures:
                future.result(timeout=5)
        data = self.request('GET', '/api/priority')[1]
        self.assertEqual(data['order'], ['sample-project', 'example-project'])
        self.assertEqual(data['scores']['sample-project'], 9)
        self.assertEqual(data['scores']['example-project'], 8)

    def test_remaining_credits_optional_meter_hook_and_coordinator(self):
        body = dict(pane='w1:p1', acao='use_remaining_credits')
        self.assertEqual(self.request('POST', '/api/acao', body)[0], 503)
        cache = Path(self.temp.name) / 'usage.json'
        cache.write_text(json.dumps(dict(data=dict(fiveHourPercent=42, fiveHourResetsAt='2099-01-01T12:00:00Z'))))
        with mock.patch.dict(self.portal.CFG, use_remaining_credits=True, cache_uso=str(cache)), mock.patch.object(
                self.portal, 'remaining_credits_enabled', return_value=True), mock.patch.object(
                self.portal.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, 'OK')) as run, mock.patch.object(
                self.portal, 'queue_after') as queue:
            self.assertEqual(self.request('POST', '/api/acao', body)[0], 200)
            self.assertIn('42% used', queue.call_args.args[1])
            self.assertIn('credit lock has been released', queue.call_args.args[1])
            with mock.patch.dict(self.portal.CFG, coordinator_pane='w1:p1'):
                self.assertEqual(self.request('POST', '/api/acao', body)[0], 200)
                self.assertIn('Ask the user which projects should be excluded', queue.call_args.args[1])
                run.assert_called_once()
            cache.write_text('{}')
            self.assertEqual(self.request('POST', '/api/acao', body)[0], 503)

    def test_upload_preserves_configured_free_space(self):
        body = b'hello'
        for route in ('/api/arquivo', '/api/files/upload'):
            with mock.patch.object(self.portal.shutil, 'disk_usage', return_value=mock.Mock(free=10 * 2**30)):
                self.assertEqual(self.request('POST', route + '?pane=w1:p1&nome=sample.txt', body)[0], 507)
            with mock.patch.dict(self.portal.CFG, upload_min_free_gb=2), mock.patch.object(
                    self.portal.shutil, 'disk_usage', return_value=mock.Mock(free=2 * 2**30 + len(body))):
                self.assertEqual(self.request('POST', route + '?pane=w1:p1&nome=sample.txt', body)[0], 200)

    def test_download_total_deadline_does_not_mark_partial_transfer(self):
        space = self.portal.space('w1:p1', False)
        handler = mock.Mock(command='GET', wfile=io.BytesIO())
        handler.pane_q.return_value = space
        folder = Path(space['cwd']) / '_portal_outbox'
        (folder / 'deadline.txt').write_bytes(b'sample')
        with mock.patch.dict(self.portal.CFG, download_timeout=1), mock.patch.object(
                self.portal.time, 'monotonic', side_effect=[0, 2]), mock.patch.object(
                self.portal.threading, 'Timer') as timer, mock.patch.object(
                self.portal.file_store, 'mark') as mark:
            self.portal.PortalMixin.r_download(handler, {'name': ['deadline.txt']})
            self.assertEqual(handler.wfile.getvalue(), b'')
            self.assertTrue(handler.close_connection)
            mark.assert_not_called()
            timer.assert_called_once_with(1, handler.derrubar)
            timer.return_value.start.assert_called_once()
            timer.return_value.cancel.assert_called_once()

    def test_download_slow_write_uses_remaining_deadline(self):
        space = self.portal.space('w1:p1', False)
        handler = mock.Mock(command='GET', wfile=io.BytesIO())
        handler.pane_q.return_value = space
        folder = Path(space['cwd']) / '_portal_outbox'
        (folder / 'slow.txt').write_bytes(b'sample')
        with mock.patch.dict(self.portal.CFG, download_timeout=2), mock.patch.object(
                self.portal.time, 'monotonic', side_effect=[0, 1, 3]), mock.patch.object(
                self.portal.threading, 'Timer') as timer, mock.patch.object(
                self.portal.file_store, 'mark') as mark:
            self.portal.PortalMixin.r_download(handler, {'name': ['slow.txt']})
            self.assertEqual(handler.wfile.getvalue(), b'sample')
            handler.connection.settimeout.assert_called_once_with(1)
            timer.assert_called_once_with(2, handler.derrubar)
            mark.assert_not_called()

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
