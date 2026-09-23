import { api } from './api';

export const grnApi = {
  getAll: async () => {
    return await api.grn.getAll();
  },

  getById: async (id) => {
    return await api.grn.getById(id);
  },

  create: async (payload) => {
    return await api.grn.create(payload);
  },

  update: async (id, payload) => {
    return await api.grn.update(id, payload);
  },

  delete: async (id, options = {}) => {
    return await api.grn.delete(id, options);
  }
};

