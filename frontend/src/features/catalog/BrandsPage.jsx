import { Tag } from "lucide-react";
import { SimpleNamedCrudPage } from "./SimpleNamedCrudPage.jsx";
import { ModuleNav } from "../../shared/components/ModuleNav.jsx";
import { catalogModuleItems } from "../../shared/navConfig.js";

export function BrandsPage() {
  return (
    <SimpleNamedCrudPage
      resource="brands"
      title="Marcas"
      description="Marcas usadas ao cadastrar e filtrar produtos."
      entityNoun="marca"
      entityNounFeminine
      pluralLabel="Marcas"
      emptyMessage="Nenhuma marca encontrada."
      searchPlaceholder="Buscar marca..."
      deleteMessage="Deseja excluir esta marca? So e possivel se nenhum produto estiver vinculado."
      statIcon={<Tag className="h-4 w-4 text-violet-600" />}
      beforeContent={<ModuleNav items={catalogModuleItems()} label="Catálogo" />}
    />
  );
}
