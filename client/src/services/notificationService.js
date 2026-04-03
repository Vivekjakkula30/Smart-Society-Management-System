// client/src/services/notificationService.js
import api from "./api"; 

export const fetchNotifications = async (page = 1, limit = 20) => {
  const res = await api.get(`/notifications?page=${page}&limit=${limit}`);
  return res.data;
};

export const fetchUnreadCount = async () => {
  const res = await api.get(`/notifications/unread-count`);
  return res.data.unread_count;
};

export const markNotificationRead = async (id) => {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data;
};

export const markAllNotificationsRead = async () => {
  const res = await api.patch(`/notifications/read-all`);
  return res.data;
};

export const deleteNotification = async (id) => {
  const res = await api.delete(`/notifications/${id}`);
  return res.data;
};