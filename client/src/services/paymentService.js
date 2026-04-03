// client/src/services/paymentService.js
import api from "./api";

export const createPayment = async (payload) => {
  const res = await api.post("/payments/create", payload);
  return res.data;
};

export const markInvoicePaid = async (invoiceId, payload) => {
  const res = await api.post(`/payments/${invoiceId}/mark-paid`, payload);
  return res.data;
};

export const fetchResidentPayments = async (residentId) => {
  const res = await api.get(`/payments/resident/${residentId}`);
  return res.data;
};

export const fetchAllPayments = async (filters = {}) => {
  const res = await api.get("/payments/all", { params: filters });
  return res.data;
};

// webhook route is server-side only (payment provider will call it)
