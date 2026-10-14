*[English version](README.md)*

# MGE-AgentPortal

Portal web para conversar de qualquer navegador com agentes de IA, como Claude Code e Codex, que rodam no multiplexador **herdr** de uma máquina em casa. O servidor usa somente a biblioteca padrão do Python, sem dependências de pip.

> **Segurança: quem controla o portal controla os agentes e, por eles, a máquina.** Proteja a chave, aprove apenas aparelhos conhecidos e leia [SECURITY.pt-BR.md](SECURITY.pt-BR.md) antes de publicar.

## Recursos

- Chat com a transcrição do Claude Code e terminal ao vivo para Claude Code e Codex.
- Cartão para responder decisões, incluindo permissões e perguntas. A impressão digital identifica a decisão exibida e impede responder a um cartão que mudou.
- Envio de arquivos por seleção, arrastar e soltar ou colar imagens; os caminhos dos arquivos recebidos seguem no recado ao agente.
- Cartões de limites de uso: Claude 5 h, Codex 5 h e semana. Cada cartão pode ser fechado e há um botão para restaurar os cartões.
- Filtro Claude/Codex/Todos, histórico do terminal, ajustes de fonte e interface para celular.
- Interface bilíngue (português/inglês): usa o idioma do navegador por padrão; o seletor **PT | EN** no cabeçalho salva a preferência neste navegador.
- Aprovação e revogação de aparelhos, auditoria e troca de chave em **Acessos**.

## Imagens

Conversa e limites de uso:

![Chat com a transcrição e cartões de uso](docs/img/conversa.png)

Decisão do agente:

![Cartão de decisão junto ao terminal](docs/img/decisao.png)

Gerenciamento de acessos:

![Pedidos, aparelhos aprovados e auditoria](docs/img/acessos.png)

Aprovação em duas etapas:

![Código exibido no aparelho que pede acesso](docs/img/aprovacao.png)

Uso no celular:

![Conversa no navegador do celular](docs/img/celular.png)

As imagens são geradas com o cenário fictício de `tests/demo.py`.

## Como funciona

O navegador consulta a API do portal, que chama o herdr para listar agentes, ler o terminal, enviar recados e pressionar teclas permitidas. Para o chat do Claude Code, o portal lê as transcrições locais de suas sessões.

Há duas portas com regras diferentes:

| Entrada | Autenticação | Exposição |
| --- | --- | --- |
| Privada, normalmente 8787 | Só chave | Loopback ou endereço privado configurado, por exemplo da rede Tailscale |
| Pública, normalmente 8788 | Chave + aparelho aprovado | Escuta somente em `127.0.0.1`; o Tailscale Funnel publica o acesso por HTTPS |

Na entrada pública, um aparelho novo informa seu nome e recebe um código de **6 dígitos**. O dono digita esse código em **Acessos**, num aparelho confiável. O pedido vale 15 minutos e é recusado após três códigos errados. Para aprovar o primeiro aparelho, use a entrada privada com a chave.

## Requisitos

- Linux, Python 3.10 ou superior e Bash. O controlador usa `flock`, `nohup`, `setsid` e `/proc`.
- herdr instalado e agentes Claude Code ou Codex já abertos nele, sob o usuário Unix que executa o portal.
- Tailscale instalado, conectado e autorizado a usar Funnel para o acesso pela internet.
- Navegador moderno com JavaScript e cookies habilitados.
- Firefox no `PATH` apenas para regenerar as imagens.

O portal não instala os agentes nem os inicia. Para funcionar como previsto, precisa ter acesso aos dados locais das sessões desse usuário.

## Instalação

Execute na raiz deste repositório:

1. Gere a chave:

   ```bash
   scripts/portal-ctl chave
   ```

   Ela fica em `~/.config/mge-agentportal/token`. Guarde-a como uma senha; não a inclua em URLs, commits ou capturas de tela.

2. Copie a configuração:

   ```bash
   cp config.example.json ~/.config/mge-agentportal/config.json
   ```

   Edite a cópia antes de iniciar. Ajuste `herdr` para o executável instalado, use `dono: "Ana"` como exemplo e remova os caminhos fictícios que não se aplicam. Deixe `aviso_cmd` vazio se não usar notificações. Para começar localmente, use `enderecos_privados: [["127.0.0.1", 8787]]`. Se precisar da entrada privada pela rede Tailscale, adicione o endereço dessa máquina à configuração, sem abrir a porta privada na internet.

   Preencha `hosts_permitidos` com os Hosts efetivamente usados: `127.0.0.1:8787`, `localhost:8787`, `127.0.0.1:8788`, o Host privado se houver e `minha-maquina.tailnet-exemplo.ts.net` substituído pelo nome da sua máquina. A lista vazia desativa a conferência de Host.

