import { afterEach, describe, expect, it, vi } from "vitest";
import { digitsOnlyCep, lookupCep, maskCepInput } from "./viaCep.js";

describe("viaCep", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mascara e recorta CEP", () => {
    expect(digitsOnlyCep("13.010-100")).toBe("13010100");
    expect(maskCepInput("13010")).toBe("13010");
    expect(maskCepInput("13010100")).toBe("13010-100");
  });

  it("retorna null se CEP curto", async () => {
    expect(await lookupCep("123")).toBeNull();
  });

  it("consulta ViaCEP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          logradouro: "Rua A",
          bairro: "Centro",
          localidade: "Santos",
          uf: "sp"
        })
      }))
    );
    const data = await lookupCep("13010100");
    expect(data).toMatchObject({ uf: "SP", street: "Rua A", city: "Santos", address: "Rua A, Centro, Santos" });
  });

  it("null quando API marca erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ erro: true }) })));
    expect(await lookupCep("00000000")).toBeNull();
  });

  it("falha HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    await expect(lookupCep("13010100")).rejects.toThrow(/cep/i);
  });
});
