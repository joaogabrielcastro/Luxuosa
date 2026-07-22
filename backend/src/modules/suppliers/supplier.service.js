import { createAppError, ERROR_CODES } from "../../utils/appErrors.js";
import { supplierRepository } from "./supplier.repository.js";

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export const supplierService = {
  list(tenantId) {
    return supplierRepository.list(tenantId);
  },

  getById(tenantId, id) {
    return supplierRepository.findById(tenantId, id);
  },

  async create(tenantId, payload) {
    const cnpj = digitsOnly(payload.cnpj);
    if (cnpj.length !== 14) {
      throw createAppError("CNPJ do fornecedor deve ter 14 digitos.", 400, ERROR_CODES.VALIDATION);
    }
    const existing = await supplierRepository.findByCnpj(tenantId, cnpj);
    if (existing) {
      throw createAppError("Ja existe um fornecedor com este CNPJ nesta loja.", 409, ERROR_CODES.CONFLICT);
    }
    return supplierRepository.create(tenantId, {
      name: payload.name.trim(),
      tradeName: payload.tradeName?.trim() || null,
      cnpj,
      stateRegistration: payload.stateRegistration?.trim() || null
    });
  },

  async update(tenantId, id, payload) {
    const data = {};
    if (payload.name != null) data.name = String(payload.name).trim();
    if (payload.tradeName !== undefined) data.tradeName = payload.tradeName?.trim() || null;
    if (payload.stateRegistration !== undefined) {
      data.stateRegistration = payload.stateRegistration?.trim() || null;
    }
    if (payload.cnpj != null) {
      const cnpj = digitsOnly(payload.cnpj);
      if (cnpj.length !== 14) {
        throw createAppError("CNPJ do fornecedor deve ter 14 digitos.", 400, ERROR_CODES.VALIDATION);
      }
      const other = await supplierRepository.findByCnpj(tenantId, cnpj);
      if (other && other.id !== id) {
        throw createAppError("Ja existe um fornecedor com este CNPJ nesta loja.", 409, ERROR_CODES.CONFLICT);
      }
      data.cnpj = cnpj;
    }
    const result = await supplierRepository.update(tenantId, id, data);
    if (result.count === 0) {
      throw createAppError("Fornecedor nao encontrado.", 404, ERROR_CODES.NOT_FOUND);
    }
    return result;
  }
};
