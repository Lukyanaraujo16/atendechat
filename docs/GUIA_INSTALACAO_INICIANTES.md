# Guia de instalação — passo a passo

Deixe este guia aberto ao lado do terminal. Copie cada comando, cole no terminal da VPS e pressione
Enter. Os comandos são executados como **root** (ou com `sudo`).

Antes de começar, tenha em mãos:

- a URL do repositório no GitHub;
- o domínio que será usado (ex.: `empresa.com.br`), com os registros **A** de `app.empresa.com.br` e
  `api.empresa.com.br` apontando para o IP da VPS;
- um e-mail para o certificado HTTPS;
- nome, e-mail e senha que você quer usar como **Super Admin** (o administrador geral do sistema);
- um celular com WhatsApp para conectar no final.

---

## PASSO 1 — Atualizar o servidor

```bash
apt-get update
apt-get -y upgrade
```

Se aparecer uma tela perguntando quais serviços reiniciar, pressione Enter. Se ao final houver o
aviso de que o sistema precisa ser reiniciado, execute `reboot`, aguarde um minuto e conecte de novo.

## PASSO 2 — Instalar o Git

```bash
apt-get install -y git
```

## PASSO 3 — Baixar o StreamHub Chat

```bash
git clone URL_DO_REPOSITORIO_GITHUB /var/www/atendechat
```

Troque `URL_DO_REPOSITORIO_GITHUB` pela URL do repositório que está na sua conta do GitHub.
Se o projeto já estiver em `/var/www/atendechat`, pule este passo.

## PASSO 4 — Entrar na pasta

```bash
cd /var/www/atendechat
```

## PASSO 5 — Executar o instalador

```bash
sudo bash install.sh
```

A partir daqui o instalador faz perguntas. Siga a tabela da próxima seção na mesma ordem.

**Regras que valem para todas as perguntas:**

- Quando houver um valor entre colchetes, ex.: `[1]`, basta pressionar **Enter** para aceitar esse valor.
- `[S/n]` significa que o padrão é **Sim**: pressione Enter para confirmar ou digite `n` para recusar.
- Se você digitar algo inválido, aparece `Valor inválido. Tente novamente.` e a mesma pergunta volta.
- As senhas **não aparecem** enquanto você digita. Isso é normal.

---

## Perguntas do instalador (instalação nova)

### 1. Menu inicial

```
StreamHub Chat — instalador ...
  Nenhuma instalação encontrada nesta VPS.
    1) Instalação nova
    2) Só verificar pré-requisitos
  Opção [1]:
```

**Pressione Enter** (instalação nova).

Em seguida o instalador mostra a **Verificação de pré-requisitos** (root, Ubuntu, memória, disco,
portas, internet). Não há pergunta aqui. Linhas `[OK]` estão certas; `[AVISO]` não impede a
instalação; se aparecer `[ERRO]`, a instalação para e a linha diz o que corrigir.

Se em vez desse menu aparecer `Instalação existente detectada`, o sistema **já está instalado**:
digite `3` (Diagnóstico) e veja os “Comandos úteis” no final deste guia.

### 2. IP da VPS

```
Configuração da instalação (Enter aceita o valor entre colchetes)
  IP público desta VPS [203.0.113.10]:
```

O instalador já detecta o IP. Confira se é o IP da sua VPS e **pressione Enter**. Se estiver errado,
digite o IP correto (ex.: `203.0.113.10`).

### 3. Modo de acesso

```
  Modo de acesso:
    1) Domínio com HTTPS (recomendado para produção): app.SEUDOMINIO e api.SEUDOMINIO
    2) Somente IP, sem HTTPS (apenas para testes)
  Escolha 1 ou 2 [1]:
```

**Pressione Enter** (opção 1, domínio com HTTPS). A opção 2 é só para testes e pula as perguntas
4 a 7.

### 4. Domínio principal

```
  Domínio principal (ex.: empresa.com.br):
```

Digite o domínio **sem** `https://` e **sem** `app.`. Exemplo: `empresa.com.br`.

### 5. Endereço do painel

```
  Endereço do painel [app.empresa.com.br]:
```

**Pressione Enter.** É o endereço que você vai abrir no navegador.

### 6. Endereço da API

```
  Endereço da API [api.empresa.com.br]:
```

**Pressione Enter.**

### 7. E-mail do certificado HTTPS

```
  E-mail para o certificado HTTPS (Let's Encrypt):
```

