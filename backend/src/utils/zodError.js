import { ZodError } from "zod";

const FIELD_PT = {
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  cpfCnpj: "CPF/CNPJ",
  address: "Endereco",
  unitPrice: "Preco unitario",
  quantity: "Quantidade",
  productVariationId: "Variacao do produto",
  productId: "Produto",
  customerId: "Cliente",
  paymentMethod: "Forma de pagamento",
  installments: "Parcelas",
  discountValue: "Desconto (valor)",
  discountPercent: "Desconto (%)",
  items: "Itens",
  categoryId: "Categoria",
  brandId: "Marca",
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
  password: "Senha",
  tenantCnpj: "CNPJ da loja",
  amount: "Valor",
  notes: "Observacoes",
  note: "Observacao",
  paidAt: "Data do pagamento",
  creditSaleId: "Venda a prazo",
  saleId: "Venda",
  type: "Tipo",
  occurredAt: "Data",
  from: "Data inicial",
  to: "Data final",
  compact: "Modo compacto",
  q: "Busca",
  take: "Quantidade por pagina",
  skip: "Pagina"
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

  if (code === "invalid_type") {
    if (issue.received === "undefined" || issue.received === "null") {
      return "campo obrigatorio — preencha para continuar.";
    }
    return "tipo de dado invalido.";
  }
  if (code === "too_small") {
    if (type === "string") {
      if (issue.minimum === 1) return "preencha este campo.";
      return "texto muito curto.";
    }
    if (type === "number") {
      if (issue.minimum === 0 && issue.inclusive === false) return "deve ser maior que zero.";
      if (issue.minimum === 1 && issue.inclusive === true) return "deve ser pelo menos 1.";
      return "valor abaixo do permitido.";
    }
    if (type === "array") return "adicione pelo menos um item na lista.";
  }
  if (code === "too_big") {
    if (type === "string") return "texto muito longo.";
    if (type === "number") return "valor acima do permitido.";
  }
  if (code === "invalid_string") {
    if (issue.validation === "email") return "informe um e-mail valido.";
  }
  if (code === "invalid_enum_value") return "selecione uma opcao valida.";
  if (code === "invalid_literal") return "valor invalido.";
  if (code === "custom") {
    if (message && !/^[\[{]/.test(message.trim())) {
      return message.endsWith(".") ? message : `${message}.`;
    }
  }

  if (message && !/^[\[{]/.test(message.trim()) && !message.includes("Expected")) {
    return message.endsWith(".") ? message : `${message}.`;
  }
  return "valor invalido — revise o campo.";
}

function formatSingleIssue(issue) {
  const path = issue.path || [];
  const prefix = itemPrefix(path);
  const label = fieldLabel(path);
  const reason = translateIssue(issue);

  if (prefix && label) {
    return `${prefix} — ${label}: ${reason}`;
  }
  if (prefix) {
    return `${prefix}: ${reason}`;
  }
  if (label) {
    return `${label}: ${reason}`;
  }
  return reason.charAt(0).toUpperCase() + reason.slice(1);
}

/**
 * @param {ZodError} err
 */
export function formatZodError(err) {
  if (!(err instanceof ZodError)) return null;
  const issues = err.issues || [];
  if (issues.length === 0) return "Revise os campos do formulario antes de continuar.";

  const messages = issues.map(formatSingleIssue);
  if (messages.length === 1) return messages[0];
  return `Corrija os seguintes pontos: ${messages.join(" ")}`;
}

/**
 * Lista estruturada para o frontend destacar campos.
 * @param {ZodError} err
 */
export function formatZodErrorDetails(err) {
  if (!(err instanceof ZodError)) return [];
  return (err.issues || []).map((issue) => ({
    field: (issue.path || []).join("."),
    message: formatSingleIssue(issue)
  }));
}

export function isZodError(err) {
  return err instanceof ZodError || err?.name === "ZodError";
}
