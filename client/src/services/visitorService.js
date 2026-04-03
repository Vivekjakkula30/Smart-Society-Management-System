// client/src/services/visitorService.js
import api from "./api";

// SECURITY: add visitor
export const addVisitorEntry = async (payload) => {
  const res = await api.post("/visitors/entry", payload);
  return res.data;
};

// SECURITY: get today's visitors
export const fetchTodayVisitors = async () => {
  const res = await api.get("/visitors/today");
  return res.data;
};

// SECURITY: mark exit
export const markVisitorExit = async (gateLogId) => {
  const res = await api.put(`/visitors/exit/${gateLogId}`);
  return res.data;
};

// RESIDENT: pending approvals
export const fetchPendingVisitors = async (residentId) => {
  const res = await api.get(`/visitors/pending/${residentId}`);
  return res.data;
};

// RESIDENT: approve/reject
export const decideVisitor = async (gateLogId, payload) => {
  const res = await api.put(`/visitors/decision/${gateLogId}`, payload);
  return res.data;
};
