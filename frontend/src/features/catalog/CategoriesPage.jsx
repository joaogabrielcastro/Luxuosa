import { Shapes } from "lucide-react";
import { SimpleNamedCrudPage } from "./SimpleNamedCrudPage.jsx";

export function CategoriesPage() {
  return (
    <SimpleNamedCrudPage
      resource="categories"
      title="Categorias"
      description="Organize o catalogo por grupos principais."
      entityNoun="categoria"
      entityNounFeminine
      pluralLabel="Categorias"
      emptyMessage="Nenhuma categoria encontrada."
      searchPlaceholder="Buscar categoria..."
      deleteMessage="Deseja excluir esta categoria?"
      statIcon={<Shapes className="h-4 w-4 text-violet-600" />}
    />
  );
}
