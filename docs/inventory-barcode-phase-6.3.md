# Fase 6.3 — integridade e performance do barcode

## Contrato

`InventoryProducts.barcode` continua `VARCHAR(64)` nullable, identificador do catálogo.
Nos saves pelo CRUD: `String(value).trim()`, vazio → `null`, máximo de 64 caracteres,
sem truncar, converter para número, validar EAN ou remover conteúdo interno.
Mantém caixa, acentos, zeros à esquerda e representações Unicode distintas
(não aplica NFC/NFD). `ABC`, `abc`, `ÁBC` e `ABC` com acento combinante são identidades distintas.
A busca humana parcial continua ignorando caixa/acentos conforme o contrato anterior.

A identidade é `(companyId, barcode)`, inclusive produtos inativos. Múltiplos
NULL são permitidos. A edição exclui somente o próprio ID da checagem, dentro
do tenant da sessão. SKU mantém suas regras anteriores e não ganha UNIQUE.
IMEI/série/MAC, estoque, pagamento, comissão, recibo e conclusão não mudam.

A checagem prévia retorna `ERR_INVENTORY_PRODUCT_BARCODE_DUPLICATE` (400).
A mesma resposta é usada para violação do índice na gravação, fechando a corrida
entre duas checagens simultâneas. Outras constraints/erros não são confundidos
com barcode. PT: “Este código de barras já está sendo usado por outro produto.”
Há traduções EN/ES. O formulário mantém modal e valores em erro, permite correção
e recebe o helper “EAN, UPC ou código interno.”

## Índice e compatibilidade

Migration: `20261005120000-unique-inventory-product-barcode.ts`.
Índice único: `InventoryProducts_companyId_barcode_key`.
Não recria a coluna nem adiciona índice redundante. O índice composto serve à
igualdade por tenant e à integridade. Não acelera o LIKE `%termo%` parcial.

- PostgreSQL (README/.env.example/Docker, driver `pg`): índice
  `("companyId", "barcode" COLLATE "C")`; a consulta exata usa a mesma expressão.
  A collation original da coluna não é alterada.
- MySQL (fallback da configuração, driver `mysql2`): índice `(companyId, barcode)`;
  exige coluna `VARCHAR(64) NULL COLLATE utf8mb4_bin` e tenant NOT NULL.
  `define.collate` na configuração não prova a collation existente. A migration
  consulta o esquema real e **falha** se divergir. Não converte a coluna nem escolhe
  uma collation implicitamente. Divergência exige avaliação manual em tarefa própria.
- MariaDB: mesmo SQL da ramificação MySQL, utilizável via protocolo/dialect `mysql`.
  O driver Sequelize `mariadb` não está instalado; esta fase não adiciona dependências.
  A ramificação `mariadb` é coberta por mocks, não homologada em servidor real.
- Outros dialetos são recusados explicitamente.

`utf8mb4_bin` usa PAD SPACE: espaços finais podem ser equivalentes no MySQL/MariaDB,
enquanto PostgreSQL C os distingue. O contrato dos saves elimina essa divergência
por trim; a migration **recusa qualquer legado não normalizado**. Escritas SQL diretas
ou integrações que contornem o CRUD devem respeitar o mesmo contrato. Não há trigger
nem CHECK impondo o trim no banco. A unicidade é garantida pelo índice para os valores
persistidos; normalização continua responsabilidade do caminho de gravação.

Um índice genérico declarado via `sync` não substitui esta migration: a expressão
PostgreSQL e a validação da collation MySQL precisam ser preservadas.

