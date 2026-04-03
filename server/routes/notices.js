// server/routes/notices.js
const express = require("express");
const router = express.Router();

const db = require("../config/database");
const { authenticate, requireAdmin } = require("../middleware");
const { notifyNewNotice } = require("../utils/notificationService");

const audienceToCategory = (audience) => {
  const map = {
    all: "general", residents: "general", residents_security: "general",
    specific_resident: "general", admins: "general", security: "security",
    event: "event", payment: "payment", maintenance: "maintenance",
  };
  return map[audience] || "general";
};

const audienceToNotificationRoles = (audience) => {
  switch (audience) {
    case "all":               return { roles: ["resident", "security", "admin"], useSpecificIds: false };
    case "residents_security":return { roles: ["resident", "security"], useSpecificIds: false };
    case "residents":         return { roles: ["resident"], useSpecificIds: false };
    case "security":          return { roles: ["security"], useSpecificIds: false };
    case "admins":            return { roles: ["admin"], useSpecificIds: false };
    case "specific_resident": return { roles: [], useSpecificIds: true };
    default:                  return { roles: ["resident"], useSpecificIds: false };
  }
};

router.get("/test", async (req, res) => {
  try {
    const [countResult] = await db.execute("SELECT COUNT(*) as count FROM notices");
    const [recent] = await db.execute(
      "SELECT id, title, category, audience_type, created_at FROM notices ORDER BY created_at DESC LIMIT 5"
    );
    res.json({ message: "Notices route working", totalNotices: countResult[0].count, recentNotices: recent });
  } catch (error) {
    res.status(500).json({ message: "Database error", error: error.message });
  }
});

// =============== GET NOTICES ===============
router.get("/", async (req, res) => {
  try {
    const audience = req.query.audience || "all";
    const isAdmin = audience === "all" || audience === "admins";

    let sql;
    let params = [];

    if (isAdmin) {
      sql = `
        SELECT n.id, n.title, n.content AS message, n.audience_type AS audience,
          n.category,
          CASE WHEN n.is_important = 1 THEN 'High' ELSE 'Low' END AS priority,
          n.created_at, n.valid_till,
          GROUP_CONCAT(nr.resident_id ORDER BY nr.resident_id ASC) AS specific_resident_ids_raw
        FROM notices n
        LEFT JOIN notice_recipients nr ON nr.notice_id = n.id
        GROUP BY n.id
        ORDER BY n.created_at DESC
      `;
    } else {
      // ✅ FIX: frontend sends users.id, but notice_recipients stores residents.id
      // We must resolve users.id → residents.id first
      const rawUserId = Number(req.query.user_id);
      const safeUserId = Number.isFinite(rawUserId) && rawUserId > 0 ? rawUserId : 0;

      let residentId = 0;
      if (safeUserId > 0) {
        const [rows] = await db.execute(
          "SELECT id FROM residents WHERE user_id = ? LIMIT 1",
          [safeUserId]
        );
        residentId = rows.length > 0 ? rows[0].id : 0;
      }

      console.log(`[notices] user_id=${safeUserId} → resident_id=${residentId}`);

      sql = `
        SELECT n.id, n.title, n.content AS message, n.audience_type AS audience,
          n.category,
          CASE WHEN n.is_important = 1 THEN 'High' ELSE 'Low' END AS priority,
          n.created_at, n.valid_till,
          GROUP_CONCAT(nr.resident_id ORDER BY nr.resident_id ASC) AS specific_resident_ids_raw
        FROM notices n
        LEFT JOIN notice_recipients nr ON nr.notice_id = n.id
        WHERE
          CASE
            WHEN n.audience_type = 'specific_resident' THEN
              CASE WHEN ? > 0 THEN
                EXISTS (
                  SELECT 1 FROM notice_recipients nr2
                  WHERE nr2.notice_id = n.id AND nr2.resident_id = ?
                )
              ELSE 0 END
            WHEN n.audience_type = 'all'                THEN 1
            WHEN n.audience_type = 'residents'          THEN 1
            WHEN n.audience_type = 'residents_security' THEN 1
            ELSE 0
          END = 1
        GROUP BY n.id
        ORDER BY n.created_at DESC
      `;
      params = [residentId, residentId]; // ← residentId, NOT userId
    }

    const [results] = await db.execute(sql, params);

    const formatted = results.map((row) => ({
      id: row.id, title: row.title, message: row.message,
      audience: row.audience || "all", category: row.category,
      priority: row.priority, created_at: row.created_at, valid_till: row.valid_till,
      specific_resident_ids: row.specific_resident_ids_raw
        ? String(row.specific_resident_ids_raw).split(",").map((id) => Number(id))
        : [],
    }));

    return res.json(formatted);
  } catch (err) {
    console.error("[notices] GET error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch notices", error: err.message });
  }
});

