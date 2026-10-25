# Verificação local / Local checks

Execute na raiz, com Python 3.12, Node 24 e Bash:
Run from the repository root, using Python 3.12, Node 24 and Bash:

```sh
python .github/scripts/check.py
```

O comando usa `git ls-files`: novos arquivos precisam ser adicionados ao índice
antes da execução. Faz sintaxe Python sem importar dependências opcionais,
`node --check` (inclusive scripts inline HTML), `bash -n`, as suítes unittest
existentes e os testes do scanner. Não instala pacotes nem acessa a rede.
The command checks tracked/staged files; stage new files first. It checks Python,
JavaScript (including inline HTML), shell syntax, unittest suites and the scanner.
It does not install packages or access the network.

## Dados pessoais e segredos / Personal data and secrets

O scanner bloqueia chaves privadas, formatos comuns de tokens, credenciais
literais, e-mails fora dos domínios de exemplo, CPF válido, telefone rotulado,
caminhos pessoais e arquivos de credenciais/estado. Não imprime valores.
It blocks common secret formats, literal credentials, email addresses, valid CPF,
labelled phone numbers, personal paths and credential/state files, without logging values.

Falsos positivos só podem receber exceção em `security-allowlist.json` com
`path`, `rule`, `sha256` e `reason`. Use o hash informado no alerta e explique
por que o dado já é público ou sintético; nunca copie o valor suspeito.
Allow false positives only by exact file/rule/hash with a documented reason;
never copy the suspicious value into the allowlist.

A varredura cobre o estado atual dos arquivos de texto UTF-8 versionados,
não o histórico, binários, ofuscação ou todo dado pessoal possível. Se houver
vazamento, revogue o segredo e revise o histórico com ferramenta especializada.
The scan covers current tracked UTF-8 text, not history, binaries, obfuscation
or every possible form of personal data. Revoke exposed secrets and audit history.

## Versões / Versions

`CHANGELOG.md` registra mudanças; a seção Unreleased ainda não é uma release.
As tags `*-ci.1` são prévias locais; não publique como versões estáveis.
Após merge e CI verde, escolha a versão SemVer, mova Unreleased para uma seção
datada e crie uma tag anotada no commit aprovado. Não há release automática.
The changelog has an Unreleased section. Local `*-ci.1` tags are previews.
After merge and green CI, choose a SemVer version and tag the reviewed commit.

Dependabot abre no máximo um PR agrupado por ecossistema, mensalmente,
sem auto-merge. Atualizações devem passar pelos mesmos testes.
Dependabot is monthly, grouped and limited to one open PR per ecosystem,
without automatic merging.
