*[English version](SECURITY.md)*

# Segurança

> **Quem controla o portal controla os agentes e, por eles, a máquina.** A chave e a aprovação de aparelho concedem acesso administrativo aos agentes disponíveis. Este portal não é um isolamento de execução nem um serviço para usuários mutuamente desconfiados.

## Modelo de ameaça

O modelo considera visitantes da internet sem autorização, tentativas de adivinhar a chave, pedidos de aprovação indevidos, conteúdo malicioso exibido no navegador, requisições lentas e escolhas enviadas para decisões que já mudaram.

A entrada privada exige só a chave. A entrada pública exige chave e aparelho aprovado e escuta somente em `127.0.0.1`. O Tailscale Funnel termina o HTTPS e encaminha para essa porta local. A porta privada não deve ser publicada pelo Funnel, redirecionamento do roteador ou outro proxy público.

O proxy e sua atribuição de origem fazem parte da confiança: na porta pública, o código usa **o último valor de `X-Forwarded-For`**, esperando que o Tailscale acrescente a origem ao final. Valores anteriores podem ser forjados. Outro proxy exige revisar essa premissa. Sem esse cabeçalho, os clientes públicos compartilham a identidade `funnel`.

## Autenticação e aparelhos

- A chave é comparada com `hmac.compare_digest`; sem chave configurada, a autenticação falha. Ela é enviada no cabeçalho `X-Token`.
- Por cliente, 15 chaves erradas em uma janela de 15 minutos limitam novas tentativas erradas. Ausência de chave não conta; uma chave correta continua sendo aceita. O controle fica em memória e reinicia com o processo.
- Pedidos de aparelho exigem a chave, têm limite de três por cliente por hora e no máximo cinco pendentes simultâneos.
- O aparelho novo mostra um código aleatório de seis dígitos. O dono precisa digitá-lo numa sessão confiável, privada ou já aprovada. A lista de pedidos não entrega o código. O pedido expira em 15 minutos; três códigos errados o recusam.
- O segredo do aparelho é enviado em cookie `pdev` com `HttpOnly`, `Secure`, `SameSite=Strict` e `Path=/`. Sua validade acompanha `dias_aparelho`, por padrão 30 dias. O servidor guarda o hash SHA-256 do segredo; o código pendente fica no arquivo privado de acessos até o pedido ser concluído ou expirar.
- Compatibilidade com aparelhos antigos aceita `X-Device` e migra para o cookie HttpOnly. Novas aprovações usam cookie.
- A chave pode ser lembrada no armazenamento local do navegador ou mantida na sessão. `HttpOnly` protege o cookie de aparelho, não a chave salva nem um navegador comprometido.

## Proteções HTTP

- CSP com `script-src 'self'`, sem scripts inline, `frame-ancestors 'none'`, `base-uri 'none'`, `object-src 'none'` e conexões restritas à própria origem. Estilos inline são permitidos.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e `Cache-Control: no-store`.
- HSTS com validade de um ano nas respostas da porta pública. O HTTPS depende do Funnel.
- Conferência exata de Host quando `hosts_permitidos` está preenchido; Host fora da lista recebe 421. Lista vazia desativa o controle: preencha antes de publicar.
- Vagas independentes por listener: 24 na entrada privada e 16 na pública por padrão. Conexões excedentes são fechadas.
- Prazo total de 20 segundos para linha de requisição e cabeçalhos. O corpo exige `Content-Length`, tem limite de tamanho e prazo total entre 30 e 900 segundos, calculado pelo tamanho, com timeout por leitura. Corpos incompletos não são aceitos.

Esses limites reduzem abuso de recursos; não garantem disponibilidade diante de ataques distribuídos ou saturação da rede.

## Comandos, decisões e dados

O herdr e o comando opcional de notificações são chamados por argumentos em lista, sem shell. O pane precisa ter formato válido e pertencer aos spaces visíveis na entrada usada. Recados têm limite de 8.000 caracteres e removem caracteres de controle.

As teclas permitidas são `esc`, `enter`, `up`, `down` e os dígitos de `1` a `9`. Para escolhas numéricas, o servidor relê o diálogo e compara sua impressão digital SHA-256 abreviada com a enviada pelo navegador. Enter também exige a impressão digital quando há diálogo. Se a decisão mudou, responde 409. Esse controle reduz escolhas em cartões antigos; não torna segura a ação autorizada nem elimina a possibilidade de a tela mudar entre a conferência e o envio da tecla.