Digite um e-mail válido (ex.: `ti@empresa.com.br`). Ele recebe avisos do certificado.

### 8. Evolution API (WhatsApp)

```
  Evolution API (WhatsApp via Evolution, opcional — conexões Baileys funcionam sem ela):
    1) Instalar nesta VPS em Docker (recomendado)
    2) Usar um servidor Evolution externo já existente (informar URL e API key)
    3) Não configurar agora
  Escolha 1, 2 ou 3 [1]:
```

**Pressione Enter** (opção 1). O instalador instala a Evolution nesta VPS e liga ela ao sistema
sozinho. Não é preciso criar chave nem configurar nada na Evolution.

### 9. Nome do Super Admin

```
  Primeiro Super Admin (acesso total à plataforma). A senha não é exibida nem gravada em log.
  Nome:
```

Digite seu nome. Exemplo: `Alex Silva`.

### 10. E-mail do Super Admin

```
  E-mail de login:
```

Digite o e-mail que você vai usar para entrar no painel. Exemplo: `alex@empresa.com.br`.

### 11. Senha do Super Admin

```
  Senha (8+ caracteres, maiúscula, minúscula e número):
  Confirme:
```

Digite a senha, pressione Enter, digite a mesma senha de novo e pressione Enter. Ela precisa ter
pelo menos 8 caracteres, com letra maiúscula, letra minúscula e número. **Guarde essa senha**: ela não
aparece em nenhum lugar depois.

- `Senha fraca: ...` → a senha não atende às regras; digite outra.
- `As senhas não coincidem.` → digite as duas de novo.

### 12. Confirmação

```
Resumo
  Painel:     https://app.empresa.com.br
  API:        https://api.empresa.com.br
  Evolution:  local
  Super Admin: Alex Silva <alex@empresa.com.br>
  Diretório:  /var/www/atendechat
  Confirmar e iniciar a instalação? [S/n]:
```

Confira o resumo e **pressione Enter**. Se algo estiver errado, digite `n` e execute
`sudo bash install.sh` de novo.

### Perguntas que só aparecem em algumas VPS

**13. DNS ainda não aponta para a VPS** (só no modo domínio):

```
  app.empresa.com.br → sem registro   (esperado 203.0.113.10)
  [T]entar de novo, [C]ontinuar sem HTTPS por enquanto, [S]air:
```

- Se você acabou de criar os registros DNS, espere alguns minutos e digite `T`.
- `C` continua a instalação sem HTTPS; depois de acertar o DNS, execute
  `sudo bash install.sh --reconfigurar` e escolha a opção `1`.
- `S` encerra sem alterar nada.

**14. Memória baixa** (VPS com menos de 6 GB de RAM e sem swap):

```
  A VPS tem 3900 MB de RAM e 0 MB de swap. Criar /swapfile de 2 GB (evita falta de memória no build do painel)? [S/n]:
```

**Pressione Enter.**

**15. Firewall** (quando o firewall ainda não está ativo, perto do final):

```
  Ativar o firewall (ufw) liberando apenas SSH (22), HTTP/HTTPS? Confirme que sua conexão SSH usa uma dessas portas. [S/n]:
```

Confira se a porta que você usa no SSH está na lista (normalmente `22`) e **pressione Enter**.

---

## O que o instalador faz sozinho

Depois da confirmação, o instalador mostra o progresso em 12 etapas (`[1/12]` a `[12/12]`). Você não
precisa instalar nada manualmente.

