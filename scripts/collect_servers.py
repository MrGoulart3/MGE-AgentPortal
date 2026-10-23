#!/usr/bin/env python3
"""Read-only SSH collector; configuration and output paths are supplied by config.json."""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import re
import shlex
import subprocess
import time

REMOTE = r'''
echo @@NODE
getconf _NPROCESSORS_ONLN
cat /proc/loadavg
awk '/MemTotal:/{t=$2}/MemAvailable:/{a=$2}END{print t,a}' /proc/meminfo
echo @@DF
df -Pk -x tmpfs -x devtmpfs
echo @@PROCS
ps -eo pid=,user=,pcpu=,rss=,etimes=,args= | while read -r pid owner cpu rss elapsed command; do
 cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null) || cwd=""
 printf '%s|%s|%s|%s|%s|%s|%s\n' "$pid" "$owner" "$cpu" "$rss" "$elapsed" "$command" "$cwd"
done
echo @@HEAVY
ps -eo user:24,pid,pcpu,etime,rss,args --sort=-pcpu | awk 'NR>1 && $3>=__CPU_MIN__' | head -200 | while read -r u p c e r a; do
 cwd=$(readlink "/proc/$p/cwd" 2>/dev/null) || cwd=""
 printf '%s|%s|%s|%s|%s|%s|%s\n' "$u" "$p" "$c" "$e" "$r" "$cwd" "$a"
done
'''
SCHEDULERS = {'none': '', 'pbs': '\necho @@PBS\nqstat -f\n',
              'slurm': "\necho @@SLURM\nsqueue -h -o '%i|%j|%u|%T|%C|%M|%Z'\n"}


def sections(text: str) -> dict:
    """Split marker-delimited command output without depending on banners."""
    result = {}
    current = None
    for line in text.splitlines():
        if line.startswith('@@'):
            current = line[2:].strip()
            result[current] = []
        elif current:
            result[current].append(line)
    return result


def attribution(owner: str, cwd: str, options: dict) -> tuple[bool, str]:
    """Match complete path prefixes, preferring the most specific mapping."""
    mapping = options.get('workspaces', {})
    for prefix in sorted(mapping, key=len, reverse=True):
        if cwd == prefix.rstrip('/') or cwd.startswith(prefix.rstrip('/') + '/'):
            return True, mapping[prefix]
    return owner in options.get('users', []), ''


SKIP_PROGRAMS = {'ps', 'awk', 'bash', 'sh', 'sshd', 'head', 'readlink', 'sleep'}
SCRATCH_FOLDERS = {'scratch', 'g16_scratch', 'software', 'opt', 'bin', 'tmp'}


def identity(owner: str, cwd: str, command: str, options: dict) -> dict:
    """Derive display identity without retaining source paths or arguments."""
    account = options.get('accounts', {}).get(owner, {})
    aliases = options.get('aliases', {})
    responsible = account.get('responsible', aliases.get(owner, owner))
    for source in (cwd, command):
        for path in re.findall(r'/[^\s\'";,|]+', source):
            ours, workspace = attribution(owner, path, options)
            if workspace:
                label = options.get('workspace_owner', aliases.get(owner, owner))
                return dict(person=f'{label} · {workspace}', responsible=responsible,
                            ours=True, workspace=workspace)
    person = owner
    if account.get('shared', False):
        person = f'? ({aliases.get(owner, owner)})'
        bases = ['/home'] + options.get('base_dirs', [])
        for source in (cwd, command):
            found = False
            for base in bases:
                pattern = re.escape(base.rstrip('/') + '/' + owner + '/') + r'([^/\s\'";,|]+)'
                for match in re.finditer(pattern, source):
                    if match[1] not in SCRATCH_FOLDERS:
                        person = aliases.get(match[1], match[1])
                        found = True
                        break
                if found:
                    break
            if found:
                break
    else:
        person = aliases.get(owner, owner)
    return dict(person=person, responsible=responsible, ours=False, workspace='')


def program_name(command: str) -> str:
    """Normalize only the executable basename."""
    try:
        tokens = shlex.split(command)
    except ValueError:
        tokens = command.split()
    basename = tokens[0].rsplit('/', 1)[-1] if tokens else '?'
    for pattern, label in (
        (r'^l\d+\.exe$', 'Gaussian'), (r'^orca', 'ORCA'),
        (r'^cpmd', 'CPMD'), (r'^(gmx|mdrun)', 'GROMACS'),
        (r'^xtb', 'xTB'), (r'^crest', 'CREST'), (r'^cp2k', 'CP2K'),
        (r'^vasp', 'VASP'), (r'^(lmp|lammps)', 'LAMMPS'),
        (r'^python', 'Python'), (r'^(mpirun|mpiexec)', 'MPI')):
        if re.search(pattern, basename, re.I):
            return label
    return basename


