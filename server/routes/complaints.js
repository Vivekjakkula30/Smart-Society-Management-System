// server/routes/complaints.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticate, requireAdmin, requireResident, requireOwnershipOrAdmin } = require("../middleware");

const ALLOWED_STATUSES = ["open", "in progress", "resolved", "closed"];

// ==================== NOTIFICATION HELPER ====================
const createComplaintNotification = async (residentId, complaintId, title, status) => {
  try {
    let notificationTitle, notificationMessage, notificationType;

    switch (status) {
      case "resolved":
        notificationTitle = "Complaint Resolved";
        notificationMessage = `Your complaint "${title}" has been resolved successfully.`;
        notificationType = "complaint_resolved";
        break;
      case "in progress":
        notificationTitle = "Complaint Update";
        notificationMessage = `Your complaint "${title}" is now being processed.`;
        notificationType = "complaint_updated";
        break;
      case "closed":
        notificationTitle = "Complaint Closed";
        notificationMessage = `Your complaint "${title}" has been closed.`;
        notificationType = "complaint_updated";
        break;
      default:
        return;
    }

    const sql = `
      INSERT INTO notifications
        (user_id, title, message, type, related_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, FALSE, NOW())
    `;
    const [result] = await db.query(sql, [
      residentId,
      notificationTitle,
      notificationMessage,
      notificationType,
      complaintId,
    ]);
    console.log(`📢 Notification created for complaint ${complaintId}: ${notificationType}`);
    return result.insertId;
  } catch (error) {
    console.error("❌ Failed to create complaint notification:", error);
  }
};

// ==================== TEST ROUTE ====================
router.get("/test", (req, res) => {
  console.log("✅ Complaints route test hit");
  res.json({ message: "Complaints route working" });
});

// ==================== SUBMIT COMPLAINT ====================
router.post("/submit", authenticate, requireResident, async (req, res) => {
  console.log("🔵 POST /api/complaints/submit received");
  try {
    const { title, description, category, priority } = req.body;
    const residentId = req.user.id;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: "title and description are required" });
    }

    const sql = `
      INSERT INTO complaints
        (resident_id, title, description, category, priority, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'open', NOW())
    `;
    const [result] = await db.query(sql, [
      residentId,
      title,
      description,
      category || "General",
      priority || "Medium",
    ]);

    return res.status(201).json({
      success: true,
      message: "Complaint created successfully",
      complaintId: result.insertId,
    });
  } catch (err) {
    console.error("❌ Submit error:", err);
    return res.status(500).json({ success: false, message: "Failed to create complaint", error: err.message });
  }
});

// ==================== GET RESIDENT COMPLAINTS ====================
router.get("/resident/:id", authenticate, requireOwnershipOrAdmin, async (req, res) => {
  try {
    const residentId = req.params.id;
    const sql = `
      SELECT
        id, resident_id, title, description, category, priority, status,
        created_at, resolved_at
      FROM complaints
      WHERE resident_id = ?
      ORDER BY created_at DESC
    `;
    const [results] = await db.query(sql, [residentId]);
    return res.json(results);
  } catch (err) {
    console.error("❌ Get complaints error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch complaints", error: err.message });
  }
});

// ==================== GET ALL COMPLAINTS (Admin) ====================
router.get("/all", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 GET /api/complaints/all");
  try {
    const sql = `
      SELECT
        c.id,
        c.resident_id,
        c.title,
        c.description,
        c.category,
        c.priority,
        c.status,
        c.created_at,
        c.resolved_at,
        u.full_name  AS resident_name,
        u.email      AS resident_email
      FROM complaints c
      LEFT JOIN users u ON c.resident_id = u.id
      ORDER BY
        FIELD(c.priority, 'Urgent', 'High', 'Medium', 'Low'),
        c.created_at DESC
    `;
    const [results] = await db.query(sql);
    console.log(`✅ Found ${results.length} total complaints`);
    return res.json(results);
  } catch (err) {
    console.error("❌ Get all complaints error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch all complaints", error: err.message });
  }
});

// ==================== UPDATE COMPLAINT STATUS (Admin) ====================
router.put("/:id/status", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 PUT /api/complaints/:id/status");
  try {
    const complaintId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const normalizedStatus = String(status).toLowerCase();

    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}`,
      });
    }

    const isResolved = normalizedStatus === "resolved" || normalizedStatus === "closed";

    // Save resolved_at when marking resolved/closed; clear it when moving back to open/in progress
    const updateSql = `
      UPDATE complaints
      SET status      = ?,
          resolved_at = ?
      WHERE id = ?
    `;
    const resolvedAt = isResolved ? new Date() : null;
    const [result] = await db.query(updateSql, [normalizedStatus, resolvedAt, complaintId]);

    console.log("✅ Complaint status updated, rows affected:", result.affectedRows);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    // Fetch updated row to return resolved_at back to the frontend
    const [rows] = await db.query(
      "SELECT id, status, resolved_at, created_at FROM complaints WHERE id = ?",
      [complaintId]
    );
    const updatedComplaint = rows[0] || null;

    // Create resident notification (non-fatal)
    try {
      const [complaintData] = await db.query(
        "SELECT resident_id, title FROM complaints WHERE id = ?",
        [complaintId]
      );
      if (complaintData.length > 0) {
        const { resident_id, title } = complaintData[0];
        await createComplaintNotification(resident_id, complaintId, title, normalizedStatus);
      }
    } catch (notificationError) {
      console.error("⚠️ Notification failed, but complaint was updated:", notificationError);
    }

    return res.json({
      success: true,
      message: "Complaint status updated successfully",
      complaint: updatedComplaint,
    });
  } catch (err) {
    console.error("❌ Update status error:", err);
    return res.status(500).json({ success: false, message: "Failed to update complaint status", error: err.message });
  }
});

// ==================== GET COMPLAINT STATS ====================
router.get("/stats", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 GET /api/complaints/stats");
  try {
    const sql = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'open'        THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN status = 'in progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status = 'resolved'    THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN status = 'closed'      THEN 1 ELSE 0 END) AS closed
      FROM complaints
    `;
    const [results] = await db.query(sql);
    return res.json(results[0]);
  } catch (err) {
    console.error("❌ Get stats error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch complaint stats", error: err.message });
  }
});

module.exports = router;