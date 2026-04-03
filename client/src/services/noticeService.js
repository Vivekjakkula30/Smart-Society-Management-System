// client/src/services/noticeService.js
import api from "./api";

// Get notices (for residents or admins)
export const getNotices = async (audience, userId) => {
  const res = await api.get("/notices", {
    params: {
      audience: audience,
      user_id: userId
    }
  });

  return res.data;
};

// Create a new notice (Admin)
export const createNotice = async (payload) => {
  console.log("🔵 [noticeService] POST /notices", payload);
  try {
    const res = await api.post("/notices", payload);
    console.log("🟢 [noticeService] POST response:", res.data);
    return res.data;
  } catch (error) {
    console.error("🔴 [noticeService] POST error:", error.response?.data || error.message);
    throw error;
  }
};

// Update an existing notice (Admin)
export const updateNotice = async (id, payload) => {
  console.log("🔵 [noticeService] PUT /notices/" + id, payload);
  const res = await api.put(`/notices/${id}`, payload);
  console.log("🟢 [noticeService] PUT response:", res.data);
  return res.data;
};

// Delete a notice (Admin)
export const deleteNotice = async (id) => {
  console.log("🔵 [noticeService] DELETE /notices/" + id);
  const res = await api.delete(`/notices/${id}`);
  console.log("🟢 [noticeService] DELETE response:", res.data);
  return res.data;
};
