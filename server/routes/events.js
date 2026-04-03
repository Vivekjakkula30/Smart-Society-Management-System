// server/routes/events.js
const express = require("express");
const router = express.Router();
const db = require("../config/database"); // promise pool
const { authenticate, requireAdmin } = require("../middleware");

// ==================== TEST ROUTE ====================
router.get("/test", (req, res) => {
  console.log("✅ Events route test hit");
  res.json({ message: "Events route working" });
});

// ==================== GET ALL EVENTS ====================
// GET /api/events  (optionally ?scope=upcoming)
router.get("/", async (req, res) => {
  console.log("🔵 GET /api/events");

  try {
    const scope = req.query.scope || "all";

    let sql = `
      SELECT 
        id,
        title,
        description,
        location,
        event_date,
        start_time,
        end_time,
        created_by,
        created_at
      FROM events
    `;

    const params = [];

    if (scope === "upcoming") {
      sql += " WHERE event_date >= CURDATE()";
    }

    sql += " ORDER BY event_date ASC, start_time ASC";

    const [results] = await db.query(sql, params);

    console.log(`✅ Found ${results.length} events (scope=${scope})`);

    return res.json(results);
  } catch (err) {
    console.error("❌ Get events error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch events",
      error: err.message,
    });
  }
});

// ==================== CREATE EVENT (ADMIN) ====================
// POST /api/events
// body: { title, description, location, event_date, start_time, end_time, created_by }
router.post("/", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 POST /api/events");
  console.log("📦 Body:", req.body);

  try {
    const {
      title,
      description,
      location,
      event_date,
      start_time,
      end_time,
      created_by,
    } = req.body;

    if (!title || !event_date) {
      return res.status(400).json({
        success: false,
        message: "Title and event_date are required",
      });
    }

    const sql = `
      INSERT INTO events
        (title, description, location, event_date, start_time, end_time, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await db.query(sql, [
      title,
      description || null,
      location || null,
      event_date,
      start_time || null,
      end_time || null,
      created_by || null,
    ]);

    console.log("✅ Event created, id:", result.insertId);

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      eventId: result.insertId,
    });
  } catch (err) {
    console.error("❌ Create event error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create event",
      error: err.message,
    });
  }
});

// ==================== UPDATE EVENT (ADMIN) ====================
// PUT /api/events/:id
// body: { title, description, location, event_date, start_time, end_time }
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 PUT /api/events/:id");
  console.log("📦 Body:", req.body);

  try {
    const eventId = req.params.id;
    const {
      title,
      description,
      location,
      event_date,
      start_time,
      end_time,
    } = req.body;

    if (!title || !event_date) {
      return res.status(400).json({
        success: false,
        message: "Title and event_date are required",
      });
    }

    const sql = `
      UPDATE events
      SET
        title = ?,
        description = ?,
        location = ?,
        event_date = ?,
        start_time = ?,
        end_time = ?
      WHERE id = ?
    `;

    const [result] = await db.query(sql, [
      title,
      description || null,
      location || null,
      event_date,
      start_time || null,
      end_time || null,
      eventId,
    ]);

    console.log("✅ Event updated, affectedRows:", result.affectedRows);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.json({
      success: true,
      message: "Event updated successfully",
    });
  } catch (err) {
    console.error("❌ Update event error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update event",
      error: err.message,
    });
  }
});

// ==================== DELETE EVENT (ADMIN) ====================
// DELETE /api/events/:id
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  console.log("🔵 DELETE /api/events/:id");

  try {
    const eventId = req.params.id;

    const sql = `DELETE FROM events WHERE id = ?`;
    const [result] = await db.query(sql, [eventId]);

    console.log("✅ Event delete, affectedRows:", result.affectedRows);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (err) {
    console.error("❌ Delete event error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete event",
      error: err.message,
    });
  }
});

module.exports = router;