def parse_jobs(lines: list[str], scheduler: str, options: dict) -> list[dict]:
    """Normalize PBS full records or pipe-delimited Slurm records."""
    records = []
    if scheduler == 'slurm':
        for line in lines:
            fields = line.split('|', 6)
            if len(fields) == 7:
                ident, name, owner, state, cores, elapsed, cwd = fields
                records.append(dict(id=ident, name=name, owner=owner, state=state,
                                    cores=cores, elapsed=elapsed, cwd=cwd))
    else:
        raw = []
        key = ''
        for line in lines:
            if line.startswith('Job Id:'):
                raw.append({'id': line.split(':', 1)[1].strip()})
            elif raw and ' = ' in line:
                key, value = line.strip().split(' = ', 1)
                raw[-1][key] = value
            elif raw and line.startswith('\t') and key:
                raw[-1][key] += line.strip()
        for item in raw:
            match = re.search(r'PBS_O_WORKDIR=([^,]+)', item.get('Variable_List', ''))
            allocation = item.get('Resource_List.select') or item.get('Resource_List.nodes', '')
            inferred = 0
            for chunk in allocation.split('+'):
                per_node = re.search(r'(?:ppn|ncpus)=(\d+)', chunk)
                count = re.match(r'^(\d+)(?=:|$)', chunk)
                inferred += (int(count[1]) if count else 1) * (int(per_node[1]) if per_node else 1)
            cores = item.get('Resource_List.ncpus') or inferred or 1
            records.append(dict(id=item['id'], name=item.get('Job_Name', ''),
                                owner=item.get('Job_Owner', '').split('@')[0],
                                state=item.get('job_state', ''), cores=cores,
                                elapsed=item.get('resources_used.walltime', ''),
                                cwd=item.get('init_work_dir') or (match[1] if match else '')))
    result = []
    for row in records:
        try:
            row['cores'] = max(0, int(row['cores']))
        except ValueError:
            continue
        row.update(identity(row['owner'], row.pop('cwd'), '', options))
        row.pop('name', None)
        result.append(row)
    return result


def cpu_threshold(options: dict) -> float:
    """Return a finite nonnegative CPU percentage."""
    value = float(options.get('process_cpu_min', 5))
    if not math.isfinite(value) or value < 0:
        raise ValueError('process_cpu_min must be finite and nonnegative')
    return value


def elapsed_seconds(value: str) -> int:
    """Parse ps elapsed time in [[days-]hours:]minutes:seconds format."""
    days, separator, clock = value.partition('-')
    seconds = 0
    for part in (clock if separator else days).split(':'):
        seconds = seconds * 60 + int(part)
    return seconds + (int(days) * 86400 if separator else 0)


def parse_heavy(lines: list[str], options: dict) -> list[dict]:
    """Group up to 40 heavy processes by person, responsible and program."""
    rows = []
    for line in lines:
        try:
            owner, pid, cpu, elapsed, rss, cwd, command = line.split('|', 6)
            cpu, ram = float(cpu), int(rss) * 1024
            seconds = elapsed_seconds(elapsed)
            if not math.isfinite(cpu) or cpu < cpu_threshold(options) or ram < 0 or seconds < 0:
                continue
            program = program_name(command)
            if program in SKIP_PROGRAMS or program == 'collect_servers.py' or (program == 'Python' and re.search(r'(?:^|[\s/])collect_servers\.py(?:\s|$)', command)):
                continue
            rows.append(dict(owner=owner, cpu=cpu, ram=ram, elapsed=seconds,
                             program=program, **identity(owner, cwd, command, options)))
        except ValueError:
            continue
    groups = {}
    for row in sorted(rows, key=lambda item: -item['cpu'])[:40]:
        key = (row['person'], row['responsible'], row['program'], row['workspace'])
        if key not in groups:
            groups[key] = dict(row, cpu=0., ram=0, elapsed=0, count=0)
        group = groups[key]
        group['cpu'] += row['cpu']
        group['ram'] += row['ram']
        group['elapsed'] = max(group['elapsed'], row['elapsed'])
        group['count'] += 1
    return sorted(groups.values(), key=lambda item: -item['cpu'])