3. Inicie e confira o serviço:

   ```bash
   scripts/portal-ctl start
   scripts/portal-ctl status
   ```

   Na própria máquina, abra `http://127.0.0.1:8787/spaces` e entre com a chave. Confira se os agentes aparecem. O log de execução fica em `~/.config/mge-agentportal/portal.log`.

4. Depois do checklist de [PROTOCOL.pt-BR.md](PROTOCOL.pt-BR.md), publique somente a porta pública:

   ```bash
   sudo tailscale funnel --bg 8788
   ```

   Use a URL HTTPS informada pelo comando; neste documento, o exemplo é `https://minha-maquina.tailnet-exemplo.ts.net/spaces`.

5. Aprove o primeiro aparelho. Nele, abra a URL pública, entre com a chave, informe um nome e peça acesso. Na sessão privada aberta na máquina, vá a **Acessos**, encontre o pedido e digite o código mostrado pelo aparelho novo. Após a aprovação, ele entra automaticamente. Os próximos aparelhos podem ser aprovados pela sessão privada ou por um aparelho já aprovado.

## Uso no dia a dia

Escolha o filtro e o space. No Claude Code, use **Conversa** para acompanhar mensagens e ações; use a visão ao vivo para conferir o terminal. O Codex usa a visão de terminal. O histórico do terminal pode depender de o agente estar parado.

Digite um recado e envie com Enter; Shift+Enter insere uma nova linha. Anexe arquivos antes de enviar. Eles ficam em `_recebidos_portal` dentro da pasta do space, e o agente recebe seus caminhos. Se um envio demorar e falhar, confira a conversa antes de reenviar.

Quando aparecer um cartão de decisão, leia a pergunta e as opções antes de responder. Se a decisão mudou, o servidor recusa a escolha e pede uma nova conferência. Fechar um cartão de uso só o oculta neste navegador; **restaurar cartões** traz os cartões de volta.

Em **Acessos**, aprove pedidos conhecidos, recuse os demais e revogue aparelhos que não usa. **Sair** remove a chave salva; **Esquecer este aparelho** também revoga o acesso desse aparelho. **Trocar a chave** exige digitar a chave atual e mostra a nova; os demais aparelhos precisarão dela, mas suas aprovações são mantidas pela interface.

Para controlar o processo:

```bash
scripts/portal-ctl status
scripts/portal-ctl stop
scripts/portal-ctl start
```

Parar o portal não remove a publicação do Funnel. Para desligá-la:

```bash
sudo tailscale funnel --https=443 off
```

## Configuração

O arquivo é `~/.config/mge-agentportal/config.json`. `MGE_PORTAL_DIR` permite escolher outro diretório de configuração, chave, acessos e logs; use o mesmo valor no controlador e no servidor. Reinicie o processo após editar a configuração. Caminhos no JSON devem ser absolutos, sem `~`.

| Chave | Padrão | Função |
| --- | --- | --- |
| `dono` | `"dono"` | Nome no prefixo dos recados; o exemplo usa `"Ana"`. |
| `herdr` | Executável no `PATH` ou `~/.local/bin/herdr` | Caminho do herdr. |
| `enderecos_privados` | `[["127.0.0.1", 8787]]` | Pares de endereço e porta que exigem só chave. Use portas diferentes de `porta_publica`. |
| `porta_publica` | `8788` | Porta local publicada pelo Funnel; sempre em `127.0.0.1`. |
| `hosts_permitidos` | `[]` | Valores exatos do cabeçalho Host aceitos; lista vazia não confere Host. |
| `ocultos_na_internet` | `[]` | Workspaces ocultos na entrada pública, por ID, rótulo ou prefixo absoluto da pasta. |
| `aviso_cmd` | `[]` | Lista de comando e argumentos para notificações; recebe título, mensagem e prioridade ao final. |
| `copia_da_chave` | `""` | Arquivo extra para copiar a chave ao trocá-la pela API; vazio desativa. O comando `portal-ctl chave` não faz essa cópia. |
| `dias_aparelho` | `30` | Validade da aprovação e do cookie de aparelho. |
| `upload_mb` | `25` | Limite de tamanho por arquivo no servidor, em MiB. A interface limita a 25 MiB. |
| `upload_pasta` | `"_recebidos_portal"` | Subpasta de recebimento dentro da pasta do space; mantenha um nome simples e relativo. |
| `janela_contexto` | `1000000` | Denominador do percentual de contexto do Claude Code. |
| `cache_uso` | `~/.claude/plugins/oh-my-claudecode/.usage-cache-anthropic.json` | Cache opcional para o limite de uso do Claude. |
| `max_conexoes_privada` | `24` | Vagas de conexão simultânea por listener privado. |
| `max_conexoes_publica` | `16` | Vagas de conexão simultânea na porta pública. |

