/** Chaves centralizadas para TanStack Query (invalidação por prefixo). */

export const queryKeys = {
  catalog: {
    all: (token) => ["catalog", token],
    categories: (token) => ["catalog", "categories", token],
    brands: (token) => ["catalog", "brands", token],
    variations: (token) => ["catalog", "variations", token]
  },
  sales: {
    all: (token) => ["sales", token],
    summary: (token, params) => ["sales", "summary", token, params]
  },
  products: {
    all: (token) => ["products", token],
    list: (token, params) => ["products", "list", token, params]
  },
  customers: {
    list: (token) => ["customers", "list", token]
  },
  crediario: {
    all: (token) => ["crediario", token],
    list: (token, params) => ["crediario", "list", token, params],
    detail: (token, id) => ["crediario", "detail", token, id]
  },
  stock: {
    all: (token) => ["stock", token],
    movements: (token, params) => ["stock", "movements", token, params]
  },
  reports: {
    all: (token) => ["reports", token],
    sales: (token, range) => ["reports", "sales", token, range],
    lowStock: (token) => ["reports", "lowStock", token]
  },
  namedResource: (resource, token) => [resource, "list", token]
};
