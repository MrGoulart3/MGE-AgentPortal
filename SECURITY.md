*[Versão em português](SECURITY.pt-BR.md)*

# Security

> **Whoever controls the portal controls the agents and, through them, the machine.** The key and device approval grant administrative access to the available agents. This portal is neither an execution sandbox nor a service for users who do not trust each other.

## Threat model

The model covers unauthorized internet visitors, attempts to guess the key, improper approval requests, malicious content displayed in the browser, slow requests, and choices submitted for decisions that have already changed.

The private entry point requires only the key. The public entry point requires the key and an approved device and listens only on `127.0.0.1`. Tailscale Funnel terminates HTTPS and forwards to this local port. The private port must not be published through Funnel, router port forwarding, or another public proxy.

The proxy and its source attribution are part of the trust boundary: on the public port, the code uses **the last value of `X-Forwarded-For`**, expecting Tailscale to append the source at the end. Earlier values can be forged. Another proxy requires reviewing this assumption. Without this header, public clients share the `funnel` identity.

## Authentication and devices

- The key is compared using `hmac.compare_digest`; without a configured key, authentication fails. It is sent in the `X-Token` header.
- Per client, 15 incorrect keys within a 15-minute window limit further incorrect attempts. A missing key does not count; a correct key is still accepted. This control is held in memory and resets with the process.
- Device requests require the key, are limited to three per client per hour, and allow at most five simultaneous pending requests.
- The new device shows a random six-digit code. The owner must enter it in a trusted session, either private or already approved. The request list does not reveal the code. The request expires in 15 minutes; three incorrect codes cause it to be denied.
- The device secret is sent in a `pdev` cookie with `HttpOnly`, `Secure`, `SameSite=Strict`, and `Path=/`. Its validity follows `dias_aparelho`, defaulting to 30 days. The server stores the SHA-256 hash of the secret; the pending code stays in the private access file until the request is completed or expires.
- Compatibility with older devices accepts `X-Device` and migrates to the HttpOnly cookie. New approvals use cookies.
- The key can be remembered in browser local storage or kept in the session. `HttpOnly` protects the device cookie, not the saved key or a compromised browser.

## HTTP protections

- CSP with `script-src 'self'`, no inline scripts, `frame-ancestors 'none'`, `base-uri 'none'`, `object-src 'none'`, and connections restricted to the same origin. Inline styles are allowed.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `Cache-Control: no-store`.
- HSTS valid for one year on public-port responses. HTTPS depends on Funnel.
- Exact Host checking when `hosts_permitidos` is populated; a Host outside the list receives 421. An empty list disables this control: fill it before publishing.
- Independent slots per listener: 24 at the private entry point and 16 at the public one by default. Excess connections are closed.
- A total deadline of 20 seconds for the request line and headers. The body requires `Content-Length`, has a size limit and a total deadline between 30 and 900 seconds calculated from its size, with a timeout per read. Incomplete bodies are not accepted.

These limits reduce resource abuse; they do not guarantee availability under distributed attacks or network saturation.

## Commands, decisions, and data

herdr and the optional notification command are invoked with argument lists, without a shell. The pane must have a valid format and belong to the spaces visible at the entry point used. Messages are limited to 8,000 characters and have control characters removed.

Allowed keys are `esc`, `enter`, `up`, `down`, and digits `1` through `9`. For numeric choices, the server rereads the dialog and compares its shortened SHA-256 fingerprint with the one sent by the browser. Enter also requires the fingerprint when a dialog exists. If the decision changed, it returns 409. This control reduces choices made on stale cards; it does not make an authorized action safe or eliminate the possibility of the screen changing between the check and the key submission.

Chat text is escaped before simple formatting is applied, and the terminal is inserted as text. Secrets matching patterns such as `token`, `senha`, `password`, `secret`, `api_key`, and `authorization` are masked in transcript messages and tool descriptions. Masking does not cover all secrets, the raw terminal, or the contents of all logs.

`ocultos_na_internet` filters workspaces by ID, label, or absolute folder prefix. The public entry point also rejects operations on hidden panes rather than merely removing them from the list. This does not prevent a visible agent from accessing other files available to its Unix user.

## Uploads

The server accepts only extensions from the allowlist: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.txt`, `.md`, `.csv`, `.tsv`, `.json`, `.xyz`, `.log`, `.out`, `.inp`, `.gjf`, `.com`, `.mol`, `.mol2`, `.sdf`, `.pdb`, `.cif`, `.docx`, `.xlsx`, `.pptx`, and `.zip`.

Path components and unsuitable characters are removed from the name, its length is limited, and a date prefix and random suffix are added. The upload is written to an exclusive `.part` file with mode `600` and renamed only after the entire body is received; failures remove the partial file.

The upload folder is created with mode `700` inside the workspace and a `.gitignore` containing `*`. If it already exists, its permissions and `.gitignore` are not corrected automatically. Keep `upload_pasta` as a controlled relative subfolder and check existing folders.

The extension does not validate the contents. There is no antivirus, archive inspection, or cumulative disk quota. The agent may interpret received files and act on them.

## Auditing and key changes

`auditoria.log` records events such as requests, approvals, denials, revocations, blocks, uploads, and key changes. **Access** shows recent events. `recados.log` stores messages, keys, and file names; there is no HTTP access log. Audit and message logs rotate after exceeding approximately 2 MB and are created with mode `600`. Runtime errors go to `portal.log`.

The configuration directory is created with mode `700`; key and access files written by the private routines use mode `600`. Permissions on preexisting directories must be checked by the operator. Logs may contain sensitive content and do not form a tamper-proof trail.

**Change key** requires the current key again. The interface keeps approved devices, but all need the new key. The API allows revoking all approvals when changing the key; revocation is also available under **Access**. `scripts/portal-ctl chave` generates another key in the file without revoking devices or copying it to `copia_da_chave`. The server rereads the key file during authentication without needing a restart.

If you suspect a problem, turn off the publication with `sudo tailscale funnel --https=443 off`, change the key, revoke suspicious devices, and review the logs before publishing again. **Sign out** deletes the key from the browser; **Forget this device** revokes its approval and deletes the cookie.

## Outside the model

- A local user with the same Unix user as the portal: they can read or change the key, files, sessions, and agents. There is no defense against this access.
- A compromised Tailscale account: the network, publication, and their administration are no longer trustworthy.
- A compromised browser, host machine, herdr, or agent; malicious extensions; phishing; dangerous actions approved by the owner; and malicious instructions in data read by the agent.

## Reporting issues

Open an issue in the repository with a general description, the affected version or revision, and the expected impact. **Do not publish exploitable details**, a working proof of concept, a key, a cookie, private transcripts, or personal data. Coordinate with the maintainers through the issue to arrange a private way to provide the necessary details.
