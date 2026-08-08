/** Monta payload Notaas POST /nfe/emitir (modelo 65 NFC-e) a partir da venda Luxuosa. */

const PAYMENT_TO_TPAG = {
  CASH: "01",
  CREDIT_CARD: "03",
  DEBIT_CARD: "04",
  PIX: "17",
  INSTALLMENT: "03"
};

export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function paymentTipo(method) {
  return PAYMENT_TO_TPAG[method] || "99";
}

/**
 * @param {{ sale: object }} params
 */
export function buildNotaasNfcePayload({ sale }) {
  const items = (sale.items || []).map((line, idx) => {
    const product = line.productVariation?.product || {};
    const qty = Math.max(1, Number(line.quantity) || 1);
    const unit = round2(line.unitPrice);
    const total = round2(unit * qty);
    const ncm = digitsOnly(product.ncm || "61091000").slice(0, 8).padStart(8, "0");
    const cfop = digitsOnly(product.cfop || "5102").slice(0, 4).padStart(4, "0");
    const csosn = String(product.icmsCsosn || "102").trim() || "102";
    const ean = digitsOnly(product.sku || "");
    const item = {
      descricao: String(product.name || `Item ${idx + 1}`).slice(0, 120),
      codigo: String(product.sku || product.id || `PRD${idx + 1}`).slice(0, 60),
      ncm,
      cfop,
      quantidade: qty,
      valorUnitario: unit,
      valorTotal: total,
      unidade: "UN",
      csosn
    };
    if (ean.length >= 8 && ean.length <= 14) {
      item.ean = ean;
    }
    return item;
  });

  if (!items.length) {
    const err = new Error("Venda sem itens para emitir NFC-e.");
    err.statusCode = 400;
    throw err;
  }

  const discount = round2(sale.discountValue || 0);
  if (discount > 0 && items.length) {
    // Rateio simples no primeiro item (Notaas aceita desconto por item)
    const d = Math.min(discount, items[0].valorTotal - 0.01);
    if (d > 0) {
      items[0].desconto = round2(d);
      items[0].valorTotal = round2(items[0].valorTotal - d);
    }
  }

  const totalPaid = round2(
    items.reduce((acc, it) => acc + Number(it.valorTotal) - Number(it.desconto || 0), 0)
  );
  const tPag = paymentTipo(sale.paymentMethod);
  const pagamento = {
    tipoPagamento: tPag,
    valor: totalPaid > 0 ? totalPaid : round2(sale.totalValue || 0)
  };
  if (tPag === "99") {
    pagamento.descricaoPagamento = "Outros";
  }

  const payload = {
    modelo: 65,
    naturezaOperacao: "Venda de mercadoria",
    tipoOperacao: 1,
    finalidade: 1,
    consumidorFinal: 1,
    presencaComprador: 1,
    transporte: { modalidadeFrete: 9 },
    items,
    pagamentos: [pagamento],
    referencia: sale.id
  };

  const customer = sale.customer;
  if (customer) {
    const doc = digitsOnly(customer.cpfCnpj);
    const nome = String(customer.name || "").trim();
    if (nome.length >= 2 && (doc.length === 11 || doc.length === 14)) {
      const dest = {
        nome: nome.slice(0, 60),
        indicadorIE: 9
      };
      if (doc.length === 11) dest.cpf = doc;
      else dest.cnpj = doc;
      if (customer.email) dest.email = String(customer.email).trim();
      // Sem codigo IBGE confiavel no cadastro, NFC-e vai so com identificacao do consumidor.
      payload.dest = dest;
    }
  }

  return payload;
}
