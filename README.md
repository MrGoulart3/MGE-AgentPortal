*[Versão em português](README.pt-BR.md)*

# MGE-AgentPortal

A web portal for chatting from any browser with AI agents, such as Claude Code and Codex, running in the **herdr** multiplexer on a Linux host. The server uses only the Python standard library, with no pip dependencies.

> **Security: whoever controls the portal controls the agents and, through them, the machine.** Protect the key, approve only known devices, and read [SECURITY.md](SECURITY.md) before publishing.

## Features

- Chat with Claude Code transcripts and a live terminal for Claude Code and Codex.
- A card for answering decisions, including permissions and questions. A fingerprint identifies the displayed decision and prevents answering a card that has changed.
- File uploads by selection, drag and drop, or pasting images; the paths of received files are included in the message to the agent.
- Usage-limit cards: Claude 5 h, Codex 5 h, and weekly. Each card can be dismissed, and a button restores the cards.
- Claude/Codex/All filter, terminal history, font adjustments, and a mobile interface.
- Bilingual interface (Portuguese/English): defaults to the browser language; the **PT | EN** selector in the header saves the preference in this browser.
- Device approval and revocation, audit events, and key changes under **Access**.

## Images

Conversation and usage limits:

![Chat with transcripts and usage cards](docs/img/en/conversa.png)

Agent decision:

![Decision card alongside the terminal](docs/img/en/decisao.png)

Access management:

![Requests, approved devices, and audit events](docs/img/en/acessos.png)

Two-step approval:

![Code displayed on the device requesting access](docs/img/en/aprovacao.png)

Mobile use:

![Conversation in a mobile browser](docs/img/en/celular.png)

The images are generated using the fictional scenario in `tests/demo.py`. Names, projects, devices, timestamps, and usage values in the demonstrations are sample data.

## How it works

The browser queries the portal API, which calls herdr to list agents, read the terminal, send messages, and press allowed keys. For Claude Code chat, the portal reads the local transcripts of its sessions.

There are two ports with different rules:

| Entry point | Authentication | Exposure |
| --- | --- | --- |
| Private, usually 8787 | Key only | Loopback or a configured private address, such as one on the Tailscale network |
| Public, usually 8788 | Key + approved device | Listens only on `127.0.0.1`; Tailscale Funnel publishes access over HTTPS |

At the public entry point, a new device provides its name and receives a **six-digit** code. The owner enters this code under **Access** on a trusted device. The request is valid for 15 minutes and is denied after three incorrect codes. To approve the first device, use the private entry point with the key.

## Requirements

- Linux, Python 3.10 or later, and Bash. The controller uses `flock`, `nohup`, `setsid`, and `/proc`.
- herdr installed, with Claude Code or Codex agents already open in it, under the Unix user running the portal.
- Tailscale installed, connected, and authorized to use Funnel for internet access.
- A modern browser with JavaScript and cookies enabled.
- Firefox on the `PATH` only for regenerating the images.
- Node.js only for running the JavaScript tests.

The portal neither installs nor starts the agents. To work as intended, it needs access to that user's local session data.

## Installation

Run from the root of this repository:

1. Generate the key:

   ```bash
   scripts/portal-ctl chave
   ```

   It is stored in `~/.config/mge-agentportal/token`. Treat it as a password; do not include it in URLs, commits, or screenshots.

2. Copy the configuration:

   ```bash
   cp config.example.json ~/.config/mge-agentportal/config.json
   ```

   The example starts on loopback, finds `herdr` on the `PATH`, and leaves notifications and workspace hiding unconfigured. Set `dono` to your name (`"Ana"` is fictional); if needed, set `herdr` to its absolute executable path and `aviso_cmd` to your notification command. Add sensitive workspace IDs, labels, or absolute folder prefixes (fictional example: `/home/ana/projects/private`) to `ocultos_na_internet`. If you need the private entry point over the Tailscale network, add this machine's address without opening the private port to the internet.

   Fill `hosts_permitidos` with the Hosts actually used: `127.0.0.1:8787`, `localhost:8787`, `127.0.0.1:8788`, the private Host if applicable, and `minha-maquina.tailnet-exemplo.ts.net` replaced with your machine's name. An empty list disables Host checking.

3. Start and check the service:

   ```bash
   scripts/portal-ctl start
   scripts/portal-ctl status
   ```

   On the machine itself, open `http://127.0.0.1:8787/spaces` and sign in with the key. Check that the agents appear. The runtime log is stored in `~/.config/mge-agentportal/portal.log`.

