"""Executa as mesmas verificações locais e do GitHub Actions, sem rede."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


class Scripts(HTMLParser):
    """Coleta JavaScript inline de HTML sem executar o conteúdo."""

    def __init__(self) -> None:
        super().__init__()
        self.active = False
        self.module = False
        self.parts: list[str] = []
        self.scripts: list[tuple[bool, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple]) -> None:
        if tag == "script":
            attributes = dict(attrs)
            kind = attributes.get("type", "")
            self.active = "src" not in attributes and kind in {
                "", "module", "text/javascript", "application/javascript"
            }
            self.module = kind == "module"
            self.parts = []

    def handle_data(self, data: str) -> None:
        if self.active:
            self.parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self.active:
            self.scripts.append((self.module, "".join(self.parts)))
            self.active = False


def run(*args: str, **kwargs: object) -> None:
    """Executa uma etapa e interrompe ao primeiro erro."""
    print("+", " ".join(args), flush=True)
    subprocess.run(args, cwd=ROOT, check=True, **kwargs)


def main() -> None:
    """Valida sintaxe e descobre explicitamente cada suíte de unittest."""
    run(sys.executable, ".github/scripts/scan_sensitive.py")
    files = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode()
    counts = {"python": 0, "javascript": 0, "shell": 0}
    for name in filter(None, files.split("\0")):
        path = ROOT / name
        if not path.is_file() or path.is_symlink():
            continue
        if path.suffix not in {".py", ".js", ".mjs", ".cjs", ".sh", ".html", ""}:
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        first = content.split("\n", 1)[0]
        if path.suffix == ".py" or first.startswith("#!") and "python" in first:
            compile(content, name, "exec")
            counts["python"] += 1
        elif path.suffix in {".js", ".mjs", ".cjs"}:
            run("node", "--check", name)
            counts["javascript"] += 1
        elif path.suffix == ".sh" or re.match(r"^#!.*(?:/|\s)(?:ba|da|k|z)?sh\b", first):
            run("bash", "-n", name)
            counts["shell"] += 1
        elif path.suffix == ".html":
            parser = Scripts()
            parser.feed(content)
            for module, source in parser.scripts:
                run("node", "--input-type=" + ("module" if module else "commonjs"),
                    "--check", input=source, text=True)
                counts["javascript"] += 1
    print("Sintaxe:", counts, flush=True)
    for suite in (".github/tests", "tests", "orquestra/tests", "uah-lite/tests"):
        if (ROOT / suite).is_dir():
            run(sys.executable, "-m", "unittest", "discover", "-s", suite, "-v")
    if (ROOT / "orquestra/hooks/guard.py").exists():
        run(sys.executable, "orquestra/hooks/guard.py", "--test")


if __name__ == "__main__":
    main()
