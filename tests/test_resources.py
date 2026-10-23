"""Authenticated panel integration and public snapshot privacy regressions."""
import importlib.util
import json
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

import demo
import test_portal
import transport

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('resources', ROOT / 'portal/resources.py')
RESOURCES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RESOURCES)


class SnapshotTest(unittest.TestCase):
    def test_compute_programs_are_configurable(self):
        self.assertEqual('compute', RESOURCES.category('xtb', '/usr/bin/xtb'))
        self.assertEqual('other', RESOURCES.category('xtb', '/usr/bin/xtb', []))
        collector = RESOURCES.Collector({'compute_commands': ['RENDER_JOB'], 'job_state': ''})
        self.assertEqual('compute', RESOURCES.category('python3', 'python3 render_job.py', collector.compute_commands))
        self.assertEqual('codex', RESOURCES.category('node', 'node codex.js', collector.compute_commands))
        self.assertIsNone(collector.job_state)
        self.assertEqual([], collector.sample()['jobs'])

    def test_thresholds_and_missing_sensors(self):
        values = {'/proc/uptime': '120 0', '/proc/stat': 'cpu 10 0 10 80 0 0 0 0',
                  '/proc/meminfo': 'MemTotal: 10000000 kB\nMemAvailable: 9000000 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB'}
        collector = RESOURCES.Collector({'job_state': '', 'min_ram_gb': 0, 'mounts': []})
        with mock.patch.object(RESOURCES, 'read', side_effect=lambda path: values.get(str(path), '')), \
             mock.patch.object(Path, 'glob', return_value=[]), \
             mock.patch.object(RESOURCES.os, 'getloadavg', return_value=(0, 0, 0)), \
             mock.patch.object(collector, 'processes', return_value=([], 0)):
            sample = collector.sample()
            self.assertIsNone(sample['temperature'])
            self.assertEqual(sample['capacity'], 'ok')
            collector.options['thresholds'] = {'ram_warn': 5, 'ram_full': 90}
            self.assertEqual(collector.sample()['capacity'], 'tight')
            collector.options['thresholds']['ram_full'] = 8
            self.assertEqual(collector.sample()['capacity'], 'full')

    def test_hides_unmapped_projects_processes_and_jobs_without_mutation(self):
        source = json.dumps({'spaces': {'proj-a': {}, 'hidden': {}, 'system/other': {}},
                             'processes': [{'space': 'proj-a'}, {'space': 'hidden'}],
                             'jobs': [{'space': 'hidden'}], 'history': [{'cpu': 3}]}).encode()
        result = json.loads(RESOURCES.public_snapshot(source, Path('/projects'),
                                                     [{'cwd': '/projects/proj-a'}], ['hidden']))
        self.assertEqual({'proj-a': {}}, result['spaces'])
        self.assertEqual([{'space': 'proj-a'}], result['processes'])
        self.assertEqual([], result['jobs'])
        self.assertIn('hidden', json.loads(source)['spaces'])

    def test_hidden_nested_workspace_blocks_entire_parent_group(self):
        source = b'{"spaces":{"proj-a":{}},"processes":[{"space":"proj-a"}]}'
        result = json.loads(RESOURCES.public_snapshot(source, Path('/projects'),
                                                     [{'cwd': '/projects/proj-a/public'}],
                                                     ['/projects/proj-a/private']))
        self.assertEqual({}, result['spaces'])
        self.assertEqual([], result['processes'])
        self.assertIsNone(RESOURCES.project('', Path('/projects')))
        self.assertIsNone(RESOURCES.project('/projects-other/proj-a', Path('/projects')))


