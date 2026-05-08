import { Tag } from "lucide-react";
import { SimpleNamedCrudPage } from "./SimpleNamedCrudPage.jsx";

export function BrandsPage() {
  return (
    <SimpleNamedCrudPage
      resource="brands"
      title="Marcas"
      description="Crie marcas para filtrar melhor produtos e variacoes."
      entityNoun="marca"
      entityNounFeminine
      pluralLabel="Marcas"
      emptyMessage="Nenhuma marca encontrada."
      searchPlaceholder="Buscar marca..."
      deleteMessage="Deseja excluir esta marca? So e possivel se nenhum produto estiver vinculado."
      statIcon={<Tag className="h-4 w-4 text-violet-600" />}
    />
  );
}
