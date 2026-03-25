import { ZodError } from "zod";

const FIELD_PT = {
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  cpfCnpj: "CPF/CNPJ",
  address: "Endereco",
  unitPrice: "Preco unitario",
  quantity: "Quantidade",
  productVariationId: "Produto",
  paymentMethod: "Forma de pagamento",
  installments: "Parcelas",
  discountValue: "Desconto (valor)",
  discountPercent: "Desconto (%)",
  items: "Itens",
  categoryId: "Categoria",
  sku: "SKU",
  price: "Preco",
  cost: "Custo",
  minStock: "Estoque minimo",
  description: "Descricao",
  ncm: "NCM",
  cfop: "CFOP",
  icmsOrig: "ICMS origem",
  icmsCsosn: "CSOSN",
  uf: "UF",
  cep: "CEP",
  ibgeMunicipio: "Codigo IBGE do municipio",
  municipioNome: "Municipio",
  size: "Tamanho",
  color: "Cor",
  stock: "Estoque",
  initialValue: "Valor inicial",
  value: "Valor",
  password: "Senha"
};

function fieldLabel(path) {
  const last = path[path.length - 1];
  if (typeof last === "string" && FIELD_PT[last]) return FIELD_PT[last];
  return null;
}

function itemPrefix(path) {
  if (path[0] === "items" && typeof path[1] === "number") {
    return `Item ${path[1] + 1}`;
  }
  return null;
}

function translateIssue(issue) {
  const { code, type, message } = issue;

  if (code === "invalid_type" && issue.received === "undefined") {
    return "campo obrigatorio.";
  }
  if (code === "too_small") {
    if (type === "string") return "texto muito curto.";
    if (type === "number") {
      if (issue.minimum === 0 && issue.inclusive === false) return "deve ser maior que zero.";
      if (issue.minimum === 1 && issue.inclusive === true) return "deve ser pelo menos 1.";
      return "valor abaixo do permitido.";
    }
    if (type === "array") return "lista com poucos itens.";
  }
  if (code === "too_big") {
    if (type === "string") return "texto muito longo.";
    if (type === "number") return "valor acima do permitido.";
  }
  if (code === "invalid_string") {
    if (issue.validation === "email") return "formato de e-mail invalido.";
  }
  if (code === "invalid_enum_value") return "valor invalido para o campo.";
  if (code === "invalid_literal") return "valor invalido.";

  if (message && !/^[\[{]/.test(message.trim())) {
    return message.endsWith(".") ? message : `${message}.`;
  }
  return "valor invalido.";
}

/**
 * @param {ZodError} err
 */
export function formatZodError(err) {
  if (!(err instanceof ZodError)) return null;
  const issues = err.issues || [];
  if (issues.length === 0) return "Dados invalidos.";

  const messages = issues.map((issue) => {
    const path = issue.path || [];
    const prefix = itemPrefix(path);
    const label = fieldLabel(path);
    const reason = translateIssue(issue);

    if (prefix && label) {
      return `${prefix} — ${label.toLowerCase()}: ${reason}`;
    }
    if (prefix) {
      return `${prefix}: ${reason}`;
    }
    if (label) {
      return `${label}: ${reason}`;
    }
    return reason.charAt(0).toUpperCase() + reason.slice(1);
  });

  return messages.join(" ");
}

export function isZodError(err) {
  return err instanceof ZodError || err?.name === "ZodError";
}
