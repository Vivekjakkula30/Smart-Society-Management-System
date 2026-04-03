// controllers/notificationController.js

const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} = require("../utils/notificationService");

/**
 * GET /api/notifications
 * Fetch paginated notifications for logged-in user
 */
const getNotifications = async (req, res) => {
  try {
    const user_id = req.user.id;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await getUserNotifications(user_id, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("getNotifications:", err);
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
};

/**
 * GET /api/notifications/unread-count
 * Lightweight endpoint for the bell badge
 */
const getUnreadCountHandler = async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.id);
    res.json({ success: true, unread_count: count });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch unread count" });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark one notification as read
 */
const markOneAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await markAsRead(id, req.user.id);
    if (!updated) return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true, message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the user
 */
const markAllRead = async (req, res) => {
  try {
    await markAllAsRead(req.user.id);
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark all as read" });
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete a single notification
 */
const deleteOne = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteNotification(id, req.user.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
};

module.exports = {
  getNotifications,
  getUnreadCountHandler,
  markOneAsRead,
  markAllRead,
  deleteOne,
};