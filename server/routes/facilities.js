// server/routes/facilities.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticate, requireAdmin } = require("../middleware");

// TEST
router.get("/test", (req, res) => res.json({ message: "Facilities route working" }));

// GET ACTIVE FACILITIES (residents — public)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, description, location, capacity, available_from, available_to, booking_fee, is_active FROM facilities WHERE is_active=1 ORDER BY name ASC"
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch facilities", error: err.message });
  }
});

// ─── NEW: GET INACTIVE FACILITIES (authenticated residents + admins) ───────────
// Residents need this to display the "Unavailable" tab with the correct count
router.get("/inactive", authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, description, location, capacity, available_from, available_to,
              booking_fee, is_active
       FROM facilities
       WHERE is_active = 0
       ORDER BY name ASC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch inactive facilities", error: err.message });
  }
});

// GET ALL FACILITIES INCLUDING INACTIVE (Admin only)
router.get("/all", authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT *, (SELECT COUNT(*) FROM facility_bookings WHERE facility_id=facilities.id) AS total_bookings FROM facilities ORDER BY is_active DESC, name ASC"
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch facilities", error: err.message });
  }
});

// CREATE FACILITY (Admin)
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, location, capacity, available_from, available_to, booking_fee, is_active } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Facility name is required" });

    const [result] = await db.query(
      `INSERT INTO facilities (name, description, location, capacity, available_from, available_to, booking_fee, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        description || null,
        location || null,
        capacity || null,
        available_from || null,
        available_to || null,
        booking_fee || 0,
        is_active !== undefined ? is_active : 1,
      ]
    );
    return res.status(201).json({ message: "Facility created successfully", facilityId: result.insertId });
  } catch (err) {
    return res.status(500).json({ message: "Failed to create facility", error: err.message });
  }
});

// UPDATE FACILITY (Admin)
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, location, capacity, available_from, available_to, booking_fee } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Facility name is required" });

    const [result] = await db.query(
      `UPDATE facilities SET name=?, description=?, location=?, capacity=?, available_from=?, available_to=?, booking_fee=? WHERE id=?`,
      [name.trim(), description||null, location||null, capacity||null, available_from||null, available_to||null, booking_fee||0, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: "Facility not found" });
    return res.json({ message: "Facility updated successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update facility", error: err.message });
  }
});

// TOGGLE ACTIVE/INACTIVE (Admin)
router.patch("/:id/toggle-active", authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, is_active FROM facilities WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Facility not found" });

    const newStatus = rows[0].is_active ? 0 : 1;
    await db.query("UPDATE facilities SET is_active=? WHERE id=?", [newStatus, req.params.id]);
    return res.json({
      message: newStatus ? "Facility is now active" : "Facility has been removed",
      is_active: newStatus,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to toggle facility status", error: err.message });
  }
});

// DELETE FACILITY PERMANENTLY (Admin)
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const [bookingRows] = await db.query(
      "SELECT COUNT(*) AS cnt FROM facility_bookings WHERE facility_id=?",
      [req.params.id]
    );
    if (bookingRows[0].cnt > 0) {
      return res.status(400).json({
        message: "Cannot delete facility with existing bookings. Use 'Remove' to deactivate it instead.",
      });
    }
    const [result] = await db.query("DELETE FROM facilities WHERE id=?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Facility not found" });
    return res.json({ message: "Facility deleted permanently" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete facility", error: err.message });
  }
});

module.exports = router;