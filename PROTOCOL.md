*[Versão em português](PROTOCOL.pt-BR.md)*

# Reproduction protocol

This guide reproduces the idea on another machine: local agents in herdr, a minimal portal, a private entry point for initial administration, and a public entry point with device approval. To install this implementation, also follow [README.md](README.md); the trust boundaries are described in [SECURITY.md](SECURITY.md).

## 1. Define access and trust

> **Whoever controls the portal controls the agents and, through them, the machine.**

Choose which projects can be operated remotely and who will have the key. Run the portal under the agents' Unix user. Reserve a private port, such as 8787, and a public one, such as 8788. Keep the public port on loopback and do not expose the private port to the internet.

## 2. Prepare agents and the multiplexer

Install and configure herdr, Claude Code, and/or Codex on the Linux host. Open the agents in the desired workspaces. Check that herdr lists workspaces and agents and can read a pane's screen:

```bash
herdr workspace list
herdr agent list
herdr agent read w1:p1 --source visible
```

Replace `w1:p1` with the identifier obtained from the listing. The agents must work locally before adding the portal.

## 3. Understand the portal contract

Use `portal/portal.py` as the reference for routes and integration: listing agents, reading the visible or recent screen, and sending prompts and keys. Calls to herdr use subprocesses without a shell. Operations must validate authentication, the pane, and workspace visibility.

To reproduce chat, associate the session ID provided by herdr with the Claude Code JSONL transcript. Read messages and tool summaries incrementally, escape displayed content, and extract context from recorded usage. Codex in this implementation uses the terminal screen; its usage limits come from local records. The Claude limit uses the optional oh-my-claudecode cache.

## 4. Separate the two entry points

In `portal/server.py`, check the listeners, Host list, security headers, connection slots, and read deadlines. The private entry point accepts only the key; the public one also requires device approval. Classify the ports without reusing the public port in private addresses.

In the browser, `portal/web/spaces.js` brings together agent filtering, chat, the terminal, decisions, attachments, usage cards, and Access. Keep scripts external to comply with the CSP that disallows inline scripts. The screen must handle errors and discard stale update responses.

## 5. Prepare the key and configuration

From the repository root:

```bash
scripts/portal-ctl chave
cp config.example.json ~/.config/mge-agentportal/config.json
```

Edit the copy. Replace the fictional name `Member A` with your name. The example finds herdr on the `PATH`, starts with the private entry point `[["127.0.0.1", 8787]]`, and leaves notifications and workspace hiding unconfigured. If you need access over the Tailscale network, configure the correct private address only in your local copy. `chave` means “key”; the command above generates one. Other Portuguese names are explained in [README.md](README.md#configuration).

Fill `hosts_permitidos` with the exact values used by the browser and proxy, including `portal.example.org` replaced with your machine's name. Define `ocultos_na_internet` by IDs, labels, or folder prefixes. Keep `upload_pasta` relative and check permissions on the configuration directory and existing upload folders.

## 6. Validate without real agents

Run:

```bash
python3 -m unittest discover -s tests -v
node --test tests/*_js_check.js
```

`tests/demo.py` sets up a temporary HOME and configuration, fictional data, and an executable that calls `tests/herdr_falso.py`. Tests check the key, approval, cookies, Host, hiding, conversation, limits, decisions, and uploads. They need neither Tailscale nor agent accounts. The suite does not replace checking the production configuration and the real proxy.

## 7. Start and check locally

```bash
scripts/portal-ctl start
scripts/portal-ctl status
```

Open `http://127.0.0.1:8787/spaces` on the machine and sign in with the key. Check in `~/.config/mge-agentportal/portal.log` that the required listeners started: the process can continue even if one address fails.

Select a test agent, follow the screen, and send a harmless message. For Claude Code, check the transcript. Test a decision with no consequences and a small sample file. Verify the received paths and creation of the protected upload folder.

## 8. Check before exposing to the internet

- [ ] Agents and herdr work locally under the expected user.
- [ ] The key is random, protected, and absent from URLs, the repository, and images.
- [ ] The configuration has been reviewed and does not depend on fictional paths.
- [ ] The public port listens only on `127.0.0.1` and differs from the private ports.
- [ ] The private port is not exposed through a router, firewall, proxy, or Funnel.
- [ ] `hosts_permitidos` contains the correct Hosts.
- [ ] Sensitive workspaces have been included in `ocultos_na_internet`.
- [ ] The configuration directory and upload folders have restricted permissions; uploads have a `.gitignore`.
- [ ] Tests passed and local use has been checked.
- [ ] Tailscale is connected and policy permits Funnel; the planned destination is public port 8788.
- [ ] Client attribution using the last `X-Forwarded-For` value is compatible with the proxy in use.
- [ ] A trusted private session is available to approve the first device.
- [ ] The owner knows how to turn off Funnel, change the key, and revoke devices.

## 9. Publish and approve the first device

Publish the public entry point:

```bash
sudo tailscale funnel --bg 8788
```

Open the HTTPS URL reported by the command on the new device. Fictional example: `https://portal.example.org/spaces`. Enter the key, name the device, and request access. It will display a six-digit code.

On the machine, through the private session at `http://127.0.0.1:8787/spaces`, open **Access**, identify the request, and enter the code shown on the new device. Do not approve by name alone: the code binds approval to the observed request. There are three attempts and a 15-minute deadline. Afterwards, already approved devices can also authorize new requests.

Check over HTTPS that an unapproved session cannot see agents and that an approved session shows only allowed workspaces. Also check at this entry point that operations on hidden panes are rejected.

## 10. Record the demonstration

To reproduce the result images, with Firefox on the `PATH`:

```bash
python3 scripts/gerar_imagens.py
IDIOMA=en python3 scripts/gerar_imagens.py
```

The script queries the API with fake herdr and captures the interface using recorded responses. When TCP is unavailable, it uses the same in-memory HTTP handler as the tests. It generates `conversa.png`, `decisao.png`, `acessos.png`, `aprovacao.png`, and `celular.png` in `docs/img` (Portuguese) and `docs/img/en` (English). Use fictional data when sharing demonstrations.

## 11. Operate, revoke, and shut down

Review **Access** and audit events. Revoke lost or unknown devices. To change the key through the interface, enter the current key and save the new one; existing approvals are kept. To recover access locally, `scripts/portal-ctl chave` generates a new key without revoking devices.

To remove public access:

```bash
sudo tailscale funnel --https=443 off
```

To also stop the local process:

```bash
scripts/portal-ctl stop
```

Stopping the server and turning off Funnel are independent operations. If you suspect a problem, remove the publication, change the key, revoke affected devices, and review what the agents did before reopening access.