Referências: [PostgreSQL UNIQUE](https://www.postgresql.org/docs/18/indexes-unique.html),
[índices e collations](https://www.postgresql.org/docs/17/indexes-collations.html),
[MySQL collation binária](https://dev.mysql.com/doc/refman/8.0/en/charset-unicode-sets.html),
[MariaDB índices/NULL](https://mariadb.com/docs/server/mariadb-quickstart-guides/mariadb-indexes-guide).

## Diagnóstico e segurança dos legados

Nesta sessão não havia `.env`/`.env.test` nem variáveis DB configuradas para um
banco de desenvolvimento/teste. **Dados reais não foram auditados**: quantidade
de produtos com barcode, grupos duplicados e empresas/IDs reais são desconhecidos.
Não interpretar resultados de mocks como “zero duplicados”. Nenhuma migration foi aplicada.

O utilitário permanente reutiliza o preflight da migration; não é script descartável:

```sh
cd backend
npm run build
node dist/scripts/diagnose-inventory-barcodes.js
```

Usar configuração de conexão explícita e credencial somente leitura. O script
carrega a configuração padrão (`.env`, ou `.env.test` quando NODE_ENV=test), sem
inicializar models/servidor, executar migrations ou alterar registros. Faz somente
SELECT e consulta de metadados. Falha de conexão/permissões indica diagnóstico
incompleto; nunca equivale a dados limpos.

O relatório contém:

- `productsWithBarcode`: produtos com barcode não NULL, inclusive vazios e inativos;
- `duplicateGroups`: grupos de valores exatamente repetidos por empresa;
- `duplicateSamples`: até 20 pares companyId/id de produtos duplicados;
- `nonNormalizedProducts`: vazios ou valores alterados por `trim()` JavaScript;
- `nonNormalizedSamples`: até 20 pares companyId/id desses produtos.

Não imprime os códigos. A paginação de 1000 registros não carrega todo catálogo
na memória e inclui IDs legados zero/negativos. Os agrupamentos binários não
confundem diferenças de caixa/acentos com duplicidade. Pares como `X` e ` X`
são apontados como problema de normalização; não são somados como duplicidade
exata. Após correção manual, refazer diagnóstico para detectar eventuais colisões.

Migration recusa duplicados e não normalizados antes do DDL. Não apaga, renomeia,
sobrescreve, converte para NULL ou escolhe vencedor. Colisões durante CREATE UNIQUE
INDEX também fazem a migration falhar com orientação compreensível. Outros erros
DDL propagam, sem serem ignorados. Não usar `IF NOT EXISTS` para aceitar índice
preexistente de definição desconhecida.

O diagnóstico é uma sequência de leituras, sem snapshot/lock. Suspender gravações
de produtos durante a aplicação para que o preflight permaneça válido, especialmente
com instâncias antigas/importações. DDL pode bloquear gravações; agendar janela.
O `down` remove **somente** o índice nomeado e não modifica coluna/collation/dados.
Após down, a checagem da aplicação deixa de ter garantia contra concorrência.

## Busca e validação

Busca mantém endpoint, `active=true`, tenant, `limit=20`, barcode exato antes de
SKU exato e depois parciais, debounce, Enter, cancelamento e dropdown limitado.
Enter seleciona um produto exato; “Adicionar item” permanece obrigatório.
Não foi implementada automação de scanner (Fase 6.4).

Testes novos cobrem CRUD, normalização, tenant, inativo, edição própria, erro de
constraint nos dois saves, concorrência equivalente com constraint simulada,
SQL gerado por dialeto, filtros, preflight, falhas DDL e down. Frontend cobre
cadastro sem código, helper, traduções e preservação/correção após erro em create/edit.
Regressões existentes de InventoryService/InventorySales continuam obrigatórias.

Executar backend por Jest diretamente: **npm test tem pretest/posttest que aplicam
e desfazem migrations**. Exemplo seguro para as suítes isoladas:

```sh
cd backend
NODE_ENV=test ./node_modules/.bin/jest --runInBand --coverage=false src/services/InventoryService src/database/__tests__/inventoryBarcodeMigration.spec.ts
```

Mocks e SQL gerado não provam execução do índice, EXPLAIN ou concorrência em
servidor real. Não houve homologação real MySQL/MariaDB/PostgreSQL nesta sessão.

## Checklist para homologação e futura publicação

1. Confirmar backup, versão/dialeto e configuração do banco alvo. Este trabalho não autoriza deploy automático.
2. Rodar diagnóstico somente leitura; registrar contagens e IDs. Corrigir legados manualmente com decisão do responsável, sem cleanup automático.
3. Confirmar schema/collation compatíveis; se incompatíveis, interromper e planejar ajuste separado.
4. Em banco isolado, aplicar migration, testar múltiplos NULL, empresas diferentes, inativo, caixa/acentos, zeros e duas gravações reais simultâneas.
5. Verificar índice e EXPLAIN da busca exata por companyId/barcode; confirmar uso do índice e plano com os dados reais.
6. Testar down/up no banco isolado, verificando dados inalterados e remoção exclusiva do índice.
7. Homologar UI: duplicado mantém modal/dados; corrigir permite salvar; busca vazia limitada; Enter seleciona sem adicionar; busca humana sem caixa/acento.
8. Na janela aprovada, suspender gravações de produtos, repetir diagnóstico e aplicar somente a migration prevista antes de habilitar a nova versão.
9. Se a migration falhar, manter gravações suspensas até avaliação; não marcar migration como aplicada nem iniciar cleanup.
10. Publicação/reinício e reabertura de gravações ficam para procedimento autorizado separado. Nenhum push/deploy/reinício foi realizado nesta fase.

## Evidência desta implementação

- Git inicial: `main`, HEAD/origin/main `7add2bb82de84d56a18f55d146d71db4c6046362`, ahead/behind 0/0.
- Auditoria: três subagentes somente leitura (banco/migration; CRUD/formulário; busca/venda) em paralelo; integrador auditou dados/ambiente.
- Revisão independente: detectou cursor inicial que excluía IDs <= 0; corrigido e coberto por testes. Nova revisão confirmou correção e não encontrou defeitos adicionais.
- Backend: 13 suítes, 132 testes aprovados (InventoryService e migration).
- Frontend: 15 suítes, 156 testes aprovados em InventorySales; após dois casos adicionais, suíte de busca reexecutada com 18 testes aprovados (158 casos distintos cobertos no conjunto final).
- Build backend/TypeScript: aprovado com a configuração local existente; `backend/tsconfig.json` não alterado por esta fase.
- Build frontend: aprovado, com avisos de lint existentes fora dos arquivos alterados.
- ESLint dos arquivos alterados: zero erros; backend com seis avisos `no-explicit-any` (cinco preexistentes na listagem e um no teste novo); frontend sem avisos.
- `git diff --check`: aprovado antes do commit.
- Preservados os leftovers `.DS_Store`, `frontend/.DS_Store`, `frontend/src/.DS_Store`, `backend/.DS_Store`, `backend/src/.DS_Store`, `docs/.DS_Store` e `backend/tsconfig.json`.
- Sem push, deploy, reinício de serviços ou aplicação de migration. Garantia final de banco só estará ativa após homologação e aplicação da migration no ambiente alvo.
