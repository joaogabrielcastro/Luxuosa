# Luxuosa SaaS - Arquitetura Multi-tenant

Arquitetura base de um SaaS para gerenciamento de loja de roupas com:

- Backend: Node.js + Express
- Frontend: React + TailwindCSS
- Banco: PostgreSQL
- ORM: Prisma
- Auth: JWT
- Modelo SaaS: multi-tenant com `tenant_id`

## Estrutura

```txt
Luxuosa/
  backend/
    prisma/
      schema.prisma
    src/
      app.js
      server.js
      config/
      middlewares/
      modules/
      shared/
      utils/
  frontend/
    src/
      app/
      features/
      shared/
```

## Princípios SaaS multi-tenant

- Base de dados única para todas as empresas.
- Todas as tabelas de domínio possuem `tenant_id`.
- JWT inclui `tenant_id` e `user_type`.
- Middleware injeta contexto do tenant em cada requisição.
- Repositórios aplicam filtro por `tenant_id` em toda consulta.

## Fluxo de autenticação

1. Usuário envia `email` e `senha`.
2. Backend valida credenciais e identifica o tenant do usuário.
3. Backend gera JWT com payload:
   - `sub`: id do usuário
   - `tenant_id`
   - `user_type` (`admin` ou `atendente`)
4. Frontend envia token no header `Authorization: Bearer <token>`.
5. Middlewares validam token e tenant antes de acessar serviços.

## Regras de isolamento de dados

- Nenhuma query de leitura/escrita ocorre sem `tenant_id`.
- IDs de recursos são sempre combinados com `tenant_id`.
- Rotas de administração respeitam `user_type = admin`.
- Logs possuem `tenant_id` para rastreabilidade.

## Domínios principais

- Autenticação e usuários
- Clientes
- Categorias e produtos
- Variações e estoque
- Vendas e itens de venda
- Caixa e movimentações
- Notas fiscais (integração externa)
- Relatórios e dashboard

## API REST (exemplo base)

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`
- `CRUD /api/v1/customers`
- `CRUD /api/v1/categories`
- `CRUD /api/v1/products`
- `CRUD /api/v1/product-variations`
- `POST /api/v1/sales`
- `GET /api/v1/sales`
- `POST /api/v1/cash-register/open`
- `POST /api/v1/cash-register/:id/close`
- `POST /api/v1/invoices/issue/:saleId`
- `GET /api/v1/reports/*`
- `GET /api/v1/dashboard/admin`

## Catalogo implementado (multi-tenant)

Endpoints prontos:

- `GET|POST /api/v1/categories`
- `GET|PUT|DELETE /api/v1/categories/:id`
- `GET|POST /api/v1/products`
- `GET /api/v1/products/low-stock`
- `GET|PUT|DELETE /api/v1/products/:id`
- `GET|POST /api/v1/product-variations`
- `GET|PUT|DELETE /api/v1/product-variations/:id`
- `GET /api/v1/dashboard/admin`

Fluxo validado:

1. Criar categoria
2. Criar produto com `sku` e `minStock`
3. Criar variacao com estoque
4. Consultar `products/low-stock`
5. Ver card/lista de estoque baixo no dashboard

Credenciais demo (seed):

- Email: `admin@luxuosa.com`
- Senha: `123456`

## Vendas e caixa implementados

Endpoints prontos:

- `GET|POST /api/v1/sales`
- `GET /api/v1/cash-register/current`
- `POST /api/v1/cash-register/open`
- `POST /api/v1/cash-register/:id/movements`
- `POST /api/v1/cash-register/:id/close`

Regras implementadas:

- Venda baixa estoque automaticamente por variacao.
- Venda registra movimentacao de estoque (`EXIT`).
- Venda atualiza historico do cliente (`totalPurchases`, `lastPurchaseAt`) quando houver cliente.
- Se existir caixa aberto, venda registra entrada automatica no caixa.
- Fechamento calcula `expectedValue` com base no valor inicial + entradas - retiradas.

## Como evoluir para produção

- Ativar migrations Prisma e seeds.
- Adicionar filas para NF-e e tarefas pesadas.
- Adicionar cache para relatórios e dashboard.
- Configurar observabilidade (logs estruturados + métricas).
- Habilitar rate limit, CORS e hardening de segurança.

## Rodar com Docker

Na raiz do projeto:

```bash
docker compose up --build
```

Acessos:

- Frontend: `http://localhost:5180`
- Backend: `http://localhost:3001/api/v1/health`
- PostgreSQL: `localhost:5432`

Para parar:

```bash
docker compose down
```

Para remover volume do banco e resetar dados:

```bash
docker compose down -v
```
