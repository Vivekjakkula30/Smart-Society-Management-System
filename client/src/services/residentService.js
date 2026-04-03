// client/src/services/residentService.js
import api from "./api";

// Get all residents (Admin only) — GET /api/residents
export const fetchAllResidents = async () => {
  console.log("🔵 [residentService] GET /residents");
  const res = await api.get("/residents");
  console.log("🟢 [residentService] response:", res.data);
  return res.data;
};

// Get residents list (Admin + Security) — used in dropdowns
export const fetchResidentsList = async () => {
  console.log("🔵 [residentService] GET /residents/list");
  const res = await api.get("/residents/list");
  return res.data;
};

// Get single resident
export const fetchResident = async (id) => {
  const res = await api.get(`/residents/${id}`);
  return res.data;
};

// Create new resident (Admin only)
export const createResident = async (payload) => {
  const res = await api.post("/residents", payload);
  return res.data;
};

// Update resident (Admin only)
export const updateResident = async (id, payload) => {
  const res = await api.put(`/residents/${id}`, payload);
  return res.data;
};

// Delete resident (Admin only)
export const deleteResident = async (id) => {
  const res = await api.delete(`/residents/${id}`);
  return res.data;
};

// Deactivate resident — PATCH /api/residents/:id/deactivate
export const deactivateResident = async (id) => {
  const res = await api.patch(`/residents/${id}/deactivate`);
  return res.data;
};

// Restore resident — PATCH /api/residents/:id/activate
export const activateResident = async (id) => {
  const res = await api.patch(`/residents/${id}/activate`);
  return res.data;
};