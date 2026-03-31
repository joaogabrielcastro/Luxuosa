import { useEffect, useState } from "react";
import { apiClient } from "../../shared/apiClient.js";
import { useAuth } from "../auth/useAuth.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { useConfirm } from "../../shared/components/ConfirmProvider.jsx";
import { DataTable } from "../../shared/components/DataTable.jsx";
import { PageHeader } from "../../shared/components/ui/PageHeader.jsx";
import { SectionCard } from "../../shared/components/ui/SectionCard.jsx";
import { Input } from "../../shared/components/ui/Input.jsx";
import { Button } from "../../shared/components/ui/Button.jsx";
import { Alert } from "../../shared/components/ui/Alert.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";
import { Shapes } from "lucide-react";

export function CategoriesPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await apiClient("/categories", { token });
    setItems(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createCategory(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (editingId) {
        await apiClient(`/categories/${editingId}`, { method: "PUT", token, body: { name } });
        showToast("Categoria atualizada.");
      } else {
        await apiClient("/categories", { method: "POST", token, body: { name } });
        showToast("Categoria criada.");
      }
      setEditingId("");
      setName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeCategory(id) {
    try {
      const confirmed = await confirm({
        title: "Excluir categoria",
        message: "Deseja excluir esta categoria?",
        confirmText: "Excluir"
      });
      if (!confirmed) return;
      await apiClient(`/categories/${id}`, { method: "DELETE", token });
      await load();
      showToast("Categoria excluida.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  return (
    <div className="ui-page">
      <PageHeader title="Categorias" description="Organize o catalogo por grupos principais." />
      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Categorias cadastradas" value={items.length} icon={<Shapes className="h-4 w-4 text-violet-600" />} />
        <StatCard label="Categorias encontradas" value={query ? items.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).length : items.length} />
      </section>
      <SectionCard title={editingId ? "Editar categoria" : "Nova categoria"}>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={createCategory}>
          <Input
            placeholder="Nome da categoria"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button disabled={loading}>
            {editingId ? "Atualizar" : "Salvar"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditingId("");
                setName("");
              }}
            >
              Cancelar
            </Button>
          ) : null}
        </form>
        {error ? <Alert className="mt-3" variant="danger">{error}</Alert> : null}
      </SectionCard>

      <DataTable
        title="Lista de categorias"
        data={items}
        columns={[
          { key: "name", label: "Nome" },
          { key: "actions", label: "Acoes" }
        ]}
        getRowKey={(row) => row.id}
        emptyMessage="Nenhuma categoria encontrada."
        search={{
          query,
          onQueryChange: setQuery,
          placeholder: "Buscar categoria...",
          matcher: (row, q) => row.name.toLowerCase().includes(q.toLowerCase())
        }}
        renderCells={(item) => (
          <>
            <td className="py-2">{item.name}</td>
            <td className="py-2">
              <Button
                variant="secondary"
                className="mr-2 px-2 py-1 text-xs"
                onClick={() => {
                  setEditingId(item.id);
                  setName(item.name);
                }}
              >
                Editar
              </Button>
              <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => removeCategory(item.id)}>
                Excluir
              </Button>
            </td>
          </>
        )}
      />
    </div>
  );
}
