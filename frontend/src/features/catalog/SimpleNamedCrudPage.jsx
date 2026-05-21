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
import { FormErrorSummary } from "../../shared/components/FormErrorSummary.jsx";
import { StatCard } from "../../shared/components/ui/StatCard.jsx";

/**
 * CRUD generico de entidades simples com apenas o campo `name`
 * (categorias, marcas, etc.). Centraliza lista + formulario + busca + acoes.
 */
export function SimpleNamedCrudPage({
  resource,
  title,
  description,
  entityNoun,
  entityNounFeminine = false,
  pluralLabel,
  emptyMessage,
  searchPlaceholder,
  deleteMessage,
  statIcon
}) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const article = entityNounFeminine ? "esta" : "este";
  const articleArt = entityNounFeminine ? "a" : "o";
  const createdMsg = entityNounFeminine
    ? `${capitalize(entityNoun)} criada.`
    : `${capitalize(entityNoun)} criado.`;
  const updatedMsg = entityNounFeminine
    ? `${capitalize(entityNoun)} atualizada.`
    : `${capitalize(entityNoun)} atualizado.`;
  const deletedMsg = entityNounFeminine
    ? `${capitalize(entityNoun)} excluida.`
    : `${capitalize(entityNoun)} excluido.`;

  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await apiClient(`/${resource}`, { token });
    setItems(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (editingId) {
        await apiClient(`/${resource}/${editingId}`, { method: "PUT", token, body: { name } });
        showToast(updatedMsg);
      } else {
        await apiClient(`/${resource}`, { method: "POST", token, body: { name } });
        showToast(createdMsg);
      }
      setEditingId("");
      setName("");
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    try {
      const confirmed = await confirm({
        title: `Excluir ${entityNoun}`,
        message: deleteMessage || `Deseja excluir ${article} ${entityNoun}?`,
        confirmText: "Excluir"
      });
      if (!confirmed) return;
      await apiClient(`/${resource}/${id}`, { method: "DELETE", token });
      await load();
      showToast(deletedMsg);
    } catch (err) {
      setError(err);
      showToast(err.message, "error");
    }
  }

  const filteredCount = query
    ? items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).length
    : items.length;

  return (
    <div className="ui-page">
      <PageHeader title={title} description={description} />
      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard label={`${pluralLabel} cadastrad${entityNounFeminine ? "as" : "os"}`} value={items.length} icon={statIcon} />
        <StatCard label={`${pluralLabel} encontrad${entityNounFeminine ? "as" : "os"}`} value={filteredCount} />
      </section>
      <SectionCard title={editingId ? `Editar ${entityNoun}` : `Nov${entityNounFeminine ? "a" : "o"} ${entityNoun}`}>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
          <Input
            placeholder={`Nome d${articleArt} ${entityNoun}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button disabled={loading}>{editingId ? "Atualizar" : "Salvar"}</Button>
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
        <FormErrorSummary error={error} />
      </SectionCard>

      <DataTable
        title={`Lista de ${pluralLabel.toLowerCase()}`}
        data={items}
        columns={[
          { key: "name", label: "Nome" },
          { key: "actions", label: "Acoes" }
        ]}
        getRowKey={(row) => row.id}
        emptyMessage={emptyMessage}
        search={{
          query,
          onQueryChange: setQuery,
          placeholder: searchPlaceholder,
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
              <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => remove(item.id)}>
                Excluir
              </Button>
            </td>
          </>
        )}
      />
    </div>
  );
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
