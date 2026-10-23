"""Collector fixtures and authenticated file/page routes without real SSH."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock

import demo
import transport

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('collect_servers', ROOT / 'scripts/collect_servers.py')
collector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector)
NODE = '''banner
@@NODE
8
3.0 2.0 1.0 1/100 123
16000000 8000000
@@DF
Filesystem 1024-blocks Used Available Capacity Mounted on
/dev/disk 10000 9200 800 92% /scratch
@@PROCS
12|ana|200|1024|90|python|/srv/projects/docs-guide/run
13|guest|100|2048|60|solver|/srv/other
14|guest|50|256|30|python|/srv/projects/docs-guide2
'''
OPTIONS = {'users':['ana'], 'workspaces':{'/srv/projects/docs-guide':'docs-guide'}}


class CollectorTest(unittest.TestCase):
    def test_linux_groups_and_prefix_boundary(self):
        row = collector.parse_output(NODE, {'name':'gpu-node'}, OPTIONS)
        self.assertTrue(row['online'])
        self.assertEqual(row['cores'], 8)
        self.assertEqual(row['ours'], 2)
        self.assertEqual(row['used'], 3.5)
        self.assertEqual(row['disks'][0]['percent'], 92)
        self.assertEqual(row['processes'][0]['workspace'], 'docs-guide')
        self.assertFalse(row['processes'][2]['ours'])
        self.assertFalse(collector.parse_output('broken', {'name':'gpu-node'}, OPTIONS)['online'])

    def test_heavy_processes(self):
        lines = [
            'ana|1|200|1-02:03:04|1024|/srv/projects/docs-guide|python run.py',
            'ana|2|5|00:30|512|/srv/projects/docs-guide|python other.py',
            'guest|3|50|02:00|256||solver sample.in --flag|pipe',
            'guest|4|10|01:00|256||solver sample.in --more',
            'guest|5|4.9|00:10|256||ignored',
            'broken', 'guest|6|nan|00:10|1||bad',
        ]
        rows = collector.parse_heavy(lines, OPTIONS)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['cpu'], 205)
        self.assertEqual(rows[0]['count'], 2)
        self.assertEqual(rows[0]['ram'], 1536 * 1024)
        self.assertEqual(rows[0]['elapsed'], 93784)
        self.assertEqual(rows[1]['count'], 2)
        self.assertEqual(rows[1]['program'], 'solver')
        self.assertFalse({'cwd', 'command'} & rows[1].keys())
        self.assertEqual(len(collector.parse_heavy(lines, dict(OPTIONS, process_cpu_min=100))), 1)
        many = [f'guest|{i}|10|00:01|1||tool {i} ' + 'x'*300 for i in range(60)]
        limited = collector.parse_heavy(many, OPTIONS)
        self.assertEqual(len(limited), 1)
        self.assertEqual(limited[0]['count'], 40)
        parsed = collector.parse_output(NODE + '@@HEAVY\n' + '\n'.join(lines), {'name':'sample'}, OPTIONS)
        self.assertEqual(parsed['heavy_processes'], rows)

    def test_person_derivation_and_programs(self):
        options = dict(OPTIONS, accounts={
            'lab': {'responsible': 'Prof. Silva', 'shared': True},
            'guest': {'responsible': 'Guest supervisor', 'shared': False}},
            aliases={'ana': 'Ana', 'bruno': 'Bruno', 'guest': 'Visitor'},
            base_dirs=['/srv/storage'], workspace_owner='Portal team')
        for cwd, command, expected in (
            ('/home/lab/ana/run', '', 'Ana'),
            ('/srv/storage/lab/bruno/run', '', 'Bruno'),
            ('/home/lab/scratch/run', 'orca /home/lab/ana/input', 'Ana'),
            ('/home/lab/g16_scratch/run', '', '? (lab)'),
            ('/home/lab/software/run', '', '? (lab)'),
            ('/home/lab/opt/run', '', '? (lab)'),
            ('/home/lab/bin/run', '', '? (lab)'),
            ('/home/lab2/ana/run', '', '? (lab)'),
            ('/srv/projects/docs-guide/run', '', 'Portal team · docs-guide'),
            ('', 'python /srv/projects/docs-guide/run.py', 'Portal team · docs-guide')):
            person = collector.identity('lab', cwd, command, options)
            self.assertEqual(person['person'], expected)
            self.assertEqual(person['responsible'], 'Prof. Silva')
        self.assertEqual(collector.identity('guest', '/home/guest/ana', '', options)['person'], 'Visitor')
        jobs = collector.parse_jobs(['1|private-job|lab|RUNNING|8|01:00|/srv/storage/lab/bruno/run'], 'slurm', options)
        self.assertEqual(jobs[0]['person'], 'Bruno')
        self.assertEqual(jobs[0]['responsible'], 'Prof. Silva')
        self.assertFalse({'cwd', 'command', 'name'} & jobs[0].keys())
        for executable, expected in (('l502.exe', 'Gaussian'), ('orca', 'ORCA'),
                ('cpmd.x', 'CPMD'), ('gmx_mpi', 'GROMACS'), ('xtb', 'xTB'),
                ('crest', 'CREST'), ('cp2k.psmp', 'CP2K'), ('vasp_std', 'VASP'),
                ('lmp_mpi', 'LAMMPS'), ('python3', 'Python'), ('mpiexec', 'MPI'),
                ('custom', 'custom')):
            self.assertEqual(collector.program_name('/opt/bin/' + executable + ' secret'), expected)
        skipped = ['ps', 'awk', 'bash', 'sh', 'sshd', 'head', 'readlink', 'sleep',
                   'collect_servers.py', 'python scripts/collect_servers.py',
                   'python3 collect_servers.py']
        self.assertEqual(collector.parse_heavy([
            f'lab|1|100|00:01|1|/home/lab/ana|{program}' for program in skipped], options), [])
        snapshot = collector.parse_output(NODE + '\n15|lab|100|1|1|python3 collect_servers.py|/home/lab/ana\n16|lab|100|1|1|orca /home/lab/bruno/input|/home/lab/scratch', {'name': 'sample'}, options)
        self.assertFalse(any(row['program'] == 'Python' and row['owner'] == 'lab' for row in snapshot['processes']))
        self.assertTrue(any(row['person'] == 'Bruno' for row in snapshot['processes']))
        self.assertTrue(all(not {'cwd', 'command'} & row.keys() for row in snapshot['processes']))

    def test_pbs_continuations_and_running_counts(self):
        text = NODE + '''@@PBS
Job Id: 17.cluster
    Job_Name = docs-build
    Job_Owner = ana@node
    job_state = R
    Resource_List.nodes = 2:ppn=4
    Variable_List = A=B,
\tPBS_O_WORKDIR=/srv/projects/docs-guide/run
Job Id: 18.cluster
    Job_Owner = guest@node
    job_state = Q
    Resource_List.ncpus = 16
'''
        row = collector.parse_output(text, {'name':'lab-cluster-a','scheduler':'pbs','cores':64}, OPTIONS)
        self.assertEqual(row['used'], 8)
        self.assertEqual(row['ours'], 8)
        self.assertEqual(row['jobs'][0]['workspace'], 'docs-guide')
        self.assertEqual(row['jobs'][1]['cores'], 16)

    def test_pbs_select_and_multiple_node_chunks(self):
        jobs = collector.parse_jobs(['Job Id: 1.cluster', '    Resource_List.select = 2:ncpus=8+1:ncpus=4',
                                     'Job Id: 2.cluster', '    Resource_List.nodes = node-a:ppn=4+2:ppn=8'],
                                    'pbs', OPTIONS)
        self.assertEqual([row['cores'] for row in jobs], [20, 20])

    def test_slurm_and_timeout(self):
        text = NODE + '@@SLURM\n42|analysis|ana|RUNNING|4|01:20|/srv/projects/docs-guide\n'
        host = {'name':'lab-cluster-a','ssh':'lab-cluster-a','scheduler':'slurm'}
        with mock.patch.object(collector.subprocess,'run',return_value=mock.Mock(stdout=text)) as run:
            row = collector.collect(host, OPTIONS)
        self.assertEqual(row['ours'], 4)
        self.assertIn('BatchMode=yes',run.call_args.args[0])
        self.assertIn('ConnectTimeout=20',run.call_args.args[0])
        self.assertEqual(run.call_args.kwargs['timeout'],30)
        with mock.patch.object(collector.subprocess,'run',side_effect=subprocess.TimeoutExpired('ssh',30)):
            self.assertFalse(collector.collect(host, OPTIONS)['online'])
        with self.assertRaises(ValueError):
            collector.collect({**host,'ssh':'-Funsafe'},OPTIONS)

    def test_history_retention_and_atomic_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot, history = root/'snapshot.json', root/'history.json'
            history.write_text(json.dumps([dict(timestamp=0, servers={})]))
            config = root/'config.json'
            config.write_text(json.dumps(dict(servers=dict(hosts=[],snapshot=str(snapshot),history=str(history)))))
            with mock.patch('sys.argv',['collect_servers','--config',str(config)]):
                collector.main()
            self.assertEqual(len(json.loads(history.read_text())),1)
            self.assertEqual(json.loads(snapshot.read_text())['servers'],[])


class FilesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.fixture = transport.fixture_without_sockets(demo,Path(self.temp.name))
        self.server = transport.MemoryServer(self.fixture)
        self.key = {'X-Token':self.fixture['token']}

    def tearDown(self):
        self.server.close()
        self.temp.cleanup()

    def request(self, method, path, body=None, headers=None, public=False):
        return self.server.request(public, method, path, body, self.key if headers is None else headers)

    def test_auth_pages_and_endpoints(self):
        for path in ('/servers','/servidores','/files','/resources','/api/servers','/api/files',
                     '/api/files/download?pane=w1:p1&name=summary.md'):
            self.assertIn(self.request('GET',path,headers={})[0],(401,403))
            self.assertEqual(self.request('GET',path)[0],200,path)
            self.assertEqual(self.request('GET',path,public=True)[0],403,path)
        self.assertIn(self.request('POST','/api/files/upload?pane=w1:p1&nome=x.txt',b'x',{})[0],(401,403))

    def test_identity_only_api_and_legacy_privacy(self):
        import portal
        path = Path(portal.CFG['servers']['snapshot'])
        snapshot = json.loads(path.read_text())
        snapshot['servers'][0]['heavy_processes'][0].update(cwd='/private/path', command='private argument')
        path.write_text(json.dumps(snapshot))
        code, data, _ = self.request('GET', '/api/servers')
        self.assertEqual(code, 200)
        for server in data['servers']:
            for key in ('processes', 'heavy_processes', 'jobs'):
                self.assertTrue(all(not {'cwd', 'command'} & row.keys() for row in server[key]))
        self.assertTrue(any(not row['ours'] for row in data['servers'][0]['heavy_processes']))

    def test_upload_list_download_and_limits(self):
        code, data, _ = self.request('POST','/api/files/upload?pane=w1:p1&nome=notes.txt',b'hello')
        self.assertEqual(code,200,data)
        self.assertEqual(Path(data['caminho']).parent.name,'_portal_inbox')
        code, files, _ = self.request('GET','/api/files')
        self.assertTrue(any(row['name'] == data['nome'] for row in files['workspaces'][0]['files']))
        code, _, response = self.request('GET','/api/files/download?pane=w1:p1&name=summary.md')
        self.assertEqual(code,200)
        self.assertIn('attachment',response.getheader('Content-Disposition'))
        import portal
        with mock.patch.dict(portal.CFG['files'],max_mb=0):
            self.assertEqual(self.request('POST','/api/files/upload?pane=w1:p1&nome=x.txt',b'x')[0],413)

    def test_workspace_overrides_and_symlink_folder(self):
        import portal
        workspace = next(row for row in portal.spaces_list() if row['pane'] == 'w1:p1')
        with mock.patch.dict(portal.CFG['files'], workspaces={'docs-guide': {'inbox': 'incoming'}}):
            code, data, _ = self.request('POST','/api/files/upload?pane=w1:p1&nome=notes.txt',b'hello')
            self.assertEqual(code,200)
            self.assertEqual(Path(data['caminho']).parent.name,'incoming')
        root = Path(workspace['cwd'])
        shutil.rmtree(root/'_portal_inbox')
        (root/'_portal_inbox').symlink_to(root/'_portal_outbox',target_is_directory=True)
        self.assertEqual(self.request('POST','/api/files/upload?pane=w1:p1&nome=x.txt',b'x')[0],400)

    def test_server_snapshot_public_filter_and_missing_snapshot(self):
        import portal
        snapshot_path = Path(portal.CFG['servers']['snapshot'])
        snapshot = json.loads(snapshot_path.read_text())
        snapshot['servers'][0]['jobs'].append(dict(workspace='privado', owner='private-user', cwd='/private'))
        snapshot_path.write_text(json.dumps(snapshot))
        with mock.patch.object(portal.PortalMixin,'authorized',return_value=True):
            code, data, _ = self.request('GET','/api/servers',public=True)
        self.assertEqual(code,200)
        self.assertFalse(any(row.get('workspace') == 'privado' for row in data['servers'][0]['jobs']))
        self.assertTrue(all(not {'cwd', 'owner'} & row.keys() for row in data['servers'][0]['jobs']))
        snapshot_path.unlink()
        self.assertEqual(self.request('GET','/api/servers')[0],503)

    def test_traversal_symlinks_and_public_workspace_visibility(self):
        for name in ('../secret.txt','%2Fetc%2Fpasswd','..%5Csecret.txt','%00.txt'):
            self.assertEqual(self.request('GET','/api/files/download?pane=w1:p1&name='+name)[0],400)
            self.assertEqual(self.request('POST','/api/files/upload?pane=w1:p1&nome='+name,b'x')[0],400)
        import portal
        workspace = next(row for row in portal.spaces_list() if row['pane'] == 'w1:p1')
        outbox = Path(workspace['cwd'])/'_portal_outbox'
        (outbox/'link.txt').symlink_to(outbox/'summary.md')
        self.assertEqual(self.request('GET','/api/files/download?pane=w1:p1&name=link.txt')[0],404)
        with mock.patch.object(portal.PortalMixin,'authorized',return_value=True):
            code, data, _ = self.request('GET','/api/files',public=True)
            self.assertEqual(code,200)
            self.assertNotIn('privado',[row['workspace'] for row in data['workspaces']])
            self.assertEqual(self.request('GET','/api/files/download?pane=w4:p1&name=x',public=True)[0],400)


class JavaScriptTest(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'),'Node unavailable')
    def test_syntax(self):
        for path in (ROOT/'portal/web').glob('*.js'):
            result = subprocess.run(['node','--check',str(path)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)

    @unittest.skipUnless(shutil.which('node'),'Node unavailable')
    def test_rendering_translation_and_escaping(self):
        result = subprocess.run(['node',str(ROOT/'tests/pages_js_check.js')],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
