*[English version](PROTOCOL.md)*

# Protocolo de reprodução

Este roteiro reproduz a ideia em outra máquina: agentes locais no herdr, um portal mínimo, entrada privada para administração inicial e entrada pública com aprovação de aparelho. Para instalar esta implementação, siga também o [README.pt-BR.md](README.pt-BR.md); os limites de confiança estão em [SECURITY.pt-BR.md](SECURITY.pt-BR.md).

## 1. Definir o acesso e a confiança

> **Quem controla o portal controla os agentes e, por eles, a máquina.**

Escolha quais projetos poderão ser operados remotamente e quem terá a chave. Execute o portal no usuário Unix dos agentes. Reserve uma porta privada, como 8787, e outra pública, como 8788. Mantenha a pública em loopback e não exponha a privada pela internet.

## 2. Preparar agentes e multiplexador

Instale e configure herdr, Claude Code e/ou Codex na máquina Linux. Abra os agentes nos workspaces desejados. Confira se o herdr lista workspaces e agentes e se consegue ler a tela de um pane:

```bash
herdr workspace list
herdr agent list
herdr agent read w1:p1 --source visible
```

Troque `w1:p1` pelo identificador obtido na listagem. Os agentes devem funcionar localmente antes de acrescentar o portal.

## 3. Entender o contrato do portal

Use `portal/portal.py` como referência das rotas e da integração: listar agentes, ler tela visível ou recente, enviar prompts e teclas. As chamadas ao herdr usam subprocessos sem shell. As operações precisam validar autenticação, pane e visibilidade do workspace.

Para reproduzir o chat, associe o ID de sessão fornecido pelo herdr à transcrição JSONL do Claude Code. Leia mensagens e resumos de ferramentas incrementalmente, escape o conteúdo exibido e extraia o contexto do uso registrado. O Codex desta implementação usa a tela do terminal; seus limites de uso vêm dos registros locais. O limite do Claude usa o cache opcional do oh-my-claudecode.

## 4. Separar as duas entradas

Em `portal/server.py`, confira os listeners, a lista de Host, os cabeçalhos de segurança, as vagas de conexão e os prazos de leitura. A entrada privada aceita só chave; a pública exige também aprovação de aparelho. Classifique as portas sem reutilizar a porta pública nos endereços privados.

No navegador, `portal/web/spaces.js` reúne filtro de agentes, chat, terminal, decisões, anexos, cartões de uso e Acessos. Preserve scripts externos para atender à CSP sem script inline. A tela deve tratar erros e descartar respostas antigas de atualização.

## 5. Preparar chave e configuração

Na raiz do repositório:

```bash
scripts/portal-ctl chave
cp config.example.json ~/.config/mge-agentportal/config.json
```

