# StreamHub Chat — site institucional

Landing page pública de **streamhubchat.com.br**. Projeto independente do app SaaS
(`frontend/` e `backend/` não são importados nem alterados). O login dos clientes continua em
**https://app.streamhubchat.com.br**.

## Stack e decisões

- **Astro 5 (saída estática)**: HTML pré-renderizado, zero JavaScript por padrão, SEO nativo e
  otimização de imagens no build (WebP responsivo via `astro:assets`/sharp). Nenhum servidor Node
  é necessário em produção — basta servir `dist/`.
- **Sem framework de UI**: as animações são CSS + ~3 kB de TypeScript (`src/scripts/timeline.ts`).
  Não há React, GSAP ou similares no bundle.
- **Fontes self-hosted** (`@fontsource-variable/inter` e `montserrat`), sem chamadas ao Google Fonts.
- **Identidade**: logotipo oficial (`frontend/src/assets/logo.png`); a variante para fundo escuro e
  os ícones são gerados por `scripts/build-brand-assets.py`, com a mesma lógica da variante clara já
  usada pela marca (texto branco, caixa "HUB" invertida, verde "CHAT" preservado).

## Comandos

```bash
cd site
npm install
npm run dev        # http://localhost:4321
npm run typecheck  # astro check
npm run lint       # eslint
npm run build      # gera dist/
npm run preview    # serve dist/ localmente
npm run check      # typecheck + lint + build
```

Node 20+ (testado com Node 24).

## Configuração (`.env`, opcional)

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PUBLIC_APP_URL` | `https://app.streamhubchat.com.br` | "Entrar na plataforma", "Solicitar acesso" (`/signup`) e links jurídicos |
| `PUBLIC_WHATSAPP_NUMBER` | `5519997913388` | Todos os CTAs comerciais (`wa.me` com mensagem pré-preenchida) |

O número de WhatsApp é o mesmo do botão de suporte da tela de login: campo
`publicWhatsAppNumber` do Branding da plataforma (Gestão SaaS → Branding), servido por
`GET /system-settings/branding`. Se for alterado no Branding, atualize a variável e gere novo build.
As mensagens por intenção (plano, demonstração, especialista) ficam em `src/config/site.ts`.

## Estrutura

```
src/
  config/site.ts        URLs, WhatsApp, preço inicial, dados legais públicos
  data/faq.ts           Perguntas frequentes (também usadas no JSON-LD)
  layouts/Base.astro    <head>: SEO, Open Graph, canonical, JSON-LD, fontes
  components/           Header, Hero (console animado), Tour (capturas reais),
                        Features, Commercial (funil animado), Journey, Plans, Faq, Footer
  scripts/timeline.ts   Motor de animação por etapas + revelação ao rolar
  assets/screens/       Capturas do ambiente demonstrativo "Aurora Studio" (dados fictícios)
public/                 favicon, ícones, og-image.png, robots.txt, sitemap.xml, manifest
scripts/                Geração de ícones/logo e modelo da imagem Open Graph
deploy/                 Exemplo de Nginx para o domínio principal (não aplicado)
```

## Regras de conteúdo

- Apenas recursos voltados às empresas clientes, conferidos no código. Nada do Super Admin
  (Gestão SaaS, Console Técnico/AgentOS, informativos, monitoramento etc.).
- Recursos dependentes de plano ou de serviço externo aparecem com essa ressalva: CRM, Estoque e
  Vendas, Instagram Direct, Agente de IA (exige chave OpenAI/Gemini da empresa), Campanhas, API.
- Não anunciar: WhatsApp Cloud API oficial, Messenger, Telegram, webchat (não existem no produto);
  Gestão de tarefas (fica só no navegador do usuário); teste grátis (o `/signup` é uma solicitação
  analisada pela equipe).
- Preço: apenas "a partir de R$ 99,90/mês", sem afirmar o que está incluído nesse valor.
- Demonstrações usam somente dados fictícios.

## Imagem de compartilhamento

`public/og-image.png` (1200×630) é uma captura de `scripts/og/og.html` renderizada em um navegador
headless na resolução 1200×630. Para regenerar, abra o arquivo no Chrome com essa viewport e salve
a captura no mesmo caminho.

## Publicação (etapa futura, sujeita a aprovação)

1. **DNS**: registros `A`/`AAAA` de `streamhubchat.com.br` e `www` apontando para o servidor
   Em 02/11/2026: a raiz já resolve para 216.106.178.90 (mesmo IP do app), sem HTTPS respondendo;
   `www` não tem registro — criar `A` (ou `CNAME` para a raiz).
2. **Certificado**: `certbot certonly --nginx -d streamhubchat.com.br -d www.streamhubchat.com.br`.
3. **Build**: `cd site && npm ci && npm run check`.
4. **Upload**: copiar `site/dist/` para `/var/www/streamhubchat-site/releases/<data>` e apontar o
   link `current` para ela (rollback = voltar o link).
5. **Nginx**: adaptar `deploy/nginx.example.conf`, `nginx -t`, `systemctl reload nginx`.
6. **Validação**: HTTPS, redirect `www` → raiz, `/robots.txt`, `/sitemap.xml`, CTAs do WhatsApp,
   "Entrar na plataforma" e ausência de impacto em `app.` e `api.`.
7. **Search Console**: cadastrar a propriedade e enviar o sitemap.