Os caminhos com `~` na tabela descrevem padrões calculados pelo programa; ao fornecê-los no JSON, escreva o caminho absoluto. As três últimas opções opcionais de cache e conexões não constam no arquivo de exemplo.

## Testes

Na raiz do repositório:

```bash
python3 -m unittest discover -s tests -v
```

Os testes usam `tests/herdr_falso.py`, HOME temporário, configuração isolada, transcrições fictícias e portas locais. Não precisam de herdr real, agentes ou Tailscale. Conferem autenticação, aprovação com código, cookies e cabeçalhos, ocultação de workspaces, conversa, limites, decisões com impressão digital, recados e uploads, incluindo envio interrompido.

## Regenerar as imagens

Com Firefox disponível no `PATH`, execute:

```bash
python3 scripts/gerar_imagens.py
```

O script sobe um servidor com herdr falso, coleta respostas da API e captura a interface com Firefox headless. Recria os cinco PNGs em `docs/img`, sem precisar de contas reais dos agentes.

## Limitações

- A interface está disponível em português e inglês e depende dos formatos de tela e dados produzidos pelos agentes e pelo herdr.
- O chat e o status de contexto são lidos das transcrições do Claude Code. O Codex tem terminal e limites de uso, sem chat por transcrição nesta implementação.
- Os limites do Claude vêm do cache do oh-my-claudecode, opcional. Os do Codex vêm dos registros locais recentes. Os cartões podem faltar ou mostrar dados desatualizados; não são consultas diretas às contas.
- O contexto é estimado a partir do uso registrado; o percentual usa `janela_contexto`. A legenda da interface ainda menciona uma janela de 1 milhão de tokens.
- A atualização ocorre por consultas periódicas; o terminal não é uma sessão interativa completa. As teclas disponíveis são restritas.
- O mascaramento de segredos é heurístico e não substitui revisar o que aparece na tela. Uploads não passam por análise de malware.

Licença: [MIT](LICENSE).

## Painel opcional de recursos do PC

Desativado por padrão. Defina `painel.enabled` como `true` na configuração privada e reinicie. Configure `painel.project_root` (raiz absoluta dos projetos), `disk` (nome do dispositivo em `/proc/diskstats`, vazio desliga taxas de disco), `mounts` (caminhos dos sistemas de arquivos), `job_state` (JSON de estado do MGE-LocalCompute), `interval` (segundos, mínimo 1), `min_ram_gb`, `max_load` e `max_temp`. O painel expande `~` na raiz e no caminho de estado dos jobs; os demais caminhos de configuração do portal continuam exigindo caminhos absolutos.

Depois de entrar, use **Recursos do PC** no cabeçalho; ele abre `/painel` autenticado em outra aba. A chave vai nos cabeçalhos, nunca na URL. Permita popups. Para reabrir após atualização completa do navegador, volte a `/spaces` e use o botão. `/painel` e `/api/estado` exigem chave; a porta pública também exige aparelho aprovado. Desativado, as rotas retornam 404.

O coletor consulta CPU/por núcleo, RAM/swap, carga, temperatura/power-clamp, taxas de disco/rede, processos por projeto, jobs gerenciados e histórico limitado em memória. Não lê nomes de contas nem expõe argumentos ou caminhos de executáveis. A resposta pública permite só detalhes de projetos associados a workspaces visíveis e remove processos e jobs ocultos/desconhecidos; falha na filtragem retorna 503. Se workspaces visíveis e ocultos estiverem sob o mesmo projeto de primeiro nível, todo esse grupo fica oculto. Totais globais e histórico ainda incluem a máquina inteira. O acesso privado mostra todos os projetos coletados. Sensores ausentes, diretórios de processos ilegíveis ou disco não configurado podem deixar valores indisponíveis. Somas de RSS podem contar páginas compartilhadas mais de uma vez.

Se o ambiente bloquear sockets TCP locais, a suíte usa automaticamente o handler HTTP real sobre fluxos de bytes em memória. Todas as verificações de rotas/corpos continuam, inclusive uploads interrompidos; listeners, concorrência TCP e timeouts de socket precisam de ambiente com sockets. Onde permitido, o transporte normal continua TCP.