class PanelTest(unittest.TestCase):
    req = test_portal.PortalTest.req
    aprovar = test_portal.PortalTest.aprovar

    @classmethod
    def setUpClass(cls):
        cls.base = Path(tempfile.mkdtemp(prefix='_tmp_panel_', dir=ROOT / 'tests'))
        cls.memory = None
        cls.d = demo.montar(cls.base) if transport.available() else transport.fixture_without_sockets(demo, cls.base)
        cfg_path = cls.d['cfgdir'] / 'config.json'
        cfg = json.loads(cfg_path.read_text())
        root = cls.d['home'] / 'projetos'
        cfg['painel'] = {'enabled': True, 'project_root': str(root), 'disk': '',
                         'mounts': ['/'], 'interval': 1, 'job_state': str(cls.base / 'jobs.json')}
        cfg['ocultos_na_internet'] = ['w4']
        cfg_path.write_text(json.dumps(cfg))
        cls.jobs = []
        for name, duration in [('docs-guide', 31), ('privado', 32)]:
            cls.jobs.append(subprocess.Popen([sys.executable, '-c', f'import time; time.sleep({duration})'], cwd=root / name))
        (cls.base / 'jobs.json').write_text(json.dumps({'jobs': [
            {'pid': child.pid, 'threads': 1, 'cwd': str(root / name), 'paused': False}
            for child, name in zip(cls.jobs, ['docs-guide', 'privado'])]}))
        if not transport.available():
            cls.memory = transport.MemoryServer(cls.d)
            cls.K = {'X-Token': cls.d['token']}
            return
        cls.proc = subprocess.Popen([sys.executable, '-u', str(ROOT / 'portal/server.py')],
                                    env=cls.d['env'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        cls.K = {'X-Token': cls.d['token']}
        for _ in range(100):
            try:
                connection = socket.create_connection(('127.0.0.1', cls.d['pub']), timeout=0.2)
                connection.close()
                break
            except OSError:
                time.sleep(0.05)
        else:
            raise RuntimeError('Panel server did not start')

    @classmethod
    def tearDownClass(cls):
        if cls.memory:
            cls.memory.close()
        else:
            cls.proc.terminate()
            cls.proc.communicate(timeout=5)
        for child in cls.jobs:
            child.terminate()
            child.wait(timeout=5)
        shutil.rmtree(cls.base)

    def snapshot(self, public=False, headers=None):
        for _ in range(40):
            code, data, response = self.req(public, 'GET', '/api/estado', h=headers or self.K)
            if code != 503:
                return code, data, response
            time.sleep(0.05)
        self.fail('Collector never published a sample')

    def test_html_and_data_require_key_and_public_device(self):
        for route in ['/painel', '/api/estado']:
            self.assertEqual(401, self.req(False, 'GET', route)[0])
            self.assertEqual(403, self.req(True, 'GET', route, h=self.K)[0])
            if route == '/api/estado':
                self.assertEqual(200, self.snapshot()[0])  # the collector may not have sampled yet
            else:
                self.assertEqual(200, self.req(False, 'GET', route, h=self.K)[0])
        self.assertEqual(404, self.req(False, 'GET', '/api/estadoX', h=self.K)[0])

    def test_private_collection_and_public_workspace_id_filter(self):
        code, private, _ = self.snapshot()
        self.assertEqual(200, code)
        self.assertIn('privado', private['spaces'])
        self.assertTrue(any(row['space'] == 'privado' for row in private['jobs']))
        self.assertTrue(private['memory']['total'] > 0)
        for row in private['processes']:
            self.assertNotIn('user', row)
            self.assertNotIn('/', row['command'])
        device = self.aprovar('panel-device', '203.0.113.41')
        headers = self.K | {'Cookie': 'pdev=' + device, 'X-Forwarded-For': '203.0.113.41'}
        code, public, _ = self.snapshot(True, headers)
        self.assertEqual(200, code)
        self.assertIn('docs-guide', public['spaces'])
        self.assertNotIn('privado', public['spaces'])
        self.assertFalse(any(row.get('space') == 'privado' for key in ('jobs', 'processes') for row in public[key]))
        self.assertIn('no-store', self.req(True, 'GET', '/painel', h=headers)[2].getheader('Cache-Control'))


if __name__ == '__main__':
    unittest.main()
