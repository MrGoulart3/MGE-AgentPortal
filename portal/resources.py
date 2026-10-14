"""Optional Linux resource collector adapted for the authenticated portal."""
from __future__ import annotations

from collections import deque
import json
import os
from pathlib import Path
import re
import threading
import time

ROOT = Path.home() / "projects"
HZ = os.sysconf('SC_CLK_TCK')
PAGE = os.sysconf('SC_PAGE_SIZE')


def read(path: str | Path) -> str:
    """Reads kernel files that can disappear during collection."""
    try:
        return Path(path).read_text(errors='replace')
    except OSError:
        return ''


def project(cwd: str, root: Path = ROOT) -> str | None:
    """Gets the first project component below the configured root."""
    if not cwd:
        return None
    try:
        parts = Path(cwd).resolve().relative_to(root.resolve()).parts
        return parts[0] if parts else None
    except ValueError:
        return None


def category(name: str, command: str) -> str:
    """Classifies programs without exposing their arguments."""
    arguments = command.split()
    executable = Path(arguments[0]).name if arguments else name
    value = (name + ' ' + executable).lower()
    if executable.startswith(('node', 'python')):
        value += ' ' + ' '.join(arguments[1:3]).lower()
    for kind in ('claude', 'codex', 'opencode'):
        if kind in value:
            return kind
    if any(word in value for word in ('xtb', 'crest', 'orca', 'sella', 'rodar_local')):
        return 'compute'
    return 'other'


