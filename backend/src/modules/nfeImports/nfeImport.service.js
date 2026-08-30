import { NfeImportItemAction, NfeImportStatus, StockMovementType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { parseNfeXml } from "../../shared/nfeXmlParser.js";
import { createAppError, ERROR_CODES } from "../../utils/appErrors.js";
import { matchProductForItem } from "./nfeImportMatch.js";

function formatDateBR(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function toStockQty(quantity) {
  const n = Number(quantity);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 0.0001) return rounded;
  // Quantidades fracionadas: arredonda para cima se >= .5, senao exige inteiro
  if (Math.abs(n - Math.floor(n)) > 0.0001) {
    return Math.max(1, Math.round(n));
  }
  return Math.floor(n);
}

function serializeDecimal(value) {
  if (value == null) return null;
  return Number(value);
}

function serializeImport(row) {
  if (!row) return null;
  return {
    ...row,
    totalValue: serializeDecimal(row.totalValue),
    items: Array.isArray(row.items)
      ? row.items.map((item) => ({
          ...item,
          quantity: serializeDecimal(item.quantity),
          unitValue: serializeDecimal(item.unitValue),
          totalValue: serializeDecimal(item.totalValue)
        }))
      : undefined
  };
}

function pickDefaultVariation(product) {
  if (!product?.variations?.length) return null;
  const def = product.variations.find(
    (v) => String(v.size || "").trim() === "" && String(v.color || "").trim() === ""
  );
  return def || product.variations[0];
}

function matchStatus(matchedProduct) {
  if (matchedProduct) return "FOUND";
  return "NEEDS_LINK";
}

async function getOrCreateDefaultVariation(tx, tenantId, productId) {
  let variation = await tx.productVariation.findFirst({
    where: { tenantId, productId, size: "", color: "" }
  });
  if (!variation) {
    variation = await tx.productVariation.create({
      data: { tenantId, productId, size: "", color: "", stock: 0 }
    });
  }
  return variation;
}

function normalizeSizeColor(decision) {
  const size = decision?.size != null ? String(decision.size).trim() : "";
  const color = decision?.color != null ? String(decision.color).trim() : "";
  return { size, color };
}

function assertSizeColorCoherence(size, color, lineNumber) {
  if ((size === "" && color !== "") || (size !== "" && color === "")) {
    throw createAppError(
      `Item ${lineNumber}: preencha Tamanho e Cor juntos, ou deixe ambos em branco.`,
      400,
      ERROR_CODES.VALIDATION
    );
  }
}

/** Resolve variacao: variationId, size+color (cria se preciso) ou padrao vazia. */
async function resolveVariationForEntry(tx, tenantId, productId, decision, lineNumber) {
  if (decision?.variationId) {
    const variation = await tx.productVariation.findFirst({
      where: { tenantId, id: decision.variationId, productId }
    });
    if (!variation) {
      throw createAppError(
        `Item ${lineNumber}: variacao selecionada nao pertence a este produto.`,
        400,
        ERROR_CODES.VALIDATION
      );
    }
    return variation;
  }

  const { size, color } = normalizeSizeColor(decision);
  assertSizeColorCoherence(size, color, lineNumber);

  if (size === "" && color === "") {
    return getOrCreateDefaultVariation(tx, tenantId, productId);
  }

  let variation = await tx.productVariation.findFirst({
    where: { tenantId, productId, size, color }
  });
  if (!variation) {
    variation = await tx.productVariation.create({
      data: { tenantId, productId, size, color, stock: 0 }
    });
  }
  return variation;
}

export const nfeImportService = {
  async list(tenantId, { take = 50, skip = 0 } = {}) {
    const limit = Math.min(Math.max(Number(take) || 50, 1), 200);
    const offset = Math.max(Number(skip) || 0, 0);
    const [items, total] = await Promise.all([
      prisma.nfeImport.findMany({
        where: { tenantId },
        orderBy: { importedAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          supplier: true,
          user: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.nfeImport.count({ where: { tenantId } })
    ]);
    return {
      items: items.map(serializeImport),
      total,
      take: limit,
      skip: offset
    };
  },

  async getById(tenantId, id) {
    const row = await prisma.nfeImport.findFirst({
      where: { tenantId, id },
      include: {
        supplier: true,
        user: { select: { id: true, name: true, email: true } },
        items: {
          orderBy: { lineNumber: "asc" },
          include: {
            product: { include: { category: true, brand: true } },
            productVariation: true
          }
        }
      }
    });
    return serializeImport(row);
  },

  async findByAccessKey(tenantId, accessKey) {
    return prisma.nfeImport.findFirst({
      where: { tenantId, accessKey },
      include: {
        supplier: true,
        user: { select: { id: true, name: true, email: true } }
      }
    });
  },

  async preview(tenantId, xmlContent) {
    const parsed = parseNfeXml(xmlContent);
    const existing = await this.findByAccessKey(tenantId, parsed.accessKey);
    if (existing && existing.status === NfeImportStatus.COMPLETED) {
      const err = createAppError(
        `Esta NF-e ja foi importada anteriormente em ${formatDateBR(existing.importedAt)}.`,
        409,
        ERROR_CODES.CONFLICT
      );
      err.existingImport = serializeImport(existing);
      throw err;
    }

    const supplierTaxId = parsed.supplier.taxId;
    const supplier =
      supplierTaxId.length === 14
        ? await prisma.supplier.findFirst({ where: { tenantId, cnpj: supplierTaxId } })
        : null;

    const matchedItems = [];
    for (const item of parsed.items) {
      const { product: matched, matchBy } = await matchProductForItem(
        prisma,
        tenantId,
        item,
        supplier
      );

      const variation = pickDefaultVariation(matched);
      const qty = toStockQty(item.quantity);
      matchedItems.push({
        ...item,
        quantityEntered: qty,
        matchStatus: matchStatus(matched),
        matchBy,
        matchedProduct: matched
          ? {
              id: matched.id,
              name: matched.name,
              sku: matched.sku,
              cost: serializeDecimal(matched.cost),
              price: serializeDecimal(matched.price),
              categoryId: matched.categoryId,
              brandId: matched.brandId,
              variationId: variation?.id || null,
              currentStock: variation?.stock ?? 0
            }
          : null,
        suggestedAction: matched ? "link" : "create",
        warnings: qty < 1 ? ["Quantidade invalida para entrada de estoque."] : []
      });
    }

    return {
      invoice: {
        accessKey: parsed.accessKey,
        number: parsed.number,
        series: parsed.series,
        model: parsed.model,
        issuedAt: parsed.issuedAt,
        totalValue: parsed.totalValue,
        paymentInfo: parsed.paymentInfo,
        itemCount: parsed.itemCount
      },
      supplier: {
        ...parsed.supplier,
        existing: supplier
          ? {
              id: supplier.id,
              name: supplier.name,
              cnpj: supplier.cnpj,
              tradeName: supplier.tradeName
            }
          : null,
        suggestedAction: supplier ? "use_existing" : "create"
      },
      items: matchedItems
    };
  },

  async confirm(tenantId, userId, { xmlContent, supplierDecision, items: itemDecisions }) {
    const parsed = parseNfeXml(xmlContent);

    const existing = await prisma.nfeImport.findFirst({
      where: { tenantId, accessKey: parsed.accessKey }
    });
    if (existing?.status === NfeImportStatus.COMPLETED) {
      throw createAppError(
        `Esta NF-e ja foi importada anteriormente em ${formatDateBR(existing.importedAt)}.`,
        409,
        ERROR_CODES.CONFLICT
      );
    }
    if (existing && (existing.status === NfeImportStatus.FAILED || existing.status === NfeImportStatus.DRAFT)) {
      await prisma.nfeImport.delete({ where: { id: existing.id } });
    }

    let draftId = null;
    try {
      const draft = await prisma.nfeImport.create({
        data: {
          tenantId,
          accessKey: parsed.accessKey,
          number: parsed.number,
          series: parsed.series,
          issuedAt: new Date(parsed.issuedAt),
          supplierId: null,
          supplierCnpj: parsed.supplier.taxId,
          supplierName: parsed.supplier.name,
          totalValue: parsed.totalValue,
          paymentInfo: parsed.paymentInfo,
          itemCount: parsed.itemCount,
          status: NfeImportStatus.DRAFT,
          xmlContent: xmlContent.trim(),
          userId
        }
      });
      draftId = draft.id;

      return await prisma.$transaction(async (tx) => {
      const decisionByLine = new Map(
        (itemDecisions || []).map((d) => [Number(d.lineNumber), d])
      );

      // Validar que todas as linhas da nota tem decisao
      for (const item of parsed.items) {
        const decision = decisionByLine.get(item.lineNumber);
        if (!decision) {
          throw createAppError(
            `Falta decisao para o item ${item.lineNumber} (${item.description}).`,
            400,
            ERROR_CODES.VALIDATION
          );
        }
        const action = String(decision.action || "").toLowerCase();
        if (!["link", "create", "ignore"].includes(action)) {
          throw createAppError(
            `Acao invalida no item ${item.lineNumber}. Use link, create ou ignore.`,
            400,
            ERROR_CODES.VALIDATION
          );
        }
        if (action === "link" && !decision.productId) {
          throw createAppError(
            `Item ${item.lineNumber}: informe o produto para vincular.`,
            400,
            ERROR_CODES.VALIDATION
          );
        }
        if (action === "create") {
          const name = String(decision.name || item.description || "").trim();
          if (name.length < 2) {
            throw createAppError(
              `Item ${item.lineNumber}: nome do produto e obrigatorio.`,
              400,
              ERROR_CODES.VALIDATION
            );
          }
          if (!decision.categoryId || !decision.brandId) {
            throw createAppError(
              `Item ${item.lineNumber}: categoria e marca sao obrigatorias para criar produto.`,
              400,
              ERROR_CODES.VALIDATION
            );
          }
          const price = Number(decision.price);
          if (!Number.isFinite(price) || price < 0) {
            throw createAppError(
              `Item ${item.lineNumber}: informe o preco de venda (>= 0).`,
              400,
              ERROR_CODES.VALIDATION
            );
          }
        }
        if (action === "link" && decision.updatePrice === true) {
          const price = Number(decision.price);
          if (!Number.isFinite(price) || price < 0) {
            throw createAppError(
              `Item ${item.lineNumber}: informe o preco de venda (>= 0) para atualizar.`,
              400,
              ERROR_CODES.VALIDATION
            );
          }
        }
      }

      // Fornecedor
      let supplier = null;
      const supplierAction = String(supplierDecision?.action || "").toLowerCase();
      const supplierTaxId = parsed.supplier.taxId;

      if (supplierTaxId.length === 14) {
        supplier = await tx.supplier.findFirst({
          where: { tenantId, cnpj: supplierTaxId }
        });
      }

      if (supplierAction === "use_existing") {
        if (supplierDecision.supplierId) {
          supplier = await tx.supplier.findFirst({
            where: { tenantId, id: supplierDecision.supplierId }
          });
          if (!supplier) {
            throw createAppError("Fornecedor selecionado nao encontrado.", 404, ERROR_CODES.NOT_FOUND);
          }
        } else if (!supplier) {
          throw createAppError("Fornecedor existente nao encontrado para esta NF-e.", 400, ERROR_CODES.VALIDATION);
        }
      } else if (supplierAction === "create" || (!supplier && supplierTaxId.length === 14)) {
        if (supplier) {
          // ja existe — reutiliza (nao duplica)
        } else if (supplierTaxId.length === 14) {
          supplier = await tx.supplier.create({
            data: {
              tenantId,
              cnpj: supplierTaxId,
              name: String(supplierDecision?.name || parsed.supplier.name).trim(),
              tradeName: supplierDecision?.tradeName || parsed.supplier.tradeName || null,
              stateRegistration:
                supplierDecision?.stateRegistration || parsed.supplier.stateRegistration || null
            }
          });
        }
      } else if (supplierAction === "skip") {
        supplier = null;
      }

      const nfeImport = await tx.nfeImport.update({
        where: { id: draftId },
        data: {
          supplierId: supplier?.id || null,
          supplierCnpj: supplierTaxId,
          supplierName: supplier?.name || parsed.supplier.name,
          status: NfeImportStatus.COMPLETED
        }
      });

      const createdItems = [];

      for (const item of parsed.items) {
        const decision = decisionByLine.get(item.lineNumber);
        const action = String(decision.action).toLowerCase();
        const qty = toStockQty(decision.quantityEntered ?? item.quantity);

        if (action === "ignore") {
          const row = await tx.nfeImportItem.create({
            data: {
              tenantId,
              nfeImportId: nfeImport.id,
              lineNumber: item.lineNumber,
              supplierCode: item.supplierCode,
              ean: item.ean,
              description: item.description,
              ncm: item.ncm,
              cfop: item.cfop,
              unit: item.unit,
              quantity: item.quantity,
              quantityEntered: 0,
              unitValue: item.unitValue,
              totalValue: item.totalValue,
              action: NfeImportItemAction.IGNORED
            }
          });
          createdItems.push(row);
          continue;
        }

        if (qty < 1) {
          throw createAppError(
            `Item ${item.lineNumber}: quantidade de entrada deve ser inteiro >= 1.`,
            400,
            ERROR_CODES.VALIDATION
          );
        }

        let product = null;
        let itemAction = NfeImportItemAction.LINKED;

        if (action === "link") {
          product = await tx.product.findFirst({
            where: { tenantId, id: decision.productId },
            include: { variations: true }
          });
          if (!product) {
            throw createAppError(
              `Item ${item.lineNumber}: produto vinculado nao encontrado nesta loja.`,
              404,
              ERROR_CODES.NOT_FOUND
            );
          }
          itemAction = NfeImportItemAction.LINKED;

          const linkPatch = {};
          if (decision.updateCost !== false) {
            linkPatch.cost = item.unitValue;
          }
          if (decision.updatePrice === true) {
            linkPatch.price = Number(decision.price);
          }
          if (Object.keys(linkPatch).length > 0) {
            await tx.product.update({
              where: { id: product.id },
              data: linkPatch
            });
          }
        } else if (action === "create") {
          const categoryId = decision.categoryId;
          const brandId = decision.brandId;

          if (!categoryId || !brandId) {
            throw createAppError(
              `Item ${item.lineNumber}: categoria e marca sao obrigatorias para criar produto.`,
              400,
              ERROR_CODES.VALIDATION
            );
          }

          const category = await tx.category.findFirst({ where: { tenantId, id: categoryId } });
          const brand = await tx.brand.findFirst({ where: { tenantId, id: brandId } });
          if (!category || !brand) {
            throw createAppError(
              `Item ${item.lineNumber}: categoria ou marca invalida para esta loja.`,
              400,
              ERROR_CODES.VALIDATION
            );
          }

          let sku =
            decision.sku != null ? String(decision.sku).trim() : item.ean || null;
          if (sku === "") sku = null;
          if (sku && sku.length < 2) {
            throw createAppError(
              `Item ${item.lineNumber}: SKU/EAN deve ter pelo menos 2 caracteres.`,
              400,
              ERROR_CODES.VALIDATION
            );
          }
          if (sku) {
            const skuTaken = await tx.product.findFirst({ where: { tenantId, sku } });
            if (skuTaken) {
              throw createAppError(
                `Item ${item.lineNumber}: ja existe produto com SKU/EAN ${sku}. Vincule ao existente.`,
                409,
                ERROR_CODES.CONFLICT
              );
            }
          }

          const ncm = item.ncm && /^\d{8}$/.test(item.ncm) ? item.ncm : undefined;
          // CFOP da NF-e de compra nao e usado no cadastro (padrao de venda permanece).
          const icmsOrig =
            item.tax?.icmsOrig != null && item.tax.icmsOrig >= 0 && item.tax.icmsOrig <= 8
              ? item.tax.icmsOrig
              : undefined;
          const icmsCsosn =
            item.tax?.icmsCsosn && String(item.tax.icmsCsosn).length >= 3
              ? String(item.tax.icmsCsosn).slice(0, 4)
              : undefined;

          product = await tx.product.create({
            data: {
              tenantId,
              name: String(decision.name || item.description).trim(),
              description: decision.description?.trim() || null,
              price: Number(decision.price),
              cost: item.unitValue,
              categoryId,
              brandId,
              sku,
              minStock: Number.isInteger(Number(decision.minStock))
                ? Math.max(0, Number(decision.minStock))
                : 0,
              ...(ncm ? { ncm } : {}),
              ...(icmsOrig != null ? { icmsOrig } : {}),
              ...(icmsCsosn ? { icmsCsosn } : {})
            },
            include: { variations: true }
          });
          itemAction = NfeImportItemAction.CREATED;
        }

        const variation = await resolveVariationForEntry(
          tx,
          tenantId,
          product.id,
          decision,
          item.lineNumber
        );

        await tx.productVariation.update({
          where: { id: variation.id },
          data: { stock: { increment: qty } }
        });

        const movement = await tx.stockMovement.create({
          data: {
            tenantId,
            productVariationId: variation.id,
            type: StockMovementType.ENTRY,
            quantity: qty,
            nfeImportId: nfeImport.id
          }
        });

        if (supplier && item.supplierCode) {
          const codeExists = await tx.productSupplierCode.findFirst({
            where: { tenantId, supplierId: supplier.id, code: item.supplierCode }
          });
          if (!codeExists) {
            await tx.productSupplierCode.create({
              data: {
                tenantId,
                productId: product.id,
                supplierId: supplier.id,
                code: item.supplierCode
              }
            });
          } else if (codeExists.productId !== product.id) {
            // codigo ja aponta para outro produto — nao sobrescreve silenciosamente
          }
        }

        const row = await tx.nfeImportItem.create({
          data: {
            tenantId,
            nfeImportId: nfeImport.id,
            lineNumber: item.lineNumber,
            supplierCode: item.supplierCode,
            ean: item.ean,
            description: item.description,
            ncm: item.ncm,
            cfop: item.cfop,
            unit: item.unit,
            quantity: item.quantity,
            quantityEntered: qty,
            unitValue: item.unitValue,
            totalValue: item.totalValue,
            productId: product.id,
            productVariationId: variation.id,
            stockMovementId: movement.id,
            action: itemAction
          }
        });
        createdItems.push(row);
      }

      return serializeImport({
        ...nfeImport,
        supplier,
        items: createdItems
      });
    });
    } catch (error) {
      if (draftId) {
        await prisma.nfeImport
          .update({
            where: { id: draftId },
            data: { status: NfeImportStatus.FAILED }
          })
          .catch(() => null);
      }
      throw error;
    }
  }
};
