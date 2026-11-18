import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Button, IconButton } from "../../shared/components/ui/Button.jsx";
import { Badge } from "../../shared/components/ui/Badge.jsx";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { FormErrorSummary } from "../../shared/components/FormErrorSummary.jsx";
import { isDefaultVariation } from "./catalogConstants.js";

const EMPTY_FORM = { size: "", color: "", stock: "", sku: "" };

export function ProductVariationsSection({ token, productId, productName, onChanged, embedded = false }) {
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
      setError(err);
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
      const sizeTrim = String(form.size || "").trim();
      const colorTrim = String(form.color || "").trim();
      // Esta secao e para variacoes reais. A variacao padrao (estoque sem
      // tamanho/cor) so e criada pela tela de cadastro do produto.
      if (sizeTrim === "" || colorTrim === "") {
        throw new Error("Informe Tamanho e Cor para criar uma variacao.");
      }
      await apiClient(editingId ? `/product-variations/${editingId}` : "/product-variations", {
        method: editingId ? "PUT" : "POST",
        token,
        body: {
          productId,
          size: sizeTrim,
          color: colorTrim,
          stock: stockNum,
          sku: String(form.sku || "").trim() || null
        }
      });
      showToast(editingId ? "Variacao atualizada." : "Variacao criada.");
      setEditingId("");
      setForm(EMPTY_FORM);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err);
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
      setError(err);
      showToast(err.message, "error");
    }
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      size: row.size || "",
      color: row.color || "",
      stock: String(row.stock ?? 0),
      sku: row.sku || ""
    });
  }

  if (!productId) {
    return (
      <SectionCard title="Tamanhos e cores">
        <p className="text-sm text-slate-600">Salve o produto primeiro para cadastrar cada combinação.</p>
      </SectionCard>
    );
  }

  const wrap = (children) => embedded
    ? (
        <section>
          <h3 className="text-[15px] font-semibold text-slate-900">Tamanhos e cores</h3>
          <p className="mb-3 mt-0.5 text-[13px] text-slate-500">
            {productName ? `${productName}: ` : ""}cada combinação tem seu estoque e código de etiqueta.
          </p>
          {children}
        </section>
      )
    : (
        <SectionCard title="Tamanhos e cores" description="Uma linha para cada combinação de tamanho e cor.">
          {children}
        </SectionCard>
      );

  const totalStock = variations.reduce((acc, v) => acc + Number(v.stock || 0), 0);

  return wrap(
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="ui-table-head">
            <tr>
              <th className="px-3 py-2">Tamanho</th>
              <th className="px-3 py-2">Cor</th>
              <th className="hidden px-3 py-2 sm:table-cell">Etiqueta</th>
              <th className="px-3 py-2 text-right">Estoque</th>
              <th className="w-20 px-2 py-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : variations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-slate-500">
                  Nenhuma combinação ainda. Adicione abaixo.
                </td>
              </tr>
            ) : (
              variations.map((row) => {
                const isDefault = isDefaultVariation(row);
                const editing = editingId === row.id;
                return (
                  <tr key={row.id} className={`border-t border-slate-100 ${editing ? "bg-brand-50/50" : ""}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{isDefault ? <Badge>Estoque geral</Badge> : row.size}</td>
                    <td className="px-3 py-2 text-slate-700">{isDefault ? "—" : row.color}</td>
                    <td className="hidden px-3 py-2 font-mono text-xs text-slate-500 sm:table-cell">{row.sku || "—"}</td>
                    <td className="num px-3 py-2 text-right">
                      {Number(row.stock) === 0 ? <Badge variant="danger">0</Badge> : row.stock}
                    </td>
                    <td className="px-2 py-1.5">
                      {isDefault ? (
                        <span className="block text-right text-2xs text-slate-400" title="Ajuste em Estoque → Movimentações">
                          Movimentações
                        </span>
                      ) : (
                        <div className="flex justify-end gap-0.5">
                          <IconButton icon={Pencil} size="sm" label={`Editar ${row.size} ${row.color}`} onClick={() => startEdit(row)} />
                          <IconButton
                            icon={Trash2}
                            size="sm"
                            label={`Excluir ${row.size} ${row.color}`}
                            className="hover:bg-red-50 hover:text-red-600"
                            onClick={() => removeVariation(row.id)}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {variations.length ? (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/70 text-xs text-slate-600">
                <td className="px-3 py-2" colSpan={3}>
                  {variations.length} combinação(ões)
                </td>
                <td className="num px-3 py-2 text-right font-semibold text-slate-900">{totalStock}</td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <form className="mt-3 rounded-xl border border-dashed border-slate-300 p-3" onSubmit={submitVariation}>
        <p className="mb-2 text-xs font-medium text-slate-600">{editingId ? "Editando combinação" : "Nova combinação"}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input placeholder="Tamanho" aria-label="Tamanho" value={form.size} onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))} />
          <Input placeholder="Cor" aria-label="Cor" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} />
          <Input
            placeholder="Estoque"
            aria-label="Estoque"
            type="number"
            min="0"
            inputMode="numeric"
            value={form.stock}
            onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
          />
          <Input
            placeholder="Codigo etiqueta (opcional)"
            aria-label="Código da etiqueta"
            value={form.sku}
            onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="submit" size="sm" variant={editingId ? "primary" : "secondary"} loading={loading} icon={editingId ? null : Plus}>
            {editingId ? "Atualizar variacao" : "Adicionar variacao"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
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
      <FormErrorSummary error={error} className="mt-2" />
    </>
  );
}