| Etapa | Automática? |
|---|---|
| Validação do DNS | sim (pergunta 13 só se o DNS não estiver certo) |
| Pacotes do sistema (Nginx, PostgreSQL, Redis, Certbot, Git etc.) | sim (pergunta 14 só com pouca memória) |
| Node.js 20 | sim |
| PostgreSQL (banco e senha) | sim |
| Redis (com senha) | sim |
| Configuração do backend e senhas internas | sim |
| Backend: dependências, compilação e banco de dados | sim |
| Primeiro Super Admin | sim (usa as respostas 9 a 11) |
| Painel (frontend): compilação e publicação | sim |
| Serviço do backend e Nginx | sim |
| HTTPS (certificado Let's Encrypt) | sim, se o DNS estiver correto |
| Evolution API (Docker) e ligação com o StreamHub Chat | sim |
| Firewall | sim (pergunta 15 se ainda não estiver ativo) |
| Verificação final | sim |

A instalação leva vários minutos; a etapa do painel (frontend) é a mais demorada. Não feche o terminal.

No final aparece:

```
============================================================
 StreamHub Chat — instalação concluída
============================================================
  Painel:        https://app.empresa.com.br
  API:           https://api.empresa.com.br
  HTTPS:         ativo
  Evolution:     local (webhook: ok)
  Login:         alex@empresa.com.br — senha definida por você
```

Antes disso, a verificação final deve mostrar `[OK] Nenhum problema encontrado.`

Os arquivos `/var/www/atendechat/backend/.env` e `/opt/streamhub/evolution/.env` guardam as senhas
internas do sistema. Faça uma cópia segura deles fora da VPS e **não envie esses arquivos para ninguém**.

---

## Primeiro acesso

### 1. Abrir o painel

No navegador, abra o endereço da linha **Painel** do resumo final, ex.: `https://app.empresa.com.br`.

### 2. Entrar como Super Admin

- **Email**: o e-mail informado na pergunta 10.
- **Senha**: a senha informada na pergunta 11.
- Clique em **Entrar**.

### 3. Confirmar que o painel funciona

Aparece a mensagem “Login efetuado com sucesso!” e a tela **Dashboard da plataforma**, com o menu
**Gestão SaaS** à esquerda.

### 4. Criar o primeiro plano

1. No menu, clique em **Planos** e depois em **Novo plano**.
2. Em **Limites do plano**, preencha:
   - **Nome**: ex.: `Plano Padrão`
   - **Usuários**: ex.: `5`
   - **Conexões**: ex.: `1` (**não deixe 0**: com 0 não é possível conectar o WhatsApp)
   - **Setores**: ex.: `3`
   - **Valor**: ex.: `0`
3. Em **Módulos e funcionalidades**, deixe marcados pelo menos **Conexões WhatsApp** e
   **Conversas / caixa de entrada** (já vêm marcados).
4. Clique em **Salvar**.

### 5. Criar a primeira empresa

1. No menu, clique em **Empresas** e depois em **Nova empresa**.
2. Preencha:
   - **Nome**: nome da empresa.
   - **E-mail principal**: e-mail de quem vai administrar a empresa (diferente do e-mail do Super Admin).
   - **Plano**: o plano criado no passo anterior.
   - **Data de vencimento** e **Recorrência**: conforme a cobrança.
3. Clique em **Criar empresa**.
4. Aparece a janela **Administrador da empresa criado**, com **E-mail do administrador** e
   **Palavra-passe provisória**. Anote a senha provisória e clique em **Ok**.

> Se o e-mail (SMTP) já estiver configurado, essa janela não aparece: o administrador recebe um
> convite por e-mail.

### 6. Entrar na empresa

1. No canto superior direito, clique no ícone da conta e em **Sair**.
2. Entre com o **E-mail principal** da empresa e a **senha provisória**.
3. Se o sistema pedir, troque a senha provisória por uma nova.

> Alternativa para o Super Admin: em **Empresas**, clique no ícone **Acessar empresa (modo suporte)**.
> Para voltar, use **Voltar ao Super Admin**.

### 7. Criar a conexão WhatsApp (Evolution)

1. No menu da empresa, clique em **Configurações**. A aba **Conexões** abre com a lista de WhatsApp.
2. Clique em **Adicionar WhatsApp**.
3. Em **Nome**, digite um nome, ex.: `WhatsApp Principal`.
4. Em **Tipo de conexão**, escolha **WhatsApp Evolution** (o padrão é “WhatsApp padrão”; troque).
   Depois de criada, a conexão não muda de tipo.
5. Clique em **Adicionar**. Aparece “WhatsApp salvo com sucesso.”

### 8. Gerar e ler o QR Code

1. Na lista, aguarde alguns segundos até a coluna **Status** mostrar **Aguardando QR**.
2. Na coluna **Sessão**, clique em **QR CODE**.
3. No celular: abra o WhatsApp → **Mais opções (⋮)** (Android) ou **Configurações** (iPhone) →
   **Dispositivos conectados** → **Conectar dispositivo**.
4. Aponte a câmera para o QR Code da tela.
5. Aparece “Conectado! Você já pode fechar esta janela.” e o status muda para **Conectado**.

Se o QR Code expirar, clique em **Gerar novo QR Code**.

### 9. Enviar uma mensagem de teste

1. De **outro** celular, envie uma mensagem para o número que acabou de ser conectado.
2. No painel, clique em **Atendimento** → **Atendimentos**.
3. Na aba **ABERTAS**, clique em **AGUARDANDO**. A conversa aparece ali.
4. Clique em **Aceitar**.
5. No campo **Digite uma mensagem**, escreva uma resposta e pressione Enter.
6. A resposta chega no celular. A instalação está concluída.

---

## Comandos úteis

Execute sempre dentro da pasta: `cd /var/www/atendechat`.

| Para | Comando | O que faz |
|---|---|---|
| Verificar a instalação | `sudo bash install.sh --verificar` | confere os pré-requisitos da VPS (não altera nada) |
| Diagnóstico | `sudo bash install.sh --diagnostico` | testa backend, painel, banco, Redis, HTTPS e Evolution (não altera nada) |
| Atualizar o sistema | `git pull --ff-only && sudo bash install.sh --atualizar` | baixa a versão nova e aplica com backup do banco |
| Reiniciar o backend | `sudo systemctl restart atendechat-backend` | reinicia a API do sistema |
| Logs do backend | `sudo journalctl -u atendechat-backend -n 100 --no-pager` | mostra as últimas 100 linhas do backend |
| Logs da Evolution | `sudo docker logs evolution-api --tail 100` | mostra as últimas 100 linhas da Evolution |
| Backup | `sudo bash scripts/streamhub-backup.sh` | cria backup completo em `/var/backups/streamhub/` |
| Redefinir a senha do Super Admin | `sudo bash install.sh --redefinir-senha` | pede o e-mail do Super Admin e a nova senha |

O backup contém senhas e dados de clientes: copie a pasta para fora da VPS em local seguro.

---

## Erros comuns

### O instalador parou com `[ERRO] Falha na etapa ...`

Nada foi apagado. Leia a linha do erro, corrija a causa (internet, disco cheio, DNS) e execute de novo:

```bash
cd /var/www/atendechat
sudo bash install.sh
```

Ele pergunta `Retomar a instalação? [S/n]`: pressione Enter. As respostas e senhas já criadas são
mantidas e o Super Admin não é criado de novo. O log completo fica em `/var/log/streamhub/`.

### O domínio ainda não aponta para a VPS

Confira:

```bash
dig +short app.empresa.com.br
dig +short api.empresa.com.br
```

Os dois precisam mostrar o IP da VPS. Se você continuou sem HTTPS (`C` na pergunta 13), depois de
corrigir o DNS execute `sudo bash install.sh --reconfigurar` e escolha a opção `1`.

### Falha ao emitir o HTTPS

Aparece `O certbot não emitiu o certificado`. Causas comuns: DNS ainda propagando, porta 80 bloqueada
no painel do provedor da VPS, proxy/CDN (ex.: nuvem laranja da Cloudflare) ligado. Corrija e execute
`sudo bash install.sh --reconfigurar`, opção `1`.

### O backend não iniciou

```bash
sudo bash install.sh --diagnostico
sudo journalctl -u atendechat-backend -n 100 --no-pager
```

Se o log mostrar `Configuração JWT inválida`, execute `sudo bash install.sh --reconfigurar` e escolha
a opção `3`. Depois de corrigir outra causa, reinicie com `sudo systemctl restart atendechat-backend`.

### A Evolution não iniciou

```bash
cd /opt/streamhub/evolution && sudo docker compose ps
sudo docker logs evolution-api --tail 100
```

Os três contêineres (`evolution-api`, `evolution-postgres`, `evolution-redis`) devem estar `Up`. Para
reaplicar a configuração da Evolution: `sudo bash install.sh --reconfigurar`, opção `2`.

### O QR Code não apareceu

1. Execute `sudo bash install.sh --diagnostico` e confira as linhas da Evolution.
2. Confirme no plano que **Conexões** é 1 ou mais (com 0 aparece
   “Número máximo de conexões já alcançado”).
3. Confirme que o tipo da conexão é **WhatsApp Evolution**.
4. Se o resumo do instalador mostrou `webhook: sem acesso`, normalmente o HTTPS ainda não foi
   emitido: resolva o HTTPS (acima) e, na lista de conexões, clique em **Novo QR CODE**.
5. Veja `sudo docker logs evolution-api --tail 100`.

---

Manual técnico completo (arquitetura, restauração de backup, integrações):
[`MANUAL_INSTALACAO.md`](MANUAL_INSTALACAO.md).
