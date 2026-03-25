# Arquitetura — Luxuosa

## 1. Visão geral

O Luxuosa é um SaaS **multi-tenant** para lojas de roupa: uma única instância de API e um único banco PostgreSQL; o isolamento entre empresas é feito por **`tenant_id`** em todas as entidades de domínio.

Objetivos de desenho:

- Operação simples em desenvolvimento e homologação.
- Capacidade de escalar horizontalmente a API (stateless + JWT).
- Módulos de backend por domínio (pastas em `modules/`), com responsabilidades claras.

## 2. Camadas do backend

| Camada | Responsabilidade |
|--------|------------------|
| **Routes** | Registro de rotas Express e composição de middlewares. |
| **Controllers** | Validação de entrada (Zod), formato da resposta HTTP, delegação ao service. |
| **Services** | Regras de negócio, transações (`prisma.$transaction`), orquestração. |
| **Repositories** | Acesso a dados com filtro obrigatório por `tenantId` onde aplicável. |
| **Middlewares** | Autenticação JWT, resolução de tenant, exigência de papel admin onde necessário, tratamento de erro. |

Arquivo central de rotas: `backend/src/routes.js` (monta o prefixo `/api/v1` em `app.js`).

## 3. Camadas do frontend

| Área | Conteúdo |
|------|----------|
| `app/` | Rotas React Router e composição de providers (auth, toast, confirmação). |
| `features/` | Telas por domínio: `auth`, `dashboard`, `catalog`, `sales`, `stock`, `reports`. |
| `shared/` | Componentes reutilizáveis (layout, tabela, cliente HTTP). |

O cliente HTTP envia `Authorization: Bearer <token>` quando o usuário está autenticado.

## 4. Multi-tenant (`tenant_id`)

Regras que o código deve respeitar:

1. O JWT emitido no login inclui identificação do tenant (e tipo de usuário).
2. `tenantMiddleware` define `req.tenantId` em rotas protegidas.
3. Consultas e alterações em dados de domínio usam `where: { tenantId }` (ou equivalente na transação).
4. Identificadores únicos compostos quando necessário (ex.: `@@unique([tenantId, sku])`, `@@unique([tenantId, email])` em **User**).
5. Evitar `findUnique` apenas por `id` sem âncora de tenant em recursos multi-tenant.

**Login:** o email não é mais único globalmente. `authRepository` busca usuários por email; se houver mais de um (vários tenants), o cliente deve enviar **`tenantCnpj`** (14 dígitos, normalizado) para selecionar o tenant. Resposta HTTP 400 com `code: TENANT_CNPJ_REQUIRED` quando o CNPJ é obrigatório e não foi informado (o `errorHandler` repassa `code` no JSON quando existir).

**RBAC:** `requireAdmin` restringe endpoints administrativos (ex.: `GET /dashboard/admin`, `GET /invoices/connection-test`). Vendas, movimentações de estoque, relatórios de leitura e reemissão de NFC-e são usáveis por qualquer usuário autenticado da loja (admin ou atendente), conforme implementação atual.

## 5. Modelo de dados (Prisma)

Entidades principais no `schema.prisma`:

- **Tenant**, **User** — plano do tenant, tipos de usuário (`ADMIN` / `ATTENDANT`). **User:** unicidade composta `(tenantId, email)`.
- **Customer** — clientes por tenant; campos opcionais para destinatário na NFC-e.
- **Category**, **Product**, **ProductVariation** — catálogo e estoque; **Product** inclui `ncm`, `cfop`, `icmsOrig`, `icmsCsosn` (Simples Nacional / CSOSN 102 no emissor).
- **StockMovement** — histórico: vendas (saída), cancelamentos (entrada), **e entradas/saídas manuais** via API de movimentação.
- **Sale**, **SaleItem** — vendas e itens.
- **Invoice** — NFC-e por venda (`saleId` único); `externalId` (id do documento na Nuvem), `key`, `number`, `pdfUrl` (caminho interno), `lastError`, `issuedAt`.

Enums relevantes: `Plan`, `UserType`, `PaymentMethod`, `SaleStatus`, `StockMovementType`, `InvoiceStatus`.

**Migrações Prisma:** histórico em `backend/prisma/migrations/`. Em deploy: `npx prisma migrate deploy` (após `prisma generate`). Bancos criados só com `db push` e sem `_prisma_migrations` precisam de baseline: aplicar o SQL da migração com `prisma db execute` e depois `prisma migrate resolve --applied <nome_da_pasta>`, ou alinhar com `migrate diff` conforme a [documentação Prisma](https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate/baseline). O `Dockerfile` de desenvolvimento pode usar `prisma db push` para subir rápido; em produção prefira `migrate deploy` com o mesmo histórico de migrações.

## 6. Fluxos implementados

### Autenticação

- `POST /auth/login` valida email/senha (hash com bcrypt), resolve tenant quando há ambiguidade de email, retorna JWT.
- Rotas autenticadas: `authMiddleware` + `tenantMiddleware` onde aplicável.

### Catálogo e estoque

- CRUD de categorias, produtos e variações com unicidade por tenant.
- Vendas debitam `ProductVariation.stock` e criam `StockMovement` do tipo saída; cancelamento restaura estoque e registra movimento de entrada.
- **Movimentação manual:** `stockMovementService.create` valida variação do tenant, aplica `ENTRY` (incremento) ou `EXIT` (decremento com validação de estoque) e grava `StockMovement`.

