const CATEGORIES = [{ id: "cat1", name: "Vestidos" }];
const BRANDS = [{ id: "br1", name: "Lux" }];
const USERS = [
  { id: "u1", name: "Admin", email: "a@loja.com", type: "ADMIN" },
  { id: "u2", name: "Ana", email: "ana@loja.com", type: "ATTENDANT" }
];
const CUSTOMERS = {
  items: [{ id: "cust1", name: "Maria Silva", cpfCnpj: "52998224725", phone: "11999999999", email: "maria@loja.com" }],
  total: 1
};
const VARIATIONS = {
  items: [
    {
      id: "var1",
      size: "M",
      color: "Preto",
      stock: 8,
      product: {
        id: "p1",
        name: "Camisa",
        sku: "CAM-01",
        price: 89.9,
        minStock: 2,
        categoryId: "cat1",
        brandId: "br1"
      }
    }
  ],
  total: 1
};
const PRODUCTS = {
  items: [
    {
      id: "p1",
      name: "Camisa",
      price: 89.9,
      cost: 40,
      sku: "CAM-01",
      minStock: 2,
      categoryId: "cat1",
      brandId: "br1",
      category: { id: "cat1", name: "Vestidos" },
      brand: { id: "br1", name: "Lux" },
      variations: VARIATIONS.items
    }
  ],
  total: 1
};
const CREDIT_SALE = {
  id: "cs1",
  status: "PAID",
  occurredAt: "2026-09-01T12:00:00.000Z",
  totalValue: 100,
  paidTotal: 100,
  paidAmount: 100,
  remaining: 0,
  customer: { id: "cust1", name: "Maria Silva", cpfCnpj: "52998224725" },
  items: [],
  payments: []
};
const OPEN_CREDIT = {
  ...CREDIT_SALE,
  id: "cs-open",
  status: "OPEN",
  paidTotal: 0,
  paidAmount: 0,
  remaining: 100
};

export const NFE_PREVIEW = {
  invoice: {
    number: "10",
    series: "1",
    issuedAt: "2026-09-01",
    totalValue: 100,
    itemCount: 1,
    accessKey: "35260900000000000000000000000000000000000000"
  },
  supplier: { name: "Fornecedor SA", tradeName: "Forn", stateRegistration: "123", taxId: "12345678000199", existing: null },
  items: [
    {
      lineNumber: 1,
      supplierCode: "C1",
      ean: "789",
      description: "Camisa polo",
      ncm: "6109",
      cfop: "5102",
      unit: "UN",
      quantity: 2,
      quantityEntered: 2,
      unitValue: 50,
      totalValue: 100,
      matchStatus: "NOT_FOUND",
      matchedProduct: null,
      suggestedAction: "create",
      warnings: []
    }
  ]
};

export const FISCAL_SUMMARY = {
  period: { label: "Setembro 2026" },
  nfce: {
    issued: { count: 1, totalValue: 100 },
    pending: { count: 0 },
    error: { count: 0 }
  },
  nfeEntrada: { imported: { count: 0, totalValue: 0 } },
  sales: {
    paid: { count: 2, totalValue: 200 },
    canceled: { count: 0 }
  },
  files: { nfceXml: 1, nfeEntradaXml: 0 },
  scopeNotes: []
};

function pathOnly(path) {
  return String(path).split("?")[0];
}

