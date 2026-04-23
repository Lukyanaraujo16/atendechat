# CoreFlow

Plataforma de atendimento via WhatsApp (multiempresa). Nome interno técnico **CoreFlow**; o nome comercial exibido aos utilizadores é configurável em **Plataforma → Branding** (`systemName`).

## 🚀 Começando

O repositório possui 3 pastas importantes:
- backend
- frontend
- instalador

O backend é feito em Express e possui toda a estrutura organizada dentro dessa pasta para que seja aplicado no ambiente do cliente. A pasta de frontend contém todo o framework do React.js que gerencia toda a interação com o usuário do sistema.

A pasta de instalador dentro dessa repositório é uma cópia do instalador usado para que os clientes de sistemas possam fazer o clone dentro da pasta home de seus servidores e seguirem com a instalação automática de todas as dependências do projeto

Link para o repositório do instalador atualizado:
- [Instalador](https://github.com/atendechat-org/instalador)

Consulte **[Implantação](#-implanta%C3%A7%C3%A3o)** para saber como implantar o projeto.

### 📋 Pré-requisitos

```
- Node.js v20.x
- Postgres (release)
- Npm ( latest )
- Docker (bionic stable)
- Redis
```

### 🔧 Instalação

Para iniciar a instalação do projeto é necessário ter todas as ferramentas de pré-requisitos disponíveis para uso

#### Redis
```
- su - root
- docker run --name redis-${instancia_add} -p ${redis_port}:6379 --restart always --detach redis redis-server --requirepass ${root_password}
```

#### Postgres
```
- sudo su - postgres
- createdb ${instancia_add};
- psql
- CREATE USER ${instancia_add} SUPERUSER INHERIT CREATEDB CREATEROLE;
- ALTER USER ${instancia_add} PASSWORD '${root_password}';
```

#### .env backend
```
NODE_ENV=
BACKEND_URL=${backend_url}
FRONTEND_URL=${frontend_url}
PROXY_PORT=443
PORT=${backend_port}

DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=${instancia_add}
DB_PASS=${mysql_root_password}
DB_NAME=${instancia_add}

JWT_SECRET=${jwt_secret}
JWT_REFRESH_SECRET=${jwt_refresh_secret}

REDIS_URI=redis://:${mysql_root_password}@127.0.0.1:${redis_port}
REDIS_OPT_LIMITER_MAX=1
REGIS_OPT_LIMITER_DURATION=3000

USER_LIMIT=${max_user}
CONNECTIONS_LIMIT=${max_whats}
CLOSED_SEND_BY_ME=true

GERENCIANET_SANDBOX=false
GERENCIANET_CLIENT_ID=Client_Id_Gerencianet
GERENCIANET_CLIENT_SECRET=Client_Secret_Gerencianet
GERENCIANET_PIX_CERT=certificado-Gerencianet
GERENCIANET_PIX_KEY=chave pix gerencianet

# EMAIL
 MAIL_HOST="smtp.gmail.com"
 MAIL_USER="seu@gmail.com"
 MAIL_PASS="SuaSenha"
 MAIL_FROM="seu@gmail.com"
 MAIL_PORT="465"

```

#### .env frontend
```
REACT_APP_BACKEND_URL=${backend_url}
REACT_APP_HOURS_CLOSE_TICKETS_AUTO = 24
```

#### Instalando dependências
```
cd backend/
npm install --force
cd frontend/
npm install --force
```

Opcional (remove o aviso *caniuse-lite is outdated* no build do frontend):

```
cd frontend/
npm run browserslist:update
```

O `npm run build` do frontend define `CI=false` para que **avisos de ESLint** não interrompam o build em pipelines que exportam `CI=true`; o bundle continua a ser gerado normalmente. Corrija os avisos no código quando possível.

### Rodando localmente
```
cd backend/
npm run watch
npm start

cd frontend/
npm start
```

## ⚙️ Executando os testes

//

### 🔩 Analise os testes de ponta a ponta

//

## 📦 Implantação em produção

Para correta implantação é necessário realizar uma atualização do código fonte da aplicação e criar novamente os arquivos da pasta dist/

Atenção: é necessário acessar utilizando o usuário de deploy

```
su - deploy
```

```
cd /home/deploy/${empresa_atualizar}
pm2 stop ${empresa_atualizar}-frontend
git pull
cd /home/deploy/${empresa_atualizar}/frontend
npm install
rm -rf build
npm run build
pm2 start ${empresa_atualizar}-frontend
pm2 save
```

```
cd /home/deploy/${empresa_atualizar}
pm2 stop ${empresa_atualizar}-backend
git pull
cd /home/deploy/${empresa_atualizar}/backend
npm install
npm update -f
npm install @types/fs-extra
npm run build
npx sequelize db:migrate
npx sequelize db:migrate
npx sequelize db:seed
pm2 start ${empresa_atualizar}-backend
pm2 save 
```

## 🛠️ Construído com


* [Express](https://expressjs.com/pt-br/) - O framework backend usado
* [React](https://react.dev/) - Framework frontend usado
* [NPM](https://www.npmjs.com/) - Gerenciador de dependências

## 🖇️ Colaborando

//

## 📌 Versão

Versão 1.0.0

## 📄 Licença

Este projeto está sob a licença

CoreFlow — base de código interna. Nome e marca visível ao cliente via branding.