### Vendas

- Criação/atualização de venda recalcula totais, aplica política de desconto por `user_type`, valida parcelamento conforme forma de pagamento.
- A UI de vendas **não** cadastra nem seleciona cliente; `customerId` fica nulo e a NFC-e segue como consumidor final. A API ainda aceita `customerId` opcional (ex.: integração externa).
- Cancelamento restaura estoque e ajusta totais do cliente quando a venda tinha `customerId`.
- Após criar venda paga, `enqueueNfceIssue` (`backend/src/jobs/enqueueNfceIssue.js`) enfileira `invoiceService.issueFromSale` **por tenant** (cadeia de promises, uma emissão por vez por `tenantId`), com retries limitados para falhas retriáveis.

### Relatórios

- `GET /reports/sales` — vendas `PAID` entre `from` e `to` (datas `YYYY-MM-DD`), totais e agregação por dia.
- `GET /reports/low-stock` — reutiliza a lógica de `productService.lowStock` (estoque total das variações vs `Product.minStock`).

### Dashboard

- `GET /dashboard/admin` agrega vendas pagas, estoque baixo, séries temporais, desempenho por atendente, margem aproximada por produto (com base em custo cadastrado), entre outros. Apenas **admin**.

### Integração fiscal (Nuvem Fiscal)

- **OAuth:** `shared/nuvemFiscal/nuvemFiscalAuth.js` (cache do token).
- **API:** `shared/nuvemFiscal/nuvemFiscalApi.js` — `GET /empresas`, `GET /empresas/:cnpj`, `GET /empresas/:cnpj/nfce`, `POST /nfce`, `GET /nfce/:id`.
- **Payload:** `shared/nuvemFiscal/nuvemFiscalNfceBuilder.js` monta `infNFe` (modelo **65** NFC-e, ICMS CSOSN 102, PIS/COFINS CST 07).
- **Emissão:** `invoice.service.issueFromSale` chama `POST /nfce`, polling até autorização, persiste chave/número em `Invoice`; PDF via `GET /nfce/:id/pdf` (proxy em `GET /invoices/sale/:saleId/pdf`).
- **Variáveis:** incluem `NUVEM_FISCAL_AMBIENTE` e `NUVEM_FISCAL_EMITENTE_CNPJ` (opcional; senão usa `Tenant.cnpj`).
- **Rotas:** `GET /invoices/connection-test` (admin); `POST /invoices/issue/:saleId` e `GET /invoices/sale/:saleId/pdf` (usuário da loja).

## 7. Mapa de rotas HTTP (referência)

Todas abaixo do prefixo **`/api/v1`**.

| Área | Rotas |
|------|--------|
| Saúde | `GET /health` |
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Clientes | `GET\|POST /customers`, `GET\|PUT\|DELETE /customers/:id` |
| Catálogo | `GET\|POST /categories`, `GET\|PUT\|DELETE /categories/:id` |
| Produtos | `GET\|POST /products`, `GET /products/low-stock`, `GET\|PUT\|DELETE /products/:id` |
| Variações | `GET\|POST /product-variations`, `GET\|PUT\|DELETE /product-variations/:id` |
| Dashboard | `GET /dashboard/admin` |
| Vendas | `GET\|POST /sales`, `PUT /sales/:id`, `POST /sales/:id/cancel` |
| Estoque (manual + listagem) | `GET /stock-movements`, `POST /stock-movements` |
| Relatórios | `GET /reports/sales`, `GET /reports/low-stock` |
| NFC-e | `GET /invoices/connection-test`, `POST /invoices/issue/:saleId`, `GET /invoices/sale/:saleId/pdf` |

## 8. Tratamento de erros e logging

- `errorHandler` centralizado devolve JSON com `error` (mensagem) e, quando aplicável, `code` (ex.: `TENANT_CNPJ_REQUIRED`).
- Requisições logadas com `morgan` em modo desenvolvimento.

## 9. Segurança

- Senhas com hash (bcrypt).
- JWT assinado com `JWT_SECRET` (obrigatório no boot).
- Segredos de terceiros (Nuvem Fiscal) apenas em variáveis de ambiente; não versionar `.env`.
- Em produção: endurecer CORS, rate limiting, rotação de chaves, e correlação de logs (`tenant_id` / `user_id` / `request_id` como evolução).

## 10. Escalabilidade e operações

- Índices Prisma em `tenantId` (e compostos onde necessário) para filtros frequentes.
- API stateless facilita réplicas atrás de load balancer.
- NFC-e na Nuvem Fiscal pode ficar pendente na resposta; a fila em memória serializa por tenant e aplica retries; para múltiplos processos ou durabilidade após restart, avaliar fila externa (Redis/Bull).
- Agregações pesadas futuras podem usar cache ou leitura dedicada (read model), se necessário.

## 11. Roadmap técnico (pendências explícitas)

1. **Telas de clientes** no frontend (API já existe).
2. **Fila persistente** e/ou workers dedicados para NFC-e em alto volume ou ambientes multi-instância.
3. **Exportação** de relatórios (CSV/PDF) e filtros avançados além do mínimo atual.
4. **Gestão de usuários** por tenant e onboarding self-service.
5. **Testes** de integração multi-tenant e monitoramento (APM/alertas).

Este documento deve evoluir junto com o repositório; em caso de divergência, prevalece o comportamento do código e do `schema.prisma`.
