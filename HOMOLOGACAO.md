# Homologação — Luxuosa

Checklist operacional para validar o produto antes de produção.

## 1. Ambiente local (Docker)

```bash
docker compose up -d --build
docker compose ps
```

Serviços esperados: `db`, `redis`, `backend`, `nfce-worker`, `frontend`.

Se o backend falhar com `Cannot find package 'stripe'` (volume antigo de `node_modules`):

```bash
docker compose exec backend npm install
docker compose restart backend nfce-worker
```

| Serviço | URL / porta |
|---------|-------------|
| Frontend | http://localhost:3006 |
| API | http://localhost:3001/api/v1/health |
| Postgres | localhost:5434 |
| Redis | localhost:6380 (host) → 6379 no container |


- `JWT_SECRET`
- `STRIPE_SECRET_KEY` (+ opcional `STRIPE_PRICE_PRO` / `STRIPE_PRICE_ENTERPRISE`)
- `FRONTEND_URL=http://localhost:3006`
- Notaas: `NOTAAS_API_BASE` / `NOTAAS_AMBIENTE` + por loja `Tenant.notaasApiKey`
- `REDIS_URL` é injetado pelo `docker-compose.yml` no backend

Opcional (webhook Stripe em tempo real):

```bash
stripe listen --forward-to localhost:3001/api/v1/billing/webhook
```

Coloque o `whsec_...` em `STRIPE_WEBHOOK_SECRET`. Sem webhook, o app usa `POST /billing/sync` ao voltar do Checkout.

## Smoke técnico

```bash
# na raiz — build FE + rotas + unit + integração API (nao inclui e2e)
npm run checkVariáveis críticas em `.env.compose` (não versionar):


# so unitarios (shared: salePayload, pagination, nfeXmlParser, planCatalog, tenantIsolation…)
npm test --prefix backend

# integracao API (precisa Postgres; Docker db na 5434 por padrao)
# cobre rotas montadas em backend/src/routes.js via src/test/*.integration.test.js
npm run test:integration --prefix backend

# cobertura c8 (unit + integracao → text + lcov)
npm run test:coverage --prefix backend

# e2e Playwright (opcional; nao bloqueia `check` se browsers faltarem)
# API em :3001; front sobe sozinho, ou reuse docker front:
# cobre shells (app-flows / critical-flows) + fluxos profundos (venda, caixa, estoque, CSV, NF-e CTA, billing)
E2E_SKIP_WEBSERVER=1 npm run test:e2e
```

**O que a cobertura automatizada cobre:** contratos HTTP dos módulos montados (auth, users, catalog, customers, sales, stock, crediário, suppliers, reports, dashboard, billing, NF-e import, invoices shells) + utilitários compartilhados (incl. preços PRO 97 / ENTERPRISE 250) + Playwright shells e deep flows (venda, caixa, estoque ENTRY, crediário form, export CSV, alertas/NF-e CTA Pro, dashboard, assinatura).

**Ainda manual:** NFC-e autorizada na SEFAZ/Notaas, Checkout/Portal Stripe com cartão real de teste, webhook Stripe em tempo real.

Esperado: frontend build OK, rotas OK, testes unitários + integração OK, `{ "ok": true }` no health.

## 3. Fluxo ponta a ponta (manual)

### A) Onboarding
1. Abrir http://localhost:3006/cadastro
2. Criar loja (CNPJ válido 14 dígitos + admin)
3. Confirmar login automático e menu da loja

### B) Usuários
1. Menu **Usuarios** → criar um atendente
2. Sair e entrar com o atendente
3. Confirmar que não vê Assinatura / Importar NF-e / Usuarios (admin only)

### C) Catálogo + venda + NFC-e
1. Garantir produto com variação e estoque
2. Na loja que deve emitir nota: `enableNfceEmission=true` no Tenant (seed ou SQL/Prisma Studio)
3. **Vendas**: incluir item (F2 / código / busca), opcionalmente cliente, finalizar com “Emitir NFC-e”
4. Acompanhar status da nota / PDF quando autorizada
5. Conferir logs do `nfce-worker` se a fila demorar

### D) Importação NF-e (entrada)
1. Plano **PRO** (Assinatura Stripe ou setar `plan=PRO` no banco para teste)
2. **Importar NF-e** → XML → vincular/criar → confirmar
3. Conferir estoque e histórico

### E) Stripe
1. Admin → **Assinatura** → Assinar Pro
2. Cartão teste: `4242 4242 4242 4242`
3. Voltar em `/assinatura?checkout=success` e ver plano atualizado
4. Testar “Gerenciar no Stripe” (Customer Portal precisa estar ativo no Dashboard)

