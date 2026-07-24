import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, CheckCircle2, AlertTriangle, Link2, Plus, Ban, ArrowLeft } from "lucide-react";
import { apiClient, ApiError } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import {
  formatCurrencyBRL,
  formatCnpjBr,
  formatDateBR,
  formatDateTimeBR,
  amountToCurrencyInput,
  maskCurrencyInput,
  parseCurrencyInput
} from "../../shared/formatters.js";
import { queryKeys } from "../../shared/queryKeys.js";
import { useCatalogTaxonomies } from "../../shared/hooks/useCatalogTaxonomies.js";
import { useInvalidateLuxuosa } from "../../shared/hooks/useInvalidateLuxuosa.js";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Select } from "../../shared/components/ui/Select.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { EmptyState } from "../../shared/components/ui/EmptyState.jsx";
import { Modal } from "../../shared/components/ui/Modal.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";

const STEPS = {
  UPLOAD: "upload",
  REVIEW: "review",
  DONE: "done"
};

function statusBadge(row) {
  if (row.matchStatus === "FOUND" && row.action === "link") {
    return <Badge variant="success">Produto encontrado</Badge>;
  }
  if (row.action === "create") {
    return <Badge variant="info">Produto novo</Badge>;
  }
  if (row.action === "ignore") {
    return <Badge variant="neutral">Ignorar</Badge>;
  }
  if (row.matchStatus === "NEEDS_LINK" || row.action === "link") {
    return <Badge variant="warning">Necessita vinculacao</Badge>;
  }
  return <Badge variant="danger">Erro</Badge>;
}

function buildInitialRows(preview) {
  return (preview.items || []).map((item) => {
    const matchedPrice = item.matchedProduct?.price;
    const salePrice =
      matchedPrice != null && Number.isFinite(Number(matchedPrice))
        ? Number(matchedPrice)
        : item.unitValue;
    return {
      lineNumber: item.lineNumber,
      supplierCode: item.supplierCode,
      ean: item.ean,
      description: item.description,
      ncm: item.ncm,
      cfop: item.cfop,
      unit: item.unit,
      quantity: item.quantity,
      quantityEntered: item.quantityEntered || Math.max(1, Math.round(Number(item.quantity) || 1)),
      unitValue: item.unitValue,
      totalValue: item.totalValue,
      matchStatus: item.matchStatus,
      matchBy: item.matchBy,
      matchedProduct: item.matchedProduct,
      action: item.suggestedAction === "link" ? "link" : "create",
      productId: item.matchedProduct?.id || "",
      name: item.description,
      price: amountToCurrencyInput(salePrice),
      categoryId: "",
      brandId: "",
      updateCost: true,
      updatePrice: false,
      sku: item.ean || item.supplierCode || "",
      warnings: item.warnings || []
    };
  });
}

