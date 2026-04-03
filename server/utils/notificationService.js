// server/utils/notificationService.js

const db = require("../config/database");

const createNotification = async ({ user_id, type, title, message, data = {} }) => {
  try {
    const [result] = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)`,
      [user_id, type, title, message, JSON.stringify(data)]
    );
    return result.insertId;
  } catch (err) {
    console.error("createNotification error:", err);
    return null;
  }
};

const createBulkNotifications = async (notifications) => {
  if (!notifications || notifications.length === 0) {
    console.log("⚠️ createBulkNotifications called with empty array — skipping");
    return;
  }
  try {
    console.log("📥 createBulkNotifications inserting", notifications.length, "rows");
    const values = notifications.map(n => [
      n.user_id,
      n.type,
      n.title,
      n.message,
      JSON.stringify(n.data || {}),
    ]);
    const [result] = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data) VALUES ?`,
      [values]
    );
    console.log("✅ Bulk insert done, affectedRows:", result.affectedRows);
  } catch (err) {
    console.error("❌ createBulkNotifications error:", err.message, err.sqlMessage || "");
  }
};

const notifyByRole = async ({ role, type, title, message, data = {} }) => {
  try {
    console.log("🔔 notifyByRole called — role:", role, "| type:", type);

    const [cols] = await db.query(`SHOW COLUMNS FROM users LIKE 'user_type'`);
    console.log("🔍 user_type column exists?", cols.length > 0 ? "YES" : "NO");

    const [users] = await db.query(
      `SELECT id, user_type FROM users WHERE user_type = ? AND is_active = 1`,
      [role]
    );
    console.log("👥 Users found for role", role, ":", JSON.stringify(users));

    if (!users.length) {
      console.log("⚠️ No users found for role:", role, "— no notifications created");
      return;
    }

    const notifications = users.map(u => ({ user_id: u.id, type, title, message, data }));
    await createBulkNotifications(notifications);
    console.log("✅ notifyByRole done for role:", role);
  } catch (err) {
    console.error("❌ notifyByRole error:", err.message, err.sqlMessage || "");
  }
};