def parse_output(text: str, host: dict, options: dict) -> dict:
    """Parse Linux metrics, retaining a valid offline record for incomplete output."""
    data = sections(text)
    result = dict(name=host['name'], scheduler=host.get('scheduler', 'none'), online=False, processes=[], heavy_processes=[], jobs=[], disks=[])
    try:
        node = data['NODE']
        cores = max(1, int(host.get('cores') or node[0]))
        load = list(map(float, node[1].split()[:3]))
        total, available = (int(value) * 1024 for value in node[2].split())
        result.update(online=True, cores=cores, load=load,
                      memory=dict(total=total, available=available, used=total - available))
    except (KeyError, IndexError, ValueError):
        return result
    for line in data.get('DF', []):
        fields = line.split()
        try:
            if len(fields) >= 6 and fields[4].endswith('%'):
                result['disks'].append(dict(mount=' '.join(fields[5:]), percent=int(fields[4][:-1]),
                                           total=int(fields[1]) * 1024, available=int(fields[3]) * 1024))
        except ValueError:
            continue
    groups = {}
    for line in data.get('PROCS', []):
        try:
            pid, owner, cpu, rss, elapsed, command, cwd = line.split('|', 6)
            program = program_name(command)
            if program in SKIP_PROGRAMS or program == 'collect_servers.py' or (program == 'Python' and re.search(r'(?:^|[\s/])collect_servers\.py(?:\s|$)', command)):
                continue
            person = identity(owner, cwd, command, options)
            key = (person['person'], person['responsible'], program, person['workspace'])
            group = groups.setdefault(key, dict(owner=owner, **person,
                                      cpu=0., ram=0, count=0, elapsed=0, program=program))
            group['cpu'] += max(0., float(cpu))
            group['ram'] += max(0, int(rss)) * 1024
            group['elapsed'] = max(group['elapsed'], int(elapsed))
            group['count'] += 1
        except ValueError:
            continue
    result['processes'] = sorted(groups.values(), key=lambda row: -row['cpu'])
    result['heavy_processes'] = parse_heavy(data.get('HEAVY', []), options)
    scheduler = host.get('scheduler', 'none')
    result['jobs'] = parse_jobs(data.get(scheduler.upper(), []), scheduler, options)
    running = [row for row in result['jobs'] if row['state'] in ('R', 'RUNNING', 'COMPLETING')]
    if scheduler != 'none':
        used = sum(row['cores'] for row in running)
        ours = sum(row['cores'] for row in running if row['ours'])
    else:
        used = max(load[0], sum(row['cpu'] for row in groups.values()) / 100)
        ours = sum(row['cpu'] for row in groups.values() if row['ours']) / 100
    result.update(used=min(cores, used), ours=min(cores, ours))
    return result


def collect(host: dict, options: dict) -> dict:
    """Run one bounded, noninteractive SSH session per host."""
    scheduler = host.get('scheduler', 'none')
    if scheduler not in SCHEDULERS:
        raise ValueError('scheduler must be none, pbs or slurm')
    alias = host['ssh']
    if not alias or alias.startswith('-') or any(char.isspace() for char in alias):
        raise ValueError('Invalid SSH alias')
    timeout = max(1, int(options.get('timeout', 20)))
    try:
        command = ['ssh', '-o', 'BatchMode=yes', '-o', f'ConnectTimeout={timeout}',
                   '-o', 'ConnectionAttempts=1', alias, 'sh -s']
        response = subprocess.run(command, input=REMOTE.replace('__CPU_MIN__', str(cpu_threshold(options))) + SCHEDULERS[scheduler],
                                  capture_output=True, encoding='utf-8', errors='replace', timeout=timeout + 10)
        return parse_output(response.stdout, host, options)
    except (OSError, subprocess.TimeoutExpired, ValueError):   # odd output on one host never stops the others
        return parse_output('', host, options)


def atomic_json(path: Path, data: object) -> None:
    """Publish a complete snapshot through an atomic rename."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False))
    temporary.chmod(0o600)
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, required=True)
    args = parser.parse_args()
    options = json.loads(args.config.expanduser().read_text(errors='replace')).get('servers', {})
    now = time.time()
    servers = [collect(host, options) for host in options.get('hosts', [])]
    history_path = Path(options.get('history', '~/.local/state/mge-agentportal/servers-history.json')).expanduser()
    try:
        history = json.loads(history_path.read_text())
    except (OSError, ValueError):
        history = []
    history = [point for point in history if point.get('timestamp', 0) >= now - 48 * 3600]
    history.append(dict(timestamp=now, servers={row['name']: dict(used=row['used'], ours=row['ours'],
                        memory=row['memory']['used'] / max(1, row['memory']['total']) * 100)
                        for row in servers if row['online']}))
    atomic_json(history_path, history)
    output = Path(options.get('snapshot', '~/.local/state/mge-agentportal/servers.json')).expanduser()
    atomic_json(output, dict(timestamp=now, servers=servers))


if __name__ == '__main__':
    main()
