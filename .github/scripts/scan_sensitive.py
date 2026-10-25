"""Varre arquivos versionados sem revelar os valores encontrados."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PATTERNS = {
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "cloud-key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "service-token": re.compile(
        r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,}"
        r"|xox[baprs]-[A-Za-z0-9-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{32,})\b"
    ),
    "credential-literal": re.compile(
        r"(?i)\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret"
        r"|password|passwd|senha)\s*[\"']?\s*[:=]\s*[\"']([^\"'\n]{12,})[\"']"
    ),
    "email": re.compile(r"[\w.+%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    "cpf": re.compile(r"(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)"),
    "phone": re.compile(
        r"(?i)\b(?:telefone|celular|whatsapp|phone)\s*[:=]\s*[\"']?"
        r"(?:\+55\s*)?\(?[1-9]\d\)?[ .-]*9?\d{4}[ .-]*\d{4}\b"
    ),
    "home-path": re.compile(r"/(?:home|Users)/[\w.-]+"),
}


def cpf_valid(value: str) -> bool:
    """Reconhece CPF com dígitos verificadores válidos."""
    digits = [int(char) for char in value if char.isdigit()]
    if len(digits) != 11 or len(set(digits)) == 1:
        return False
    for size in (9, 10):
        check = (sum(n * (size + 1 - i) for i, n in enumerate(digits[:size])) * 10) % 11
        if digits[size] != (0 if check == 10 else check):
            return False
    return True


def placeholder(rule: str, value: str) -> bool:
    """Aceita apenas exemplos genéricos ou endereços de automação conhecidos."""
    lower = value.lower()
    if rule == "email":
        domain = lower.rsplit("@", 1)[-1]
        return (
            domain in {"example.com", "example.org", "example.net", "localhost"}
            or domain.endswith((".test", ".invalid", ".example", ".localhost"))
            or domain in {"users.noreply.github.com", "noreply.github.com"}
        )
    if rule == "cpf":
        return not cpf_valid(value)
    if rule == "home-path":
        return lower.rsplit("/", 1)[-1] in {"user", "username", "example", "runner"}
    if rule == "credential-literal":
        return any(mark in lower for mark in (
            "example", "placeholder", "changeme", "change-me", "replace", "your_",
            "your-", "<", "${", "os.environ", "getenv", "[redacted]",
        )) or len(set(value)) < 5
    return False


def findings(path: str, content: str) -> list[dict]:
    """Retorna somente localização, regra e hash de cada ocorrência."""
    result = []
    for rule, pattern in PATTERNS.items():
        for match in pattern.finditer(content):
            value = match.group(1) if rule == "credential-literal" else match.group()
            if placeholder(rule, value):
                continue
            digest = hashlib.sha256(f"{path}\0{rule}\0{value}".encode()).hexdigest()
            result.append({
                "path": path, "rule": rule, "sha256": digest,
                "line": content.count("\n", 0, match.start()) + 1,
            })
    return result


def main() -> int:
    """Falha ao detectar dados suspeitos ou exceções sem justificativa."""
    allow_path = ROOT / ".github/security-allowlist.json"
    allowed = json.loads(allow_path.read_text(encoding="utf-8"))
    if any(not item.get("reason", "").strip() for item in allowed):
        raise ValueError("Toda exceção precisa de justificativa.")
    exceptions = {(item["path"], item["rule"], item["sha256"]) for item in allowed}
    paths = subprocess.check_output(
        ["git", "ls-files", "-z"], cwd=ROOT
    ).decode().split("\0")
    failures = []
    checked = 0
    for relative in filter(None, paths):
        path = ROOT / relative
        if path.is_symlink():
            if not path.resolve().is_relative_to(ROOT):
                failures.append({"path": relative, "line": 1, "rule": "external-symlink"})
            continue
        if not path.is_file():
            continue
        name = path.name.lower()
        if (
            any(part in {".omc", ".vevn", ".venv", ".aws", ".ssh"} for part in path.parts)
            or name in {"id_rsa", "id_ed25519", "credentials.json"}
            or (name == ".env" or name.startswith(".env."))
            and not name.endswith((".example", ".sample", ".template"))
        ):
            failures.append({"path": relative, "line": 1, "rule": "sensitive-path"})
        data = path.read_bytes()
        if b"\0" in data:
            continue
        try:
            content = data.decode("utf-8")
        except UnicodeDecodeError:
            continue
        checked += 1
        failures.extend(
            item for item in findings(relative, content)
            if (item["path"], item["rule"], item["sha256"]) not in exceptions
        )
    for item in failures:
        print(f"{item['path']}:{item['line']}: {item['rule']} {item.get('sha256', '')}")
    print(f"Varredura: {checked} arquivos de texto; {len(failures)} alerta(s).")
    return bool(failures)


if __name__ == "__main__":
    raise SystemExit(main())
