-- Bancos novos podem nunca ter tido caixa/registradora. CASCADE remove FKs dependentes.
DROP TABLE IF EXISTS "CashMovement" CASCADE;

DROP TABLE IF EXISTS "CashRegister" CASCADE;

DROP TYPE IF EXISTS "CashMovementType";

DROP TYPE IF EXISTS "CashRegisterStatus";
