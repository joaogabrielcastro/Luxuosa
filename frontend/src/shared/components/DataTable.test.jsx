import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataTable } from "./DataTable.jsx";

const rows = [
  { id: "1", name: "Ana" },
  { id: "2", name: "Bruno" }
];

describe("DataTable", () => {
  it("lista linhas e filtra busca", async () => {
    const user = userEvent.setup();
    let query = "";
    const view = () =>
      render(
        <DataTable
          title="Clientes"
          data={rows}
          columns={[{ key: "name", label: "Nome" }]}
          getRowKey={(row) => row.id}
          renderCells={(row) => <td>{row.name}</td>}
          search={{
            query,
            onQueryChange: (q) => {
              query = q;
            },
            matcher: (row, q) => row.name.toLowerCase().includes(q.toLowerCase()),
            placeholder: "Buscar cliente"
          }}
        />
      );

    const first = view();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Buscar cliente"), "bru");
    first.unmount();
    query = "bru";
    view();
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  });

  it("mostra empty state", () => {
    render(
      <DataTable
        title="Vazio"
        data={[]}
        columns={[{ key: "name", label: "Nome" }]}
        getRowKey={(row) => row.id}
        renderCells={(row) => <td>{row.name}</td>}
        emptyMessage="Nenhum cliente."
      />
    );
    expect(screen.getByText("Nenhum cliente.")).toBeInTheDocument();
  });
});