O texto do chat é escapado antes de receber formatação simples e o terminal é inserido como texto. Segredos com padrões como `token`, `senha`, `password`, `secret`, `api_key` e `authorization` são mascarados nas mensagens e descrições de ferramentas da transcrição. O mascaramento não cobre todos os segredos, o terminal bruto ou o conteúdo de todos os logs.

`ocultos_na_internet` filtra workspaces por ID, rótulo ou prefixo absoluto da pasta. A entrada pública também rejeita operações sobre panes ocultos, em vez de apenas removê-los da lista. Isso não impede um agente visível de acessar outros arquivos aos quais seu usuário Unix tem acesso.

## Uploads

O servidor aceita somente extensões da lista permitida: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.txt`, `.md`, `.csv`, `.tsv`, `.json`, `.xyz`, `.log`, `.out`, `.inp`, `.gjf`, `.com`, `.mol`, `.mol2`, `.sdf`, `.pdb`, `.cif`, `.docx`, `.xlsx`, `.pptx` e `.zip`.

O nome perde componentes de caminho e caracteres inadequados, tem comprimento limitado e recebe prefixo de data e sufixo aleatório. O upload é gravado em arquivo exclusivo `.part`, com modo `600`, e só renomeado após receber todo o corpo; falhas removem o parcial.

A pasta de recebimento é criada com modo `700` dentro do workspace e com `.gitignore` contendo `*`. Se já existir, suas permissões e seu `.gitignore` não são corrigidos automaticamente. Mantenha `upload_pasta` como subpasta relativa controlada e confira pastas existentes.

A extensão não valida o conteúdo. Não há antivírus, inspeção de arquivos compactados ou quota acumulada de disco. O agente pode interpretar arquivos recebidos e executar ações a partir deles.

## Auditoria e troca de chave

`auditoria.log` registra eventos como pedidos, aprovações, recusas, revogações, bloqueios, uploads e trocas de chave. **Acessos** mostra os eventos recentes. `recados.log` guarda recados, teclas e nomes de arquivos; não há log HTTP de acesso. Os logs de auditoria e recados giram ao ultrapassar aproximadamente 2 MB e são criados com modo `600`. Erros de execução vão para `portal.log`.

O diretório de configuração é criado com modo `700`; arquivos de chave e acessos escritos pelas rotinas privadas usam modo `600`. Permissões de diretórios preexistentes devem ser conferidas pelo operador. Os logs podem conter conteúdo sensível e não formam uma trilha inviolável.

**Trocar a chave** exige a chave atual novamente. A interface mantém os aparelhos aprovados, mas todos precisam da nova chave. A API permite revogar todas as aprovações na troca; também há revogação em **Acessos**. `scripts/portal-ctl chave` gera outra chave no arquivo, sem revogar aparelhos ou copiar para `copia_da_chave`. O servidor relê o arquivo de chave na autenticação, sem precisar reiniciar.

Em caso de suspeita, desligue a publicação com `sudo tailscale funnel --https=443 off`, troque a chave, revogue os aparelhos suspeitos e revise os logs antes de republicar. **Sair** apaga a chave do navegador; **Esquecer este aparelho** revoga sua aprovação e apaga o cookie.

## Fora do modelo

- Usuário local com o mesmo usuário Unix do portal: pode ler ou alterar chave, arquivos, sessões e agentes. Não há defesa contra esse acesso.
- Conta Tailscale comprometida: a rede, a publicação e sua administração deixam de ser confiáveis.
- Navegador, máquina anfitriã, herdr ou agente comprometidos; extensões maliciosas; phishing; ações perigosas aprovadas pelo dono e instruções maliciosas nos dados lidos pelo agente.

## Reportar problemas

Abra uma issue no repositório com uma descrição geral, versão ou revisão afetada e impacto esperado. **Não publique detalhes exploráveis**, prova de conceito funcional, chave, cookie, transcrições privadas ou dados pessoais. Combine com a manutenção, pela issue, uma forma reservada de fornecer os detalhes necessários.
