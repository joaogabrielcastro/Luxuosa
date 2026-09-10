import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNfeXml } from "./nfeXmlParser.js";

const SAMPLE_NFE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35240112345678000190550010000001231234567890" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <natOp>Venda</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>123</nNF>
        <dhEmi>2026-07-21T10:30:00-03:00</dhEmi>
        <tpNF>1</tpNF>
      </ide>
      <emit>
        <CNPJ>12345678000190</CNPJ>
        <xNome>FORNECEDOR EXEMPLO LTDA</xNome>
        <xFant>FORNECEDOR EX</xFant>
        <IE>123456789</IE>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>ABC-001</cProd>
          <cEAN>7891234567890</cEAN>
          <xProd>Produto Teste Luxuosa</xProd>
          <NCM>61091000</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>2.0000</qCom>
          <vUnCom>25.5000</vUnCom>
          <vProd>51.00</vProd>
          <cEANTrib>7891234567890</cEANTrib>
          <uTrib>UN</uTrib>
          <qTrib>2.0000</qTrib>
          <vUnTrib>25.5000</vUnTrib>
        </prod>
        <imposto>
          <ICMS>
            <ICMSSN102>
              <orig>0</orig>
              <CSOSN>102</CSOSN>
            </ICMSSN102>
          </ICMS>
        </imposto>
      </det>
      <det nItem="2">
        <prod>
          <cProd>XYZ-002</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>Produto Sem EAN</xProd>
          <NCM>61091000</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>10.0000</vUnCom>
          <vProd>10.00</vProd>
        </prod>
        <imposto/>
      </det>
      <total>
        <ICMSTot>
          <vNF>61.00</vNF>
        </ICMSTot>
      </total>
      <pag>
        <detPag>
          <tPag>17</tPag>
          <vPag>61.00</vPag>
        </detPag>
      </pag>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <chNFe>35240112345678000190550010000001231234567890</chNFe>
    </infProt>
  </protNFe>
</nfeProc>`;

describe("parseNfeXml", () => {
  it("extrai cabecalho, fornecedor e itens", () => {
    const result = parseNfeXml(SAMPLE_NFE);
    assert.equal(result.accessKey, "35240112345678000190550010000001231234567890");
    assert.equal(result.number, "123");
    assert.equal(result.series, "1");
    assert.equal(result.supplier.taxId, "12345678000190");
    assert.equal(result.supplier.name, "FORNECEDOR EXEMPLO LTDA");
    assert.equal(result.totalValue, 61);
    assert.match(result.paymentInfo || "", /PIX/i);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].ean, "7891234567890");
    assert.equal(result.items[0].supplierCode, "ABC-001");
    assert.equal(result.items[0].quantity, 2);
    assert.equal(result.items[0].unitValue, 25.5);
    assert.equal(result.items[1].ean, null);
  });

  it("rejeita XML invalido", () => {
    assert.throws(() => parseNfeXml("<root>nao e nfe</root>"), /NF-e/);
  });

  it("rejeita XML vazio", () => {
    assert.throws(() => parseNfeXml("   "), /vazio/i);
  });

  it("rejeita XML quebrado, sem chave, emitente e data", () => {
    assert.throws(() => parseNfeXml("<nfeProc><NFe><infNFe>"), /infNFe|integro|ler o XML/i);
    const noKey = SAMPLE_NFE
      .replace(/Id="NFe\d+"/, 'Id="NFe"')
      .replace(/<chNFe>\d+<\/chNFe>/, "");
    assert.throws(() => parseNfeXml(noKey), /Chave de acesso/);
    const badEmit = SAMPLE_NFE.replace(/<CNPJ>12345678000190<\/CNPJ>/, "<CNPJ>1</CNPJ>");
    assert.throws(() => parseNfeXml(badEmit), /CNPJ\/CPF do emitente/);
    const badDate = SAMPLE_NFE.replace(/<dhEmi>2026-07-21T10:30:00-03:00<\/dhEmi>/, "<dhEmi>nope</dhEmi>");
    assert.throws(() => parseNfeXml(badDate), /Data de emissao/);
    const noItems = SAMPLE_NFE.replace(/<det nItem="1">[\s\S]*<det nItem="2">[\s\S]*<\/det>/, "");
    assert.throws(() => parseNfeXml(noItems), /nao possui itens|itens/);
  });
});
