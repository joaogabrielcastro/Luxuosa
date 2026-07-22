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

Variáveis críticas em `.env.compose` (não versionar):

- `JWT_SECRET`
- `STRIPE_SECRET_KEY` (+ opcional `STRIPE_PRICE_PRO` / `STRIPE_PRICE_ENTERPRISE`)
- `FRONTEND_URL=http://localhost:3006`
- Credenciais Nuvem Fiscal (`NUVEM_FISCAL_*`)
- `REDIS_URL` é injetado pelo `docker-compose.yml` no backend

Opcional (webhook Stripe em tempo real):

```bash
stripe listen --forward-to localhost:3001/api/v1/billing/webhook
```

Coloque o `whsec_...` em `STRIPE_WEBHOOK_SECRET`. Sem webhook, o app usa `POST /billing/sync` ao voltar do Checkout.

## Smoke técnico

```bash
# na raiz — build FE + rotas + unit + integração API (nao inclui e2e)
npm run check

# so unitarios (shared: salePayload, pagination, nfeXmlParser, planCatalog, tenantIsolation…)
npm test --prefix backend

# integracao API (precisa Postgres; Docker db na 5434 por padrao)
# cobre rotas montadas em backend/src/routes.js via src/test/*.integration.test.js
npm run test:integration --prefix backend

# cobertura c8 (unit + integracao → text + lcov)
npm run test:coverage --prefix backend

# e2e Playwright (opcional; nao bloqueia `check` se browsers faltarem)
# API em :3001; front sobe sozinho, ou reuse docker front:
E2E_SKIP_WEBSERVER=1 npm run test:e2e
```

**O que a cobertura automatizada cobre:** contratos HTTP dos módulos montados (auth, users, catalog, customers, sales, stock, crediário, suppliers, reports, dashboard, billing, NF-e import, invoices shells) + utilitários compartilhados + shells Playwright das páginas principais.

**Ainda manual:** NFC-e autorizada na SEFAZ/Nuvem Fiscal, Checkout/Portal Stripe com cartão real de teste, webhook Stripe em tempo real.

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

Habilitar emissão NFC-e **por loja** (`Tenant.enableNfceEmission`) só depois do CNPJ configurado na Nuvem Fiscal — evita emitir com emitente errado.

## 6. Critérios de “homologado”

- [ ] Health OK + Redis up
- [ ] Cadastro de loja funciona
- [ ] Venda baixa estoque
- [ ] NFC-e autoriza em homologação (loja com flag ligada)
- [ ] Import NF-e sobe estoque
- [ ] Checkout Stripe Pro atualiza `Tenant.plan`
- [ ] `npm run check` verde
- [ ] Segredos não estão no Git
