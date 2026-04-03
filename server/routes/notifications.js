// server/routes/notifications.js

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware"); // ← matches your server.js
const {
  getNotifications,
  getUnreadCountHandler,
  markOneAsRead,
  markAllRead,
  deleteOne,
} = require("../controllers/notificationController");

// All notification routes require login
router.use(authenticate);

// GET    /api/notifications                → paginated list
router.get("/", getNotifications);

// GET    /api/notifications/unread-count   → unread badge count
router.get("/unread-count", getUnreadCountHandler);

// PATCH  /api/notifications/read-all       → mark all as read
router.patch("/read-all", markAllRead);

// PATCH  /api/notifications/:id/read       → mark one as read
router.patch("/:id/read", markOneAsRead);

// DELETE /api/notifications/:id            → delete one
router.delete("/:id", deleteOne);

module.exports = router;