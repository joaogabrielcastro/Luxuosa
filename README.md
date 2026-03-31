# Luxuosa

SaaS multi-tenant para gestão de loja de roupa: catálogo, vendas, estoque, relatórios e dashboard. Uma única base PostgreSQL com isolamento lógico por `tenant_id`; autenticação via JWT.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Backend | Node.js 20, Express, Prisma, Zod |
| Frontend | React 18, Vite, TailwindCSS, React Router |
| Banco | PostgreSQL 16 |
| Fiscal (integração) | [Nuvem Fiscal](https://www.nuvemfiscal.com.br/) (OAuth2 + API REST) |

## O que já existe no produto

- **Autenticação:** login (`POST /auth/logout` e `GET /auth/me` requerem JWT). Email é único **por loja**: `@@unique([tenantId, email])` no Prisma. Se o mesmo email existir em mais de um tenant, o login exige **`tenantCnpj`** (14 dígitos) no body para escolher a loja.
- **Catálogo:** categorias, produtos, variações (tamanho/cor/estoque), alerta de estoque baixo (produto vs soma das variações).
- **Vendas:** criar, listar, editar, cancelar; baixa de estoque e movimentação `EXIT`; desconto com política por tipo de usuário (admin vs atendente); UI por categoria e produto; **sem cadastro de cliente na interface** — a NFC-e sai como **consumidor final**.
- **Movimentações de estoque manuais:** entrada e saída sem venda (`POST /stock-movements`), com histórico (`GET /stock-movements`). Saída não pode ultrapassar o estoque da variação.
- **Relatórios (API):** vendas pagas por intervalo de datas (`GET /reports/sales?from=&to=`) e lista de produtos abaixo do mínimo (`GET /reports/low-stock`). O **dashboard admin** continua com visão mais rica (só admin).
- **Clientes (API):** `GET|POST|PUT|DELETE /customers` para integrações ou dados legados; não há tela dedicada no app.
- **Dashboard (admin):** métricas agregadas (receita, ticket, vendas por período/atendente, lucro por produto, estoque consolidado, produtos sem venda recente, etc.).
- **NFC-e (Nuvem Fiscal):** após registrar a venda, o backend enfileira emissão **modelo 65** em fila persistida no banco (`NfceIssueJob`) com serialização por `tenantId`; consulta SEFAZ e grava `Invoice`. **PDF (DANFE):** `GET /invoices/sale/:saleId/pdf`. Reemissão/forçar emissão: `POST /invoices/issue/:saleId` (qualquer usuário autenticado da loja). Status do job por venda: `GET /invoices/sale/:saleId/job`. Teste de conexão OAuth: `GET /invoices/connection-test` (só admin). OAuth com scope `empresa nfe nfce`. Simples Nacional (CSOSN 102).

## O que ainda é esboço ou não existe

- **NF-e na UI** e refinamentos fiscais avançados (outros CST/CFOP, download automático de XML em massa).
- **Gestão de usuários** do tenant (criar atendentes), **onboarding** de novos tenants.
- **Fila externa dedicada** (Redis/Bull) para NFC-e em cenários de alto volume/múltiplas instâncias (atualmente já há persistência no Postgres via `NfceIssueJob`).
- **Testes automatizados** em volume.

## Estrutura do repositório

```txt
Luxuosa/
  package.json      # scripts prisma:* delegam para backend/
  backend/
    prisma/
      schema.prisma
      seed.js
      migrations/
    scripts/
      test-nuvemfiscal.mjs
    src/
      app.js
      server.js
      jobs/
        enqueueNfceIssue.js   # fila in-memory por tenant para NFC-e pós-venda
      config/
      middlewares/
      modules/          # auth, customers, categories, products, productVariations,
      #                 # dashboard, sales, invoices, stockMovements, reports
      shared/
        nuvemFiscal/    # OAuth e API Nuvem Fiscal
      utils/
    .env.example
  frontend/
    src/
      app/
      features/         # auth, dashboard, catalog, sales, stock, reports
      shared/
  docker-compose.yml
  ARCHITECTURE.md
```

## Variáveis de ambiente (backend)

Copie `backend/.env.example` para `backend/.env`. Principais chaves:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL |
| `JWT_SECRET` | Obrigatório; segredo de assinatura do JWT |
| `JWT_EXPIRES_IN` | Ex.: `1d` |
| `NUVEM_FISCAL_CLIENT_ID` | Credencial OAuth (Console Nuvem Fiscal) |
| `NUVEM_FISCAL_CLIENT_SECRET` | Não versionar |
| `NUVEM_FISCAL_API_BASE` | Sandbox: `https://api.sandbox.nuvemfiscal.com.br` |
| `NUVEM_FISCAL_OAUTH_SCOPE` | Padrão: `empresa nfe nfce` |
| `NUVEM_FISCAL_AMBIENTE` | `homologacao` ou `producao` (igual à empresa no console Nuvem) |
| `NUVEM_FISCAL_EMITENTE_CNPJ` | Opcional; 14 dígitos. Se vazio, usa `Tenant.cnpj` |
| `NUVEM_FISCAL_RESP_TEC_CNPJ` | CNPJ do responsável técnico (infRespTec), quando exigido pela SEFAZ |
| `NUVEM_FISCAL_RESP_TEC_CONTATO` | Nome do contato técnico |
| `NUVEM_FISCAL_RESP_TEC_EMAIL` | Email do responsável técnico |
| `NUVEM_FISCAL_RESP_TEC_FONE` | Telefone (somente dígitos) do responsável técnico |

No fluxo com Docker deste repositório, o `backend` lê essas variáveis via `env_file` em `docker-compose.yml` (arquivo `/.env.compose`).

## API REST

Prefixo global: **`/api/v1`**.

### Implementado

| Método e caminho | Notas |
|------------------|--------|
| `GET /health` | Saúde da API |
| `POST /auth/login` | Body: `email`, `password`, opcional `tenantCnpj` (14 dígitos se vários tenants com o mesmo email) |
| `POST /auth/logout` | Requer JWT |
| `GET /auth/me` | Requer JWT |
| `GET\|POST /customers` | |
| `GET\|PUT\|DELETE /customers/:id` | |
| `GET\|POST /categories` | |
| `GET\|PUT\|DELETE /categories/:id` | |
| `GET\|POST /products` | `GET` aceita `take`, `skip`, `q`, `categoryId`, `brandId` |
| `GET /products/low-stock` | |
| `GET\|PUT\|DELETE /products/:id` | |
| `GET\|POST /product-variations` | `GET` aceita `take`, `skip`, `q`, `categoryId`, `brandId`, `productId` |
| `GET\|PUT\|DELETE /product-variations/:id` | |
| `GET /dashboard/admin` | Só admin |
| `GET\|POST /sales` | `GET` aceita `take`, `skip`, `paymentMethod`, `nfce`, `q`, `mode` (`summary`/`full`) |
| `GET /sales/summary` | Lista enxuta para telas de operação (mesmos filtros de `GET /sales`) |
| `GET /sales/:id` | Detalhe completo da venda |
| `PUT /sales/:id` | |
| `POST /sales/:id/cancel` | |
| `GET /stock-movements` | Lista movimentações; aceita `take` e `skip` |
| `POST /stock-movements` | Body: `productVariationId`, `type` (`ENTRY` \| `EXIT`), `quantity` |
| `GET /reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD` | Vendas pagas no intervalo (totais e por dia) |
| `GET /reports/low-stock` | Produtos com estoque total ≤ mínimo cadastrado |
| `GET /invoices/connection-test` | Só admin; testa OAuth + `GET /empresas` na Nuvem Fiscal |
| `POST /invoices/issue/:saleId` | Reemite/força NFC-e (venda paga); JWT da loja |
| `GET /invoices/sale/:saleId/pdf` | PDF (DANFE) da NFC-e autorizada |
| `GET /invoices/sale/:saleId/job` | Status da fila de emissão NFC-e para a venda |

## Frontend (rotas)

| Rota | Página |
|------|--------|
| `/login` | Login (campo opcional CNPJ da loja se necessário) |
| `/` | Dashboard admin |
| `/catalog/categories` | Categorias |
| `/catalog/products` | Produtos |
| `/catalog/variations` | Variações |
| `/vendas` | Vendas + NFC-e (lista com atualização automática enquanto pendente, filtros, PDF, reemissão) |
| `/sales` | Redireciona para `/vendas` |
| `/estoque/movimentos` | Movimentações de estoque manuais |
| `/stock` | Redireciona para `/estoque/movimentos` |
| `/relatorios` | Relatórios mínimos (vendas por período, estoque baixo) |
| `/reports` | Redireciona para `/relatorios` |

## NFC-e e Nuvem Fiscal

1. Crie credenciais no [Console](https://console.nuvemfiscal.com.br/) (recomenda-se **Sandbox** primeiro).
2. Preencha `NUVEM_FISCAL_*` no `.env` conforme `backend/.env.example` (**scope** `empresa nfe nfce`).
3. Teste sem subir o servidor: na pasta `backend`, `npm run test:nuvemfiscal` (OAuth + `GET /empresas`).
4. Com API rodando e JWT de **admin**: `GET /api/v1/invoices/connection-test`.
5. **Venda de teste:** no frontend (**Vendas**), finalize uma venda; a NFC-e é processada na fila interna. A lista pode atualizar sozinha enquanto a nota estiver pendente; use **Baixar PDF** se autorizada, **Tentar novamente** / **Emitir agora** se necessário.

### Troubleshooting rápido (NFC-e)

- **`Nao informado o grupo de informacoes do responsavel tecnico`**: preencha `NUVEM_FISCAL_RESP_TEC_*`.
- **`IE do emitente nao vinculada ao CNPJ`**: confira IE/CNPJ da empresa no Console Nuvem/SEFAZ.
- **`Ja existe NFC-e emitida` + sem PDF**: o backend já reconcilia estado local vs Nuvem e libera reemissão quando a autorização remota não for 100/150.
- **`Nuvem Fiscal retornou 404 ao baixar PDF`**: pode ser atraso de disponibilização; o backend já faz retry e valida autorização antes de baixar.

Documentação oficial: [Autenticação](https://dev.nuvemfiscal.com.br/docs/autenticacao).

**NFC-e automática:** ao criar uma venda (`POST /sales`), o backend enfileira emissão na Nuvem Fiscal. No fluxo atual do app, a venda **não** vincula cliente (`customerId` nulo), então a nota é **CONSUMIDOR FINAL**. Se `customerId` for enviado pela API e o cliente tiver dados fiscais completos, o destinatário pode usar CPF/CNPJ do cadastro. **PDF:** `GET /api/v1/invoices/sale/:saleId/pdf` (JWT). Produtos: `ncm`, `cfop`, `icmsOrig`, `icmsCsosn` (padrões: `61091000`, `5102`, `0`, `102`). CNPJ emitente: `Tenant.cnpj` ou `NUVEM_FISCAL_EMITENTE_CNPJ`; certificado e ambiente na Nuvem alinhados a `NUVEM_FISCAL_AMBIENTE`. OAuth **scope** `empresa nfe nfce`.

Nunca commite `Client Secret`. Se exposto, revogue e gere novas credenciais.

## Credenciais demo (seed)

Após `npm run prisma:seed` no backend (com banco aplicado):

- Email: `admin@luxuosa.com`
- Senha: `123456`

## Rodar com Docker

Na raiz do projeto:

```bash
docker compose up --build
```

| Serviço | URL / porta |
|---------|-------------|
| Frontend | http://localhost:5180 |
| Backend | http://localhost:3001/api/v1/health |
| PostgreSQL | localhost:5432 (usuário/senha/db conforme `docker-compose.yml`) |

Parar:

```bash
docker compose down
```

Resetar volume do banco:

```bash
docker compose down -v
```

O backend executa `prisma generate`, `prisma migrate deploy` e `npm run dev` ao iniciar o container.

## Desenvolvimento local (sem Docker)

1. Suba um PostgreSQL e defina `DATABASE_URL` e `JWT_SECRET` em `backend/.env`.
2. Backend: `cd backend && npm install && npx prisma generate && npx prisma migrate deploy && npm run prisma:seed && npm run dev` (porta padrão 3001). Se o banco foi criado só com `db push` e aparecer erro P3005, veja baseline em `ARCHITECTURE.md` ou use `npx prisma db push` uma vez para alinhar o schema.

### Prisma (pastas e comandos)

- O arquivo do schema é **`backend/prisma/schema.prisma`**. Comandos como `npx prisma migrate deploy` precisam ser executados **de dentro de `backend/`**, ou use na **raiz do repositório**: `npm run prisma:deploy`, `npm run prisma:push`, `npm run prisma:status`, etc. (veja `package.json` na raiz).
- O CLI do Prisma não fica no PATH global: use **`npx prisma db push`** (e outros subcomandos), ou **`npm run prisma:push`** em `backend/` ou na raiz. **`db push` sozinho não existe** no PowerShell — isso não é um comando.
- Em **`backend/`** também funcionam: `npm run prisma:push`, `npm run prisma:deploy`, `npm run prisma:status` (definidos no `package.json` do backend).
- **P1001 (Can't reach database server):** o PostgreSQL não está rodando ou a `DATABASE_URL` está errada. Com Docker: `docker compose up -d` (serviço `db`). Confira porta **5432** e usuário/senha no `.env`.
3. Frontend: `cd frontend && npm install`; defina `VITE_API_URL` apontando para a API (ex.: `http://localhost:3001/api/v1`); `npm run dev` (porta **5180** neste repo, para não conflitar com outro app na 5173).

## Evolução recomendada para produção

- Usar **`prisma migrate deploy`** no pipeline (há migrações versionadas no repositório).
- **Rate limit**, CORS restritivo, rotação de segredos e observabilidade (logs estruturados, métricas).
- **Fila persistente** (Redis/Bull ou similar) para NFC-e se houver múltiplos workers ou exigência de não perder jobs ao reiniciar.
- Testes de integração com isolamento por tenant.

Documentação técnica detalhada: **`ARCHITECTURE.md`**.
