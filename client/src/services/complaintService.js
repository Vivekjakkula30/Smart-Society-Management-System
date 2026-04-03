// client/src/services/complaintService.js
import api from "./api";

export const fetchResidentComplaints = async (residentId) => {
  console.log("🔵 [complaintService] GET /complaints/resident/" + residentId);
  const res = await api.get(`/complaints/resident/${residentId}`);
  console.log("🟢 [complaintService] GET response:", res.data);
  return res.data;
};

export const submitComplaint = async (payload) => {
  console.log("🔵 [complaintService] POST /complaints/submit", payload);
  const res = await api.post("/complaints/submit", payload);
  console.log("🟢 [complaintService] POST response:", res.data);
  return res.data;
};

export const fetchAllComplaints = async () => {
  console.log("🔵 [complaintService] GET /complaints/all");
  const res = await api.get("/complaints/all");
  console.log("🟢 [complaintService] GET all response:", res.data);
  return res.data;
};

// Returns full response including complaint.resolved_at from server
export const updateComplaintStatus = async (complaintId, status) => {
  console.log("🟡 [complaintService] PUT /complaints/" + complaintId + "/status", { status });
  const res = await api.put(`/complaints/${complaintId}/status`, { status });
  console.log("🟢 [complaintService] PUT response:", res.data);
  return res.data;
};