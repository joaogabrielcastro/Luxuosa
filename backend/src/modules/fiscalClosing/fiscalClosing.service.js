import { ZipArchive } from "archiver";
import { InvoiceStatus, NfeImportStatus, SaleStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { getNfeDanfe, getNfeXml } from "../../shared/notaas/notaasApi.js";
import { formatCnpjBr } from "../../shared/fiscal/tenantEmitente.js";
import { formatMoneyBRL, parseFiscalMonth, safeFileName } from "./fiscalClosingMonth.js";

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function sumDecimal(rows, field) {
  return round2(rows.reduce((acc, row) => acc + Number(row[field] || 0), 0));
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildResumoText(summary) {
  const lines = [
    `FECHAMENTO FISCAL — ${summary.period.label}`,
    `Loja: ${summary.tenant.name}`,
    `CNPJ: ${summary.tenant.cnpjFormatado}`,
    "",
    "NFC-e (vendas — modelo 65)",
    `  Emitidas: ${summary.nfce.issued.count} — ${formatMoneyBRL(summary.nfce.issued.totalValue)}`,
    `  Pendentes/erro: ${summary.nfce.pending.count + summary.nfce.error.count}`,
    `  Canceladas (status local): ${summary.nfce.canceled.count}`,
    "",
    "NF-e de entrada (compras — importadas)",
    `  Importadas: ${summary.nfeEntrada.imported.count} — ${formatMoneyBRL(summary.nfeEntrada.imported.totalValue)}`,
    "",
    "Vendas pagas (periodo)",
    `  Quantidade: ${summary.sales.paid.count}`,
    `  Faturamento: ${formatMoneyBRL(summary.sales.paid.totalValue)}`,
    `  Vendas canceladas: ${summary.sales.canceled.count}`,
    "",
    "Arquivos neste pacote",
    `  NFC-e com XML: ${summary.files.nfceXml}`,
    `  NFC-e com PDF: ${summary.files.nfcePdf}`,
    `  NF-e entrada com XML: ${summary.files.nfeEntradaXml}`,
    "",
    "Observacoes:",
    "  - Luxuosa emite NFC-e (mod. 65), nao NF-e de saida (mod. 55).",
    "  - NFS-e e CT-e nao sao geridos por este sistema.",
    "  - Eventos SEFAZ (cancelamento/CC-e) serao incluidos quando implementados.",
    "",
    `Gerado em: ${summary.generatedAt}`
  ];
  return lines.join("\n");
}

async function resolveNfceXml(invoice, apiKey) {
  if (invoice.xmlContent?.trim()) {
    return invoice.xmlContent.trim();
  }
  if (!invoice.externalId || !apiKey) return null;
  const res = await getNfeXml(apiKey, invoice.externalId);
  if (res.ok && typeof res.body === "string" && res.body.trim()) {
    return res.body.trim();
  }
  return null;
}

async function resolveNfcePdf(invoice, apiKey) {
  if (!invoice.externalId || !apiKey) return null;
  const res = await getNfeDanfe(apiKey, invoice.externalId);
  if (res.ok && res.body) {
    return Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body);
  }
  return null;
}

async function loadClosingData(tenantId, period) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, cnpj: true, notaasApiKey: true }
  });
  if (!tenant) {
    const err = new Error("Loja nao encontrada.");
    err.statusCode = 404;
    throw err;
  }

  const [invoices, nfeImports, paidSales, canceledSales] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        tenantId,
        issuedAt: { gte: period.start, lte: period.end }
      },
      include: {
        sale: {
          select: {
            id: true,
            totalValue: true,
            occurredAt: true,
            paymentMethod: true
          }
        }
      },
      orderBy: { issuedAt: "asc" }
    }),
    prisma.nfeImport.findMany({
      where: {
        tenantId,
        status: NfeImportStatus.COMPLETED,
        issuedAt: { gte: period.start, lte: period.end }
      },
      orderBy: { issuedAt: "asc" }
    }),
    prisma.sale.findMany({
      where: {
        tenantId,
        status: SaleStatus.PAID,
        occurredAt: { gte: period.start, lte: period.end }
      },
      select: {
        id: true,
        totalValue: true,
        occurredAt: true,
        paymentMethod: true,
        invoice: {
          select: { status: true, key: true, number: true }
        }
      },
      orderBy: { occurredAt: "asc" }
    }),
    prisma.sale.count({
      where: {
        tenantId,
        status: SaleStatus.CANCELED,
        occurredAt: { gte: period.start, lte: period.end }
      }
    })
  ]);

  const issued = invoices.filter((i) => i.status === InvoiceStatus.ISSUED);
  const pending = invoices.filter((i) => i.status === InvoiceStatus.PENDING);
  const error = invoices.filter((i) => i.status === InvoiceStatus.ERROR);
  const canceled = invoices.filter((i) => i.status === InvoiceStatus.CANCELED);

  return {
    tenant,
    invoices,
    issued,
    pending,
    error,
    canceled,
    nfeImports,
    paidSales,
    canceledSalesCount: canceledSales
  };
}

