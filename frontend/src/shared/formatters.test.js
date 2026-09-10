import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  amountToCurrencyInput,
  formatCnpjBr,
  formatCurrencyBRL,
  formatCurrencyInputValue,
  formatDateBR,
  formatDateTimeBR,
  maskCurrencyInput,
  parseCurrencyInput
} from "./formatters.js";

describe("formatCnpjBr", () => {
  it("mascara 14 digitos", () => {
    assert.equal(formatCnpjBr("12345678000190"), "12.345.678/0001-90");
  });

  it("nao mascara tamanho errado", () => {
    assert.equal(formatCnpjBr("123"), "123");
    assert.equal(formatCnpjBr(""), "");
  });
});

describe("parseCurrencyInput / mask", () => {
  it("converte 70,00 para numero", () => {
    assert.equal(parseCurrencyInput("70,00"), 70);
    assert.equal(parseCurrencyInput(""), 0);
  });

  it("mascara digitacao em centavos", () => {
    assert.equal(maskCurrencyInput("7000"), "70,00");
    assert.equal(maskCurrencyInput(""), "");
  });

  it("amountToCurrencyInput ignora negativo", () => {
    assert.equal(amountToCurrencyInput(-1), "");
    assert.equal(amountToCurrencyInput(10), "10,00");
  });
});

describe("formatDateBR", () => {
  it("formata ISO date-only", () => {
    assert.equal(formatDateBR("2026-09-10"), "10/09/2026");
  });

  it("vazio ou invalido vira string vazia", () => {
    assert.equal(formatDateBR(""), "");
    assert.equal(formatDateBR("nao-e-data"), "");
  });
});

describe("formatDateTimeBR e moeda", () => {
  it("formata ISO com hora", () => {
    assert.equal(formatDateTimeBR(""), "");
    assert.equal(formatDateTimeBR("nao-e-data"), "");
    assert.match(formatDateTimeBR("2026-09-10T15:30:00.000Z"), /\d{2}\/\d{2}\/2026/);
  });

  it("currency e input value", () => {
    assert.match(formatCurrencyBRL(10), /R\$/);
    assert.equal(formatCurrencyInputValue(""), "");
    assert.equal(formatCurrencyInputValue("abc"), "");
    assert.equal(formatCurrencyInputValue(12.5), "12,50");
    assert.equal(amountToCurrencyInput(null), "");
  });
});
