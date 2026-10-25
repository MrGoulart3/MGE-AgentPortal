"""Flat workspace inbox/outbox storage with explicit path and symlink checks."""
from __future__ import annotations

import os
from pathlib import Path


def folder(cwd: str, workspace: str, config: dict, kind: str) -> Path:
    """Resolve an administrator-configured folder, rejecting symlink components."""
    options = config.get('files', {})
    override = options.get('workspaces', {}).get(workspace, {})
    default = config.get('upload_pasta', '_portal_inbox') if kind == 'inbox' else '_portal_outbox'
    raw = Path(override.get(kind, options.get(kind, default))).expanduser()
    if '..' in raw.parts:
        raise ValueError('Invalid folder')
    path = raw if raw.is_absolute() else Path(cwd) / raw
    if any(part.is_symlink() for part in (path, *path.parents)):
        raise ValueError('Symlink folder')
    return path


def filename(name: str) -> str:
    """Accept one plain basename, never sanitize a traversal into a valid name."""
    if not name or name in ('.', '..') or '/' in name or '\\' in name or any(ord(c) < 32 for c in name):
        raise ValueError('Invalid filename')
    return name


def open_download(root: Path, name: str):
    """Open a regular, non-symlink file relative to a checked directory."""
    import stat
    name = filename(name)
    directory = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        descriptor = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
    finally:
        os.close(directory)
    stream = os.fdopen(descriptor, 'rb')
    if not stat.S_ISREG(os.fstat(descriptor).st_mode):
        stream.close()
        raise ValueError('Not a regular file')
    return stream


def mark_key(path: Path) -> str:
    """Identifies a version without exposing its path in the event index."""
    import hashlib
    info = path.stat()
    return hashlib.sha256(f'{path}:{info.st_mtime_ns}:{info.st_size}'.encode()).hexdigest()


def marked(directory: Path, path: Path) -> bool:
    """Replays the mark events for this file version."""
    import json
    key = mark_key(path)
    value = False
    index = directory / 'file-marks.jsonl'
    if index.exists():
        for line in index.read_text().splitlines():
            row = json.loads(line)
            if row['id'] == key:
                value = row['tipo'] == 'baixado'
    return value


def mark(directory: Path, path: Path, kind: str) -> None:
    """Appends a private event while the caller holds the portal lock."""
    import json
    with (directory / 'file-marks.jsonl').open('a') as stream:
        os.chmod(stream.name, 0o600)
        stream.write(json.dumps({'id': mark_key(path), 'tipo': kind}) + '\n')
