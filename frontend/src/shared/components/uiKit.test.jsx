import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Alert } from "./ui/Alert.jsx";
import { Button } from "./ui/Button.jsx";
import { EmptyState } from "./ui/EmptyState.jsx";
import { Modal } from "./ui/Modal.jsx";
import { PageHeader } from "./ui/PageHeader.jsx";
import { PageLoader } from "./PageLoader.jsx";
import { StatCard } from "./ui/StatCard.jsx";

describe("UI compartilhada", () => {
  it("PageHeader, StatCard, EmptyState, Alert, PageLoader", () => {
    render(
      <div>
        <PageHeader title="Usuarios" description="Cadastro" actions={<button type="button">Novo</button>} />
        <StatCard label="Cadastrados" value={3} hint="total" tone="success" />
        <EmptyState title="Sem dados" description="Cadastre o primeiro." />
        <Alert variant="danger" title="Erro">
          Falhou
        </Alert>
        <PageLoader />
      </div>
    );
    expect(screen.getByRole("heading", { name: "Usuarios" })).toBeInTheDocument();
    expect(screen.getByText("Cadastrados")).toBeInTheDocument();
    expect(screen.getByText("Sem dados")).toBeInTheDocument();
    expect(screen.getByText("Erro")).toBeInTheDocument();
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
  });

  it("Button e Modal fecham no Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <div>
        <Button variant="danger">Excluir</Button>
        <Modal open title="Confirmar" onClose={onClose}>
          Tem certeza?
        </Modal>
      </div>
    );
    expect(screen.getByRole("dialog", { name: "Confirmar" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
