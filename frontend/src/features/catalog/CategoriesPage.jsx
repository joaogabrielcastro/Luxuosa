import { Shapes } from "lucide-react";
import { SimpleNamedCrudPage } from "./SimpleNamedCrudPage.jsx";
import { ModuleNav } from "../../shared/components/ModuleNav.jsx";
import { catalogModuleItems } from "../../shared/navConfig.js";

export function CategoriesPage() {
  return (
    <SimpleNamedCrudPage
      resource="categories"
      title="Categorias"
      description="Grupos do catálogo, usados ao cadastrar produtos."
      entityNoun="categoria"
      entityNounFeminine
      pluralLabel="Categorias"
      emptyMessage="Nenhuma categoria encontrada."
      searchPlaceholder="Buscar categoria..."
      deleteMessage="Deseja excluir esta categoria?"
      statIcon={<Shapes className="h-4 w-4 text-violet-600" />}
      beforeContent={<ModuleNav items={catalogModuleItems()} label="Catálogo" />}
    />
  );
}
