# Luxuosa

SaaS multi-tenant para gestão de loja de roupa: catálogo, vendas, estoque, relatórios e dashboard. Uma única base PostgreSQL com isolamento lógico por `tenant_id`; autenticação via JWT.

## Homologação

Checklist operacional (Docker, Stripe, NFC-e, produção): ver [HOMOLOGACAO.md](./HOMOLOGACAO.md).

## Stack

| Camada | Tecnologia |
|--------|------------|
| Backend | Node.js 20, Express, Prisma, Zod |
| Frontend | React 18, Vite, TailwindCSS, React Router |
| Banco | PostgreSQL 16 |
| Fiscal (integração) | [Notaas](https://notaas.com.br/) (API key por loja / projeto) |

## O que já existe no produto

- **Autenticação:** login (`POST /auth/logout` e `GET /auth/me` requerem JWT). Email é único **por loja**: `@@unique([tenantId, email])` no Prisma. Se o mesmo email existir em mais de um tenant, o login exige **`tenantCnpj`** (14 dígitos) no body para escolher a loja.
- **Catálogo:** categorias, marcas, produtos, variações (tamanho/cor/estoque), alerta de estoque baixo (produto vs soma das variações).
- **Vendas:** criar, listar, editar, cancelar; baixa de estoque e movimentação `EXIT`; desconto com política por tipo de usuário (admin vs atendente); UI por categoria e produto; **sem seleção de cliente na tela de venda** — a NFC-e padrão sai como **consumidor final** (`customerId` opcional na API).
- **Crediário (contas a receber):** vendas a prazo sem NFC-e; parcelas e baixas; disponível para todos os tenants.
- **Clientes:** tela em `/clientes` (CRUD) alinhada ao `GET|POST|PUT|DELETE /customers`; uso no crediário e vendas quando aplicável.
- **Movimentações de estoque manuais:** entrada e saída sem venda (`POST /stock-movements`), com histórico (`GET /stock-movements`). Saída não pode ultrapassar o estoque da variação.
- **Relatórios (API):** vendas pagas por intervalo de datas (`GET /reports/sales?from=&to=`) e lista de produtos abaixo do mínimo (`GET /reports/low-stock`). O **dashboard admin** continua com visão mais rica (só admin).
- **Dashboard (admin):** métricas agregadas (receita, ticket, vendas por período/atendente, lucro por produto, estoque consolidado, produtos sem venda recente, etc.).
- **NFC-e (Notaas):** após registrar a venda, o backend enfileira emissão **modelo 65** em fila persistida (`NfceIssueJob`) com serialização por `tenantId`; consulta status e grava `Invoice`. Cada loja usa seu projeto Notaas (`Tenant.notaasApiKey`). **PDF (DANFE):** `GET /invoices/sale/:saleId/pdf`. Reemissão: `POST /invoices/issue/:saleId` (admin). Config: `PATCH /invoices/notaas-config`. Teste: `GET /invoices/connection-test` (admin). Simples Nacional (CSOSN 102).

## O que ainda é esboço ou não existe

- **NF-e na UI** e refinamentos fiscais avançados (outros CST/CFOP, download automático de XML em massa).
- **Gestão de usuários** do tenant (criar atendentes), **onboarding** de novos tenants.
- **Fila externa dedicada** (Redis/Bull) para NFC-e em cenários de alto volume/múltiplas instâncias (há worker `nfce-worker` no Docker; Redis/Bull ainda não).
- **Testes automatizados** em volume (há testes unitários básicos em `salePayload`; falta cobertura de integração).

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
      list-tenant-fiscal.mjs
    src/
      app.js
      server.js
      jobs/
        enqueueNfceIssue.js   # fila por tenant para NFC-e pós-venda
      config/
      middlewares/
      modules/          # auth, customers, categories, products, productVariations,
      #                 # dashboard, sales, invoices, stockMovements, reports
      shared/
        notaas/         # API Notaas (NFC-e)
        nuvemFiscal/    # legado (helpers de CNPJ emitente)
      utils/
    .env.example
  frontend/
    src/
      app/
      features/         # auth, dashboard, catalog, sales, stock, reports, crediario, customers
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
| `NOTAAS_API_BASE` | Padrão: `https://platform.notaas.com.br/api/v1` |
| `NOTAAS_AMBIENTE` | `homologacao` ou `producao` (tpAmb no payload) |
| `NOTAAS_ORG_TOKEN` | Opcional — gestão de projetos; **não** é emitente |
| `NFCE_MOCK` | `true` em testes — não chama Notaas |
| `NFCE_PROCESS_IN_API` | `false` na API e worker separado (`npm run worker:nfce`); `true` (padrão) processa fila no mesmo processo |
| `NFCE_WORKER_POLL_MS` | Intervalo do worker NFC-e (padrão 5000 ms) |
| `LOGIN_RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_WINDOW_MS` | Limite de tentativas no `POST /auth/login` |

Por loja (banco, não env): `Tenant.notaasApiKey` (`ntaas_...`), `Tenant.notaasProjectId`, `Tenant.enableNfceEmission`. Admin: `PATCH /invoices/notaas-config`.

No fluxo com Docker deste repositório, o `backend` lê essas variáveis via `env_file` em `docker-compose.yml` (arquivo `/.env.compose`). O `docker-compose.yml` inclui o serviço **`nfce-worker`** com `NFCE_PROCESS_IN_API=true`; a API usa `NFCE_PROCESS_IN_API=false`.

### Segurança e RBAC (resumo)

- **Admin:** cancelar/editar venda, emitir NFC-e manual, CRUD de catálogo, estoque manual, crediário (criar/cancelar).
- **Atendente:** criar venda, listar catálogo, receber crediário.
- Vendas com NFC-e **emitida** ou job **em processamento** não podem ser editadas/canceladas.
- `GET /customers` e `GET /product-variations` retornam `{ items, total, take, skip }` (paginação obrigatória).

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
| `GET\|POST /crediario` | Crediário: listar e criar venda a prazo (JWT + tenant) |
| `GET /crediario/:id` | Detalhe com parcelas |
| `POST /crediario/:id/payments` | Registrar pagamento |
| `POST /crediario/:id/cancel` | Cancelar crediário |
| `GET /sales/summary` | Lista enxuta para telas de operação (mesmos filtros de `GET /sales`) |
| `GET /sales/:id` | Detalhe completo da venda |
| `PUT /sales/:id` | Só admin; bloqueado se NFC-e emitida |
| `POST /sales/:id/cancel` | Só admin; bloqueado se NFC-e emitida |
| `GET /stock-movements` | Lista movimentações; aceita `take` e `skip` |
| `POST /stock-movements` | Body: `productVariationId`, `type` (`ENTRY` \| `EXIT`), `quantity` |
| `GET /reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD` | Vendas pagas no intervalo (totais e por dia) |
| `GET /reports/low-stock` | Produtos com estoque total ≤ mínimo cadastrado |
| `GET /invoices/connection-test` | Só admin; valida API Key Notaas da loja |
| `PATCH /invoices/notaas-config` | Só admin; grava `notaasApiKey` / `notaasProjectId` / `enableNfceEmission` |
| `POST /invoices/issue/:saleId` | Só admin; reemite/força NFC-e (venda paga) |
| `GET /invoices/sale/:saleId/pdf` | PDF (DANFE) da NFC-e autorizada |
| `GET /invoices/sale/:saleId/job` | Status da fila de emissão NFC-e para a venda |

## Frontend (rotas)

| Rota | Página |
|------|--------|
| `/login` | Login (campo opcional CNPJ da loja se necessário) |
| `/` | Dashboard admin |
| `/catalog/categories` | Categorias |
| `/catalog/brands` | Marcas |
| `/catalog/products` | Produtos |
| `/catalog/variations` | Variações |
| `/vendas` | Vendas + NFC-e (lista com atualização automática enquanto pendente, filtros, PDF, reemissão) |
| `/crediario` | Crediário (contas a receber) |
| `/clientes` | Clientes |
| `/sales` | Redireciona para `/vendas` |
| `/estoque/movimentos` | Movimentações de estoque manuais |
| `/stock` | Redireciona para `/estoque/movimentos` |
| `/relatorios` | Relatórios mínimos (vendas por período, estoque baixo) |
| `/reports` | Redireciona para `/relatorios` |

## NFC-e e Notaas

1. Crie um **projeto** no Notaas para a loja (mesmo CNPJ do `Tenant`) e configure certificado + CSC.
2. Copie a API Key do projeto (`ntaas_...`) e grave em `Tenant.notaasApiKey` (admin: `PATCH /api/v1/invoices/notaas-config` com `{ "notaasApiKey": "ntaas_...", "enableNfceEmission": true }`).
3. No Coolify/`.env`: `NOTAAS_API_BASE` e `NOTAAS_AMBIENTE` (homologação primeiro).
4. Com API rodando e JWT de **admin**: `GET /api/v1/invoices/connection-test`.
5. **Venda de teste:** em **Vendas**, finalize com “Emitir NFC-e”; use **Baixar PDF** se autorizada.

### Troubleshooting rápido (NFC-e)

- **`NOTAAS_API_KEY_MISSING`**: a loja não tem `notaasApiKey` — cadastre no Notaas e grave via `PATCH /invoices/notaas-config`.
- **`NFCE_TENANT_CNPJ_REQUIRED`**: `Tenant.cnpj` inválido (precisa 14 dígitos).
- **Erro de certificado/CSC no Notaas**: corrija no painel do projeto (mesmo CNPJ da loja).
- **DANFE 404 / atraso**: o backend já faz retry ao baixar o PDF.

**NFC-e automática:** ao criar venda com `emitNfce`, o backend enfileira emissão no Notaas com a API Key **daquela loja**. Consumidor final quando não há cliente. **PDF:** `GET /api/v1/invoices/sale/:saleId/pdf`. Produtos: `ncm`, `cfop`, `icmsCsosn` (padrões: `61091000`, `5102`, `102`).

Nunca commite API Keys (`ntaas_...`). Se exposta, revogue no Notaas e gere outra.

### Várias lojas (multi-tenant) — cada cliente com CNPJ + projeto Notaas

Cada login usa o `Tenant` da loja. A emissão usa `Tenant.notaasApiKey` (projeto Notaas daquele CNPJ). Certificado/CSC ficam no projeto Notaas, não no banco Luxuosa.

| Como conferir | O que fazer |
|---------------|-------------|
| **No app** | Banner **“NFC-e desta loja: XX.XXX.XXX/XXXX-XX”** + aviso se faltar API Key. |
| **API** | `GET /invoices/connection-test` (admin). |
| **No servidor** | `cd backend && npm run fiscal:list-tenants` |

**Cadastro de cada cliente:**

1. `Tenant.cnpj` = CNPJ real (14 dígitos).
2. Projeto Notaas com o **mesmo CNPJ** + certificado/CSC.
3. `Tenant.notaasApiKey` + `enableNfceEmission = true`.
4. Remova `NUVEM_FISCAL_*` do Coolify (legado).

Se o mesmo e-mail existir em mais de uma loja, o login pede o **CNPJ da loja** para escolher o tenant certo.

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
| Frontend | http://localhost:3006 |
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

O `backend/Dockerfile` sobe com `prisma generate` e **`npm run start:prod`** (que corre `migrate deploy` antes de `node src/server.js`).

No **Coolify / Nixpacks**, defina o **Start Command** do serviço API, por exemplo:

`npx prisma generate && npm run start:prod`

(As variáveis `DATABASE_URL` e `PORT` devem estar disponíveis no runtime.) Para **CORS** restrito à origem do teu front em producao, adicione `CORS_ORIGINS=https://teu-dominio-front.com` no backend (lista separada por virgulas se houver varios).

No **frontend** em producao (Coolify ou Docker deste repo): defina **VITE_API_URL** no **buildtime** (ex.: `https://api-luxuosa.jwsoftware.com.br/api/v1`), depois `npm run build` e start com `npm run start` ou o `CMD` do `frontend/Dockerfile` — o preview escuta **3000** por defeito (`PORT` pode sobrescrever).

## Antes de commitar (checagem rápida)

Na raiz do repositório:

```bash
npm run check

Backend — testes unitários: `cd backend && npm test`. Com Postgres (ex. Docker): `DATABASE_URL=... npm run test:integration`
```

Isso gera o build do frontend e valida o carregamento das rotas do backend. Com banco novo ou após puxar migrações: `npm run prisma:deploy` (aplica migrações em `backend/prisma/migrations`).

## Desenvolvimento local (sem Docker)

1. Suba um PostgreSQL e defina `DATABASE_URL` e `JWT_SECRET` em `backend/.env`.
2. Backend: `cd backend && npm install && npx prisma generate && npx prisma migrate deploy && npm run prisma:seed && npm run dev` (porta padrão 3001). Se o banco foi criado só com `db push` e aparecer erro P3005, veja baseline em `ARCHITECTURE.md` ou use `npx prisma db push` uma vez para alinhar o schema.

### Banco de producao vazio (`User` / tabelas inexistentes, P3018)

As pastas `prisma/migrations` deste repo **nao** incluem uma migração inicial que cria todo o schema; num Postgres **novo**, `migrate deploy` sozinho pode falhar a meio. Nesse caso:

1. Desbloquear a migração em falha:  
   `npx prisma migrate resolve --rolled-back <nome_da_migracao_que_falhou>`
2. Aplicar o schema completo **sem** correr o SQL antigo das migrações:  
   `npx prisma db push`
3. Marcar como já aplicadas as migrações que **ainda não** constam como concluídas (uma linha por nome de pasta em `prisma/migrations`):  
   `npx prisma migrate resolve --applied <nome_da_migracao>`

Não voltes a correr `migrate deploy` depois do `db push` até o historico estar alinhado; caso contrário o SQL pode tentar criar tabelas/indices que o `db push` já criou. Depois de todos os `resolve --applied`, `npx prisma migrate status` deve mostrar tudo aplicado. Em seguida: `npm run prisma:seed` se quiser dados iniciais.

### Prisma (pastas e comandos)

- O arquivo do schema é **`backend/prisma/schema.prisma`**. Comandos como `npx prisma migrate deploy` precisam ser executados **de dentro de `backend/`**, ou use na **raiz do repositório**: `npm run prisma:deploy`, `npm run prisma:push`, `npm run prisma:status`, etc. (veja `package.json` na raiz).
- O CLI do Prisma não fica no PATH global: use **`npx prisma db push`** (e outros subcomandos), ou **`npm run prisma:push`** em `backend/` ou na raiz. **`db push` sozinho não existe** no PowerShell — isso não é um comando.
- Em **`backend/`** também funcionam: `npm run prisma:push`, `npm run prisma:deploy`, `npm run prisma:status` (definidos no `package.json` do backend).
- **P1001 (Can't reach database server):** o PostgreSQL não está rodando ou a `DATABASE_URL` está errada. Com Docker: `docker compose up -d` (serviço `db`). Confira porta **5432** e usuário/senha no `.env`.
3. Frontend: `cd frontend && npm install`; defina `VITE_API_URL` apontando para a API (ex.: `http://localhost:3001/api/v1`); `npm run dev` (porta **3006** neste repo).

## Evolução recomendada para produção

- Usar **`prisma migrate deploy`** no pipeline (há migrações versionadas no repositório).
- **Rate limit**, CORS restritivo, rotação de segredos e observabilidade (logs estruturados, métricas).
- **Fila persistente** (Redis/Bull ou similar) para NFC-e se houver múltiplos workers ou exigência de não perder jobs ao reiniciar.
- Testes de integração com isolamento por tenant.

Documentação técnica detalhada: **`ARCHITECTURE.md`**.