4. After completing the checklist in [PROTOCOL.md](PROTOCOL.md), publish only the public port:

   ```bash
   sudo tailscale funnel --bg 8788
   ```

   Use the HTTPS URL reported by the command; in this document, the example is `https://minha-maquina.tailnet-exemplo.ts.net/spaces`.

5. Approve the first device. On it, open the public URL, sign in with the key, enter a name, and request access. In the private session open on the machine, go to **Access**, find the request, and enter the code shown by the new device. Once approved, it signs in automatically. Subsequent devices can be approved from the private session or an already approved device.

## Everyday use

Choose the filter and the space. For Claude Code, use **Chat** to follow messages and actions; use the live view to check the terminal. Codex uses the terminal view. Terminal history may depend on the agent being idle.

Type a message and send it with Enter; Shift+Enter inserts a new line. Attach files before sending. They are stored in `_recebidos_portal` inside the space's folder, and the agent receives their paths. If sending takes a long time and fails, check the conversation before trying again.

When a decision card appears, read the question and options before answering. If the decision has changed, the server rejects the choice and asks you to check again. Dismissing a usage card only hides it in this browser; **restore cards** brings the cards back.

Under **Access**, approve known requests, deny the others, and revoke devices you no longer use. **Sign out** removes the saved key; **Forget this device** also revokes this device's access. **Change key** requires entering the current key and displays the new one; other devices will need it, but the interface keeps their approvals.

To control the process:

```bash
scripts/portal-ctl status
scripts/portal-ctl stop
scripts/portal-ctl start
```

Stopping the portal does not remove the Funnel publication. To turn it off:

```bash
sudo tailscale funnel --https=443 off
```

## Configuration

The file is `~/.config/mge-agentportal/config.json`. `MGE_PORTAL_DIR` lets you choose another directory for configuration, the key, access records, and logs; use the same value in the controller and the server. Restart the process after editing the configuration. File paths in JSON must be absolute, without `~`, except for the panel paths described below; `herdr` may also be an executable name on the `PATH`.

Existing Portuguese names remain part of the public interface: `chave` means “key” (`portal-ctl chave` generates one), `painel` means “panel”, `estado` means “state”, `herdr_falso.py` provides fake herdr, and `gerar_imagens.py` generates screenshots. Configuration keys keep their spelling; the table translates their purpose.

| Key | Default | Purpose |
| --- | --- | --- |
| `dono` | `"dono"` | Name in the message prefix; the example uses `"Ana"`. |
| `herdr` | Executable on the `PATH` or `~/.local/bin/herdr` | Executable path or name on the `PATH`. |
| `enderecos_privados` | `[["127.0.0.1", 8787]]` | Address and port pairs requiring only the key. Use ports different from `porta_publica`. |
| `porta_publica` | `8788` | Local port published by Funnel; always on `127.0.0.1`. |
| `hosts_permitidos` | `[]` | Exact accepted Host header values; an empty list does not check Host. |
| `ocultos_na_internet` | `[]` | Workspaces hidden at the public entry point, by ID, label, or absolute folder prefix. |
| `aviso_cmd` | `[]` | List of command and arguments for notifications; title, message, and priority are appended. |
| `copia_da_chave` | `""` | Additional file to copy the key to when changing it through the API; empty disables this. The `portal-ctl chave` command does not make this copy. |
| `dias_aparelho` | `30` | Validity of device approval and the device cookie. |
| `upload_mb` | `25` | Size limit per file, in MiB; the browser uses the server's configured value. |
| `upload_pasta` | `"_recebidos_portal"` | Upload subfolder inside the space's folder; keep it a simple, relative name. |
| `janela_contexto` | `1000000` | Denominator for the Claude Code context percentage. |
| `cache_uso` | `~/.claude/plugins/oh-my-claudecode/.usage-cache-anthropic.json` | Optional cache for the Claude usage limit. |
| `max_conexoes_privada` | `24` | Simultaneous connection slots per private listener. |
| `max_conexoes_publica` | `16` | Simultaneous connection slots on the public port. |

Paths containing `~` in the table describe defaults calculated by the program; when supplying them in JSON, write the absolute path. The last three optional cache and connection settings are not included in the example file.

## Tests

From the repository root:

```bash
python3 -m unittest discover -s tests -v
node --test tests/*_js_check.js
```

