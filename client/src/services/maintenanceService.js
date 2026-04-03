// client/src/services/maintenanceService.js
import api from "./api";

// ADMIN: get all invoices (with optional filters)
export const fetchAllMaintenance = async (filters = {}) => {
  const res = await api.get("/maintenance/all", { params: filters });
  return res.data;
};

// ADMIN: create/generate invoice
export const generateMaintenanceInvoice = async (invoiceData) => {
  const res = await api.post("/maintenance/generate", invoiceData);
  return res.data;
};

// ADMIN: mark invoice as paid
export const markInvoicePaid = async (id, body = {}) => {
  const res = await api.put(`/maintenance/${id}/mark-paid`, body);
  return res.data;
};

// RESIDENT: fetch maintenance invoices for a specific resident
export const fetchResidentMaintenance = async (residentId, filters = {}) => {
  if (!residentId) {
    throw new Error("residentId is required to fetch maintenance");
  }
  const res = await api.get(`/maintenance/resident/${residentId}`, {
    params: filters,
  });
  return res.data;
};