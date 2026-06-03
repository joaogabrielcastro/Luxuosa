/** Chaves centralizadas para TanStack Query (invalidação por prefixo). */

export const queryKeys = {
  catalog: {
    all: (token) => ["catalog", token],
    categories: (token) => ["catalog", token, "categories"],
    brands: (token) => ["catalog", token, "brands"],
    variations: (token) => ["catalog", token, "variations"]
  },
  sales: {
    all: (token) => ["sales", token],
    summary: (token, params) => ["sales", token, "summary", params]
  },
  products: {
    all: (token) => ["products", token],
    list: (token, params) => ["products", token, "list", params]
  },
  customers: {
    all: (token) => ["customers", token],
    list: (token) => ["customers", token, "list"]
  },
  crediario: {
    all: (token) => ["crediario", token],
    list: (token, params) => ["crediario", token, "list", params],
    detail: (token, id) => ["crediario", token, "detail", id]
  },
  stock: {
    all: (token) => ["stock", token],
    movements: (token, params) => ["stock", token, "movements", params]
  },
  reports: {
    all: (token) => ["reports", token],
    sales: (token, range) => ["reports", token, "sales", range],
    lowStock: (token) => ["reports", token, "lowStock"]
  },
  namedResource: (resource, token) => [resource, token, "list"]
};
