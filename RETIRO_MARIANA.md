# Operacao do crediario — retiro da Mariana

O sistema continua sendo online: nao ha promessa de funcionamento sem internet.

## Preparacao (2 a 3 dias antes)

1. Aplique a migration e publique backend e frontend da mesma versao.
2. No tenant da Mariana, abra **Configuracoes > Crediario para evento**, ative a **Interface enxuta para crediario** e informe nome, vencimento e limite padrao.
3. Crie logins individuais **ATTENDANT**; nao compartilhe a conta de administrador.
4. Confira estoque, precos e codigos/SKUs. Teste o leitor no aparelho real.
5. Faca uma venda de teste, confira o extrato e cancele-a.
6. Teste a rede no local e deixe uma segunda conexao pronta.

## Identificacao do servo

Registre ao menos nome e telefone. Se houver, use CPF e um **codigo do evento** unico, como o numero do cracha. O sistema impede duplicidade de CPF, telefone ou codigo na loja. Pesquise antes de cadastrar para concentrar todas as compras na mesma conta.

## Venda

1. Abra **Crediario > Nova venda**.
2. Selecione a pessoa ou use **Cadastrar cliente rapido**.
3. Leia o codigo de barras/SKU ou escolha os itens e confira o total.
4. Confira saldo anterior e limite.
5. Confirme uma vez e aguarde a resposta.

Somente o administrador autoriza valor acima do limite. Cancelamentos e exclusoes tambem sao administrativos, e as operacoes relevantes ficam na auditoria.

## Contingencia de internet

Ao aparecer o aviso de conexao indisponivel, nao conclua novas vendas. Use uma ficha numerada com horario, operador, codigo/nome, telefone, itens, quantidades e precos. Quando a rede voltar, lance cada ficha uma unica vez, marque-a como digitada e confira as fichas contra a lista consolidada.

Nao coloque dados de clientes em aplicativos pessoais. Mantenha as fichas sob controle e destrua-as com seguranca depois da conciliacao.

## Encerramento

1. Exporte a lista consolidada e confira o saldo por cliente.
2. Confira compras, itens, operadores e vencimento no extrato; use **Imprimir/PDF**.
3. Registre recebimentos somente depois da confirmacao real.
4. Depois da conciliacao, use **Configuracoes > Encerrar evento**.

## Checklist

- [ ] Migration aplicada e versao publicada
- [ ] Evento configurado no tenant correto
- [ ] Atendentes com logins individuais
- [ ] Estoque, precos e codigos conferidos
- [ ] Venda, cancelamento, extrato e recebimento testados
- [ ] Internet principal e alternativa testadas
- [ ] Fichas numeradas disponiveis
- [ ] Responsavel pela conciliacao definido
