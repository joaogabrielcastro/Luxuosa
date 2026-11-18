# Luxuosa — Plano de evolução do backend

Planejamento (não implementado) das funcionalidades que o redesenho do frontend identificou como
necessárias, mas que dependem de mudanças no banco de dados e na API. Nenhuma delas foi simulada
no frontend com dados fictícios.

Princípios para todas as fases:

- **Mudanças aditivas.** Colunas e tabelas novas; nada é removido ou renomeado no mesmo deploy.
- **Contratos preservados.** Os campos atuais da API continuam existindo com o mesmo significado.
- **Migração com backfill.** Cada fase traz migração Prisma + script de preenchimento idempotente.
- **Regras sensíveis com aprovação.** Caixa, NFC-e, crediário e planos só mudam após validação do
  responsável pelo produto.

---

## 1. Pagamento combinado (ex.: parte no PIX, parte no dinheiro)

**Situação atual.** `Sale.paymentMethod` e `Sale.installments` guardam **uma** forma por venda. O caixa
(`cash.service`) soma por `paymentMethod`; o emissor NFC-e (`notaasNfceBuilder`) já envia
`pagamentos: [ ... ]` (lista), mas com um único item.

**Modelo proposto.**

```prisma
model SalePayment {
  id            String        @id @default(cuid())
  tenantId      String
  saleId        String
  paymentMethod PaymentMethod
  amount        Decimal       @db.Decimal(12, 2)
  installments  Int           @default(1)
  createdAt     DateTime      @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])
  sale   Sale   @relation(fields: [saleId], references: [id], onDelete: Cascade)

  @@index([tenantId, saleId])
  @@index([tenantId, paymentMethod])
}
```

- `Sale.paymentMethod` continua existindo: recebe a forma **principal** (maior valor), para manter
  relatórios, filtros e integrações atuais funcionando.
- Backfill: uma linha `SalePayment` por venda existente, com `amount = totalValue`.

**API.** `POST/PUT /sales` aceita `payments: [{ paymentMethod, amount, installments }]` opcional.
Sem `payments`, o comportamento atual é mantido. Validação: soma = `totalValue` (tolerância de
R$ 0,01), parcelamento só em `INSTALLMENT`, no máximo uma linha `CASH` (para o troco).

**Impactos a validar.**

| Área | Mudança |
|---|---|
| Caixa | `totalsByMethod` passa a somar `SalePayment`. `expectedCash` = soma das linhas `CASH`. |
| NFC-e | Uma entrada em `pagamentos` por linha (tPag por forma); troco informado em `vTroco`. Homologar no Notaas antes de produção. |
| Relatórios / dashboard | `byPayment` agrega `SalePayment` (soma exata por forma). |
| Fechamento fiscal | O CSV exporta as formas por venda. |

**Frontend (pronto para receber).** O carrinho do PDV (`usePosCart`/`buildSalePayload`) já centraliza
o corpo da venda; basta adicionar a lista de pagamentos e uma UI "Dividir pagamento".

**Esforço estimado:** médio (backend 3–4 dias + homologação fiscal).

---

## 2. Contas a pagar e fluxo de caixa

**Situação atual.** Não há registro de despesas. O "financeiro" é composto por Caixa (sessões),
vendas pagas e recebimentos de crediário.

**Modelo proposto.**

```prisma
enum PayableStatus { OPEN PAID CANCELED }

model ExpenseCategory {
  id       String @id @default(cuid())
  tenantId String
  name     String
  @@unique([tenantId, name])
}

model Payable {
  id          String        @id @default(cuid())
  tenantId    String
  description String
  categoryId  String?
  supplierId  String?       // reaproveita Supplier (NF-e de entrada)
  nfeImportId String?       // conta gerada a partir de uma NF-e importada
  amount      Decimal       @db.Decimal(12, 2)
  dueDate     DateTime
  paidAt      DateTime?
  paidAmount  Decimal?      @db.Decimal(12, 2)
  method      PaymentMethod?
  status      PayableStatus @default(OPEN)
  notes       String?
  createdAt   DateTime      @default(now())
  @@index([tenantId, status, dueDate])
}
```