// =============== CREATE NOTICE (Admin) ===============
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, message, audience = "all", specific_resident_ids, priority = "Low", valid_till, created_by } = req.body;

    if (!title || !message)
      return res.status(400).json({ success: false, message: "Title and message are required." });

    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();

    if (trimmedTitle.length < 3 || trimmedTitle.length > 120)
      return res.status(400).json({ success: false, message: "Notice title must be between 3 and 120 characters." });

    if (trimmedMessage.length < 5 || trimmedMessage.length > 2000)
      return res.status(400).json({ success: false, message: "Notice message must be between 5 and 2000 characters." });

    if (audience === "specific_resident" && (!Array.isArray(specific_resident_ids) || specific_resident_ids.length === 0))
      return res.status(400).json({ success: false, message: "Please select at least one resident." });

    const category = audienceToCategory(audience);
    const isImportant = priority === "High" ? 1 : 0;
    const validTillVal = valid_till && valid_till.trim() !== "" ? valid_till.trim() : null;
    const postedBy = created_by || req.user?.id || null;

    const [result] = await db.execute(
      `INSERT INTO notices (title, content, category, audience_type, is_important, posted_by, valid_till, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [trimmedTitle, trimmedMessage, category, audience, isImportant, postedBy, validTillVal]
    );

    const noticeId = result.insertId;

    if (audience === "specific_resident" && Array.isArray(specific_resident_ids) && specific_resident_ids.length > 0) {
      const rows = specific_resident_ids.map((rid) => [noticeId, Number(rid)]);
      await db.query("INSERT INTO notice_recipients (notice_id, resident_id) VALUES ?", [rows]);
    }

    try {
      const { roles, useSpecificIds } = audienceToNotificationRoles(audience);
      if (useSpecificIds && Array.isArray(specific_resident_ids) && specific_resident_ids.length > 0) {
        await notifyNewNotice({ roles: [], resident_ids: specific_resident_ids, notice_title: trimmedTitle, notice_id: noticeId });
        console.log(`📢 Notice #${noticeId} sent to specific residents: ${specific_resident_ids.join(", ")}`);
      } else if (roles.length > 0) {
        await notifyNewNotice({ roles, notice_title: trimmedTitle, notice_id: noticeId });
        console.log(`📢 Notice #${noticeId} sent to roles: ${roles.join(", ")}`);
      }
    } catch (notifErr) {
      console.error("⚠️ Notification failed (notice still created):", notifErr.message);
    }

    return res.status(201).json({ success: true, message: "Notice created successfully", noticeId });
  } catch (err) {
    console.error("[notices] POST error:", err);
    return res.status(500).json({ success: false, message: "Failed to create notice", error: err.message, sqlError: err.sqlMessage || null });
  }
});

// =============== UPDATE NOTICE (Admin) ===============
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const noticeId = Number(req.params.id);
    const { title, message, audience = "all", specific_resident_ids, priority = "Low", valid_till } = req.body;

    if (!title || !message)
      return res.status(400).json({ success: false, message: "Title and message are required." });

    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();

    if (trimmedTitle.length < 3 || trimmedTitle.length > 120)
      return res.status(400).json({ success: false, message: "Notice title must be between 3 and 120 characters." });

    if (trimmedMessage.length < 5 || trimmedMessage.length > 2000)
      return res.status(400).json({ success: false, message: "Notice message must be between 5 and 2000 characters." });

    if (audience === "specific_resident" && (!Array.isArray(specific_resident_ids) || specific_resident_ids.length === 0))
      return res.status(400).json({ success: false, message: "Please select at least one resident." });

    const category = audienceToCategory(audience);
    const isImportant = priority === "High" ? 1 : 0;
    const validTillVal = valid_till && valid_till.trim() !== "" ? valid_till.trim() : null;

    const [result] = await db.execute(
      `UPDATE notices SET title = ?, content = ?, category = ?, audience_type = ?, is_important = ?, valid_till = ? WHERE id = ?`,
      [trimmedTitle, trimmedMessage, category, audience, isImportant, validTillVal, noticeId]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: "Notice not found." });

    await db.execute("DELETE FROM notice_recipients WHERE notice_id = ?", [noticeId]);

    if (audience === "specific_resident" && Array.isArray(specific_resident_ids) && specific_resident_ids.length > 0) {
      const rows = specific_resident_ids.map((rid) => [noticeId, Number(rid)]);
      await db.query("INSERT INTO notice_recipients (notice_id, resident_id) VALUES ?", [rows]);
    }

    return res.json({ success: true, message: "Notice updated successfully" });
  } catch (err) {
    console.error("[notices] PUT error:", err);
    return res.status(500).json({ success: false, message: "Failed to update notice", error: err.message });
  }
});

// =============== DELETE NOTICE (Admin) ===============
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const noticeId = Number(req.params.id);
    await db.execute("DELETE FROM notice_recipients WHERE notice_id = ?", [noticeId]);
    const [result] = await db.execute("DELETE FROM notices WHERE id = ?", [noticeId]);
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: "Notice not found." });
    return res.json({ success: true, message: "Notice deleted successfully" });
  } catch (err) {
    console.error("[notices] DELETE error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete notice", error: err.message });
  }
});

module.exports = router;
