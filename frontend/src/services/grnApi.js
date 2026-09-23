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
  }
};

