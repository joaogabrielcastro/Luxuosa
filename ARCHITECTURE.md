# Arquitetura completa SaaS - Luxuosa

## 1) Visao geral

Sistema SaaS multi-tenant para lojas de roupas, com uma base PostgreSQL compartilhada e isolamento logico por `tenant_id`.

Objetivos:

- Simples para iniciar e operar
- Escalavel para muitas empresas
- Reutilizavel com modulos desacoplados

## 2) Camadas

Backend (Express):

- `controllers`: valida entrada e resposta HTTP
- `services`: regra de negocio
- `repositories`: acesso a dados com filtro de tenant
- `middlewares`: auth, tenant, autorizacao e erro

Frontend (React):

- `features`: funcionalidades por dominio
- `app`: rotas e bootstrap
- `shared`: cliente HTTP e componentes comuns

Banco (PostgreSQL + Prisma):

- modelos normalizados com `tenantId`
- indices compostos por `tenantId` para performance

## 3) Multi-tenant com tenant_id

Garantias obrigatorias:

1. JWT sempre carrega `tenant_id`.
2. Middleware define `req.tenantId`.
3. Repositorios sempre consultam com `where: { tenantId }`.
4. Nunca usar `findUnique({ where: { id } })` isolado em recursos de dominio.
5. Chaves unicas por tenant quando necessario (`@@unique([tenantId, sku])`, etc.).

## 4) Entidades implementadas no schema Prisma

- `Tenant`
- `User`
- `Customer`
- `Category`
- `Product`
- `ProductVariation`
- `StockMovement`
- `Sale`
- `SaleItem`
- `CashRegister`
- `CashMovement`
- `Invoice`

Enums:

- `UserType`, `PaymentMethod`, `SaleStatus`
- `StockMovementType`, `CashRegisterStatus`, `CashMovementType`
- `InvoiceStatus`, `Plan`

## 5) Fluxos principais

### Login

1. `POST /auth/login`
2. Valida email/senha
3. Gera JWT com `sub`, `tenant_id`, `user_type`
4. Frontend salva sessao

### CRUD de clientes (padrao de modulo)

1. Rota protegida (`authMiddleware` + `tenantMiddleware`)
2. Controller valida via Zod
3. Service orquestra regras
4. Repository executa query multi-tenant

### Vendas e estoque (desenho)

1. Criar venda com itens por variacao
2. Calcular total/descontos
3. Baixar estoque por variacao
4. Registrar movimentacao de estoque
5. Registrar entrada no caixa
6. Atualizar historico do cliente

### Emissao de NF-e (desenho)

1. Venda finalizada dispara emissao
2. Service monta payload fiscal
3. Envia para API externa
4. Persiste numero/chave/xml/pdf/status

## 6) Contratos REST sugeridos

- Auth: `/auth/login`, `/auth/logout`, `/auth/me`
- Clientes: `/customers`
- Catalogo: `/categories`, `/products`, `/product-variations`
- Estoque: `/stock-movements`
- Vendas: `/sales`
- Caixa: `/cash-register`, `/cash-movements`
- Fiscal: `/invoices/issue/:saleId`
- BI: `/reports/*`, `/dashboard/admin`

## 7) Escalabilidade

- Indices por `tenantId` em todas as tabelas
- Paginacao padrao para listas
- Agregacoes pesadas em endpoints de relatorio com cache
- Fila assincrona para NF-e
- Stateless API para escalar horizontalmente

## 8) Seguranca minima

- Senha com hash (`bcrypt`)
- JWT assinado com segredo forte e expiracao curta
- RBAC simples por `user_type`
- Rate limit e CORS em producao
- Logs com `tenant_id`, `user_id`, `request_id`

## 9) Roadmap tecnico

1. Criar migrations Prisma
2. Implementar modulos completos de vendas/estoque/caixa
3. Criar testes de integracao por tenant
4. Integrar provedor de NF-e
5. Adicionar monitoramento (APM + alertas)