**API.** CRUD `/payables` (admin), `POST /payables/:id/pay`, `GET /finance/cash-flow?from&to`
retornando por dia: entradas (vendas pagas + recebimentos de crediário), saídas (contas pagas) e saldo.
Previsto: contas em aberto e parcelas de crediário com vencimento.

**Integrações.** Opcional: ao confirmar uma NF-e de entrada, sugerir a conta a pagar com os dados de
`paymentInfo` da nota (sem criar automaticamente).

**Plano.** Decisão comercial pendente: se entra no BASIC ou a partir do PRO. Até a decisão, o gate
fica desligado (não bloquear nada que hoje está liberado).

**Esforço estimado:** médio-alto (backend 4–5 dias; frontend: módulo novo Financeiro → Contas a
pagar e Fluxo de caixa, reaproveitando DataTable, StatCard e o gráfico do Início).

---

## 3. Imagens de produto

**Situação atual.** `Product` não tem imagem. O PDV mostra iniciais do produto no cartão.

**Modelo proposto.**

```prisma
model ProductImage {
  id        String   @id @default(cuid())
  tenantId  String
  productId String
  url       String   // URL pública do arquivo otimizado
  thumbUrl  String   // 160px, usada no PDV e nas listas
  position  Int      @default(0)
  color     String?  // opcional: foto por cor da grade
  createdAt DateTime @default(now())
  @@index([tenantId, productId])
}
```

**Armazenamento.** Objeto externo (S3 compatível / R2) com URL assinada para upload direto do
navegador (`POST /products/:id/images/upload-url`) e confirmação (`POST /products/:id/images`).
Redimensionamento no servidor (sharp) para `thumb` (160px) e `card` (640px) em WebP.

**API.** As listagens de produtos e variações passam a incluir `coverThumbUrl` (campo novo,
opcional). Limite por produto (ex.: 8 fotos) e por tamanho (ex.: 5 MB).

**Frontend.** `ProductCard` do PDV e lista de produtos exibem a miniatura com `loading="lazy"`,
`width/height` fixos e fallback para as iniciais atuais.

**Esforço estimado:** médio (2–3 dias + configuração do storage). Requer variáveis de ambiente novas.

---

## 4. Histórico de vendas por cliente

**Situação atual.** A ficha do cliente mostra o histórico do **crediário** (`/crediario/customers/:id/statement`)
e o total acumulado (`Customer.totalPurchases`), mas `GET /sales` não filtra por cliente.

**Proposta (sem mudança de banco).** Aceitar `customerId` em `GET /sales` e `GET /sales/summary`
(o índice `Sale(tenantId)` existe; adicionar `@@index([tenantId, customerId])` em migração leve).

**Frontend.** A ficha do cliente ganha a aba "Compras à vista" usando o mesmo `useSalesList`.

**Esforço estimado:** baixo (meio dia).

---

## 5. Ajustes menores identificados

| Item | Proposta | Esforço |
|---|---|---|
| `GET /stock-movements` sem `total` | Retornar `{ items, total, take, skip }` como as demais listagens (manter array por compatibilidade via `?format=paged`). | baixo |
| Busca de variações por tamanho/cor | Incluir `size` e `color` no `OR` de `productVariationRepository.listPaged` (hoje o PDV refina localmente). | baixo |
| Filtro por período em `/sales` | `from`/`to` em `GET /sales` para o histórico e as notas fiscais. | baixo |
| Comparação de períodos | Já existe em `reports.advanced` (Enterprise). Sem mudança; apenas documentado. | — |
| Sessão e permissões | `entitlements` adicionados em `/auth/me` nesta entrega (aditivo). | feito |

---

## Ordem sugerida

1. Histórico por cliente e ajustes menores (baixo risco, valor imediato).
2. Imagens de produto (melhora o PDV e o catálogo).
3. Pagamento combinado (exige homologação fiscal).
4. Contas a pagar e fluxo de caixa (exige decisão de plano).