Edite a cópia. Substitua o nome fictício `Ana` pelo seu nome. O exemplo encontra herdr no `PATH`, começa com a entrada privada `[["127.0.0.1", 8787]]` e deixa notificações e ocultação de workspaces sem configuração. Se precisar acessar pela rede Tailscale, configure o endereço privado correto apenas na sua cópia local. O comando `chave` acima gera uma chave. Os demais nomes em português são explicados no [README.pt-BR.md](README.pt-BR.md#configuração).

Preencha `hosts_permitidos` com os valores exatos usados pelo navegador e pelo proxy, incluindo `minha-maquina.tailnet-exemplo.ts.net` substituído pelo nome da sua máquina. Defina `ocultos_na_internet` por IDs, rótulos ou prefixos de pastas. Mantenha `upload_pasta` relativa e confira permissões do diretório de configuração e de pastas de upload já existentes.

## 6. Validar sem agentes reais

Execute:

```bash
python3 -m unittest discover -s tests -v
node --test tests/*_js_check.js
```

`tests/demo.py` monta HOME e configuração temporários, dados fictícios e um executável que chama `tests/herdr_falso.py`. Os testes conferem chave, aprovação, cookies, Host, ocultação, conversa, limites, decisões e uploads. Não precisam de Tailscale nem de contas dos agentes. A suíte não substitui conferir a configuração de produção e o proxy real.

## 7. Iniciar e conferir localmente

```bash
scripts/portal-ctl start
scripts/portal-ctl status
```

Abra `http://127.0.0.1:8787/spaces` na máquina e entre com a chave. Confira que os listeners necessários iniciaram em `~/.config/mge-agentportal/portal.log`: o processo pode continuar mesmo se um dos endereços falhar.

Selecione um agente de teste, acompanhe a tela e envie um recado inofensivo. No Claude Code, confira a transcrição. Teste uma decisão sem consequências e um pequeno arquivo de exemplo. Verifique os caminhos recebidos e a criação da pasta protegida de uploads.

## 8. Conferir antes de expor na internet

- [ ] Agentes e herdr funcionam localmente sob o usuário esperado.
- [ ] A chave é aleatória, está protegida e não aparece em URL, repositório ou imagem.
- [ ] A configuração foi revisada e não depende de caminhos fictícios.
- [ ] A porta pública escuta somente em `127.0.0.1` e é diferente das portas privadas.
- [ ] A porta privada não está exposta por roteador, firewall, proxy ou Funnel.
- [ ] `hosts_permitidos` está preenchido com os Hosts corretos.
- [ ] Workspaces sensíveis foram incluídos em `ocultos_na_internet`.
- [ ] Diretório de configuração e pastas de upload estão com permissões restritas; uploads têm `.gitignore`.
- [ ] Testes passaram e o uso local foi conferido.
- [ ] Tailscale está conectado e a política permite Funnel; o destino planejado é a porta pública 8788.
- [ ] A atribuição de cliente pelo último `X-Forwarded-For` é compatível com o proxy usado.
- [ ] Há uma sessão privada confiável disponível para aprovar o primeiro aparelho.
- [ ] O dono sabe desligar o Funnel, trocar a chave e revogar aparelhos.

## 9. Publicar e aprovar o primeiro aparelho

Publique a entrada pública:

```bash
sudo tailscale funnel --bg 8788
```

Abra a URL HTTPS informada pelo comando no aparelho novo. Exemplo fictício: `https://minha-maquina.tailnet-exemplo.ts.net/spaces`. Digite a chave, nomeie o aparelho e peça acesso. Ele exibirá um código de seis dígitos.

Na máquina, pela sessão privada em `http://127.0.0.1:8787/spaces`, abra **Acessos**, identifique o pedido e digite o código mostrado no aparelho novo. Não aprove só pelo nome: o código vincula a aprovação ao pedido observado. Há três tentativas e prazo de 15 minutos. Depois, aparelhos já aprovados também podem autorizar novos pedidos.

Confira pelo HTTPS que uma sessão sem aprovação não vê os agentes e que a sessão aprovada só mostra os workspaces permitidos. Confira também, nessa entrada, que operações sobre panes ocultos são rejeitadas.

## 10. Registrar a demonstração

Para reproduzir as imagens do resultado, com Firefox no `PATH`:

```bash
python3 scripts/gerar_imagens.py
IDIOMA=en python3 scripts/gerar_imagens.py
```

O script consulta a API com herdr falso e captura a interface usando respostas gravadas. Quando TCP estiver indisponível, usa o mesmo handler HTTP em memória dos testes. Gera `conversa.png`, `decisao.png`, `acessos.png`, `aprovacao.png` e `celular.png` em `docs/img` (português) e `docs/img/en` (inglês). Use dados fictícios ao compartilhar demonstrações.

## 11. Operar, revogar e desligar

Revise **Acessos** e os eventos de auditoria. Revogue aparelhos perdidos ou desconhecidos. Para trocar a chave pela interface, digite a chave atual e guarde a nova; as aprovações existentes são mantidas. Para recuperar acesso localmente, `scripts/portal-ctl chave` gera uma nova chave, sem revogar aparelhos.

Para retirar o acesso público:

```bash
sudo tailscale funnel --https=443 off
```

Para parar também o processo local:

```bash
scripts/portal-ctl stop
```

Parar o servidor e desligar o Funnel são operações independentes. Em caso de suspeita, retire a publicação, troque a chave, revogue os aparelhos afetados e revise o que os agentes fizeram antes de reabrir o acesso.