const getUserNotifications = async (user_id, { page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;
  try {
    const [rows] = await db.query(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [user_id, limit, offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?`,
      [user_id]
    );
    const [[{ unread_count }]] = await db.query(
      `SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [user_id]
    );
    return {
      notifications: rows.map(n => ({
        ...n,
        data: typeof n.data === "string" ? JSON.parse(n.data) : n.data,
      })),
      unread_count,
      total,
      page,
      total_pages: Math.ceil(total / limit),
    };
  } catch (err) {
    console.error("getUserNotifications error:", err);
    throw err;
  }
};

const markAsRead = async (notification_id, user_id) => {
  try {
    const [result] = await db.query(
      `UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?`,
      [notification_id, user_id]
    );
    return result.affectedRows > 0;
  } catch (err) {
    console.error("markAsRead error:", err);
    throw err;
  }
};

const markAllAsRead = async (user_id) => {
  try {
    await db.query(
      `UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0`,
      [user_id]
    );
  } catch (err) {
    console.error("markAllAsRead error:", err);
    throw err;
  }
};

const deleteNotification = async (notification_id, user_id) => {
  try {
    const [result] = await db.query(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [notification_id, user_id]
    );
    return result.affectedRows > 0;
  } catch (err) {
    console.error("deleteNotification error:", err);
    throw err;
  }
};

const getUnreadCount = async (user_id) => {
  try {
    const [[{ count }]] = await db.query(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [user_id]
    );
    return count;
  } catch (err) {
    console.error("getUnreadCount error:", err);
    return 0;
  }
};

const notifyVisitorArrival = async ({ resident_user_id, visitor_name, purpose, gate_log_id }) => {
  return createNotification({
    user_id: resident_user_id,
    type: "visitor_request",
    title: "Visitor at Gate",
    message: `${visitor_name} is at the gate${purpose ? ` for "${purpose}"` : ""}. Please approve or reject.`,
    data: { gate_log_id, visitor_name, purpose },
  });
};

const notifyVisitorDecision = async ({ security_user_id, visitor_name, decision, gate_log_id }) => {
  const approved = decision === "approved";
  return createNotification({
    user_id: security_user_id,
    type: approved ? "visitor_approved" : "visitor_rejected",
    title: approved ? "Visitor Approved " : "Visitor Rejected ",
    message: `${visitor_name} has been ${decision} by the resident.`,
    data: { gate_log_id, visitor_name, decision },
  });
};

const notifyNewMaintenanceRequest = async ({ admin_user_ids = [], resident_name, category, complaint_id }) => {
  const notifications = admin_user_ids.map(user_id => ({
    user_id,
    type: "maintenance_new",
    title: "New Maintenance Request",
    message: `${resident_name} submitted a new ${category} maintenance request.`,
    data: { complaint_id, category, resident_name },
  }));
  return createBulkNotifications(notifications);
};

const notifyMaintenanceUpdate = async ({ resident_user_id, category, status, complaint_id }) => {
  const statusLabels = {
    in_progress: "is now In Progress ",
    resolved: "has been Resolved ",
    rejected: "was Rejected ",
    pending: "is Pending review",
  };
  return createNotification({
    user_id: resident_user_id,
    type: "maintenance_update",
    title: "Maintenance Request Updated",
    message: `Your ${category} request ${statusLabels[status] || `is now ${status}`}.`,
    data: { complaint_id, category, status },
  });
};

const notifyNewNotice = async ({ roles = ["resident"], resident_ids = [], notice_title, notice_id }) => {
  console.log(" notifyNewNotice called — roles:", roles, "| resident_ids:", resident_ids, "| title:", notice_title);

  // If specific resident IDs are provided, notify only those users
 if (resident_ids && resident_ids.length > 0) {
    // resident_ids contains residents.id — resolve to users.id
    const [residentRows] = await db.query(
      `SELECT user_id FROM residents WHERE id IN (?)`,
      [resident_ids]
    );
    const userIds = residentRows.map(r => r.user_id);
    const notifications = userIds.map(user_id => ({
      user_id,
      type: "notice",
      title: " New Notice",
      message: `A new notice has been posted: "${notice_title}". Tap to view.`,
      data: { notice_id, notice_title },
    }));
    await createBulkNotifications(notifications);
    console.log("✅ notifyNewNotice sent to specific residents:", resident_ids);
    return;
  }

  // Otherwise, notify by roles
  for (const role of roles) {
    await notifyByRole({
      role,
      type: "notice",
      title: " New Notice",
      message: `A new notice has been posted: "${notice_title}". Tap to view.`,
      data: { notice_id, notice_title },
    });
  }
};

const notifyPaymentReminder = async ({ resident_user_id, amount, due_date, payment_type, payment_id }) => {
  return createNotification({
    user_id: resident_user_id,
    type: "payment_reminder",
    title: " Payment Reminder",
    message: `Your ${payment_type} payment of ₹${amount} is due on ${due_date}.`,
    data: { payment_id, amount, due_date, payment_type },
  });
};

const notifyPaymentReceived = async ({ admin_user_ids = [], resident_name, amount, payment_type, payment_id }) => {
  const notifications = admin_user_ids.map(user_id => ({
    user_id,
    type: "payment_received",
    title: " Payment Received",
    message: `${resident_name} paid ₹${amount} for ${payment_type}.`,
    data: { payment_id, amount, resident_name, payment_type },
  }));
  return createBulkNotifications(notifications);
};

module.exports = {
  createNotification,
  createBulkNotifications,
  notifyByRole,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  notifyVisitorArrival,
  notifyVisitorDecision,
  notifyNewMaintenanceRequest,
  notifyMaintenanceUpdate,
  notifyNewNotice,
  notifyPaymentReminder,
  notifyPaymentReceived,
};