class Collector:
    """Keeps a resource snapshot and a bounded in-memory history."""

    def __init__(self, options: dict | None = None) -> None:
        self.options = options or {}
        self.root = Path(self.options.get('project_root', '~/projects')).expanduser().resolve()
        self.disk = self.options.get('disk', '')
        self.mounts = self.options.get('mounts', ['/'])
        self.interval = max(1, float(self.options.get('interval', 3)))
        self.job_state = Path(self.options.get('job_state', '~/.local/state/mge-localcompute/state.json')).expanduser()
        self.previous = {}
        self.previous_cpu = {}
        self.previous_io = {}
        self.last = time.monotonic()
        self.history = deque(maxlen=201)
        self.payload = b'{}'
        self.capacity = 'unknown'
        self.stopped = threading.Event()

    def processes(self, elapsed: float, uptime: float) -> tuple[list, int]:
        """Measures process CPU per interval and inherits parent project attribution."""
        rows = {}
        current = {}
        denied = 0
        for entry in Path('/proc').iterdir():
            if not entry.name.isdigit():
                continue
            try:
                raw = (entry / 'stat').read_text()
                end = raw.rfind(')')
                name = raw[raw.find('(') + 1:end]
                fields = raw[end + 2:].split()
                pid = int(entry.name)
                ticks = int(fields[11]) + int(fields[12])
                start = int(fields[19])
                key = (pid, start)
                old = self.previous.get(key, ticks)
                current[key] = ticks
                cpu = max(0, ticks - old) / HZ / elapsed * 100
                try:
                    cwd = os.readlink(entry / 'cwd')
                except OSError:
                    cwd = ''
                    denied += 1
                command = (entry / 'cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace')
                # Argumentos são usados apenas para classificação, nunca enviados ao cliente.
                executable = command.split(' ', 1)[0] or name
                rows[pid] = dict(pid=pid, parent=int(fields[1]),
                                 space=project(cwd, self.root), name=name,
                                 cpu=cpu, ram=max(0, int(fields[21])) * PAGE,
                                 seconds=max(0, uptime - start / HZ),
                                 cpu_seconds=ticks / HZ, command=Path(executable).name[:100],
                                 kind=category(name, command))
            except (OSError, ValueError, IndexError):
                continue
        for row in rows.values():
            ancestor = row
            seen = set()
            while not ancestor['space'] and ancestor['parent'] in rows:
                if ancestor['pid'] in seen:
                    break
                seen.add(ancestor['pid'])
                ancestor = rows[ancestor['parent']]
            row['space'] = ancestor['space'] or 'system/other'
        self.previous = current
        return list(rows.values()), denied

    def sample(self) -> dict:
        """Collects global resources and process summaries."""
        now = time.monotonic()
        elapsed = max(0.01, now - self.last)
        self.last = now
        uptime = float(read('/proc/uptime').split()[0])
        cpu = {}
        for line in read('/proc/stat').splitlines():
            fields = line.split()
            if not fields or not re.fullmatch(r'cpu\d*', fields[0]):
                continue
            values = list(map(int, fields[1:9]))
            total = sum(values)
            idle = values[3] + values[4]
            old_total, old_idle = self.previous_cpu.get(fields[0], (total, idle))
            delta = total - old_total
            cpu[fields[0]] = 100 * (1 - (idle - old_idle) / delta) if delta else 0
            self.previous_cpu[fields[0]] = (total, idle)
        mem = {}
        for line in read('/proc/meminfo').splitlines():
            key, value = line.split(':', 1)
            mem[key] = int(value.split()[0]) * 1024
        cache = mem.get('Cached', 0) + mem.get('SReclaimable', 0)
        memory = dict(total=mem['MemTotal'], available=mem['MemAvailable'],
                      used=mem['MemTotal'] - mem['MemAvailable'], cache=cache,
                      swap=mem['SwapTotal'] - mem['SwapFree'], swap_total=mem['SwapTotal'])
        totals = {}
        for line in read('/proc/diskstats').splitlines():
            values = line.split()
            if len(values) > 9 and values[2] == self.disk:
                totals['disk_read'] = int(values[5]) * 512
                totals['disk_write'] = int(values[9]) * 512
        network = {}
        for line in read('/proc/net/dev').splitlines()[2:]:
            interface, counters = line.split(':')
            values = counters.split()
            if interface.strip() != 'lo':
                network[interface.strip()] = dict(rx=int(values[0]), tx=int(values[8]))
        totals['net_in'] = sum(row['rx'] for row in network.values())
        totals['net_out'] = sum(row['tx'] for row in network.values())
        rates = {key: max(0, value - self.previous_io.get(key, value)) / elapsed
                 for key, value in totals.items()}
        self.previous_io = totals
        disks = []
        for mount in self.mounts:
            try:
                stat = os.statvfs(mount)
            except OSError:
                continue
            disks.append(dict(mount=mount, total=stat.f_blocks * stat.f_frsize,
                              used=(stat.f_blocks - stat.f_bfree) * stat.f_frsize,
                              available=stat.f_bavail * stat.f_frsize))
        temperatures = []
        thermal = dict(package=None, cores={}, high=85.0, crit=105.0)
        for sensor in Path('/sys/class/hwmon').glob('hwmon*/temp*_input'):
            try:
                value = float(sensor.read_text()) / 1000
            except (OSError, ValueError):
                continue
            temperatures.append(value)
            if read(sensor.parent / 'name').strip() != 'coretemp':
                continue
            label = read(str(sensor).replace('_input', '_label')).strip()
            if label.startswith('Package'):
                thermal['package'] = value
                for key in ('max', 'crit'):
                    limit = read(str(sensor).replace('_input', '_' + key)).strip()
                    if limit.isdigit():
                        thermal['high' if key == 'max' else key] = int(limit) / 1000
            elif label.startswith('Core'):
                thermal['cores'][label] = value
        processes, denied = self.processes(elapsed, uptime)
        # intel_powerclamp: % de ociosidade injetada (cur_state) e CPU das threads idle_inject.
        clamp = None
        for device in Path('/sys/class/thermal').glob('cooling_device*'):
            if read(device / 'type').strip() == 'intel_powerclamp':
                state = read(device / 'cur_state').strip()
                clamp = int(state) if state.lstrip('-').isdigit() else None
        inject = sum(row['cpu'] for row in processes if row['name'].startswith('idle_inject'))
        thermal.update(core_max=max(thermal['cores'].values(), default=None),
                       powerclamp=clamp, idle_inject_cpu=inject,
                       clamped=bool((clamp or 0) > 0 or inject > 10))
        spaces = {}
        for row in processes:
            space = spaces.setdefault(row['space'], dict(cpu=0, ram=0, count=0, kinds={}))
            space['cpu'] += row['cpu']
            space['ram'] += row['ram']
            space['count'] += 1
            kind = space['kinds'].setdefault(row['kind'], dict(cpu=0, ram=0, count=0))
            for key in ('cpu', 'ram'):
                kind[key] += row[key]
            kind['count'] += 1
        jobs = []
        try:
            state = json.loads(read(self.job_state))
            for job in state.get('jobs', []):
                jobs.append(dict(pid=job['pid'], threads=job['threads'],
                                 space=project(job.get('cwd', ''), self.root),
                                 active=Path('/proc', str(job['pid'])).exists(),
                                 paused=bool(job.get('paused'))))
        except (ValueError, KeyError, TypeError):
            pass
        self.capacity = 'ok' if (memory['available'] >= float(self.options.get('min_ram_gb', 3)) * 1024**3
                                 and os.getloadavg()[0] <= float(self.options.get('max_load', 5.5))
                                 and thermal['package'] is not None
                                 and thermal['package'] < float(self.options.get('max_temp', 85))
                                 and not thermal['clamped']) else 'tight'
        point = dict(time=time.time(), cpu=cpu.get('cpu', 0),
                     memory=memory['used'], temp=thermal['package'], **rates)
        self.history.append(point)
        return dict(timestamp=time.time(), interval=self.interval, cpu=cpu, memory=memory,
                    load=list(os.getloadavg()), uptime=uptime, disks=disks,
                    temperature=max(temperatures) if temperatures else None, thermal=thermal,
                    rates=rates, network=network, spaces=spaces, processes=processes,
                    jobs=jobs, capacity=self.capacity, history=list(self.history),
                    inaccessible_cwd=denied, collector_pid=os.getpid())

    def run(self) -> None:
        """Updates snapshots independently of HTTP requests."""
        while not self.stopped.is_set():
            started = time.monotonic()
            try:
                self.payload = json.dumps(self.sample(), separators=(',', ':')).encode()
            except (OSError, ValueError, KeyError, IndexError) as error:
                print(f'Collection failed / Falha de coleta: {error}', flush=True)
            self.stopped.wait(max(0.1, self.interval - (time.monotonic() - started)))


def public_snapshot(payload: bytes, root: Path, visible: list[dict], hidden: list[str]) -> bytes:
    """Omits project details not positively mapped to a visible workspace.

    Global metrics still include all machine activity; no account names or command
    arguments are collected. The private collector payload is never modified.
    """
    allowed = set()
    blocked = set()
    for item in hidden:
        if item.startswith('/'):
            name = project(item, root)
            if name:
                blocked.add(name)
        else:
            blocked.add(item)
    for row in visible:
        name = project(row.get('cwd', ''), root)
        if name:
            allowed.add(name)
    allowed -= blocked
    data = json.loads(payload)
    data['spaces'] = {key: value for key, value in data.get('spaces', {}).items() if key in allowed}
    for key in ('processes', 'jobs'):
        data[key] = [row for row in data.get(key, []) if row.get('space') in allowed]
    data.pop('collector_pid', None)
    return json.dumps(data, separators=(',', ':')).encode()