export function NfeImportPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.type === "ADMIN";
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { refreshAfterStockMutation } = useInvalidateLuxuosa(token);
  const { sortedCategories, sortedBrands } = useCatalogTaxonomies(token);

  const [tab, setTab] = useState("import");
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [xmlContent, setXmlContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [supplierAction, setSupplierAction] = useState("create");
  const [supplierId, setSupplierId] = useState("");
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [historySkip, setHistorySkip] = useState(0);
  const [planUpgradeRequired, setPlanUpgradeRequired] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkBrandId, setBulkBrandId] = useState("");
  const historyPageSize = 20;

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list(token, { take: 500, skip: 0, forNfe: true }),
    enabled: Boolean(token) && step === STEPS.REVIEW,
    queryFn: () => apiClient("/products?take=500&skip=0", { token })
  });
  const products = useMemo(() => productsQuery.data?.items || [], [productsQuery.data]);

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", token, "list"],
    enabled: Boolean(token) && (step === STEPS.REVIEW || tab === "history"),
    queryFn: () => apiClient("/suppliers", { token })
  });
  const suppliers = useMemo(() => suppliersQuery.data || [], [suppliersQuery.data]);

  const historyQuery = useQuery({
    queryKey: queryKeys.stock.nfeImports(token, { skip: historySkip, take: historyPageSize }),
    enabled: Boolean(token) && tab === "history",
    queryFn: () =>
      apiClient(`/nfe-imports?take=${historyPageSize}&skip=${historySkip}`, { token })
  });

  const detailQuery = useQuery({
    queryKey: ["nfe-imports", token, "detail", detailId],
    enabled: Boolean(token) && Boolean(detailId),
    queryFn: () => apiClient(`/nfe-imports/${detailId}`, { token })
  });

  const readFile = useCallback(async (file) => {
    if (!file) return;
    if (!/\.xml$/i.test(file.name) && file.type && !file.type.includes("xml")) {
      showToast("Selecione um arquivo .xml de NF-e.", "error");
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      showToast("Arquivo maior que 2,5 MB.", "error");
      return;
    }
    const text = await file.text();
    setXmlContent(text);
    setFileName(file.name);
    setDuplicateInfo(null);
    setPreview(null);
    setRows([]);
    setStep(STEPS.UPLOAD);
  }, [showToast]);

  async function handlePreview() {
    if (!xmlContent.trim()) {
      showToast("Selecione um arquivo XML.", "error");
      return;
    }
    setLoadingPreview(true);
    setDuplicateInfo(null);
    try {
      const data = await apiClient("/nfe-imports/preview", {
        method: "POST",
        token,
        body: { xmlContent }
      });
      setPreview(data);
      setRows(buildInitialRows(data));
      if (data.supplier?.existing) {
        setSupplierAction("use_existing");
        setSupplierId(data.supplier.existing.id);
      } else {
        setSupplierAction("create");
        setSupplierId("");
      }
      setStep(STEPS.REVIEW);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 402 || err.code === "PLAN_UPGRADE_REQUIRED")) {
        setPlanUpgradeRequired(true);
      }
      if (err instanceof ApiError && err.status === 409) {
        setDuplicateInfo({
          message: err.message,
          existingImport: err.payload?.existingImport || null
        });
      }
      showToast(err.message || "Falha ao ler XML.", "error");
    } finally {
      setLoadingPreview(false);
    }
  }

  function updateRow(lineNumber, patch) {
    setRows((prev) => prev.map((r) => (r.lineNumber === lineNumber ? { ...r, ...patch } : r)));
  }

  function applyTaxonomyToCreateRows() {
    if (!bulkCategoryId || !bulkBrandId) {
      showToast("Selecione categoria e marca para aplicar em todos.", "error");
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.action === "create" ? { ...r, categoryId: bulkCategoryId, brandId: bulkBrandId } : r
      )
    );
    showToast("Categoria e marca aplicadas nos itens novos.");
  }

  function validateReview() {
    for (const row of rows) {
      if (row.action === "ignore") continue;
      if (row.action === "link" && !row.productId) {
        showToast(`Item ${row.lineNumber}: selecione o produto para vincular.`, "error");
        return false;
      }
      if (row.action === "link" && row.updatePrice) {
        const price = parseCurrencyInput(row.price);
        if (!Number.isFinite(price) || price < 0) {
          showToast(`Item ${row.lineNumber}: informe o preco de venda.`, "error");
          return false;
        }
      }
      if (row.action === "create") {
        if (!row.name || row.name.trim().length < 2) {
          showToast(`Item ${row.lineNumber}: informe o nome do produto.`, "error");
          return false;
        }
        const price = parseCurrencyInput(row.price);
        if (!Number.isFinite(price) || price < 0) {
          showToast(`Item ${row.lineNumber}: informe o preco de venda.`, "error");
          return false;
        }
        if (!row.categoryId || !row.brandId) {
          showToast(`Item ${row.lineNumber}: selecione categoria e marca.`, "error");
          return false;
        }
      }
      const qty = Math.floor(Number(row.quantityEntered));
      if (!Number.isInteger(qty) || qty < 1) {
        showToast(`Item ${row.lineNumber}: quantidade invalida.`, "error");
        return false;
      }
    }
    if (supplierAction === "use_existing" && !supplierId && !preview?.supplier?.existing) {
      showToast("Selecione um fornecedor.", "error");
      return false;
    }
    return true;
  }

  async function handleConfirm() {
    if (!validateReview()) return;
    setConfirming(true);
    try {
      const payload = {
        xmlContent,
        supplierDecision: {
          action: supplierAction,
          supplierId:
            supplierAction === "use_existing"
              ? supplierId || preview?.supplier?.existing?.id || null
              : null,
          name: preview?.supplier?.name,
          tradeName: preview?.supplier?.tradeName,
          stateRegistration: preview?.supplier?.stateRegistration
        },
        items: rows.map((row) => ({
          lineNumber: row.lineNumber,
          action: row.action,
          productId: row.action === "link" ? row.productId : undefined,
          name: row.action === "create" ? row.name.trim() : undefined,
          price:
            row.action === "create" || (row.action === "link" && row.updatePrice)
              ? parseCurrencyInput(row.price)
              : undefined,
          categoryId: row.action === "create" ? row.categoryId : undefined,
          brandId: row.action === "create" ? row.brandId : undefined,
          sku: row.action === "create" ? row.sku || null : undefined,
          quantityEntered: Math.floor(Number(row.quantityEntered)),
          updateCost: row.action === "link" ? row.updateCost : undefined,
          updatePrice: row.action === "link" ? Boolean(row.updatePrice) : undefined
        }))
      };
      const imported = await apiClient("/nfe-imports/confirm", {
        method: "POST",
        token,
        body: payload
      });
      setResult(imported);
      setStep(STEPS.DONE);
      showToast("NF-e importada e estoque atualizado.");
      await Promise.all([
        refreshAfterStockMutation(),
        queryClient.invalidateQueries({ queryKey: ["nfe-imports"] }),
        queryClient.invalidateQueries({ queryKey: ["suppliers"] })
      ]);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 402 || err.code === "PLAN_UPGRADE_REQUIRED")) {
        setPlanUpgradeRequired(true);
      }
      showToast(err.message || "Falha na importacao.", "error");
    } finally {
      setConfirming(false);
    }
  }

  function importStatusBadge(status) {
    if (status === "COMPLETED") return <Badge variant="success">Concluida</Badge>;
    if (status === "FAILED") return <Badge variant="danger">Falhou</Badge>;
    if (status === "DRAFT") return <Badge variant="warning">Rascunho</Badge>;
    return <Badge variant="neutral">{status || "—"}</Badge>;
  }

  function resetWizard() {
    setStep(STEPS.UPLOAD);
    setXmlContent("");
    setFileName("");
    setPreview(null);
    setRows([]);
    setResult(null);
    setDuplicateInfo(null);
    setBulkCategoryId("");
    setBulkBrandId("");
  }

  const reviewStats = useMemo(() => {
    const link = rows.filter((r) => r.action === "link").length;
    const create = rows.filter((r) => r.action === "create").length;
    const ignore = rows.filter((r) => r.action === "ignore").length;
    return { link, create, ignore };
  }, [rows]);

  if (!isAdmin) {
    return (
      <div className="ui-page">
        <PageHeader title="Entrada por NF-e (XML)" description="Entrada de mercadoria via nota fiscal." />
        <SectionCard title="Acesso restrito">
          <p className="text-sm text-slate-600">Apenas administradores podem importar NF-e.</p>
          <Link to="/estoque/movimentos" className="mt-3 inline-flex text-sm text-violet-700 hover:underline">
            Voltar a ajustar estoque
          </Link>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="Entrada por NF-e (XML)"
        description="Selecione o XML, confira os produtos e confirme a entrada no estoque."
      />

      {planUpgradeRequired ? (
        <Alert
          variant="warning"
          title="Plano Pro necessario"
          className="mb-4"
        >
          <p>A importacao de NF-e esta disponivel a partir do plano Pro.</p>
          <Link to="/assinatura" className="mt-2 inline-flex text-sm font-medium underline hover:no-underline">
            Ir para Assinatura
          </Link>
        </Alert>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "import" ? "primary" : "secondary"}
          className="text-sm"
          onClick={() => setTab("import")}
        >
          Nova importacao
        </Button>
        <Button
          type="button"
          variant={tab === "history" ? "primary" : "secondary"}
          className="text-sm"
          onClick={() => setTab("history")}
        >
          Historico de NF-e
        </Button>
        <Link
          to="/estoque/movimentos"
          className="inline-flex items-center gap-1 self-center text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Movimentações
        </Link>
      </div>

      {tab === "history" ? (
        <SectionCard title="NF-e importadas">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
            <span>
              {historyQuery.isLoading
                ? "Carregando..."
                : `${historyQuery.data?.total ?? 0} importacao(oes)`}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs"
                disabled={historySkip === 0}
                onClick={() => setHistorySkip((v) => Math.max(v - historyPageSize, 0))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs"
                disabled={(historyQuery.data?.items?.length || 0) < historyPageSize}
                onClick={() => setHistorySkip((v) => v + historyPageSize)}
              >
                Proxima
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-2">Nota</th>
                  <th className="py-2 pr-2">Fornecedor</th>
                  <th className="py-2 pr-2">Emissao</th>
                  <th className="py-2 pr-2">Importacao</th>
                  <th className="py-2 pr-2">Valor</th>
                  <th className="py-2 pr-2">Itens</th>
                  <th className="py-2 pr-2">Usuario</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(historyQuery.data?.items || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4">
                      <EmptyState
                        title="Nenhuma NF-e importada"
                        description="Vá em Nova importação, envie o XML da nota do fornecedor e confirme a entrada."
                      />
                    </td>
                  </tr>
                ) : (
                  (historyQuery.data?.items || []).map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2">
                        <button
                          type="button"
                          className="text-left font-medium text-violet-700 hover:underline"
                          onClick={() => setDetailId(row.id)}
                        >
                          {row.number}/{row.series}
                        </button>
                        <p className="max-w-[140px] truncate text-[10px] text-slate-400" title={row.accessKey}>
                          {row.accessKey}
                        </p>
                      </td>
                      <td className="py-2 pr-2">
                        <p className="max-w-[180px] truncate">{row.supplierName}</p>
                        <p className="text-xs text-slate-500">{formatCnpjBr(row.supplierCnpj)}</p>
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap">{formatDateBR(row.issuedAt)}</td>
                      <td className="py-2 pr-2 whitespace-nowrap">{formatDateTimeBR(row.importedAt)}</td>
                      <td className="py-2 pr-2 whitespace-nowrap">{formatCurrencyBRL(row.totalValue)}</td>
                      <td className="py-2 pr-2">{row.itemCount}</td>
                      <td className="py-2 pr-2">{row.user?.name || "—"}</td>
                      <td className="py-2">
                        {importStatusBadge(row.status)}
                        {row.status === "FAILED" ? (
                          <p className="mt-1 text-[10px] text-rose-700">
                            Pode reenviar o XML na aba Nova importacao.
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {tab === "import" && step === STEPS.UPLOAD ? (
        <>
          <SectionCard title="1. Selecionar XML">
            <div
              className={`rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
                dragOver ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-slate-50/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                readFile(file);
              }}
            >
              <FileUp className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-800">
                Arraste o XML da NF-e ou clique para selecionar
              </p>
              <p className="mt-1 text-xs text-slate-500">Limite 2,5 MB · arquivo .xml</p>
              <label className="mt-4 inline-flex cursor-pointer">
                <span className="ui-btn ui-btn-secondary text-sm">Escolher arquivo</span>
                <input
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  className="hidden"
                  onChange={(e) => readFile(e.target.files?.[0])}
                />
              </label>
              {fileName ? (
                <p className="mt-3 text-sm text-emerald-700">
                  Arquivo: <strong>{fileName}</strong>
                </p>
              ) : null}
            </div>
            {duplicateInfo ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <div>
                    <p>{duplicateInfo.message}</p>
                    {duplicateInfo.existingImport ? (
                      <button
                        type="button"
                        className="mt-2 text-violet-700 underline"
                        onClick={() => {
                          setTab("history");
                          setDetailId(duplicateInfo.existingImport.id);
                        }}
                      >
                        Ver importacao anterior
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                className="text-sm"
                disabled={!xmlContent || loadingPreview}
                onClick={handlePreview}
              >
                {loadingPreview ? "Lendo XML..." : "Ler nota e continuar"}
              </Button>
            </div>
          </SectionCard>
        </>
      ) : null}

      {tab === "import" && step === STEPS.REVIEW && preview ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="NF-e" value={`${preview.invoice.number}/${preview.invoice.series}`} />
            <StatCard label="Emissao" value={formatDateBR(preview.invoice.issuedAt)} />
            <StatCard label="Valor total" value={formatCurrencyBRL(preview.invoice.totalValue)} />
            <StatCard label="Itens" value={preview.invoice.itemCount} />
          </section>

          <SectionCard title="Dados da nota">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Chave de acesso</dt>
                <dd className="break-all font-mono text-xs">{preview.invoice.accessKey}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Pagamento</dt>
                <dd>{preview.invoice.paymentInfo || "—"}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Fornecedor">
            <p className="text-sm font-medium text-slate-900">{preview.supplier.name}</p>
            <p className="text-xs text-slate-500">
              CNPJ {formatCnpjBr(preview.supplier.taxId)}
              {preview.supplier.tradeName ? ` · ${preview.supplier.tradeName}` : ""}
            </p>
            {preview.supplier.existing ? (
              <p className="mt-2 text-sm text-emerald-700">
                Fornecedor ja cadastrado: {preview.supplier.existing.name}
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-700">Fornecedor ainda nao cadastrado nesta loja.</p>
            )}
            <div className="mt-3 grid max-w-xl gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Acao</span>
                <Select value={supplierAction} onChange={(e) => setSupplierAction(e.target.value)}>
                  {preview.supplier.existing || suppliers.length > 0 ? (
                    <option value="use_existing">Usar fornecedor existente</option>
                  ) : null}
                  <option value="create">Cadastrar fornecedor</option>
                  <option value="skip">Nao vincular fornecedor</option>
                </Select>
              </label>
              {supplierAction === "use_existing" ? (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-600">Fornecedor</span>
                  <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                    <option value="">Selecione</option>
                    {preview.supplier.existing ? (
                      <option value={preview.supplier.existing.id}>
                        {preview.supplier.existing.name} (CNPJ da nota)
                      </option>
                    ) : null}
                    {suppliers
                      .filter((s) => s.id !== preview.supplier.existing?.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {formatCnpjBr(s.cnpj)}
                        </option>
                      ))}
                  </Select>
                </label>
              ) : null}
            </div>
          </SectionCard>

          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Vincular" value={reviewStats.link} />
            <StatCard label="Criar novos" value={reviewStats.create} />
            <StatCard label="Ignorar" value={reviewStats.ignore} />
          </section>

          <SectionCard title="Conferencia de produtos">
            {reviewStats.create > 0 ? (
              <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-600">Categoria (itens novos)</span>
                  <Select value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)}>
                    <option value="">Selecione</option>
                    {sortedCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-600">Marca (itens novos)</span>
                  <Select value={bulkBrandId} onChange={(e) => setBulkBrandId(e.target.value)}>
                    <option value="">Selecione</option>
                    {sortedBrands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full text-sm"
                    onClick={applyTaxonomyToCreateRows}
                  >
                    Aplicar em todos os itens novos
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="space-y-4">
              {rows.map((row) => (
                <div
                  key={row.lineNumber}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        #{row.lineNumber} · {row.description}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        EAN {row.ean || "—"} · Cod. forn. {row.supplierCode || "—"} · NCM{" "}
                        {row.ncm || "—"} · {row.quantity} {row.unit || "UN"} ×{" "}
                        {formatCurrencyBRL(row.unitValue)}
                        {row.matchBy ? ` · Match: ${row.matchBy}` : ""}
                      </p>
                    </div>
                    {statusBadge(row)}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={row.action === "link" ? "primary" : "secondary"}
                      className="gap-1 px-2 py-1 text-xs"
                      onClick={() =>
                        updateRow(row.lineNumber, {
                          action: "link",
                          productId: row.matchedProduct?.id || row.productId
                        })
                      }
                    >
                      <Link2 className="h-3 w-3" /> Vincular
                    </Button>
                    <Button
                      type="button"
                      variant={row.action === "create" ? "primary" : "secondary"}
                      className="gap-1 px-2 py-1 text-xs"
                      onClick={() => updateRow(row.lineNumber, { action: "create" })}
                    >
                      <Plus className="h-3 w-3" /> Criar novo
                    </Button>
                    <Button
                      type="button"
                      variant={row.action === "ignore" ? "primary" : "secondary"}
                      className="gap-1 px-2 py-1 text-xs"
                      onClick={() => updateRow(row.lineNumber, { action: "ignore" })}
                    >
                      <Ban className="h-3 w-3" /> Ignorar
                    </Button>
                  </div>

                  {row.action !== "ignore" ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-600">Qtd. entrada</span>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={row.quantityEntered}
                          onChange={(e) =>
                            updateRow(row.lineNumber, { quantityEntered: e.target.value })
                          }
                        />
                      </label>

                      {row.action === "link" ? (
                        <>
                          <label className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-xs font-medium text-slate-600">
                              Produto no sistema
                            </span>
                            <Select
                              value={row.productId}
                              onChange={(e) => {
                                const productId = e.target.value;
                                const product = products.find((p) => p.id === productId);
                                updateRow(row.lineNumber, {
                                  productId,
                                  ...(product?.price != null
                                    ? { price: amountToCurrencyInput(product.price) }
                                    : {})
                                });
                              }}
                            >
                              <option value="">Selecione</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                  {p.sku ? ` (${p.sku})` : ""}
                                </option>
                              ))}
                            </Select>
                          </label>
                          <label className="flex items-center gap-2 pt-5 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={row.updateCost}
                              onChange={(e) =>
                                updateRow(row.lineNumber, { updateCost: e.target.checked })
                              }
                            />
                            Atualizar custo
                          </label>
                          <label className="flex items-center gap-2 pt-5 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={row.updatePrice}
                              onChange={(e) =>
                                updateRow(row.lineNumber, { updatePrice: e.target.checked })
                              }
                            />
                            Atualizar preco de venda
                          </label>
                          {row.updatePrice ? (
                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-slate-600">Preco venda</span>
                              <Input
                                value={row.price}
                                onChange={(e) =>
                                  updateRow(row.lineNumber, {
                                    price: maskCurrencyInput(e.target.value)
                                  })
                                }
                              />
                            </label>
                          ) : null}
                        </>
                      ) : null}

                      {row.action === "create" ? (
                        <>
                          <label className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-xs font-medium text-slate-600">Nome</span>
                            <Input
                              value={row.name}
                              onChange={(e) => updateRow(row.lineNumber, { name: e.target.value })}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-slate-600">Preco venda</span>
                            <Input
                              value={row.price}
                              onChange={(e) =>
                                updateRow(row.lineNumber, {
                                  price: maskCurrencyInput(e.target.value)
                                })
                              }
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-slate-600">SKU / EAN</span>
                            <Input
                              value={row.sku}
                              onChange={(e) => updateRow(row.lineNumber, { sku: e.target.value })}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-slate-600">Categoria</span>
                            <Select
                              value={row.categoryId}
                              onChange={(e) =>
                                updateRow(row.lineNumber, { categoryId: e.target.value })
                              }
                            >
                              <option value="">Selecione</option>
                              {sortedCategories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </Select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-slate-600">Marca</span>
                            <Select
                              value={row.brandId}
                              onChange={(e) =>
                                updateRow(row.lineNumber, { brandId: e.target.value })
                              }
                            >
                              <option value="">Selecione</option>
                              {sortedBrands.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </Select>
                          </label>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="text-sm" onClick={resetWizard}>
                Voltar
              </Button>
              <Button
                type="button"
                className="text-sm"
                disabled={confirming}
                onClick={handleConfirm}
              >
                {confirming ? "Importando..." : "Confirmar e atualizar estoque"}
              </Button>
            </div>
          </SectionCard>
        </>
      ) : null}

      {tab === "import" && step === STEPS.DONE && result ? (
        <SectionCard title="Importacao concluida">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="font-medium text-slate-900">
                NF-e {result.number}/{result.series} importada com sucesso.
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Estoque atualizado de forma transacional. Chave:{" "}
                <span className="font-mono text-xs">{result.accessKey}</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" className="text-sm" onClick={resetWizard}>
                  Importar outra NF-e
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="text-sm"
                  onClick={() => {
                    setTab("history");
                    setDetailId(result.id);
                  }}
                >
                  Ver detalhes
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <Modal
        open={Boolean(detailId)}
        title="Detalhes da importacao"
        onClose={() => setDetailId(null)}
        size="lg"
      >
        {detailQuery.isLoading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : detailQuery.data ? (
          <div className="space-y-3">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Nota</dt>
                <dd>
                  {detailQuery.data.number}/{detailQuery.data.series}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Valor</dt>
                <dd>{formatCurrencyBRL(detailQuery.data.totalValue)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Fornecedor</dt>
                <dd>{detailQuery.data.supplierName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Importado por</dt>
                <dd>{detailQuery.data.user?.name}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Chave</dt>
                <dd className="break-all font-mono text-xs">{detailQuery.data.accessKey}</dd>
              </div>
            </dl>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-1 pr-2">#</th>
                    <th className="py-1 pr-2">Descricao</th>
                    <th className="py-1 pr-2">Qtd</th>
                    <th className="py-1 pr-2">Acao</th>
                    <th className="py-1">Produto</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailQuery.data.items || []).map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-1 pr-2">{item.lineNumber}</td>
                      <td className="py-1 pr-2">{item.description}</td>
                      <td className="py-1 pr-2">{item.quantityEntered}</td>
                      <td className="py-1 pr-2">{item.action}</td>
                      <td className="py-1">{item.product?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nao encontrado.</p>
        )}
      </Modal>
    </div>
  );
}