function buildSummaryFromData(period, data) {
  const { tenant, issued, pending, error, canceled, nfeImports, paidSales, canceledSalesCount } =
    data;

  const summary = {
    period: {
      year: period.year,
      month: period.month,
      label: period.label,
      from: period.from,
      to: period.to
    },
    tenant: {
      name: tenant.name,
      cnpj: tenant.cnpj,
      cnpjFormatado: formatCnpjBr(tenant.cnpj)
    },
    nfce: {
      issued: {
        count: issued.length,
        totalValue: round2(issued.reduce((acc, i) => acc + Number(i.sale?.totalValue || 0), 0))
      },
      pending: { count: pending.length },
      error: { count: error.length },
      canceled: { count: canceled.length }
    },
    nfeEntrada: {
      imported: {
        count: nfeImports.length,
        totalValue: sumDecimal(nfeImports, "totalValue")
      }
    },
    sales: {
      paid: {
        count: paidSales.length,
        totalValue: sumDecimal(paidSales, "totalValue")
      },
      canceled: { count: canceledSalesCount }
    },
    files: {
      nfceXml: issued.filter((i) => Boolean(i.xmlContent?.trim())).length,
      nfcePdf: issued.filter((i) => Boolean(i.externalId)).length,
      nfeEntradaXml: nfeImports.filter((i) => Boolean(i.xmlContent?.trim())).length
    },
    scopeNotes: [
      "NFC-e modelo 65 (vendas ao consumidor).",
      "NF-e modelo 55 apenas como entrada (compras importadas).",
      "NFS-e e CT-e nao se aplicam a este produto.",
      "Cancelamentos fiscais na SEFAZ ainda nao exportados como eventos."
    ],
    generatedAt: new Date().toISOString()
  };

  return summary;
}

export const fiscalClosingService = {
  async getSummary(tenantId, year, month) {
    const period = parseFiscalMonth(year, month);
    const data = await loadClosingData(tenantId, period);
    const summary = buildSummaryFromData(period, data);
    return {
      ...summary,
      details: {
        nfceIssued: data.issued.map((inv) => ({
          saleId: inv.saleId,
          number: inv.number,
          key: inv.key,
          issuedAt: inv.issuedAt,
          totalValue: Number(inv.sale?.totalValue || 0),
          hasXml: Boolean(inv.xmlContent?.trim()),
          hasPdf: Boolean(inv.externalId)
        })),
        nfeEntrada: data.nfeImports.map((row) => ({
          id: row.id,
          accessKey: row.accessKey,
          number: row.number,
          series: row.series,
          issuedAt: row.issuedAt,
          supplierName: row.supplierName,
          totalValue: Number(row.totalValue),
          hasXml: Boolean(row.xmlContent?.trim())
        }))
      }
    };
  },

  async buildExportZip(tenantId, year, month) {
    const period = parseFiscalMonth(year, month);
    const data = await loadClosingData(tenantId, period);
    const summary = buildSummaryFromData(period, data);
    const apiKey =
      env.nfceMock && !String(data.tenant.notaasApiKey || "").trim()
        ? "ntaas_mock_export"
        : String(data.tenant.notaasApiKey || "").trim() || null;

    const salesCsvRows = [
      [
        "data",
        "venda_id",
        "valor",
        "pagamento",
        "nfce_status",
        "nfce_numero",
        "nfce_chave"
      ],
      ...data.paidSales.map((s) => [
        s.occurredAt ? new Date(s.occurredAt).toISOString().slice(0, 10) : "",
        s.id,
        Number(s.totalValue).toFixed(2),
        s.paymentMethod,
        s.invoice?.status || "",
        s.invoice?.number || "",
        s.invoice?.key || ""
      ])
    ];

    let nfceXmlCount = 0;
    let nfcePdfCount = 0;
    let nfeEntradaXmlCount = 0;

    const archive = new ZipArchive({ zlib: { level: 6 } });
    const chunks = [];
    archive.on("data", (chunk) => chunks.push(chunk));

    const zipPromise = new Promise((resolve, reject) => {
      archive.on("error", reject);
      archive.on("end", () => resolve(Buffer.concat(chunks)));
    });

    archive.append(JSON.stringify(summary, null, 2), { name: "resumo.json" });
    archive.append(buildResumoText(summary), { name: "resumo.txt" });
    archive.append(
      `\uFEFF${salesCsvRows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}`,
      { name: "vendas.csv" }
    );

    for (const inv of data.issued) {
      const keyPart = inv.key || inv.saleId;
      const base = safeFileName(`${inv.number || "sem-numero"}_${keyPart.slice(-8)}`, inv.saleId);

      const xml = await resolveNfceXml(inv, apiKey);
      if (xml) {
        archive.append(xml, { name: `nfce/xml/${base}.xml` });
        nfceXmlCount += 1;
      }

      const pdf = await resolveNfcePdf(inv, apiKey);
      if (pdf) {
        archive.append(pdf, { name: `nfce/pdf/${base}.pdf` });
        nfcePdfCount += 1;
      }
    }

    for (const row of data.nfeImports) {
      if (!row.xmlContent?.trim()) continue;
      const base = safeFileName(row.accessKey || row.id, row.id);
      archive.append(row.xmlContent.trim(), { name: `nfe-entrada/xml/${base}.xml` });
      nfeEntradaXmlCount += 1;
    }

    summary.files = {
      nfceXml: nfceXmlCount,
      nfcePdf: nfcePdfCount,
      nfeEntradaXml: nfeEntradaXmlCount
    };
    archive.append(JSON.stringify(summary, null, 2), { name: "resumo-com-contagem-arquivos.json" });

    await archive.finalize();
    const buf = await zipPromise;

    const slug = safeFileName(data.tenant.name, "loja");
    const filename = `fechamento-fiscal_${slug}_${period.year}-${String(period.month).padStart(2, "0")}.zip`;

    return { buf, filename, summary };
  }
};
