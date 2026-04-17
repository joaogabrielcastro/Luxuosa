import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";

const EMPTY_FORM = { size: "", color: "", stock: "" };

export function ProductVariationsSection({ token, productId, productName, onChanged }) {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  async function load() {
    if (!productId) return;
    setListLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("take", "200");
      params.set("skip", "0");
      params.set("productId", productId);
      const data = await apiClient(`/product-variations?${params.toString()}`, { token });
      setVariations(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    setEditingId("");
    setForm(EMPTY_FORM);
    load().catch(() => {});
  }, [productId, token]);

  async function submitVariation(e) {
    e.preventDefault();
    if (!productId) return;
    setError("");
    setLoading(true);
    try {
      const stockNum = Number(form.stock);
      if (!Number.isFinite(stockNum) || stockNum < 0) {
        throw new Error("Informe um estoque valido (0 ou mais).");
      }
      await apiClient(editingId ? `/product-variations/${editingId}` : "/product-variations", {
        method: editingId ? "PUT" : "POST",
        token,
        body: {
          productId,
          size: String(form.size || "").trim(),
          color: String(form.color || "").trim(),
          stock: stockNum
        }
      });
      showToast(editingId ? "Variacao atualizada." : "Variacao criada.");
      setEditingId("");
      setForm(EMPTY_FORM);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function removeVariation(id) {
    try {
      const ok = await confirm({
        title: "Excluir variacao",
        message:
          "Excluir esta variacao? So e possivel se nao houver vendas/crediario; o historico de movimentos de estoque desta variacao sera apagado.",
        confirmText: "Excluir"
      });
      if (!ok) return;
      await apiClient(`/product-variations/${id}`, { method: "DELETE", token });
      showToast("Variacao excluida.");
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      size: row.size || "",
      color: row.color || "",
      stock: String(row.stock ?? 0)
    });
  }

  if (!productId) {
    return (
      <SectionCard title="Variacoes (tamanho, cor, estoque)">
        <p className="text-sm text-slate-600">Salve o produto primeiro para cadastrar variacoes.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Variacoes (tamanho, cor, estoque)"
      description={productName ? `Produto: ${productName}` : undefined}
    >
      <form className="mt-3 grid gap-2 md:grid-cols-3" onSubmit={submitVariation}>
        <Input
          placeholder="Tamanho"
          value={form.size}
          onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))}
        />
        <Input
          placeholder="Cor"
          value={form.color}
          onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
        />
        <Input
          placeholder="Estoque"
          type="number"
          min="0"
          value={form.stock}
          onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
        />
        <div className="flex flex-wrap gap-2 md:col-span-3">
          <Button type="submit" disabled={loading}>
            {editingId ? "Atualizar variacao" : "Adicionar variacao"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditingId("");
                setForm(EMPTY_FORM);
              }}
            >
              Cancelar edicao
            </Button>
          ) : null}
        </div>
      </form>
      {error ? (
        <Alert className="mt-2" variant="danger">
          {error}
        </Alert>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
            <tr>
              <th className="px-3 py-2">Tamanho</th>
              <th className="px-3 py-2">Cor</th>
              <th className="px-3 py-2">Estoque</th>
              <th className="px-3 py-2">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-slate-500">
                  Carregando...
                </td>
              </tr>
            ) : variations.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-slate-500">
                  Nenhuma variacao. Use o formulario acima ou ajuste a quantidade atual no bloco principal (gera estoque
                  automatico).
                </td>
              </tr>
            ) : (
              variations.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2">{row.size}</td>
                  <td className="px-3 py-2">{row.color}</td>
                  <td className="px-3 py-2">{row.stock}</td>
                  <td className="px-3 py-2">
                    <Button type="button" variant="secondary" className="mr-2 px-2 py-0.5 text-xs" onClick={() => startEdit(row)}>
                      Editar
                    </Button>
                    <Button type="button" variant="danger" className="px-2 py-0.5 text-xs" onClick={() => removeVariation(row.id)}>
                      Excluir
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