### F) Relatórios / alertas
1. **Relatórios** → exportar CSV
2. Dashboard admin → banner de estoque baixo (se houver produto abaixo do mínimo)

## 4. Produção (Coolify / VPS)

Obrigatório:

| Variável | Notas |
|----------|--------|
| `NODE_ENV=production` | Ativa exigência de CORS |
| `CORS_ORIGINS` | Ex.: `https://app.seudominio.com.br` |
| `FRONTEND_URL` | URL pública do front (success/cancel Stripe) |
| `DATABASE_URL` | Postgres gerenciado |
| `JWT_SECRET` | Segredo forte |
| `STRIPE_SECRET_KEY` | Preferir `sk_live_...` só após homologar |
| `STRIPE_WEBHOOK_SECRET` | Endpoint real no Dashboard Stripe |
| `REDIS_URL` | Rate limit de login entre réplicas |
| `NUVEM_FISCAL_*` | Ambiente `producao` alinhado ao console |
| `NFCE_PROCESS_IN_API=false` | API + worker separados |

Webhook Stripe (Dashboard):

- URL: `https://api.seudominio.com.br/api/v1/billing/webhook`
- Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

## 5. Planos (referência)

| Plano | Preço (catálogo) | Libera |
|-------|------------------|--------|
| BASIC | Grátis | Catálogo, vendas, estoque, crediário |
| PRO | R$ 97/mês | NFC-e (se `enableNfceEmission`), import NF-e |
| ENTERPRISE | R$ 250/mês | Tudo do Pro + roadmap multi-loja |

**Clientes já existentes:** tenants com `planGateExempt=true` **não são bloqueados** por plano (NFC-e, import NF-e, alertas). A migração marca todas as lojas atuais como isentas; **novos cadastros** self-serve nascem com `planGateExempt=false` e passam pelo gate (BASIC → upgrade).

Habilitar emissão NFC-e **por loja** (`Tenant.enableNfceEmission`) só depois do projeto Notaas (mesmo CNPJ) + `notaasApiKey` gravada — evita emitir com emitente errado.

## 6. Critérios de “homologado”

- [x] Health OK + Redis up *(local Docker verificado)*
- [ ] Cadastro de loja funciona *(manual no front)*
- [x] Venda baixa estoque *(coberto por testes de integração)*
- [ ] NFC-e autoriza em homologação (loja com flag ligada) *(manual SEFAZ — ver §3C)*
- [x] Import NF-e sobe estoque *(coberto por testes de integração)*
- [ ] Checkout Stripe Pro atualiza `Tenant.plan` *(manual — webhook ou POST /billing/sync)*
- [x] `npm run check` verde
- [x] Segredos não estão no Git *(`.env.example` sem secrets; use `.env` / `.env.compose`)*

### Status técnico (automático)

| Checagem | Resultado |
|----------|-----------|
| `GET /api/v1/health` | ok |
| Stripe Products/Prices (`npm run stripe:setup`) | PRO + ENTERPRISE via `lookup_key` |
| Notaas (API Key por loja) | pendente — cadastrar Luxuosa Presentes no Notaas |
| CI GitHub Actions | workflow `.github/workflows/ci.yml` |

### Ainda precisa de você (manual)

1. **NFC-e real:** login Luxuosa → venda com “Emitir NFC-e” → PDF autorizado (worker + SEFAZ homologação).
2. **Stripe checkout:** Assinatura → Pro → cartão `4242…` → voltar com plano atualizado. Para webhook local: `stripe listen --forward-to localhost:3001/api/v1/billing/webhook` e colocar `whsec_…` em `STRIPE_WEBHOOK_SECRET`.
3. **Produção (Coolify):** após 1–2 ok, aplicar envs da §4, `prisma migrate deploy`, webhook Stripe live, `NOTAAS_AMBIENTE=producao` só quando for emitir real.

### Multi-tenant NFC-e (checklist Coolify / Notaas)

- [ ] ~~Remover credenciais Nuvem Fiscal~~ (código Luxuosa não usa mais; limpar Coolify se ainda houver `NUVEM_FISCAL_*`)
- [ ] Envs: `NOTAAS_API_BASE`, `NOTAAS_AMBIENTE`
- [ ] Cada loja: projeto Notaas com o mesmo `Tenant.cnpj` + certificado/CSC no projeto + `Tenant.notaasApiKey`
- [ ] Luxuosa Presentes: cadastrar no Notaas e gravar key (`PATCH /invoices/notaas-config` ou SQL)
- [ ] `enableNfceEmission=true` só nas lojas prontas
- [ ] Worker NFC-e separado com `NFCE_PROCESS_IN_API=true`
- [ ] Fechamento fiscal: `/fechamento-fiscal` → export ZIP do mês