export async function mockApi(path, { method = "GET", body } = {}) {
  const verb = String(method || "GET").toUpperCase();
  const pathname = pathOnly(path);

  if (verb !== "GET") {
    if (pathname === "/categories") return { id: "cat-new", name: body?.name || "Nova" };
    if (pathname === "/users") return { id: "u-new", name: body?.name || "Novo", type: body?.type || "ATTENDANT" };
    if (pathname === "/nfe-imports/preview") return NFE_PREVIEW;
    if (pathname === "/nfe-imports/confirm") {
      return { id: "imp1", status: "COMPLETED", number: "10", series: "1", accessKey: "3526", itemCount: 1, totalValue: 100 };
    }
    if (pathname === "/products") return { id: "p-new", name: body?.name || "Novo", variations: [] };
    if (pathname === "/customers") return { id: "cust-new", name: body?.name || "Novo" };
    if (pathname === "/cash/open") {
      return { session: { id: "cash1", status: "OPEN", openingFloat: 0, openedAt: new Date().toISOString() } };
    }
    if (pathname === "/stock-alerts/run") return { ran: true, alerts: [{ id: "p1" }] };
    if (pathname === "/billing/checkout") return { url: "https://stripe.test/checkout" };
    if (pathname === "/billing/portal") return { url: "https://stripe.test/portal" };
    if (pathname === "/billing/sync") {
      return { configured: true, currentPlan: "PRO", hasStripeCustomer: true, plans: [] };
    }
    return { ok: true };
  }

  if (pathname === "/auth/stores") {
    return { canSwitch: false, stores: [] };
  }
  if (pathname === "/categories") return CATEGORIES;
  if (pathname === "/brands") return BRANDS;
  if (pathname === "/users") return USERS;
  if (pathname === "/suppliers") return [];
  if (pathname === "/dashboard/admin") {
    return {
      monthlyRevenue: 500,
      daySales: 2,
      ticketAverage: 80,
      crediarioOpenBalance: 100,
      crediarioOpenCount: 1,
      crediarioReceivedMonth: 40,
      lowStockCount: 1,
      lowStockItems: [{ id: "p1", name: "Camisa", currentStock: 0, minStock: 2, severity: "critical" }],
      lastSales: [
        {
          id: "sale1",
          totalValue: 89.9,
          paymentMethod: "PIX",
          occurredAt: "2026-09-01T12:00:00.000Z",
          user: { name: "Admin" }
        }
      ],
      salesByPeriod: [],
      salesByAttendant: [{ userId: "u1", name: "Admin", sales: 2, amount: 150 }],
      profitByProduct: [{ productId: "p1", name: "Camisa", revenue: 200, profit: 80 }],
      productsWithoutSales: [{ productId: "p2", name: "Saia", lastSaleAt: null }],
      stockConsolidated: []
    };
  }
  if (pathname === "/billing/status") {
    return {
      configured: false,
      currentPlan: "PRO",
      hasStripeCustomer: false,
      plans: [
        { id: "BASIC", name: "Básico", description: "Operação essencial", priceLabel: "Grátis", features: [], current: false },
        { id: "PRO", name: "Pro", description: "Notas fiscais", priceLabel: "R$ 99", features: ["NFC-e"], current: true }
      ]
    };
  }
  if (pathname === "/cash/current") {
    return { session: null, preview: { saleCount: 0, totalAmount: 0, expectedCash: 0, expectedDrawer: 0, totalsByMethod: {} } };
  }
  if (pathname === "/cash") {
    return {
      items: [
        {
          id: "cash-closed",
          status: "CLOSED",
          openedAt: "2026-09-01T10:00:00.000Z",
          saleCount: 3,
          expectedCash: 80,
          countedCash: 79,
          differenceCash: -1
        }
      ],
      total: 1
    };
  }
  if (pathname === "/reports/low-stock") {
    return {
      items: [
        {
          id: "p1",
          name: "Camisa",
          sku: "CAM-01",
          currentStock: 0,
          minStock: 2,
          severity: "critical",
          category: "Vestidos",
          brand: "Lux"
        }
      ]
    };
  }
  if (pathname.startsWith("/reports/sales")) {
    return {
      saleCount: 2,
      totalAmount: 150,
      ticketAverage: 75,
      byDay: [
        { date: "2026-09-01", count: 1, amount: 50 },
        { date: "2026-09-02", count: 1, amount: 100 }
      ],
      byPayment: [
        { method: "PIX", count: 1, amount: 50 },
        { method: "CASH", count: 1, amount: 100 }
      ],
      byAttendant: [{ userId: "u1", name: "Admin", sales: 2, amount: 150 }],
      advanced: null
    };
  }
  if (pathname.startsWith("/customers")) return CUSTOMERS;
  if (pathname === "/crediario") {
    return { items: [CREDIT_SALE, OPEN_CREDIT], total: 2 };
  }
  if (pathname === "/crediario/cs-open") return OPEN_CREDIT;
  if (pathname.startsWith("/crediario/")) return CREDIT_SALE;
  if (pathname.startsWith("/products")) return PRODUCTS;
  if (pathname.startsWith("/product-variations")) return VARIATIONS;
  if (pathname.startsWith("/sales/summary") || pathname === "/sales") {
    return {
      items: [
        {
          id: "sale1",
          occurredAt: "2026-09-01T12:00:00.000Z",
          totalValue: 89.9,
          paymentMethod: "CASH",
          status: "PAID",
          invoice: { status: "ISSUED", number: "1", key: "35260900000000000000000000000000000000000000" },
          nfceJob: { status: "COMPLETED" }
        },
        {
          id: "sale-err",
          occurredAt: "2026-09-02T12:00:00.000Z",
          totalValue: 50,
          paymentMethod: "PIX",
          status: "PAID",
          invoice: { status: "ERROR", lastError: "timeout sefaz" },
          nfceJob: { status: "FAILED", lastError: "timeout" }
        }
      ],
      total: 2
    };
  }
  if (pathname === "/stock-alerts/settings") {
    return { enabled: true, email: "estoque@loja.com", phone: "11999999999", minSeverity: "low", cooldownMin: 1440 };
  }
  if (pathname.startsWith("/stock-alerts/logs")) {
    return {
      items: [
        {
          id: "log1",
          sentAt: "2026-09-01T12:00:00.000Z",
          channel: "EMAIL",
          severity: "critical",
          status: "SENT",
          message: "Camisa zerada"
        }
      ],
      total: 1
    };
  }
  if (pathname.startsWith("/stock-movements")) return { items: [], total: 0 };
  if (pathname === "/invoices/connection-test") {
    return { ok: true, environment: "homologacao", tenant: { cnpjFormatado: "12.345.678/0001-99" }, warnings: ["sem certificado"] };
  }
  if (pathname.startsWith("/nfe-imports/") && pathname !== "/nfe-imports") {
    return {
      id: "imp1",
      number: "10",
      series: "1",
      accessKey: "3526",
      supplierName: "Fornecedor SA",
      totalValue: 100,
      user: { name: "Admin" },
      items: [
        {
          id: "i1",
          lineNumber: 1,
          description: "Camisa polo",
          quantityEntered: 2,
          action: "create",
          product: { name: "Camisa polo" }
        }
      ]
    };
  }
  if (pathname.startsWith("/nfe-imports")) {
    return {
      items: [
        {
          id: "imp1",
          number: "10",
          series: "1",
          accessKey: "3526",
          supplierName: "Fornecedor SA",
          supplierCnpj: "12345678000199",
          issuedAt: "2026-09-01",
          importedAt: "2026-09-01T12:00:00.000Z",
          totalValue: 100,
          itemCount: 1,
          status: "COMPLETED",
          user: { name: "Admin" }
        }
      ],
      total: 1
    };
  }

  return {};
}

export function jsonResponse(data, ok = true) {
  return {
    ok,
    headers: { get: () => "" },
    json: async () => data,
    blob: async () => new Blob([JSON.stringify(data)])
  };
}
