import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormErrorSummary } from "./FormErrorSummary.jsx";

describe("FormErrorSummary", () => {
  it("nao renderiza sem erro", () => {
    const { container } = render(<FormErrorSummary error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra string", () => {
    render(<FormErrorSummary error="Campo obrigatorio" />);
    expect(screen.getByText("Campo obrigatorio")).toBeInTheDocument();
  });

  it("lista detalhes de validacao", () => {
    const err = {
      message: "Revise os campos",
      status: 400,
      details: [
        { field: "name", message: "Nome curto" },
        { field: "email", message: "E-mail invalido" }
      ]
    };
    render(<FormErrorSummary error={err} />);
    expect(screen.getByText("Nome curto")).toBeInTheDocument();
    expect(screen.getByText("E-mail invalido")).toBeInTheDocument();
  });
});
