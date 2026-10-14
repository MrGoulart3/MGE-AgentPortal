*[Versão em português](README.pt-BR.md)*

# MGE-AgentPortal

A web portal for chatting from any browser with AI agents, such as Claude Code and Codex, running in the **herdr** multiplexer on a home machine. The server uses only the Python standard library, with no pip dependencies.

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

The images are generated using the fictional scenario in `tests/demo.py`.

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

   Edit the copy before starting. Set `herdr` to the installed executable, use `dono: "Ana"` as an example, and remove fictional paths that do not apply. Leave `aviso_cmd` empty if you do not use notifications. To start locally, use `enderecos_privados: [["127.0.0.1", 8787]]`. If you need the private entry point over the Tailscale network, add this machine's address to the configuration without opening the private port to the internet.

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

The file is `~/.config/mge-agentportal/config.json`. `MGE_PORTAL_DIR` lets you choose another directory for configuration, the key, access records, and logs; use the same value in the controller and the server. Restart the process after editing the configuration. Paths in JSON must be absolute, without `~`.

| Key | Default | Purpose |
| --- | --- | --- |
| `dono` | `"dono"` | Name in the message prefix; the example uses `"Ana"`. |
| `herdr` | Executable on the `PATH` or `~/.local/bin/herdr` | Path to herdr. |
| `enderecos_privados` | `[["127.0.0.1", 8787]]` | Address and port pairs requiring only the key. Use ports different from `porta_publica`. |
| `porta_publica` | `8788` | Local port published by Funnel; always on `127.0.0.1`. |
| `hosts_permitidos` | `[]` | Exact accepted Host header values; an empty list does not check Host. |
| `ocultos_na_internet` | `[]` | Workspaces hidden at the public entry point, by ID, label, or absolute folder prefix. |
| `aviso_cmd` | `[]` | List of command and arguments for notifications; title, message, and priority are appended. |
| `copia_da_chave` | `""` | Additional file to copy the key to when changing it through the API; empty disables this. The `portal-ctl chave` command does not make this copy. |
| `dias_aparelho` | `30` | Validity of device approval and the device cookie. |
| `upload_mb` | `25` | Server size limit per file, in MiB. The interface limits uploads to 25 MiB. |
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
```

The tests use `tests/herdr_falso.py`, a temporary HOME, isolated configuration, fictional transcripts, and local ports. They do not need real herdr, agents, or Tailscale. They check authentication, code-based approval, cookies and headers, workspace hiding, conversation, limits, fingerprinted decisions, messages, and uploads, including interrupted transfers.

## Regenerating the images

With Firefox available on the `PATH`, run:

```bash
python3 scripts/gerar_imagens.py
```

The script starts a server with fake herdr, collects API responses, and captures the interface using headless Firefox. It recreates the five PNGs in `docs/img`, without requiring real agent accounts.

## Limitations

- The interface is available in Portuguese and English and depends on the screen and data formats produced by the agents and herdr.
- Chat and context status are read from Claude Code transcripts. Codex has a terminal and usage limits, without transcript-based chat in this implementation.
- Claude limits come from the optional oh-my-claudecode cache. Codex limits come from recent local records. Cards may be missing or show outdated data; they do not query accounts directly.
- Context is estimated from recorded usage; the percentage uses `janela_contexto`. The interface caption still refers to a window of 1 million tokens.
- Updates use periodic polling; the terminal is not a full interactive session. Available keys are restricted.
- Secret masking is heuristic and does not replace reviewing what appears on screen. Uploads are not scanned for malware.

License: [MIT](LICENSE).

## Optional PC resources panel

Disabled by default. Set `painel.enabled` to `true` in the private configuration and restart. Configure `painel.project_root` (absolute projects directory), `disk` (device name from `/proc/diskstats`, empty disables disk rates), `mounts` (filesystem paths), `job_state` (MGE-LocalCompute state JSON), `interval` (seconds, at least 1), `min_ram_gb`, `max_load` and `max_temp`. The panel expands `~` in its project and job-state paths; the other portal configuration paths still require absolute values.

After signing in, use **PC resources** in the portal header; it opens an authenticated `/painel` in another tab. The key is sent in request headers, never in the URL. Popups must be allowed. To reopen after a full browser refresh, return to `/spaces` and use the button again. `/painel` and `/api/estado` require the key; the public port also requires an approved device. When disabled, panel routes return 404.

The collector reads Linux CPU/per-core utilization, RAM/swap, load, temperature and power-clamp, disk/network rates, process groups by project, managed jobs and a bounded in-memory history. It does not read account names or expose command arguments and executable paths. The public response permits only project details mapped to visible portal workspaces and omits hidden/unmapped processes and jobs; filtering failures return 503. If hidden and visible nested workspaces share one top-level project, that entire project group is omitted. Global totals and history still include the whole machine. Private access shows all collected projects. Missing sensors, unreadable process directories or an unconfigured disk may leave some values unavailable. RSS sums can count shared pages more than once.

The test suite automatically uses the real HTTP handler over in-memory byte streams when the environment blocks local TCP sockets. All route/body assertions still run, including interrupted uploads; listener binding, TCP concurrency and socket-level timeouts require a socket-enabled environment. The normal transport remains TCP where permitted.
