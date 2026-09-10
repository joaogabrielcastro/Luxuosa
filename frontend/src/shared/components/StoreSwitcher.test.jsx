import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { StoreSwitcher } from "./StoreSwitcher.jsx";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn()
}));

const acceptSession = vi.fn();

vi.mock("../apiClient.js", () => ({
  apiClient
}));

vi.mock("../../features/auth/useAuth.jsx", () => ({
  useAuth: () => ({
    token: "tok",
    tenant: { id: "t1", name: "Loja A" },
    acceptSession
  })
}));

describe("StoreSwitcher", () => {
  beforeEach(() => {
    apiClient.mockReset();
    acceptSession.mockReset();
  });

  it("nao aparece com uma loja", async () => {
    apiClient.mockResolvedValue({ canSwitch: false, stores: [{ id: "t1", name: "Loja A" }] });
    const { container } = render(<StoreSwitcher />);
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith("/auth/stores", expect.anything()));
    expect(container.querySelector("select")).toBeNull();
  });

  it("troca de loja e recarrega", async () => {
    apiClient.mockImplementation(async (path) => {
      if (path === "/auth/stores") {
        return {
          canSwitch: true,
          stores: [
            { id: "t1", name: "Loja A" },
            { id: "t2", name: "Loja B" }
          ]
        };
      }
      return { token: "new", tenant: { id: "t2" }, user: {} };
    });
    const user = userEvent.setup();
    render(<StoreSwitcher />);
    const select = await screen.findByLabelText("Trocar loja");
    await user.selectOptions(select, "t2");
    await waitFor(() =>
      expect(apiClient).toHaveBeenCalledWith(
        "/auth/switch-store",
        expect.objectContaining({ method: "POST", body: { tenantId: "t2" } })
      )
    );
    expect(acceptSession).toHaveBeenCalled();
  });
});
