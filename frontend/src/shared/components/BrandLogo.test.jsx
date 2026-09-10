import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo.jsx";

describe("BrandLogo", () => {
  it("selo da loja comum", () => {
    const { container } = render(<BrandLogo tenant={{ name: "Minha Loja", cnpj: "12345678000199" }} />);
    expect(container.textContent).toContain("M");
  });

  it("marca Luxuosa no CNPJ da marca", () => {
    render(<BrandLogo tenant={{ name: "Luxuosa", cnpj: "12440489000100" }} />);
    expect(screen.getByAltText("Luxuosa")).toBeInTheDocument();
  });
});