The tests use `tests/herdr_falso.py`, a temporary HOME, isolated configuration, fictional transcripts, and local ports. They do not need real herdr, agents, or Tailscale. They check authentication, code-based approval, cookies and headers, workspace hiding, conversation, limits, fingerprinted decisions, messages, and uploads, including interrupted transfers.

## Regenerating the images

With Firefox available on the `PATH`, run:

```bash
python3 scripts/gerar_imagens.py
```

The script starts a server with fake herdr, collects API responses, and captures the interface using headless Firefox. It recreates the five PNGs in `docs/img`, without requiring real agent accounts. Run `IDIOMA=en python3 scripts/gerar_imagens.py` for the matching English images in `docs/img/en`. It also works through the test suite's in-memory HTTP transport when TCP is unavailable.

## Limitations

- The interface is available in Portuguese and English and depends on the screen and data formats produced by the agents and herdr.
- Chat and context status are read from Claude Code transcripts. Codex has a terminal and usage limits, without transcript-based chat in this implementation.
- Claude limits come from the optional oh-my-claudecode cache. Codex limits come from recent local records. Cards may be missing or show outdated data; they do not query accounts directly.
- Context is estimated from recorded usage; both the percentage and caption use the configured `janela_contexto`.
- Updates use periodic polling; the terminal is not a full interactive session. Available keys are restricted.
- Secret masking is heuristic and does not replace reviewing what appears on screen. Uploads are not scanned for malware.

License: [MIT](LICENSE).

## Optional PC resources panel

Disabled by default. Set `painel.enabled` to `true` in the private configuration and restart. The panel expands `~` in its project and job-state paths.

| Key inside `painel` | Default | Purpose |
| --- | --- | --- |
| `enabled` | `false` | Enable the read-only panel. |
| `project_root` | `~/projects` | Group processes by the first directory below this root. |
| `disk` | `""` | Device from `/proc/diskstats` to measure; empty disables disk rates. |
| `mounts` | `["/"]` | Filesystems to show. |
| `job_state` | `~/.local/state/mge-localcompute/state.json` | Optional [MGE-LocalCompute](https://github.com/MrGoulart3/MGE-LocalCompute) integration; missing files or `""` yield no managed jobs. A compatible JSON contains `jobs` with `pid`, `threads`, `cwd`, and optional `paused`. |
| `interval` | `3` | Sampling interval in seconds, minimum 1. |
| `min_ram_gb` | `3` | Minimum available RAM in GiB for the capacity indicator. |
| `max_load` | `5.5` | Maximum 1-minute load for the capacity indicator. |
| `max_temp` | `85` | CPU package temperature ceiling in °C for the capacity indicator. |
| `compute_commands` | `["xtb", "crest", "orca", "sella", "rodar_local"]` | Case-insensitive substrings for classifying compute processes. Existing tool names are kept for compatibility; replace with your programs or use `[]` to disable this category. `rodar_local` means “run locally”. |

RAM, load, and temperature thresholds are configurable display defaults; the portal never changes thread counts or pauses jobs. Choose values for your hardware. CPU package/core parsing currently targets the Linux `coretemp` driver; other hardware may have unavailable readings. The capacity indicator is conservative when the package sensor is unavailable. Sensor thresholds use fallbacks of 85 °C (high) and 105 °C (critical); the temperature graph uses the critical threshold.

After signing in, use **PC resources** in the portal header; it opens an authenticated `/painel` in another tab. The key is sent in request headers, never in the URL. Popups must be allowed. To reopen after a full browser refresh, return to `/spaces` and use the button again. `/painel` and `/api/estado` require the key; the public port also requires an approved device. When disabled, panel routes return 404.

The collector reads Linux CPU/per-core utilization, RAM/swap, load, temperature and power-clamp, disk/network rates, process groups by project, managed jobs and a bounded in-memory history. It does not read account names or expose command arguments and executable paths. The public response permits only project details mapped to visible portal workspaces and omits hidden/unmapped processes and jobs; filtering failures return 503. If hidden and visible nested workspaces share one top-level project, that entire project group is omitted. Global totals and history still include the whole machine. Private access shows all collected projects. Missing sensors, unreadable process directories or an unconfigured disk may leave some values unavailable. RSS sums can count shared pages more than once.

The test suite automatically uses the real HTTP handler over in-memory byte streams when the environment blocks local TCP sockets. All route/body assertions still run, including interrupted uploads; listener binding, TCP concurrency and socket-level timeouts require a socket-enabled environment. The normal transport remains TCP where permitted.
